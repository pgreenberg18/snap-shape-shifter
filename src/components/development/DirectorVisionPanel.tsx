import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilmId, useFilm } from "@/hooks/useFilm";
import {
  DIRECTORS,
  STYLE_AXES,
  STYLE_AXIS_LABELS,
  CLUSTER_LABELS,
  QUADRANT_LABELS,
  blendVectors,
  styleDistance,
  nearestDirectors,
  vectorToQuadrant,
  emotionTier,
  type DirectorProfile,
  type StyleVector,
  type ClusterId,
  type QuadrantId,
} from "@/lib/director-styles";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Eye, Check, Blend, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ── Cluster color map ── */
const CLUSTER_COLORS: Record<ClusterId, string> = {
  "operatic-mythmakers": "hsl(40, 90%, 55%)",
  "epic-formalists": "hsl(210, 70%, 55%)",
  "stylized-auteurs": "hsl(280, 60%, 60%)",
  "gritty-realists": "hsl(15, 70%, 50%)",
  "tonal-alchemists": "hsl(160, 60%, 45%)",
  "intimate-humanists": "hsl(340, 60%, 55%)",
  "world-architects": "hsl(120, 50%, 45%)",
  "genre-provocateurs": "hsl(0, 70%, 55%)",
  "new-wave-architects": "hsl(190, 70%, 50%)",
};

/* ── Helpers ── */
function directorToXY(d: DirectorProfile): { x: number; y: number } {
  const x = (d.vector.scale + d.vector.spectacle) / 2;
  const y = (d.vector.structure + d.vector.genreFluidity) / 2;
  return { x, y };
}

function vectorToXY(v: StyleVector): { x: number; y: number } {
  return { x: (v.scale + v.spectacle) / 2, y: (v.structure + v.genreFluidity) / 2 };
}

/** Genre-aware scoring: boost directors whose knownFor overlaps with film genres */
function genreAwareDistance(
  target: StyleVector,
  director: DirectorProfile,
  filmGenres: string[],
): number {
  const baseDist = styleDistance(target, director.vector);
  if (!filmGenres.length) return baseDist;
  const overlap = director.knownFor.filter((g) =>
    filmGenres.some((fg) => fg.toLowerCase() === g.toLowerCase())
  ).length;
  // Each genre match reduces distance by 15%
  const genreBonus = overlap * 0.15;
  return baseDist * Math.max(0.4, 1 - genreBonus);
}

