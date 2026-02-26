import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilmId } from "@/hooks/useFilm";
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
import { Loader2, Sparkles, Eye, Check, Blend } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  // X = Intimacy ↔ Spectacle (scale + spectacle) / 2
  // Y = Classical ↔ Experimental (structure + genreFluidity) / 2
  const x = (d.vector.scale + d.vector.spectacle) / 2;
  const y = (d.vector.structure + d.vector.genreFluidity) / 2;
  return { x, y };
}

function vectorToXY(v: StyleVector): { x: number; y: number } {
  return { x: (v.scale + v.spectacle) / 2, y: (v.structure + v.genreFluidity) / 2 };
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

/* ── Component ── */
const DirectorVisionPanel = ({ disabled }: { disabled?: boolean }) => {
  const filmId = useFilmId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: profile, isLoading: profileLoading } = useDirectorProfile(filmId);

  const [hoveredDirector, setHoveredDirector] = useState<string | null>(null);
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<string | null>(null);
  const [blendWeight, setBlendWeight] = useState(70); // 70% primary
  const [analyzing, setAnalyzing] = useState(false);

  // Sync from DB profile
  const primaryId = selectedPrimary || profile?.primary_director_id || null;
  const secondaryId = selectedSecondary || profile?.secondary_director_id || null;
  const primaryDirector = DIRECTORS.find((d) => d.id === primaryId);
  const secondaryDirector = DIRECTORS.find((d) => d.id === secondaryId);

  const scriptVector = profile?.computed_vector as unknown as StyleVector | null;

  // Top 3 matches from script vector
  const topMatches = useMemo(() => {
    if (!scriptVector) return [];
    return nearestDirectors(scriptVector, 5);
  }, [scriptVector]);

  const topMatchIds = useMemo(() => new Set(topMatches.slice(0, 3).map((m) => m.director.id)), [topMatches]);

  // Blended vector
  const blendedVector = useMemo(() => {
    if (!primaryDirector) return null;
    if (!secondaryDirector) return primaryDirector.vector;
    return blendVectors(primaryDirector.vector, secondaryDirector.vector, blendWeight / 100);
  }, [primaryDirector, secondaryDirector, blendWeight]);

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

  // Constellation dimensions
  const MAP_W = 720;
  const MAP_H = 420;
  const PAD = 50;

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
    // If both set, replace secondary
    setSelectedSecondary(d.id);
  };

  const hovered = hoveredDirector ? DIRECTORS.find((d) => d.id === hoveredDirector) : null;

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

      {/* Constellation Map */}
      {(profile || scriptVector) && (
        <>
          <div className="rounded-lg border border-border bg-background/50 overflow-hidden relative">
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-auto" style={{ maxHeight: 420 }}>
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
              <text x={PAD + 8} y={PAD + 16} fill="hsl(var(--muted-foreground))" fontSize="9" opacity="0.5" fontFamily="var(--font-display)">INTIMATE + EXPERIMENTAL</text>
              <text x={MAP_W - PAD - 8} y={PAD + 16} fill="hsl(var(--muted-foreground))" fontSize="9" opacity="0.5" textAnchor="end" fontFamily="var(--font-display)">EPIC + EXPERIMENTAL</text>
              <text x={PAD + 8} y={MAP_H - PAD - 8} fill="hsl(var(--muted-foreground))" fontSize="9" opacity="0.5" fontFamily="var(--font-display)">INTIMATE + CLASSICAL</text>
              <text x={MAP_W - PAD - 8} y={MAP_H - PAD - 8} fill="hsl(var(--muted-foreground))" fontSize="9" opacity="0.5" textAnchor="end" fontFamily="var(--font-display)">EPIC + CLASSICAL</text>

              {/* Axis labels */}
              <text x={MAP_W / 2} y={MAP_H - 10} fill="hsl(var(--muted-foreground))" fontSize="10" textAnchor="middle" opacity="0.6">Intimacy ← → Spectacle</text>
              <text x={14} y={MAP_H / 2} fill="hsl(var(--muted-foreground))" fontSize="10" textAnchor="middle" opacity="0.6" transform={`rotate(-90, 14, ${MAP_H / 2})`}>Classical ← → Experimental</text>

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
                const r = isPrimary ? 10 : isSecondary ? 8 : isTop3 ? 7 : 4.5;

                return (
                  <g
                    key={d.id}
                    className="cursor-pointer transition-opacity"
                    opacity={isHovered || isPrimary || isSecondary || isTop3 ? 1 : 0.45}
                    onMouseEnter={() => setHoveredDirector(d.id)}
                    onMouseLeave={() => setHoveredDirector(null)}
                    onClick={() => handleNodeClick(d)}
                  >
                    {/* Glow ring for selected */}
                    {(isPrimary || isSecondary) && (
                      <circle cx={sx} cy={sy} r={r + 5} fill="none" stroke={isPrimary ? "hsl(var(--primary))" : "hsl(var(--ring))"} strokeWidth="1.5" opacity="0.5">
                        <animate attributeName="r" values={`${r + 4};${r + 7};${r + 4}`} dur="2s" repeatCount="indefinite" />
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

                    {/* Name label */}
                    {(isHovered || isPrimary || isSecondary || isTop3) && (
                      <text
                        x={sx}
                        y={sy - r - 5}
                        fill={isPrimary || isSecondary ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                        fontSize={isPrimary || isSecondary ? "10" : "8.5"}
                        textAnchor="middle"
                        fontWeight={isPrimary || isSecondary ? "700" : "500"}
                        fontFamily="var(--font-display)"
                      >
                        {d.name.split(" ").pop()}
                      </text>
                    )}

                    {/* Rank badge */}
                    {rank >= 0 && rank < 3 && !isPrimary && !isSecondary && (
                      <text x={sx + r + 3} y={sy + 3} fill="hsl(var(--primary))" fontSize="8" fontWeight="bold">#{rank + 1}</text>
                    )}
                  </g>
                );
              })}

              {/* Script vector marker */}
              {scriptVector && (() => {
                const { x, y } = vectorToXY(scriptVector);
                const { sx, sy } = toScreen(x, y);
                return (
                  <g>
                    <line x1={sx - 8} y1={sy} x2={sx + 8} y2={sy} stroke="hsl(var(--destructive))" strokeWidth="2" />
                    <line x1={sx} y1={sy - 8} x2={sx} y2={sy + 8} stroke="hsl(var(--destructive))" strokeWidth="2" />
                    <text x={sx + 12} y={sy + 4} fill="hsl(var(--destructive))" fontSize="9" fontWeight="bold" fontFamily="var(--font-display)">YOUR SCRIPT</text>
                  </g>
                );
              })()}

              {/* Blended position marker */}
              {blendedVector && primaryDirector && secondaryDirector && (() => {
                const { x, y } = vectorToXY(blendedVector);
                const { sx, sy } = toScreen(x, y);
                return (
                  <g>
                    <circle cx={sx} cy={sy} r={6} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
                    <circle cx={sx} cy={sy} r={2.5} fill="hsl(var(--primary))" />
                    <text x={sx + 10} y={sy + 4} fill="hsl(var(--primary))" fontSize="8" fontWeight="600" fontFamily="var(--font-display)">BLEND</text>
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* Cluster legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
            {(Object.entries(CLUSTER_LABELS) as [ClusterId, string][]).map(([id, label]) => (
              <div key={id} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CLUSTER_COLORS[id] }} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
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

            {/* Top matches */}
            {topMatches.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Recommendations</span>
                <div className="grid grid-cols-3 gap-2">
                  {topMatches.slice(0, 3).map((m, i) => (
                    <button
                      key={m.director.id}
                      onClick={() => {
                        if (disabled) return;
                        if (i === 0) {
                          setSelectedPrimary(m.director.id);
                        } else if (i === 1) {
                          setSelectedSecondary(m.director.id);
                        } else {
                          // Replace secondary with 3rd
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
                      <p className="text-[9px] text-muted-foreground mt-1 truncate">{CLUSTER_LABELS[m.director.cluster]}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">Distance: {m.distance.toFixed(2)}</p>
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
                    <p className="text-[10px] text-muted-foreground">{primaryDirector.visualMandate.lighting.split(";")[0]}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Click a director on the map</p>
                )}
              </div>
              <div className={cn("rounded-lg border p-3 space-y-1.5", secondaryDirector ? "border-border bg-secondary/30" : "border-border border-dashed")}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Secondary</span>
                {secondaryDirector ? (
                  <>
                    <p className="text-sm font-display font-bold text-foreground">{secondaryDirector.name}</p>
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