/* ── Hook: fetch director profile ── */
const useDirectorProfile = (filmId: string | undefined) =>
  useQuery({
    queryKey: ["director-profile", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("film_director_profiles")
        .select("*")
        .eq("film_id", filmId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });

/* ── Hook: fetch film genres ── */
const useFilmGenres = (filmId: string | undefined) =>
  useQuery({
    queryKey: ["film-genres", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("films")
        .select("genres")
        .eq("id", filmId!)
        .single();
      if (error) throw error;
      return (data?.genres as string[]) || [];
    },
    enabled: !!filmId,
  });

/* ── Component ── */
const DirectorVisionPanel = ({ disabled }: { disabled?: boolean }) => {
  const filmId = useFilmId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: film } = useFilm();
  const { data: profile, isLoading: profileLoading } = useDirectorProfile(filmId);
  const { data: filmGenres = [] } = useFilmGenres(filmId);
  const filmTitle = film?.title || "YOUR FILM";

  const [hoveredDirector, setHoveredDirector] = useState<string | null>(null);
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<string | null>(null);
  const [blendWeight, setBlendWeight] = useState(70);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Sync from DB profile
  const primaryId = selectedPrimary || profile?.primary_director_id || null;
  const secondaryId = selectedSecondary || profile?.secondary_director_id || null;
  const primaryDirector = DIRECTORS.find((d) => d.id === primaryId);
  const secondaryDirector = DIRECTORS.find((d) => d.id === secondaryId);

  const scriptVector = profile?.computed_vector as unknown as StyleVector | null;

  // Genre-aware top matches
  const topMatches = useMemo(() => {
    if (!scriptVector) return [];
    return DIRECTORS
      .map((d) => ({ director: d, distance: genreAwareDistance(scriptVector, d, filmGenres) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [scriptVector, filmGenres]);

  const topMatchIds = useMemo(() => new Set(topMatches.slice(0, 3).map((m) => m.director.id)), [topMatches]);

  // Blended vector
  const blendedVector = useMemo(() => {
    if (!primaryDirector) return null;
    if (!secondaryDirector) return primaryDirector.vector;
    return blendVectors(primaryDirector.vector, secondaryDirector.vector, blendWeight / 100);
  }, [primaryDirector, secondaryDirector, blendWeight]);

  // Filtered directors for manual search
  const filteredDirectors = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return DIRECTORS.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.knownFor.some((g) => g.toLowerCase().includes(q)) ||
        CLUSTER_LABELS[d.cluster].toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Run analysis
  const handleAnalyze = useCallback(async () => {
    if (!filmId) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-director-fit", {
        body: { film_id: filmId, save: true },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["director-profile", filmId] });
      toast({ title: "Director analysis complete", description: `Top match: ${data.matches[0]?.director_name}` });
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [filmId, queryClient, toast]);

  // Save selection
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!filmId || !primaryDirector) return;
      const vec = blendedVector || primaryDirector.vector;
      const profileData: any = {
        film_id: filmId,
        primary_director_id: primaryDirector.id,
        primary_director_name: primaryDirector.name,
        secondary_director_id: secondaryDirector?.id || null,
        secondary_director_name: secondaryDirector?.name || null,
        blend_weight: blendWeight / 100,
        computed_vector: scriptVector || vec,
        quadrant: vectorToQuadrant(vec),
        cluster: primaryDirector.cluster,
        emotional_depth: emotionTier(vec.emotion),
        auto_matched: false,
        match_distance: scriptVector ? styleDistance(scriptVector, vec) : null,
        visual_mandate: primaryDirector.visualMandate,
        updated_at: new Date().toISOString(),
      };

      if (profile?.id) {
        const { error } = await supabase.from("film_director_profiles").update(profileData).eq("id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("film_director_profiles").insert(profileData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["director-profile", filmId] });
      toast({ title: "Director vision saved" });
    },
  });

  // Tighter constellation — reduced padding, more usable space
  const MAP_W = 600;
  const MAP_H = 380;
  const PAD = 36;

  // Pan & zoom state — start zoomed in ~3x, centered
  const [mapZoom, setMapZoom] = useState(3);
  const [mapPan, setMapPan] = useState({ x: MAP_W / 2 - (MAP_W / 3) / 2, y: MAP_H / 2 - (MAP_H / 3) / 2 });
  const mapDragging = useRef(false);
  const mapDragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const vbW = MAP_W / mapZoom;
  const vbH = MAP_H / mapZoom;
  const vbX = Math.max(0, Math.min(mapPan.x, MAP_W - vbW));
  const vbY = Math.max(0, Math.min(mapPan.y, MAP_H - vbH));

  const handleMapWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setMapZoom((prev) => {
      const next = Math.max(1, Math.min(5, prev - e.deltaY * 0.002));
      return next;
    });
  }, []);

  const handleMapPointerDown = useCallback((e: React.PointerEvent) => {
    // Don't start pan if clicking a director node
    if ((e.target as HTMLElement).closest("[data-director-node]")) return;
    mapDragging.current = true;
    mapDragStart.current = { x: e.clientX, y: e.clientY, panX: mapPan.x, panY: mapPan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [mapPan]);

  const handleMapPointerMove = useCallback((e: React.PointerEvent) => {
    if (!mapDragging.current) return;
    const svgEl = e.currentTarget as SVGSVGElement;
    const rect = svgEl.getBoundingClientRect();
    const scaleX = (MAP_W / mapZoom) / rect.width;
    const scaleY = (MAP_H / mapZoom) / rect.height;
    const dx = (e.clientX - mapDragStart.current.x) * scaleX;
    const dy = (e.clientY - mapDragStart.current.y) * scaleY;
    setMapPan({
      x: mapDragStart.current.panX - dx,
      y: mapDragStart.current.panY - dy,
    });
  }, [mapZoom]);

  const handleMapPointerUp = useCallback(() => {
    mapDragging.current = false;
  }, []);

  const toScreen = (x: number, y: number) => ({
    sx: PAD + ((x / 10) * (MAP_W - PAD * 2)),
    sy: MAP_H - PAD - ((y / 10) * (MAP_H - PAD * 2)),
  });

  const handleNodeClick = (d: DirectorProfile) => {
    if (disabled) return;
    if (!primaryId || primaryId === d.id) {
      setSelectedPrimary(d.id);
      return;
    }
    if (!secondaryId || secondaryId === d.id) {
      setSelectedSecondary(d.id === secondaryId ? null : d.id);
      return;
    }
    setSelectedSecondary(d.id);
  };

  const handleManualSelect = (directorId: string, role: "primary" | "secondary") => {
    if (disabled) return;
    if (role === "primary") {
      setSelectedPrimary(directorId);
      if (secondaryId === directorId) setSelectedSecondary(null);
    } else {
      setSelectedSecondary(directorId);
      if (primaryId === directorId) setSelectedPrimary(null);
    }
    setSearchQuery("");
  };

  const hovered = hoveredDirector ? DIRECTORS.find((d) => d.id === hoveredDirector) : null;

  /** Genre overlap badges */
  const GenreTags = ({ genres }: { genres: string[] }) => {
    if (!genres.length) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {genres.map((g) => {
          const isMatch = filmGenres.some((fg) => fg.toLowerCase() === g.toLowerCase());
          return (
            <span
              key={g}
              className={cn(
                "text-[8px] px-1.5 py-0.5 rounded-full border font-medium",
                isMatch
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-secondary/50 text-muted-foreground border-border"
              )}
            >
              {g}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Analyze button if no profile */}
      {!profile && !analyzing && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Run the neural style engine to match your script to directorial visions.
          </p>
          <Button onClick={handleAnalyze} disabled={disabled || analyzing} className="gap-2" size="sm">
            <Sparkles className="h-4 w-4" /> Analyze Style
          </Button>
        </div>
      )}

      {analyzing && (
        <div className="flex items-center gap-3 py-6 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Analyzing directorial fit…</span>
        </div>
      )}

      {/* Manual Director Search — always visible */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Manual Director Selection</span>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-[9px] uppercase tracking-wider text-primary font-bold">Primary</label>
            <Select
              value={primaryId || ""}
              onValueChange={(v) => handleManualSelect(v, "primary")}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Select primary director…" />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                  {[...DIRECTORS].sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-muted-foreground ml-1.5">— {d.knownFor.join(", ")}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Secondary</label>
            <Select
              value={secondaryId || ""}
              onValueChange={(v) => handleManualSelect(v, "secondary")}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Select secondary…" />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                  {[...DIRECTORS].filter((d) => d.id !== primaryId).sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-muted-foreground ml-1.5">— {d.knownFor.join(", ")}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Film genre context */}
        {filmGenres.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider shrink-0">Your genres:</span>
            <div className="flex flex-wrap gap-1">
              {filmGenres.map((g) => (
                <span key={g} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Constellation Map */}
      {(profile || scriptVector) && (
        <>
          <div className="rounded-lg border border-border bg-background/50 overflow-hidden relative">
            {/* Axis labels outside the SVG frame */}
            <div className="text-center text-[9px] text-muted-foreground/60 py-1 select-none">Intimacy ← → Spectacle</div>
            <div className="flex">
              <div className="flex items-center justify-center shrink-0 w-5 select-none">
                <span className="text-[9px] text-muted-foreground/60 whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Classical ← → Experimental</span>
              </div>
              <div className="flex-1">
            <svg
              viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
              className="w-full h-auto select-none"
              style={{ maxHeight: 380, cursor: mapDragging.current ? "grabbing" : "grab" }}
              onWheel={handleMapWheel}
              onPointerDown={handleMapPointerDown}
              onPointerMove={handleMapPointerMove}
              onPointerUp={handleMapPointerUp}
            >
              {/* Grid lines */}
              {[2.5, 5, 7.5].map((v) => {
                const { sx } = toScreen(v, 0);
                const { sy } = toScreen(0, v);
                return (
                  <g key={v}>
                    <line x1={sx} y1={PAD} x2={sx} y2={MAP_H - PAD} stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.4" />
                    <line x1={PAD} y1={sy} x2={MAP_W - PAD} y2={sy} stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.4" />
                  </g>
                );
              })}

              {/* Quadrant labels */}
              <text x={PAD + 6} y={PAD + 12} fill="hsl(var(--muted-foreground))" fontSize="8" opacity="0.5" fontFamily="var(--font-display)">INTIMATE + EXPERIMENTAL</text>
              <text x={MAP_W - PAD - 6} y={PAD + 12} fill="hsl(var(--muted-foreground))" fontSize="8" opacity="0.5" textAnchor="end" fontFamily="var(--font-display)">EPIC + EXPERIMENTAL</text>
              <text x={PAD + 6} y={MAP_H - PAD - 6} fill="hsl(var(--muted-foreground))" fontSize="8" opacity="0.5" fontFamily="var(--font-display)">INTIMATE + CLASSICAL</text>
              <text x={MAP_W - PAD - 6} y={MAP_H - PAD - 6} fill="hsl(var(--muted-foreground))" fontSize="8" opacity="0.5" textAnchor="end" fontFamily="var(--font-display)">EPIC + CLASSICAL</text>

              {/* Blend line between primary and secondary */}
              {primaryDirector && secondaryDirector && (() => {
                const p1 = directorToXY(primaryDirector);
                const p2 = directorToXY(secondaryDirector);
                const s1 = toScreen(p1.x, p1.y);
                const s2 = toScreen(p2.x, p2.y);
                return (
                  <line x1={s1.sx} y1={s1.sy} x2={s2.sx} y2={s2.sy} stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.3" strokeDasharray="4 4" />
                );
              })()}

              {/* Director nodes */}
              {DIRECTORS.map((d) => {
                const { x, y } = directorToXY(d);
                const { sx, sy } = toScreen(x, y);
                const isTop3 = topMatchIds.has(d.id);
                const isPrimary = d.id === primaryId;
                const isSecondary = d.id === secondaryId;
                const isHovered = d.id === hoveredDirector;
                const rank = topMatches.findIndex((m) => m.director.id === d.id);
                const clusterColor = CLUSTER_COLORS[d.cluster];
                const hasGenreOverlap = filmGenres.length > 0 && d.knownFor.some((g) =>
                  filmGenres.some((fg) => fg.toLowerCase() === g.toLowerCase())
                );
                const r = isPrimary ? 9 : isSecondary ? 7 : isTop3 ? 6 : hasGenreOverlap ? 5 : 4;

                return (
                  <g
                    key={d.id}
                    data-director-node
                    className="cursor-pointer transition-opacity"
                    opacity={isHovered || isPrimary || isSecondary || isTop3 ? 1 : hasGenreOverlap ? 0.7 : 0.35}
                    onMouseEnter={() => setHoveredDirector(d.id)}
                    onMouseLeave={() => setHoveredDirector(null)}
                    onClick={() => handleNodeClick(d)}
                  >
                    {/* Glow ring for selected */}
                    {(isPrimary || isSecondary) && (
                      <circle cx={sx} cy={sy} r={r + 4} fill="none" stroke={isPrimary ? "hsl(var(--primary))" : "hsl(var(--ring))"} strokeWidth="1.5" opacity="0.5">
                        <animate attributeName="r" values={`${r + 3};${r + 6};${r + 3}`} dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Top-3 ring */}
                    {isTop3 && !isPrimary && !isSecondary && (
                      <circle cx={sx} cy={sy} r={r + 3} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.4" strokeDasharray="2 2" />
                    )}

                    {/* Node circle */}
                    <circle
                      cx={sx} cy={sy} r={r}
                      fill={isPrimary || isSecondary ? "hsl(var(--primary))" : clusterColor}
                      stroke={isHovered ? "hsl(var(--foreground))" : "none"}
                      strokeWidth={isHovered ? 1.5 : 0}
                    />

                    {/* Name label — show for hovered, selected, and top matches */}
                    {(isHovered || isPrimary || isSecondary || isTop3) && (
                      <text
                        x={sx}
                        y={sy - r - 4}
                        fill={isPrimary || isSecondary ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                        fontSize={isPrimary || isSecondary ? "9" : "8"}
                        textAnchor="middle"
                        fontWeight={isPrimary || isSecondary ? "700" : "500"}
                        fontFamily="var(--font-display)"
                      >
                        {d.name.split(" ").pop()}
                      </text>
                    )}

                    {/* Rank badge */}
                    {rank >= 0 && rank < 3 && !isPrimary && !isSecondary && (
                      <text x={sx + r + 2} y={sy + 3} fill="hsl(var(--primary))" fontSize="7" fontWeight="bold">#{rank + 1}</text>
                    )}
                  </g>
                );
              })}

              {/* Script vector marker */}
              {scriptVector && (() => {
                const sv = vectorToXY(scriptVector);
                const center = toScreen(5, 5);
                return (
                  <g>
                    <line x1={center.sx - 7} y1={center.sy} x2={center.sx + 7} y2={center.sy} stroke="hsl(var(--destructive))" strokeWidth="2" />
                    <line x1={center.sx} y1={center.sy - 7} x2={center.sx} y2={center.sy + 7} stroke="hsl(var(--destructive))" strokeWidth="2" />
                    <text x={center.sx} y={center.sy - 10} fill="hsl(var(--destructive))" fontSize="8" fontWeight="bold" fontFamily="var(--font-display)" textAnchor="middle">{filmTitle.toUpperCase()}</text>
                  </g>
                );
              })()}

              {/* Blended position marker */}
              {blendedVector && primaryDirector && secondaryDirector && (() => {
                const { x, y } = vectorToXY(blendedVector);
                const { sx, sy } = toScreen(x, y);
                return (
                  <g>
                    <circle cx={sx} cy={sy} r={5} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
                    <circle cx={sx} cy={sy} r={2} fill="hsl(var(--primary))" />
                    <text x={sx + 8} y={sy + 3} fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="var(--font-display)">BLEND</text>
                  </g>
                );
              })()}
            </svg>
              </div>
            </div>
            {/* Zoom controls */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <button
                onClick={() => setMapZoom((z) => Math.min(5, z + 0.5))}
                className="h-6 w-6 rounded bg-card/80 border border-border text-xs text-muted-foreground hover:text-foreground flex items-center justify-center"
              >+</button>
              <button
                onClick={() => setMapZoom((z) => Math.max(1, z - 0.5))}
                className="h-6 w-6 rounded bg-card/80 border border-border text-xs text-muted-foreground hover:text-foreground flex items-center justify-center"
              >−</button>
              <button
                onClick={() => { setMapZoom(1); setMapPan({ x: 0, y: 0 }); }}
                className="h-6 px-1.5 rounded bg-card/80 border border-border text-[9px] text-muted-foreground hover:text-foreground flex items-center justify-center"
              >Fit</button>
            </div>
          </div>

          {/* Cluster legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
            {(Object.entries(CLUSTER_LABELS) as [ClusterId, string][]).map(([id, label]) => (
              <div key={id} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CLUSTER_COLORS[id] }} />
                <span className="text-[9px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {/* Hovered director detail */}
          {hovered && (
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-display font-bold text-foreground">{hovered.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  {CLUSTER_LABELS[hovered.cluster]}
                </span>
              </div>
              <GenreTags genres={hovered.knownFor} />
              <div className="grid grid-cols-4 gap-2">
                {STYLE_AXES.map((axis) => (
                  <div key={axis} className="space-y-0.5">
                    <span className="text-[9px] text-muted-foreground uppercase">{STYLE_AXIS_LABELS[axis]}</span>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${hovered.vector[axis] * 10}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground italic">"{hovered.visualMandate.lighting}"</p>
            </div>
          )}

          {/* Selection panel */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Director Selection</span>
            </div>

            {/* Top matches with genre info */}
            {topMatches.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  AI Recommendations {filmGenres.length > 0 && <span className="text-primary/70 normal-case">· genre-weighted</span>}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {topMatches.slice(0, 3).map((m, i) => (
                    <button
                      key={m.director.id}
                      onClick={() => {
                        if (disabled) return;
                        if (i === 0) {
                          setSelectedPrimary(m.director.id);
                        } else {
                          setSelectedSecondary(m.director.id);
                        }
                      }}
                      disabled={disabled}
                      className={cn(
                        "rounded-lg border p-2.5 text-left transition-all hover:border-primary/50",
                        (m.director.id === primaryId || m.director.id === secondaryId)
                          ? "border-primary bg-primary/5"
                          : "border-border bg-secondary/30",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold" style={{ backgroundColor: CLUSTER_COLORS[m.director.cluster], color: "#fff" }}>
                          {i + 1}
                        </span>
                        <span className="text-xs font-display font-bold text-foreground truncate">{m.director.name}</span>
                      </div>
                      <GenreTags genres={m.director.knownFor} />
                      <p className="text-[9px] text-muted-foreground/60 mt-1">Distance: {m.distance.toFixed(2)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Primary / Secondary display */}
            <div className="grid grid-cols-2 gap-3">
              <div className={cn("rounded-lg border p-3 space-y-1.5", primaryDirector ? "border-primary/40 bg-primary/5" : "border-border border-dashed")}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Primary</span>
                {primaryDirector ? (
                  <>
                    <p className="text-sm font-display font-bold text-foreground">{primaryDirector.name}</p>
                    <GenreTags genres={primaryDirector.knownFor} />
                    <p className="text-[10px] text-muted-foreground">{primaryDirector.visualMandate.lighting.split(";")[0]}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Click a director or use dropdown above</p>
                )}
              </div>
              <div className={cn("rounded-lg border p-3 space-y-1.5", secondaryDirector ? "border-border bg-secondary/30" : "border-border border-dashed")}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Secondary</span>
                {secondaryDirector ? (
                  <>
                    <p className="text-sm font-display font-bold text-foreground">{secondaryDirector.name}</p>
                    <GenreTags genres={secondaryDirector.knownFor} />
                    <p className="text-[10px] text-muted-foreground">{secondaryDirector.visualMandate.lighting.split(";")[0]}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Click another director to blend</p>
                )}
              </div>
            </div>

            {/* Blend slider */}
            {primaryDirector && secondaryDirector && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Blend className="h-3 w-3" /> Blend Ratio
                  </span>
                  <span className="text-[10px] font-mono text-foreground">
                    {blendWeight}% / {100 - blendWeight}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-primary font-bold truncate w-20 text-right">{primaryDirector.name.split(" ").pop()}</span>
                  <Slider
                    className="fader-slider flex-1"
                    value={[blendWeight]}
                    onValueChange={([v]) => setBlendWeight(v)}
                    min={10}
                    max={90}
                    step={5}
                    disabled={disabled}
                  />
                  <span className="text-[9px] text-muted-foreground font-bold truncate w-20">{secondaryDirector.name.split(" ").pop()}</span>
                </div>

                {/* Blended 8-axis radar preview */}
                {blendedVector && (
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    {STYLE_AXES.map((axis) => (
                      <div key={axis} className="space-y-0.5">
                        <span className="text-[8px] text-muted-foreground uppercase">{STYLE_AXIS_LABELS[axis]}</span>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-primary/70 transition-all duration-300" style={{ width: `${blendedVector[axis] * 10}%` }} />
                        </div>
                        <span className="text-[8px] text-muted-foreground/60 tabular-nums">{blendedVector[axis]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save + Re-analyze buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={disabled || !primaryDirector || saveMutation.isPending}
                className="gap-1.5 flex-1"
                size="sm"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirm Vision
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={disabled || analyzing}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Re-analyze
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DirectorVisionPanel;
