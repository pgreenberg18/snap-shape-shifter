import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { parseSceneFromPlainText } from "@/lib/parse-script-text";
import {
  Upload, Type, CheckCircle, FileText, Sparkles, Loader2, Film, Eye,
  Camera, Palette, MapPin, Users, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown,
  AlertTriangle, ScrollText, X, Plus, LocateFixed, Shield, Lock, Unlock,
  Clock, Save, Rewind, FastForward, AlertCircle, RefreshCw, Trash2,
  Zap, Volume2, Dog, UserPlus, Paintbrush, Swords, Wand2, Sun, Home, Clapperboard, Monitor, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useScriptViewer } from "@/components/ScriptViewerDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useContentSafety, useFilm, useFilmId, useParsedScenes } from "@/hooks/useFilm";
import { supabase } from "@/integrations/supabase/client";
import GlobalElementsManager from "@/components/development/GlobalElementsManager";
import TypewriterSceneFeed from "@/components/development/TypewriterSceneFeed";
import DirectorVisionPanel from "@/components/development/DirectorVisionPanel";
import ProductionBiblePanel from "@/components/development/ProductionBiblePanel";
import DraggableScriptPopup from "@/components/DraggableScriptPopup";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/* ── Constants ── */
const ACCEPTED_EXTENSIONS = [".fdx"];
const ACCEPTED_LABEL = ".fdx only (more formats coming soon)";

const FORMAT_PRESETS: { value: string; label: string; width: number; height: number; fps: number; aspect: string; fourK?: { width: number; height: number }; category: string }[] = [
  // Live-Action
  { value: "feature_film", label: "Feature Film", width: 1920, height: 1080, fps: 24, aspect: "16:9", category: "Live-Action" },
  { value: "tv_series", label: "TV Series", width: 1920, height: 1080, fps: 24, aspect: "16:9", fourK: { width: 3840, height: 2160 }, category: "Live-Action" },
  { value: "tv_sitcom", label: "TV Sitcom", width: 1920, height: 1080, fps: 30, aspect: "16:9", fourK: { width: 3840, height: 2160 }, category: "Live-Action" },
  { value: "commercial", label: "TV Commercial", width: 1920, height: 1080, fps: 30, aspect: "16:9", fourK: { width: 3840, height: 2160 }, category: "Live-Action" },
  { value: "short_film", label: "Short Film", width: 1920, height: 1080, fps: 24, aspect: "16:9", fourK: { width: 3840, height: 2160 }, category: "Live-Action" },
  { value: "documentary", label: "Documentary", width: 1920, height: 1080, fps: 24, aspect: "16:9", fourK: { width: 3840, height: 2160 }, category: "Live-Action" },
  { value: "music_video", label: "Music Video", width: 1920, height: 1080, fps: 24, aspect: "16:9", fourK: { width: 3840, height: 2160 }, category: "Live-Action" },
  // Animation
  { value: "animated_feature", label: "Animated Feature", width: 1920, height: 1080, fps: 24, aspect: "16:9", fourK: { width: 3840, height: 2160 }, category: "Animation" },
  { value: "animation_series", label: "Animation Series", width: 1920, height: 1080, fps: 24, aspect: "16:9", fourK: { width: 3840, height: 2160 }, category: "Animation" },
  { value: "animation_short", label: "Animation Short", width: 1920, height: 1080, fps: 24, aspect: "16:9", fourK: { width: 3840, height: 2160 }, category: "Animation" },
  
  // Social & Digital
  { value: "tiktok", label: "TikTok", width: 1080, height: 1920, fps: 30, aspect: "9:16", category: "Social & Digital" },
  { value: "instagram_reel", label: "Instagram Reel", width: 1080, height: 1920, fps: 30, aspect: "9:16", category: "Social & Digital" },
  { value: "instagram_post", label: "Instagram Post", width: 1080, height: 1080, fps: 30, aspect: "1:1", category: "Social & Digital" },
  { value: "instagram_story", label: "Instagram Story", width: 1080, height: 1920, fps: 30, aspect: "9:16", category: "Social & Digital" },
  { value: "youtube", label: "YouTube", width: 1920, height: 1080, fps: 30, aspect: "16:9", fourK: { width: 3840, height: 2160 }, category: "Social & Digital" },
  { value: "youtube_short", label: "YouTube Short", width: 1080, height: 1920, fps: 30, aspect: "9:16", category: "Social & Digital" },
  { value: "facebook", label: "Facebook Video", width: 1280, height: 720, fps: 30, aspect: "16:9", category: "Social & Digital" },
  { value: "snapchat", label: "Snapchat", width: 1080, height: 1920, fps: 30, aspect: "9:16", category: "Social & Digital" },
  { value: "linkedin", label: "LinkedIn Video", width: 1920, height: 1080, fps: 30, aspect: "16:9", category: "Social & Digital" },
  // Specialty
  { value: "vr_360", label: "VR / 360°", width: 4096, height: 2048, fps: 30, aspect: "2:1", category: "Specialty" },
];

/* ── Hooks ── */
const useLatestAnalysis = (filmId: string | undefined) =>
  useQuery({
    queryKey: ["script-analysis", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("script_analyses")
        .select("*")
        .eq("film_id", filmId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d && (d.status === "pending" || d.status === "analyzing" || d.status === "enriching")) return 3000;
      return false;
    },
  });

/* ── Analysis Progress Steps ── */
const PARSING_STEPS = [
  { label: "Uploading script", key: "upload", detail: "Sending your file to the server…" },
  { label: "Parsing screenplay format", key: "parse", detail: "Detecting scene headings, dialogue, and action lines…" },
  { label: "Extracting scenes", key: "extract", detail: "Splitting script into individual scenes…" },
];

const AnalysisProgress = ({ status, filmId, onCancel }: { status?: string; filmId?: string; onCancel?: () => void }) => {
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(() => Date.now());

  // Poll enrichment progress from DB when enrichment is active
  const isEnrichingPhase = status === "enriching" || status === "analyzing";
  const { data: enrichmentProgress } = useQuery({
    queryKey: ["enrichment-progress", filmId],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("parsed_scenes")
        .select("id", { count: "exact", head: true })
        .eq("film_id", filmId!);
      const { count: enriched } = await supabase
        .from("parsed_scenes")
        .select("id", { count: "exact", head: true })
        .eq("film_id", filmId!)
        .eq("enriched", true);
      // Fetch ALL enriched scenes ordered by scene_number
      const { data: recentScenes } = await supabase
        .from("parsed_scenes")
        .select("scene_number, heading, description, characters")
        .eq("film_id", filmId!)
        .eq("enriched", true)
        .order("scene_number", { ascending: true });
      return {
        total: total || 0,
        enriched: enriched || 0,
        recentScenes: recentScenes || [],
      };
    },
    enabled: !!filmId && isEnrichingPhase,
    refetchInterval: 3000,
  });

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return m > 0 ? `${m}:${rem.toString().padStart(2, "0")}` : `${s}s`;
  };

  const enrichTotal = enrichmentProgress?.total || 0;
  const enrichDone = enrichmentProgress?.enriched || 0;
  const enrichPct = enrichTotal > 0 ? Math.round((enrichDone / enrichTotal) * 100) : 0;
  const recentScenes = enrichmentProgress?.recentScenes || [];

  // Show enrichment progress once we have parsed scenes data
  const isEnriching = isEnrichingPhase && enrichTotal > 0 && enrichDone > 0;
  const parsingDone = isEnriching || status === "complete";
  const overallPct = parsingDone
    ? (isEnriching ? 30 + Math.round(enrichPct * 0.7) : 100)
    : Math.min(Math.round((elapsed / 1000 / 15) * 30), 29);

  // Estimate remaining time
  const estimatedRemaining = isEnriching && enrichDone > 3
    ? Math.round(((elapsed / 1000) / enrichDone) * (enrichTotal - enrichDone))
    : null;

  const formatEstimate = (s: number) => {
    if (s < 60) return `~${s}s remaining`;
    const m = Math.floor(s / 60);
    return `~${m}m remaining`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-8 space-y-6">
      <div className="flex items-start gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-sm truncate">
            {isEnriching ? "Analyzing your script…" : "Parsing your screenplay…"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Elapsed: {formatTime(elapsed)}
            {isEnriching && enrichTotal > 0 && ` · ${enrichDone} of ${enrichTotal} scenes`}
            {isEnriching && estimatedRemaining !== null && ` · ${formatEstimate(estimatedRemaining)}`}
            {!isEnriching && " · Please be patient. This highly detailed analysis usually takes a few minutes."}
          </p>
        </div>
        {onCancel && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 text-xs shrink-0"
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" />
            Cancel Script Analysis
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-right tabular-nums">{overallPct}%</p>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {PARSING_STEPS.map((step, i) => {
          const isDone = parsingDone || (elapsed / 1000 > (i + 1) * 3);
          const isActive = !isDone && (elapsed / 1000 > i * 3);
          const stepPct = isDone ? 100 : isActive ? Math.min(Math.round(((elapsed / 1000 - i * 3) / 3) * 100), 99) : 0;
          return (
            <div key={step.key} className="space-y-1">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full shrink-0 transition-colors",
                  isDone && "bg-primary text-primary-foreground",
                  isActive && "bg-primary/20 text-primary",
                  !isDone && !isActive && "bg-secondary text-muted-foreground/40"
                )}>
                  {isDone ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : isActive ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="text-[10px] font-bold">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "text-sm transition-colors",
                    isDone && "text-foreground",
                    isActive && "text-foreground font-semibold",
                    !isDone && !isActive && "text-muted-foreground/50"
                  )}>
                    {step.label}
                    {(isActive || isDone) && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums font-normal">{stepPct}%</span>
                    )}
                  </span>
                  {isActive && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 animate-in fade-in slide-in-from-left-2 duration-300">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
              {isActive && (
                <div className="ml-9 h-1 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/50 transition-all duration-700 ease-out"
                    style={{ width: `${stepPct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
        {/* Enrichment step — shows real progress */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full shrink-0 transition-colors",
              !isEnriching && !parsingDone && "bg-secondary text-muted-foreground/40",
              isEnriching && "bg-primary/20 text-primary",
              parsingDone && !isEnriching && "bg-primary text-primary-foreground",
            )}>
              {isEnriching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : parsingDone ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <span className="text-[10px] font-bold">4</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className={cn(
                "text-sm transition-colors",
                isEnriching && "text-foreground font-semibold",
                !isEnriching && !parsingDone && "text-muted-foreground/50",
                parsingDone && !isEnriching && "text-foreground",
              )}>
                Extracting details from each scene
                {isEnriching && enrichTotal > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums font-normal">{enrichDone}/{enrichTotal} · {enrichPct}%</span>
                )}
                {parsingDone && !isEnriching && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums font-normal">100%</span>
                )}
              </span>
              {isEnriching && (
                <p className="text-xs text-muted-foreground mt-0.5 animate-in fade-in slide-in-from-left-2 duration-300">
                  Identifying characters, wardrobe, props, locations, stunts, VFX, SFX, mood, and cinematic elements…
                </p>
              )}
            </div>
          </div>
          {isEnriching && (
            <div className="ml-9 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-700 ease-out"
                style={{ width: `${enrichPct}%` }}
              />
            </div>
          )}

          {/* Live typewriter feed during enrichment */}
          {isEnriching && recentScenes.length > 0 && (
            <TypewriterSceneFeed scenes={recentScenes} />
          )}
        </div>
      </div>

    </div>
  );
};

/* ── Propagation Progress (shown after Vision is locked) ── */
const PropagationProgress = ({ filmId, onComplete }: { filmId: string; onComplete: () => void }) => {
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(timer);
  }, [startTime]);

  const { data: progress } = useQuery({
    queryKey: ["propagation-progress", filmId],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("parsed_scenes")
        .select("id", { count: "exact", head: true })
        .eq("film_id", filmId);
      const { count: enriched } = await supabase
        .from("parsed_scenes")
        .select("id", { count: "exact", head: true })
        .eq("film_id", filmId)
        .eq("enriched", true);
      const { data: recentScenes } = await supabase
        .from("parsed_scenes")
        .select("scene_number, heading")
        .eq("film_id", filmId)
        .eq("enriched", true)
        .order("scene_number", { ascending: false })
        .limit(5);
      return { total: total || 0, enriched: enriched || 0, recentScenes: (recentScenes || []).reverse() };
    },
    refetchInterval: done ? false : 2000,
  });

  const total = progress?.total || 0;
  const enriched = progress?.enriched || 0;
  const pct = total > 0 ? Math.round((enriched / total) * 100) : 0;
  const allDone = total > 0 && enriched >= total;

  useEffect(() => {
    if (allDone && !done) {
      setDone(true);
      const timer = setTimeout(() => onComplete(), 2500);
      return () => clearTimeout(timer);
    }
  }, [allDone, done, onComplete]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return m > 0 ? `${m}:${rem.toString().padStart(2, "0")}` : `${s}s`;
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-8 space-y-6 animate-fade-in">
      {!done ? (
        <>
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div
                className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"
                style={{ animationDuration: "1.5s" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-lg text-foreground">
                Implementing Vision
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Propagating Production Bible into scene-by-scene breakdown…
              </p>
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                Elapsed: {formatTime(elapsed)}
                {total > 0 && ` · ${enriched} of ${total} scenes`}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{enriched} / {total} scenes</span>
              <span>{pct}%</span>
            </div>
          </div>

          {/* Recently processed scenes */}
          {progress?.recentScenes && progress.recentScenes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recently processed</p>
              <div className="space-y-1">
                {progress.recentScenes.map((s: any) => (
                  <div key={s.scene_number} className="flex items-center gap-2 text-xs animate-fade-in">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="text-muted-foreground">Scene {s.scene_number}</span>
                    <span className="text-foreground/70 truncate">{(s.heading || "").split("\n")[0].substring(0, 60)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-4 animate-scale-in">
          <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <div className="text-center">
            <h3 className="font-display font-bold text-lg text-green-400">
              Vision Implemented
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              All {total} scenes have been enriched. Opening Scene Breakdown…
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Main Page ── */
const Development = () => {
  const [searchParams] = useSearchParams();
  const filmId = useFilmId();
  const { data: film } = useFilm();
  const { data: safety } = useContentSafety();
  const { data: analysis, isLoading: analysisLoading } = useLatestAnalysis(filmId);
  const { data: devParsedScenes } = useParsedScenes();
  const { data: directorProfile } = useQuery({
    queryKey: ["director-profile", filmId],
    queryFn: async () => {
      const { data } = await supabase
        .from("film_director_profiles")
        .select("id")
        .eq("film_id", filmId!)
        .maybeSingle();
      return data;
    },
    enabled: !!filmId,
  });
  const { data: productionBible } = useQuery({
    queryKey: ["production-bible-status", filmId],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_bibles")
        .select("status")
        .eq("film_id", filmId!)
        .maybeSingle();
      return data;
    },
    enabled: !!filmId,
  });
  const bibleComplete = productionBible?.status === "complete";
  const { data: sceneLocations } = useQuery({
    queryKey: ["scene-locations", filmId],
    queryFn: async () => {
      const { data } = await supabase
        .from("parsed_scenes")
        .select("location_name")
        .eq("film_id", filmId!)
        .not("location_name", "is", null);
      return [...new Set((data || []).map(d => d.location_name).filter(Boolean))] as string[];
    },
    enabled: !!filmId,
  });
  const { data: scenePropOwnership } = useQuery({
    queryKey: ["scene-prop-ownership", filmId],
    queryFn: async () => {
      const { data } = await supabase
        .from("parsed_scenes")
        .select("scene_number, characters, key_objects, location_name, wardrobe, picture_vehicles")
        .eq("film_id", filmId!)
        .eq("enriched", true);
      return (data || []).map(d => ({
        scene_number: d.scene_number as number,
        characters: (d.characters || []) as string[],
        key_objects: (d.key_objects || []) as string[],
        location_name: (d.location_name || "") as string,
        wardrobe: (d.wardrobe || []) as any[],
        picture_vehicles: (d.picture_vehicles || []) as string[],
      }));
    },
    enabled: !!filmId,
  });
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState(false);
  const [nudity, setNudity] = useState(false);
  const [violence, setViolence] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const uploadAbortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const [allScenesApproved, setAllScenesApproved] = useState(false);
  const [contentSafetyRun, setContentSafetyRun] = useState(false);
  const [locking, setLocking] = useState(false);
  const [allElementsReviewed, setAllElementsReviewed] = useState(false);
  const [scriptSectionOpen, setScriptSectionOpen] = useState(true);

  // Collapse the script section once we know analysis is complete
  useEffect(() => {
    if (!analysisLoading && analysis?.status === "complete") {
      setScriptSectionOpen(false);
    }
  }, [analysisLoading, analysis?.status]);
  const [reviewStats, setReviewStats] = useState<{ approved: number; rejected: number; pending: number } | null>(null);
  const [timePeriod, setTimePeriod] = useState("");
  const [timePeriodSaving, setTimePeriodSaving] = useState(false);
  const [formatType, setFormatType] = useState<string>("");
  const [frameWidth, setFrameWidth] = useState<number | null>(null);
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const [frameRate, setFrameRate] = useState<number | null>(null);
  const [formatSaving, setFormatSaving] = useState(false);
  const [formatOverride, setFormatOverride] = useState(false);
  const [fourKEnabled, setFourKEnabled] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
  const [filmTitle, setFilmTitle] = useState("");
  const [versionName, setVersionName] = useState("");
  const [writers, setWriters] = useState("");
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [visualSummaryApproved, setVisualSummaryApproved] = useState(false);
  const [ratingsApproved, setRatingsApproved] = useState(false);
  
  const enrichingRef = useRef(false);
  const [devComplete, setDevComplete] = useState(false);
  const [fundamentalsLocked, setFundamentalsLocked] = useState(false);
  const [visionComplete, setVisionComplete] = useState(false);
  const [propagating, setPropagating] = useState(false);
  const [propagationDone, setPropagationDone] = useState(false);
  const [activeTab, setActiveTab] = useState("fundamentals");
  const [reanalyzeDialogOpen, setReanalyzeDialogOpen] = useState(false);

  // Restore fundamentalsLocked & visionComplete from DB state on mount
  useEffect(() => {
    if (!analysis) return;
    const scriptIsLocked = !!(film as any)?.script_locked;
    const visionDone = !!(analysis as any).ai_notes_approved && !!directorProfile;
    if (analysis.status && scriptIsLocked) {
      setFundamentalsLocked(true);
      if (visionDone) {
        setVisionComplete(true);
        setActiveTab("breakdown");
      } else {
        setActiveTab("vision");
      }
    }
  }, [analysis?.id, (film as any)?.script_locked, (analysis as any)?.ai_notes_approved, directorProfile]);

  // Post-enrichment: finalize analysis (always) then optionally run director fit
  const runPostEnrichment = useCallback(async (analysisId: string, { includeDirectorFit = false } = {}) => {
    try {
      console.log("Running finalize-analysis…");
      const { error: finErr } = await supabase.functions.invoke("finalize-analysis", {
        body: { analysis_id: analysisId },
      });
      if (finErr) console.error("finalize-analysis failed:", finErr);
      else console.log("Finalization complete");

      queryClient.invalidateQueries({ queryKey: ["script-analysis", filmId] });

      // Only run director style matching after fundamentals are locked (during enrichment)
      if (includeDirectorFit && filmId) {
        console.log("Running director fit analysis…");
        const { error: dirErr } = await supabase.functions.invoke("analyze-director-fit", {
          body: { film_id: filmId, save: true },
        });
        if (dirErr) console.error("analyze-director-fit failed:", dirErr);
        else console.log("Director fit analysis complete");
        queryClient.invalidateQueries({ queryKey: ["director-profile", filmId] });
      }
    } catch (e) {
      console.error("Post-enrichment pipeline error:", e);
    }
  }, [filmId, queryClient]);

  // Parallel batch enrichment helper (5 concurrent)
  const runEnrichmentBatches = useCallback((sceneIds: string[], analysisId: string, onComplete?: () => void, { includeDirectorFit = true }: { includeDirectorFit?: boolean } = {}) => {
    if (enrichingRef.current || !analysisId) return; // prevent duplicate loops
    enrichingRef.current = true;

    const CONCURRENCY = 5;
    const RETRY_DELAY = 3000;
    const MAX_RETRIES = 4;

    const getErrorText = (reason: unknown) => {
      if (!reason) return "";
      if (typeof reason === "string") return reason;
      if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
      try {
        return JSON.stringify(reason);
      } catch {
        return String(reason);
      }
    };

    (async () => {
      try {
        let queue = [...sceneIds];
        const attempts = new Map<string, number>();

        while (queue.length > 0) {
          const batch = queue.slice(0, CONCURRENCY);
          queue = queue.slice(CONCURRENCY);

          const results = await Promise.allSettled(
            batch.map((sceneId) => {
              const payload = { scene_id: sceneId, analysis_id: analysisId };
              console.log("Enriching scene:", payload);
              return supabase.functions.invoke("enrich-scene", {
                body: payload,
              }).then((res) => {
                if (res.error) throw res.error;
                return res;
              });
            })
          );

          const retrySceneIds: string[] = [];

          results.forEach((result, index) => {
            if (result.status !== "rejected") return;

            const sceneId = batch[index];
            const errorText = getErrorText(result.reason);
            const isRetryable =
              errorText.includes("429") ||
              errorText.includes("503") ||
              errorText.toLowerCase().includes("rate limit") ||
              errorText.toLowerCase().includes("temporarily unavailable");

            const attempt = (attempts.get(sceneId) ?? 0) + 1;

            if (isRetryable && attempt < MAX_RETRIES) {
              attempts.set(sceneId, attempt);
              retrySceneIds.push(sceneId);
              return;
            }

            console.error(`Enrichment failed for scene ${sceneId} after ${attempt} attempts`, result.reason);
          });

          if (retrySceneIds.length > 0) {
            console.warn(`Retrying ${retrySceneIds.length} scene(s) after transient errors...`);
            await new Promise((r) => setTimeout(r, RETRY_DELAY));
            queue.push(...retrySceneIds);
          }
        }

        onComplete?.();
        queryClient.invalidateQueries({ queryKey: ["script-analysis", filmId] });

        // Chain: finalize → optionally director fit (only on first lock, not on resume)
        await runPostEnrichment(analysisId, { includeDirectorFit });
      } finally {
        enrichingRef.current = false;
      }
    })();
  }, [filmId, queryClient, runPostEnrichment]);

  // Resume enrichment on page load only if vision is locked and there are unenriched scenes
  useEffect(() => {
    if (!analysis || !filmId || !visionComplete) return;
    if (enrichingRef.current) return;

    (async () => {
      // Find unenriched scene IDs
      const { data: unenriched } = await supabase
        .from("parsed_scenes")
        .select("id")
        .eq("film_id", filmId)
        .eq("enriched", false)
        .order("scene_number", { ascending: true });

      if (unenriched && unenriched.length > 0) {
        console.log(`Resuming enrichment for ${unenriched.length} remaining scenes`);
        runEnrichmentBatches(
          unenriched.map((s) => s.id),
          analysis.id,
          undefined,
          { includeDirectorFit: false }, // Don't overwrite saved director profile on resume
        );
      }
    })();
  }, [analysis?.id, filmId, visionComplete, runEnrichmentBatches]);

  /* Sync section approval states from DB */
  useEffect(() => {
    if (!analysis) return;
    setVisualSummaryApproved(!!(analysis as any).visual_summary_approved);
    setRatingsApproved(!!(analysis as any).ratings_approved);
    
    // If ratings were previously approved, the content safety analysis was already run
    if ((analysis as any).ratings_approved) setContentSafetyRun(true);
  }, [analysis?.id]);

  const persistApproval = useCallback(async (field: string, value: boolean) => {
    if (!analysis?.id) return;
    await supabase
      .from("script_analyses")
      .update({ [field]: value } as any)
      .eq("id", analysis.id);
  }, [analysis?.id]);

  const metaDirty = filmTitle !== (film?.title ?? "") || versionName !== (film?.version_name ?? "") || writers !== ((film as any)?.writers ?? "");

  // Reset saved state when fields change
  useEffect(() => { if (metaDirty) setMetaSaved(false); }, [metaDirty]);

  /* Auto-fill time period from AI temporal analysis */
  const temporalAnalysis = useMemo(() => {
    if (!analysis || analysis.status !== "complete") return null;
    const ge = analysis.global_elements as any;
    return ge?.temporal_analysis || null;
  }, [analysis?.global_elements, analysis?.status]);

  useEffect(() => {
    if (film?.time_period || !temporalAnalysis?.primary_time_period?.estimated_year_or_era) return;
    const extracted = temporalAnalysis.primary_time_period.estimated_year_or_era;
    if (extracted) {
      setTimePeriod(extracted);
      if (filmId) {
        supabase.from("films").update({ time_period: extracted }).eq("id", filmId).then(() => {
          queryClient.invalidateQueries({ queryKey: ["film", filmId] });
        });
      }
    }
  }, [temporalAnalysis, film?.time_period, filmId]);

  const scriptLocked = !!(film as any)?.script_locked;

  /* Sync film metadata from DB */
  useEffect(() => {
    if (film?.time_period != null) setTimePeriod(film.time_period);
    if (film?.title != null) setFilmTitle(film.title);
    if (film?.version_name != null) setVersionName(film.version_name ?? "");
    if ((film as any)?.writers != null) setWriters((film as any).writers ?? "");
    if ((film as any)?.genres != null) setGenres((film as any).genres ?? []);
    if ((film as any)?.format_type != null) setFormatType((film as any).format_type ?? "");
    if ((film as any)?.frame_width != null) setFrameWidth((film as any).frame_width);
    if ((film as any)?.frame_height != null) setFrameHeight((film as any).frame_height);
    if ((film as any)?.frame_rate != null) setFrameRate((film as any).frame_rate);
    // If values exist but no override was set, check if they differ from preset
    if ((film as any)?.format_type) {
      const preset = FORMAT_PRESETS.find(p => p.value === (film as any).format_type);
      if (preset && ((film as any).frame_width !== preset.width || (film as any).frame_height !== preset.height || (film as any).frame_rate !== preset.fps)) {
        setFormatOverride(true);
      }
    }
  }, [film?.time_period, film?.title, film?.version_name, (film as any)?.writers, (film as any)?.genres, (film as any)?.format_type, (film as any)?.frame_width, (film as any)?.frame_height, (film as any)?.frame_rate]);

  /* Auto-scroll to scene from ?scene= query param and open its script */
  useEffect(() => {
    const sceneParam = searchParams.get("scene");
    if (!sceneParam) return;
    // Wait for scenes to render
    const timer = setTimeout(() => {
      const el = document.getElementById(`scene-${sceneParam}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 3000);
        // Auto-click the Script button to open the script viewer
        const scriptBtn = el.querySelector('[data-script-btn]') as HTMLButtonElement;
        if (scriptBtn) {
          setTimeout(() => scriptBtn.click(), 600);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchParams, analysis]);

  const uploadFile = useCallback(async (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast({ title: "Unsupported format", description: `Supported: ${ACCEPTED_LABEL}`, variant: "destructive" });
      return;
    }
    if (!filmId) return;
    setUploading(true);
    const uploadStartTime = Date.now();
    const abortController = new AbortController();
    uploadAbortRef.current = abortController;

    // Upload file to storage only — analysis is triggered separately
    const path = `${filmId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("scripts").upload(path, file, {
      // @ts-ignore – signal supported by fetch-based upload
      signal: abortController.signal,
    } as any);
    if (abortController.signal.aborted) {
      setUploading(false);
      uploadAbortRef.current = null;
      return;
    }
    if (uploadErr) {
      setUploading(false);
      uploadAbortRef.current = null;
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      return;
    }
    uploadAbortRef.current = null;

    setUploadedFile(file.name);
    setUploadedPath(path);
    // Keep uploading state visible for at least 1.5s so user can see it
    const elapsed = Date.now() - uploadStartTime;
    const remaining = Math.max(0, 1500 - elapsed);
    setTimeout(() => {
      setUploading(false);
      toast({ title: "Script uploaded", description: "Click Analyze to begin breakdown." });
    }, remaining);
  }, [toast, filmId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleAnalyze = async () => {
    // For reanalysis, use existing analysis record; for first analysis, use local upload state
    const fileName = uploadedFile || analysis?.file_name;
    const storagePath = uploadedPath || analysis?.storage_path;
    if (!fileName || !storagePath) return;
    setAnalyzing(true);

    let analysisId: string;

    if (analysis?.id) {
      // Reanalyze: wipe all downstream data for this film
      const wipePromises = [
        supabase.from("parsed_scenes").delete().eq("film_id", filmId!),
        supabase.from("characters").delete().eq("film_id", filmId!),
        supabase.from("shots").delete().eq("film_id", filmId!),
        supabase.from("film_assets").delete().eq("film_id", filmId!),
        supabase.from("film_director_profiles").delete().eq("film_id", filmId!),
        supabase.from("film_style_contracts").delete().eq("film_id", filmId!),
        supabase.from("content_safety").delete().eq("film_id", filmId!),
        supabase.from("production_bibles").delete().eq("film_id", filmId!),
        supabase.from("scene_style_overrides").delete().eq("film_id", filmId!),
        supabase.from("vice_conflicts").delete().eq("film_id", filmId!),
        supabase.from("vice_dependencies").delete().eq("film_id", filmId!),
        supabase.from("vice_dirty_queue").delete().eq("film_id", filmId!),
        supabase.from("asset_identity_registry").delete().eq("film_id", filmId!),
        supabase.from("wardrobe_fitting_views").delete().eq("film_id", filmId!),
        supabase.from("wardrobe_scene_assignments").delete().eq("film_id", filmId!),
        supabase.from("post_production_clips").delete().eq("film_id", filmId!),
        supabase.from("production_presets").delete().eq("film_id", filmId!),
      ];
      await Promise.all(wipePromises);

      // Unlock script so user starts fresh
      await supabase.from("films").update({ script_locked: false }).eq("id", filmId!);

      // Reset existing analysis record
      const { error: resetErr } = await supabase
        .from("script_analyses")
        .update({
          status: "pending",
          scene_breakdown: null,
          global_elements: null,
          visual_summary: null,
          ai_generation_notes: null,
          ai_notes_approved: false,
          visual_summary_approved: false,
          ratings_approved: false,
          scene_approvals: null,
          scene_rejections: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", analysis.id);

      if (resetErr) {
        toast({ title: "Failed to start reanalysis", description: resetErr.message, variant: "destructive" });
        setAnalyzing(false);
        return;
      }

      // Reset local UI state
      setFundamentalsLocked(false);
      setVisionComplete(false);
      setActiveTab("fundamentals");

      // Invalidate all downstream query caches so UI reflects the wipe
      queryClient.invalidateQueries({ queryKey: ["parsed-scenes"] });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      queryClient.invalidateQueries({ queryKey: ["shots"] });
      queryClient.invalidateQueries({ queryKey: ["film-assets"] });
      queryClient.invalidateQueries({ queryKey: ["director-profile"] });
      queryClient.invalidateQueries({ queryKey: ["style-contract"] });
      queryClient.invalidateQueries({ queryKey: ["content-safety"] });
      queryClient.invalidateQueries({ queryKey: ["production-bible"] });
      queryClient.invalidateQueries({ queryKey: ["scene-style-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["vice-conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["vice-dependencies"] });
      queryClient.invalidateQueries({ queryKey: ["vice-dirty-queue"] });
      queryClient.invalidateQueries({ queryKey: ["asset-identity-registry"] });
      queryClient.invalidateQueries({ queryKey: ["wardrobe-fitting-views"] });
      queryClient.invalidateQueries({ queryKey: ["wardrobe-scene-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["post-production-clips"] });
      queryClient.invalidateQueries({ queryKey: ["production-presets"] });
      queryClient.invalidateQueries({ queryKey: ["voice-auditions"] });
      queryClient.invalidateQueries({ queryKey: ["enrichment-progress"] });
      queryClient.invalidateQueries({ queryKey: ["scene-locations"] });
      queryClient.invalidateQueries({ queryKey: ["scene-prop-ownership"] });
      queryClient.invalidateQueries({ queryKey: ["script-analysis", filmId] });

      analysisId = analysis.id;
    } else {
      // First analysis: insert new record
      const { data: record, error: insertErr } = await supabase
        .from("script_analyses")
        .insert({ film_id: filmId!, file_name: fileName, storage_path: storagePath, status: "pending" })
        .select()
        .single();

      if (insertErr || !record) {
        toast({ title: "Failed to start analysis", description: insertErr?.message, variant: "destructive" });
        setAnalyzing(false);
        return;
      }
      analysisId = record.id;
    }

    const { data: parseResult, error: invokeErr } = await supabase.functions.invoke("parse-script", {
      body: { analysis_id: analysisId },
    });

    if (invokeErr) {
      setAnalyzing(false);
      toast({ title: "Analysis request failed", description: invokeErr.message, variant: "destructive" });
      return;
    }

    const sceneIds: string[] = parseResult?.scene_ids || [];
    // Skip enrichment — it runs after Vision is locked
    // Just run finalize + director fit
    if (analysisId) {
      runPostEnrichment(analysisId);
    }

    setAnalyzing(false);
    queryClient.invalidateQueries({ queryKey: ["script-analysis", filmId] });
  };

  useEffect(() => {
    if (safety) {
      setLanguage(safety.language);
      setNudity(safety.nudity);
      setViolence(safety.violence);
    }
  }, [safety]);

  const updateSafety = async (field: string, value: boolean) => {
    if (!safety) return;
    await supabase.from("content_safety").update({ [field]: value }).eq("id", safety.id);
  };

  const handleToggle = (field: string, setter: (v: boolean) => void) => (val: boolean) => {
    setter(val);
    updateSafety(field, val);
  };

  const handleLockScript = async () => {
    if (!filmId) return;
    setLocking(true);

    // 1. Lock the film
    const { error } = await supabase.from("films").update({ script_locked: true } as any).eq("id", filmId);
    if (error) {
      setLocking(false);
      toast({ title: "Lock failed", description: error.message, variant: "destructive" });
      return;
    }

    // 2. Auto-populate characters from parsed_scenes (live enriched data, not stale JSON)
    try {
      const { data: parsedScenes } = await supabase
        .from("parsed_scenes")
        .select("characters")
        .eq("film_id", filmId);

      if (parsedScenes && parsedScenes.length > 0) {
        const nameSet = new Set<string>();
        for (const scene of parsedScenes) {
          if (!Array.isArray(scene.characters)) continue;
          for (const c of scene.characters) {
            let raw = typeof c === "string" ? c : (c as any)?.name;
            if (!raw || typeof raw !== "string") continue;
            raw = raw.replace(/\s*\(.*?\)\s*/g, "").replace(/^"|"$/g, "").trim().toUpperCase();
            if (raw && raw.length > 1 && !raw.includes("TEAM") && !raw.includes("OFFICERS") && !raw.includes("UNSEEN") && !raw.includes("SILHOUETTE")) {
              nameSet.add(raw);
            }
          }
        }

        if (nameSet.size > 0) {
          const { data: existing } = await supabase
            .from("characters")
            .select("name")
            .eq("film_id", filmId);
          const existingNames = new Set((existing ?? []).map((c) => c.name.toUpperCase()));
          const newChars = [...nameSet]
            .filter((n) => !existingNames.has(n))
            .map((name) => ({
              film_id: filmId,
              name: name.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "),
            }));

          if (newChars.length > 0) {
            await supabase.from("characters").insert(newChars);
            queryClient.invalidateQueries({ queryKey: ["characters"] });
          }
        }
      }
    } catch (e) {
      console.error("Failed to auto-populate characters:", e);
    }

    // Auto-compile the Director's Style Contract from all Development data
    // This propagates genre, rating, visual DNA, and scene overrides to all downstream generation
    supabase.functions.invoke("compile-style-contract", { body: { film_id: filmId } })
      .then(({ error }) => {
        if (error) console.error("Style contract compilation failed:", error);
        else console.log("Director's Style Contract compiled successfully");
      });

    setLocking(false);
    setBreakdownOpen(false);
    queryClient.invalidateQueries({ queryKey: ["film", filmId] });
    toast({ title: "Script Locked", description: "Breakdown finalized. Style contract compiled. All data propagated through Production." });
  };

  const handleUnlockScript = async () => {
    if (!filmId) return;
    setLocking(true);
    const { error } = await supabase.from("films").update({ script_locked: false } as any).eq("id", filmId);
    setLocking(false);
    if (error) {
      toast({ title: "Unlock failed", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["film", filmId] });
      toast({ title: "Script Unlocked", description: "You can now make changes to the script breakdown." });
    }
  };

  const handleSaveTimePeriod = async () => {
    if (!filmId) return;
    setTimePeriodSaving(true);
    const { error } = await supabase.from("films").update({ time_period: timePeriod || null }).eq("id", filmId);
    setTimePeriodSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["film", filmId] });
      toast({ title: "Time period saved", description: timePeriod || "Cleared" });
    }
  };

  const handleFormatChange = (value: string) => {
    setFormatType(value);
    setFourKEnabled(false);
    const preset = FORMAT_PRESETS.find(p => p.value === value);
    if (preset && !formatOverride) {
      setFrameWidth(preset.width);
      setFrameHeight(preset.height);
      setFrameRate(preset.fps);
    }
  };

  const handleSaveFormat = async () => {
    if (!filmId) return;
    setFormatSaving(true);
    const { error } = await supabase.from("films").update({
      format_type: formatType || null,
      frame_width: frameWidth,
      frame_height: frameHeight,
      frame_rate: frameRate,
    } as any).eq("id", filmId);
    setFormatSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["film", filmId] });
      toast({ title: "Format saved" });
    }
  };

  const isAnalyzing = analyzing || analysis?.status === "pending" || analysis?.status === "analyzing" || analysis?.status === "enriching";

  const handleSaveMeta = async () => {
    if (!filmId) return;
    setMetaSaving(true);
    const { error } = await supabase.from("films").update({
      title: filmTitle || undefined,
      version_name: versionName || null,
      writers: writers || null,
    } as any).eq("id", filmId);
    setMetaSaving(false);
    setMetaSaved(true);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["film", filmId] });
      toast({ title: "Film details saved" });
    }
  };

  /* Secondary time periods from AI temporal analysis */
  const secondaryTimePeriods = useMemo(() => {
    return temporalAnalysis?.secondary_time_periods || [];
  }, [temporalAnalysis]);

  /* State for script text preview dialog */
  const [scriptPreview, setScriptPreview] = useState<{ heading: string; text: string; highlight?: string } | null>(null);

  /* Fallback: keyword-based detection if AI didn't provide temporal_analysis */
  const timeShifts = useMemo(() => {
    if (secondaryTimePeriods.length > 0) return []; // AI handled it
    if (!devParsedScenes || devParsedScenes.length === 0) return [];

    const currentYear = new Date().getFullYear();
    let baseYear = currentYear;
    const periodStr = (film?.time_period || timePeriod || "").trim();
    if (periodStr) {
      const yearMatch = periodStr.match(/\b(1[0-9]{3}|2[0-9]{3})\b/);
      if (yearMatch) baseYear = parseInt(yearMatch[1], 10);
      else if (/present/i.test(periodStr)) baseYear = currentYear;
    }

    const FLASHBACK_KEYWORDS = ["flashback", "flash back", "flash-back", "years earlier", "years ago", "years later", "years before", "months earlier", "months ago", "months later", "days earlier", "days later", "flash forward", "flashforward", "flash-forward", "time jump", "memory", "year earlier", "year later"];
    const RETURN_KEYWORDS = ["back to present", "present day", "end flashback", "end flash back", "resume present", "return to present"];
    const allScenes = devParsedScenes as any[];

    // Approximate page numbers (~3000 chars per page)
    const CHARS_PER_PAGE = 3000;
    let cumulativeChars = 0;
    const scenePages: number[] = allScenes.map((scene: any) => {
      const rawLen = (scene.raw_text || scene.description || "").length || 200;
      const page = Math.floor(cumulativeChars / CHARS_PER_PAGE) + 1;
      cumulativeChars += rawLen;
      return page;
    });

    const shifts: { type: string; sceneHeading: string; sceneIndex: number; sceneNumber: number; calculatedYear: string; pageNumber: number }[] = [];
    const seenTimePeriods = new Set<string>();
    seenTimePeriods.add(String(baseYear));
    seenTimePeriods.add("present");
    let currentTimePeriod = String(baseYear);

    for (const [i, scene] of allScenes.entries()) {
      const heading = (scene.heading || "").toLowerCase();
      const desc = (scene.description || "").toLowerCase();
      const combined = `${heading} ${desc}`;
      const originalHeading = scene.heading || `Scene ${i + 1}`;

      // Check for explicit return-to-present markers
      if (RETURN_KEYWORDS.some(kw => combined.includes(kw))) {
        currentTimePeriod = String(baseYear);
        continue;
      }

      // "PRESENT DAY" in heading = return to base
      if (/present\s*day/i.test(heading)) {
        currentTimePeriod = String(baseYear);
        continue;
      }

      for (const kw of FLASHBACK_KEYWORDS) {
        if (!combined.includes(kw)) continue;

        const type = kw.includes("forward") || kw.includes("later") ? "Flash Forward"
          : kw.includes("memory") ? "Memory" : "Flashback";

        let calculatedYear = "";
        const explicitYear = (originalHeading + " " + (scene.description || ""))
          .match(/\b(1[0-9]{3}|2[0-9]{3})\b/);
        if (explicitYear) {
          calculatedYear = explicitYear[1];
        } else {
          const numberWords: Record<string, number> = {
            one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
            eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
            fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
            nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
          };
          const relMatch = combined.match(/(\d+|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty))\s+(years?|months?|days?)\s+(earlier|ago|before|later|after|forward)/i);
          if (relMatch) {
            let num = parseInt(relMatch[1], 10);
            if (isNaN(num)) num = numberWords[relMatch[1].toLowerCase()] || 0;
            const unit = relMatch[2].toLowerCase();
            const direction = relMatch[3].toLowerCase();
            const isPast = ["earlier", "ago", "before"].includes(direction);
            if (unit.startsWith("year") && num > 0) {
              calculatedYear = String(isPast ? baseYear - num : baseYear + num);
            } else if (unit.startsWith("month") && num > 0) {
              const yearOffset = Math.round(num / 12);
              calculatedYear = yearOffset >= 1
                ? `~${isPast ? baseYear - yearOffset : baseYear + yearOffset}`
                : `${baseYear} (${num} months ${isPast ? "earlier" : "later"})`;
            } else if (unit.startsWith("day") && num > 0) {
              calculatedYear = `${baseYear} (${num} days ${isPast ? "earlier" : "later"})`;
            }
          }
        }

        // Skip if returning to an already-established time period
        const periodKey = calculatedYear || type;
        if (seenTimePeriods.has(periodKey)) {
          currentTimePeriod = periodKey;
          break;
        }

        seenTimePeriods.add(periodKey);
        currentTimePeriod = periodKey;
        shifts.push({
          type,
          sceneHeading: originalHeading,
          sceneIndex: i,
          sceneNumber: scene.scene_number || i + 1,
          calculatedYear,
          pageNumber: scenePages[i] || 1,
        });
        break;
      }
    }
    return shifts;
  }, [devParsedScenes, secondaryTimePeriods.length, film?.time_period, timePeriod]);

  /* Fetch raw script text for a scene preview popup */
  const fetchSceneText = useCallback(async (sceneNumber: number, highlight?: string) => {
    if (!filmId) return;
    const { data } = await supabase
      .from("parsed_scenes")
      .select("heading, raw_text")
      .eq("film_id", filmId)
      .eq("scene_number", sceneNumber)
      .limit(1)
      .maybeSingle();
    if (data) setScriptPreview({ heading: data.heading, text: data.raw_text, highlight });
  }, [filmId]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Phase header */}
      <header className="shrink-0 border-b border-border bg-card px-6 py-3 flex items-baseline gap-3">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground whitespace-nowrap">Development</h1>
        <p className="text-xs text-muted-foreground truncate">Script analysis, visual DNA, and content safety — the creative blueprint for your film.</p>
      </header>

      <Tabs value={activeTab} onValueChange={(v) => {
          if (v === "vision" && !fundamentalsLocked) {
            toast({ title: "Fundamentals must be locked first", description: "Complete and lock the Fundamentals section before accessing Vision.", variant: "destructive" });
            return;
          }
          if (v === "breakdown" && !visionComplete) {
            toast({ title: "Vision must be locked first", description: "Complete and lock the Vision section before accessing Scene Breakdown.", variant: "destructive" });
            return;
          }
          setActiveTab(v);
        }} className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 bg-card/60 backdrop-blur-sm px-6">
          <TabsList className="h-auto bg-transparent gap-0 p-0 border-b border-border items-end">
            <DevelopmentTab value="fundamentals" icon={Film} label="Fundamentals" locked={fundamentalsLocked} />
            <DevelopmentTab value="vision" icon={Camera} label="Vision" disabled={!fundamentalsLocked} locked={visionComplete} />
            <DevelopmentTab value="breakdown" icon={ScrollText} label="Scene Breakdown" disabled={!visionComplete} />
          </TabsList>
        </div>

        {/* ═══ FUNDAMENTALS TAB ═══ */}
        <TabsContent value="fundamentals" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="mx-auto max-w-5xl px-6 pt-6 pb-10 space-y-6">
              {/* ── Script Details ── */}
              <Collapsible open={scriptSectionOpen} onOpenChange={setScriptSectionOpen}>
                <CollapsibleTrigger className="w-full">
                  <div data-help-id="dev-film-details" className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Film className="h-5 w-5 text-primary" />
                      <h3 className="font-display text-lg font-bold">Script</h3>
                      {analysis && (
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-primary" /> Uploaded
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {analysis?.status === "complete" && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</Label>
                        <Input
                          value={filmTitle}
                          onChange={(e) => setFilmTitle(e.target.value)}
                          placeholder="Film title"
                          disabled={scriptLocked}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Version</Label>
                        <Input
                          value={versionName}
                          onChange={(e) => setVersionName(e.target.value)}
                          placeholder="e.g. Draft 1, Final Cut"
                          disabled={scriptLocked}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Writers</Label>
                        <Input
                          value={writers}
                          onChange={(e) => setWriters(e.target.value)}
                          placeholder="e.g. Jane Doe & John Smith"
                          disabled={scriptLocked}
                        />
                      </div>
                    </div>
                    {!scriptLocked && !analysis && (
                      <div className="flex justify-end">
                        <Button
                          onClick={handleSaveMeta}
                          disabled={metaSaving || (!metaDirty && metaSaved)}
                          className="gap-1.5"
                          size="sm"
                        >
                          {metaSaving ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                          ) : metaSaved && !metaDirty ? (
                            <><CheckCircle className="h-4 w-4" /> Saved</>
                          ) : (
                            <><Save className="h-4 w-4" /> Save Details</>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Script file info or upload — shown after details are saved */}
                    {(metaSaved || analysis) && (
                      <>
                        <div className="border-t border-border my-2" />
                        {analysis ? (
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-display font-semibold text-foreground truncate">{analysis.file_name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {analysis.status === "complete" ? "Analysis complete" : analysis.status === "error" ? "Analysis failed" : "Analyzing…"}
                              </p>
                            </div>
                            {analysis.status === "complete" && !scriptLocked && (
                              <Button
                                onClick={() => setReanalyzeDialogOpen(true)}
                                disabled={isAnalyzing}
                                variant="outline"
                                size="sm"
                                className="gap-1.5 shrink-0"
                              >
                                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Reanalyze
                              </Button>
                            )}

                            {/* Reanalyze confirmation dialog */}
                            <AlertDialog open={reanalyzeDialogOpen} onOpenChange={setReanalyzeDialogOpen}>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-destructive" />
                                    Reanalyze Script?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-left space-y-3">
                                    <p>
                                      Reanalyzing will <strong>permanently wipe all existing work</strong> in this version — including characters, shots, assets, director vision, content ratings, production bible, and all post-production data.
                                    </p>
                                    <p>
                                      The entire pipeline will start from scratch.
                                    </p>
                                    <p className="rounded-lg bg-muted p-3 text-sm">
                                      <strong>Recommendation:</strong> Duplicate this version first and import the updated script there instead. This preserves your current work as a backup.
                                    </p>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => {
                                      setReanalyzeDialogOpen(false);
                                      handleAnalyze();
                                    }}
                                  >
                                    Wipe & Reanalyze
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ) : (
                          <>
                            <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS.join(",")} className="hidden" onChange={handleFileChange} />
                            <div
                              onClick={() => !uploading && fileInputRef.current?.click()}
                              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                              onDragLeave={() => setDragOver(false)}
                              onDrop={handleDrop}
                              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 transition-colors cursor-pointer backdrop-blur-md bg-card/50 ${
                                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                              }`}
                            >
                              {uploading ? (
                                <>
                                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs font-display font-semibold text-foreground">Uploading…</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Please wait while your file uploads</p>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="gap-1.5 text-[10px]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      uploadAbortRef.current?.abort();
                                      setUploading(false);
                                      toast({ title: "Upload cancelled" });
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                    Quit Uploading
                                  </Button>
                                </>
                              ) : uploadedFile ? (
                                <>
                                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                                    <CheckCircle className="h-6 w-6 text-green-500" />
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm font-display font-semibold text-foreground flex items-center gap-2 justify-center">
                                      <FileText className="h-4 w-4" /> {uploadedFile}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">Click or drop to replace</p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-center">
                                    <p className="text-xs font-display font-semibold text-foreground">
                                      Drop your screenplay here
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{ACCEPTED_LABEL} — or click to browse</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-[10px] text-muted-foreground">
                                    <Upload className="h-3 w-3" />
                                    Upload Script
                                  </div>
                                </>
                              )}
                            </div>
                            {uploadedFile && !analysis && (
                              <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full mt-2 gap-2" size="lg">
                                {isAnalyzing ? (
                                  <><Loader2 className="h-4 w-4 animate-spin" />Analyzing Script…</>
                                ) : (
                                  <><Sparkles className="h-4 w-4" />Analyze Script — Visual Breakdown</>
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ── Step 2: Analysis Results / Review Section ── */}
              {(isAnalyzing || analysis?.status === "complete" || analysis?.status === "error") && (
                <section>
                  {analysis?.status !== "complete" && (
                    <Collapsible defaultOpen>
                      <CollapsibleTrigger className="w-full">
                        <div data-help-id="dev-script-breakdown" className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2">
                            <ScrollText className="h-5 w-5 text-primary" />
                            <h3 className="font-display text-lg font-bold">Script Analysis</h3>
                            {isAnalyzing && (
                              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin text-primary" /> Processing
                              </span>
                            )}
                            {analysis?.status === "error" && (
                              <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Error
                              </span>
                            )}
                          </div>
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6 space-y-4">
                          {/* Loading state with progress */}
                          {isAnalyzing && <AnalysisProgress status={analysis?.status} filmId={filmId} onCancel={async () => {
                            setAnalyzing(false);
                            if (analysis?.id) {
                              await supabase.from("script_analyses").update({ status: "error", error_message: "Cancelled by user" }).eq("id", analysis.id);
                              queryClient.invalidateQueries({ queryKey: ["script-analysis", filmId] });
                            }
                            toast({ title: "Processing cancelled" });
                          }} />}

                          {/* Error state */}
                          {analysis?.status === "error" && (
                            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
                              <div className="flex items-center gap-3">
                                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                                <div>
                                  <p className="font-display font-semibold text-sm">Analysis Failed</p>
                                  <p className="text-sm text-muted-foreground">{analysis.error_message || "Unknown error"}</p>
                                </div>
                              </div>
                              <Button
                                onClick={async () => {
                                  setAnalyzing(true);
                                  const { error: invokeErr } = await supabase.functions.invoke("parse-script", {
                                    body: { analysis_id: analysis.id },
                                  });
                                  if (invokeErr) {
                                    setAnalyzing(false);
                                    toast({ title: "Retry failed", description: invokeErr.message, variant: "destructive" });
                                  } else {
                                    // Run finalize + director fit (same as main analyze flow)
                                    runPostEnrichment(analysis.id);
                                    setAnalyzing(false);
                                    queryClient.invalidateQueries({ queryKey: ["script-analysis", filmId] });
                                  }
                                }}
                                disabled={isAnalyzing}
                                className="gap-2"
                                variant="outline"
                              >
                                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Analyze Again
                              </Button>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Complete results — Fundamentals sections */}
                  {analysis?.status === "complete" && (
                    <div className="space-y-6">
                      {/* ── Format / Time Period / Genre — side-by-side ── */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* ── Format ── */}
                      <Collapsible>
                        <CollapsibleTrigger className="w-full">
                          <div data-help-id="dev-format-specs" className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 hover:bg-accent/30 transition-colors cursor-pointer h-full">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Monitor className="h-5 w-5 text-primary" />
                                <h3 className="font-display text-sm font-bold">Format</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                {formatType ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                                )}
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                            {formatType && (() => {
                              const preset = FORMAT_PRESETS.find(p => p.value === formatType);
                              return preset ? (
                                <p className="text-xs text-muted-foreground text-left truncate">{preset.label} ({preset.aspect})</p>
                              ) : null;
                            })()}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Select the output format. This determines frame size, aspect ratio, and frame rate for all generated images and clips.
                            </p>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format Type</Label>
                              <Select value={formatType || undefined} onValueChange={handleFormatChange}>
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Select a format…" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border border-border z-[9999]">
                                  {(() => {
                                    let lastCat = "";
                                    return FORMAT_PRESETS.map((p) => {
                                      const showLabel = p.category !== lastCat;
                                      lastCat = p.category;
                                      return (
                                        <span key={p.value}>
                                          {showLabel && (
                                            <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground select-none">
                                              {p.category}
                                            </div>
                                          )}
                                          <SelectItem value={p.value}>
                                            {p.label}{(p.category === "Social & Digital" || p.category === "Specialty") ? ` (${p.aspect})` : ""}
                                          </SelectItem>
                                        </span>
                                      );
                                    });
                                  })()}
                                </SelectContent>
                              </Select>
                            </div>

                            {formatType && (
                              <>
                                {(() => {
                                  const preset = FORMAT_PRESETS.find(p => p.value === formatType);
                                  if (!preset) return null;
                                  const displayWidth = fourKEnabled && preset.fourK ? preset.fourK.width : preset.width;
                                  const displayHeight = fourKEnabled && preset.fourK ? preset.fourK.height : preset.height;
                                  return (
                                    <div className="rounded-lg bg-secondary/50 border border-border p-3 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Industry Standard</span>
                                        <span className="text-xs text-muted-foreground">{preset.aspect}</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-3 text-sm">
                                        <div>
                                          <span className="text-[10px] text-muted-foreground uppercase">Width</span>
                                          <p className="font-display font-bold text-foreground">{displayWidth}px</p>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-muted-foreground uppercase">Height</span>
                                          <p className="font-display font-bold text-foreground">{displayHeight}px</p>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-muted-foreground uppercase">Frame Rate</span>
                                          <p className="font-display font-bold text-foreground">{preset.fps} fps</p>
                                        </div>
                                      </div>

                                      {preset.fourK && (
                                        <div className="space-y-2 pt-1">
                                          <div className="flex items-center gap-2">
                                            <Switch
                                              checked={fourKEnabled}
                                              onCheckedChange={(val) => {
                                                setFourKEnabled(val);
                                                if (!formatOverride) {
                                                  const dims = val ? preset.fourK! : { width: preset.width, height: preset.height };
                                                  setFrameWidth(dims.width);
                                                  setFrameHeight(dims.height);
                                                  setFrameRate(preset.fps);
                                                }
                                              }}
                                            />
                                            <Label className="text-xs text-muted-foreground">4K Resolution</Label>
                                          </div>
                                          {fourKEnabled && (
                                            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-2">
                                              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                              <p className="text-xs text-destructive">
                                                4K video generation uses significantly more credits and takes longer to render. Use only when high-resolution output is essential.
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={formatOverride}
                                    onCheckedChange={(val) => {
                                      setFormatOverride(val);
                                      if (!val) {
                                        const preset = FORMAT_PRESETS.find(p => p.value === formatType);
                                        if (preset) {
                                          const w = fourKEnabled && preset.fourK ? preset.fourK.width : preset.width;
                                          const h = fourKEnabled && preset.fourK ? preset.fourK.height : preset.height;
                                          setFrameWidth(w);
                                          setFrameHeight(h);
                                          setFrameRate(preset.fps);
                                        }
                                      }
                                    }}
                                    disabled={false}
                                  />
                                  <Label className="text-xs text-muted-foreground">Override defaults</Label>
                                </div>

                                {formatOverride && (
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Width (px)</Label>
                                      <Input
                                        type="number"
                                        value={frameWidth ?? ""}
                                        onChange={(e) => setFrameWidth(e.target.value ? parseInt(e.target.value) : null)}
                                        disabled={false}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Height (px)</Label>
                                      <Input
                                        type="number"
                                        value={frameHeight ?? ""}
                                        onChange={(e) => setFrameHeight(e.target.value ? parseInt(e.target.value) : null)}
                                        disabled={false}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">FPS</Label>
                                      <Input
                                        type="number"
                                        value={frameRate ?? ""}
                                        onChange={(e) => setFrameRate(e.target.value ? parseFloat(e.target.value) : null)}
                                        disabled={false}
                                      />
                                    </div>
                                  </div>
                                )}

                                <div className="flex justify-end">
                                  <Button
                                    onClick={handleSaveFormat}
                                    disabled={formatSaving}
                                    className="gap-1.5"
                                    size="sm"
                                  >
                                    {formatSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save Format
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* ── Time Period ── */}
                      <Collapsible>
                        <CollapsibleTrigger className="w-full">
                          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 hover:bg-accent/30 transition-colors cursor-pointer h-full">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-primary" />
                                <h3 className="font-display text-sm font-bold">Time Period</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                {film?.time_period ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                                )}
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                            {film?.time_period && (
                              <p className="text-xs text-muted-foreground text-left truncate">
                                {film.time_period}{secondaryTimePeriods.length > 0 ? `, +${secondaryTimePeriods.length} secondary` : ""}
                              </p>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Set when most of this film takes place. This anchors the visual language for all downstream phases.
                            </p>

                            {/* AI-detected primary time period with confidence */}
                            {temporalAnalysis?.primary_time_period && (
                              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-semibold text-foreground">AI Detection</span>
                                  </div>
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                    temporalAnalysis.primary_time_period.confidence === "High" && "bg-green-500/20 text-green-400",
                                    temporalAnalysis.primary_time_period.confidence === "Medium" && "bg-yellow-500/20 text-yellow-400",
                                    temporalAnalysis.primary_time_period.confidence === "Low" && "bg-red-500/20 text-red-400",
                                  )}>
                                    {temporalAnalysis.primary_time_period.confidence} confidence
                                  </span>
                                </div>
                                <p className="text-sm font-display font-bold text-foreground">
                                  {temporalAnalysis.primary_time_period.estimated_year_or_era}
                                </p>
                                {Array.isArray(temporalAnalysis.primary_time_period.evidence) && temporalAnalysis.primary_time_period.evidence.length > 0 && (
                                  <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-4 list-disc">
                                    {temporalAnalysis.primary_time_period.evidence.map((e: string, i: number) => (
                                      <li key={i}>{e}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}

                            <div className="flex gap-3">
                              <Input
                                placeholder="e.g. 1970s, Near-future 2084, Victorian Era, Present Day"
                                value={timePeriod}
                                onChange={(e) => setTimePeriod(e.target.value)}
                                disabled={scriptLocked}
                                className="flex-1"
                              />
                              <Button
                                onClick={handleSaveTimePeriod}
                                disabled={timePeriodSaving || scriptLocked || timePeriod === (film?.time_period ?? "")}
                                className="gap-1.5 shrink-0"
                              >
                                {timePeriodSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save
                              </Button>
                            </div>
                            {film?.time_period && (
                              <p className="text-xs text-muted-foreground/70 flex items-center gap-1.5">
                                <Clock className="h-3 w-3" /> Current: <span className="font-semibold text-foreground">{film.time_period}</span>
                              </p>
                            )}

                            {/* AI-detected secondary time periods */}
                            {secondaryTimePeriods.length > 0 && (
                              <div className="border-t border-border pt-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <Rewind className="h-4 w-4 text-primary" />
                                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Secondary Time Periods ({secondaryTimePeriods.length})
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Additional time periods detected in the script — flashbacks, flashforwards, dream sequences, and more.
                                </p>
                                <div className="space-y-2">
                                  {secondaryTimePeriods.map((period: any, i: number) => {
                                    const matchedScenes = (period.scene_sluglines || []).map((slug: string) => {
                                      const allScenes = (devParsedScenes || []) as any[];
                                      const CHARS_PER_PAGE = 3000;
                                      let cumChars = 0;
                                      for (const sc of allScenes) {
                                        const rawLen = (sc.raw_text || sc.description || "").length || 200;
                                        const page = Math.floor(cumChars / CHARS_PER_PAGE) + 1;
                                        cumChars += rawLen;
                                        if ((sc.scene_heading || sc.heading || "").toLowerCase().includes(slug.toLowerCase()) ||
                                            slug.toLowerCase().includes((sc.scene_heading || sc.heading || "").toLowerCase())) {
                                          return { slug, sceneNumber: sc.scene_number || 0, page };
                                        }
                                      }
                                      return { slug, sceneNumber: 0, page: 0 };
                                    });

                                    return (
                                      <div key={i} className="rounded-lg bg-secondary p-3 space-y-2">
                                        <div className="flex items-center gap-3">
                                          <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 shrink-0">
                                            {(period.type || "").toLowerCase().includes("forward") || (period.type || "").toLowerCase().includes("epilogue") ? (
                                              <FastForward className="h-3.5 w-3.5 text-primary" />
                                            ) : (
                                              <Rewind className="h-3.5 w-3.5 text-primary" />
                                            )}
                                          </span>
                                          <div className="flex-1 min-w-0 space-y-1">
                                            <SecondaryTimePeriodField
                                              initialValue={period.label || ""}
                                              placeholder="Label…"
                                              disabled={!!scriptLocked}
                                              fieldKey="label"
                                              analysisId={analysis.id}
                                              periodIndex={i}
                                              globalElements={analysis.global_elements as any}
                                              className="text-xs font-semibold text-foreground bg-transparent border-transparent hover:border-border focus:border-primary h-6 px-1"
                                            />
                                            <SecondaryTimePeriodField
                                              initialValue={period.type || ""}
                                              placeholder="Type (e.g. Flashback)…"
                                              disabled={!!scriptLocked}
                                              fieldKey="type"
                                              analysisId={analysis.id}
                                              periodIndex={i}
                                              globalElements={analysis.global_elements as any}
                                              className="text-[10px] text-muted-foreground bg-transparent border-transparent hover:border-border focus:border-primary h-5 px-1"
                                            />
                                          </div>
                                          <SecondaryTimePeriodField
                                            initialValue={period.estimated_year_or_range || ""}
                                            placeholder="e.g. 1955"
                                            disabled={!!scriptLocked}
                                            fieldKey="estimated_year_or_range"
                                            analysisId={analysis.id}
                                            periodIndex={i}
                                            globalElements={analysis.global_elements as any}
                                            className="w-32 h-7 text-xs bg-yellow-500/20 text-yellow-300 border-yellow-500/40 font-semibold text-center"
                                          />
                                          {!scriptLocked && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                              onClick={async () => {
                                                const updated = { ...analysis.global_elements as any };
                                                if (updated.temporal_analysis?.secondary_time_periods) {
                                                  updated.temporal_analysis.secondary_time_periods.splice(i, 1);
                                                  await supabase.from("script_analyses").update({ global_elements: updated }).eq("id", analysis.id);
                                                  queryClient.invalidateQueries({ queryKey: ["latest-analysis", filmId] });
                                                }
                                              }}
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          )}
                                        </div>
                                        {matchedScenes.length > 0 && (
                                          <div className="space-y-1 pl-9">
                                            {matchedScenes.map((ms: any, j: number) => (
                                              <div key={j} className="flex items-center gap-2">
                                                <button
                                                  onClick={() => fetchSceneText(ms.sceneNumber, ms.slug)}
                                                  className="shrink-0 flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                                                  title="View scene in script"
                                                >
                                                  <FileText className="h-3 w-3" />
                                                  Sc.{ms.sceneNumber}
                                                </button>
                                                <span className="text-[11px] text-muted-foreground truncate flex-1">{ms.slug}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {Array.isArray(period.evidence) && period.evidence.length > 0 && (
                                          <ul className="text-[10px] text-muted-foreground space-y-0.5 pl-9 list-disc">
                                            {period.evidence.map((e: string, j: number) => (
                                              <li key={j}>{e}</li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Legacy fallback: keyword-detected time shifts */}
                            {timeShifts.length > 0 && (
                              <div className="border-t border-border pt-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <Rewind className="h-4 w-4 text-primary" />
                                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Detected Time Shifts ({timeShifts.length})
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  The script references flashbacks, flash forwards, or other time periods.
                                </p>
                                <div className="space-y-2">
                                  {timeShifts.map((shift, i) => (
                                    <div key={i} className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                                      <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 shrink-0">
                                        {shift.type.includes("Forward") ? (
                                          <FastForward className="h-3.5 w-3.5 text-primary" />
                                        ) : (
                                          <Rewind className="h-3.5 w-3.5 text-primary" />
                                        )}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-foreground truncate">{shift.sceneHeading}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase">{shift.type} · Scene {shift.sceneNumber}</p>
                                      </div>
                                      <button
                                        onClick={() => fetchSceneText(shift.sceneNumber)}
                                        className="shrink-0 flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                                        title="View script page"
                                      >
                                        <FileText className="h-3 w-3" />
                                        p.{shift.pageNumber}
                                      </button>
                                      <Input
                                        defaultValue={shift.calculatedYear}
                                        placeholder="e.g. 1955"
                                        className="w-40 h-8 text-xs"
                                        disabled={scriptLocked}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* ── Genre ── */}
                      {(() => {
                        const GENRE_OPTIONS = ["Action", "Comedy", "Docu-drama", "Drama", "Horror", "Sci-Fi", "Fantasy", "Animation", "Thriller", "Romance", "Documentary", "Musical", "Western", "Mystery", "Crime", "Adventure", "War", "Biographical", "Historical", "Noir", "Satire", "Supernatural"];
                        const availableGenres = GENRE_OPTIONS.filter((g) => !genres.includes(g));
                        const removeGenre = (g: string) => {
                          const next = genres.filter((x) => x !== g);
                          setGenres(next);
                          supabase.from("films").update({ genres: next } as any).eq("id", filmId!);
                        };
                        const addGenre = (g: string) => {
                          if (genres.includes(g)) return;
                          const next = [...genres, g];
                          setGenres(next);
                          setGenreDropdownOpen(false);
                          supabase.from("films").update({ genres: next } as any).eq("id", filmId!);
                        };
                        return (
                          <Collapsible>
                            <CollapsibleTrigger className="w-full">
                              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 hover:bg-accent/30 transition-colors cursor-pointer h-full">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Clapperboard className="h-5 w-5 text-primary" />
                                    <h3 className="font-display text-sm font-bold">Genre</h3>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {genres.length > 0 ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                                    )}
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                                {genres.length > 0 && (
                                  <p className="text-xs text-muted-foreground text-left truncate">{genres.join(", ")}</p>
                                )}
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  {genres.map((g) => (
                                    <span key={g} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 font-medium">
                                      {g}
                                      <button onClick={() => removeGenre(g)} className="hover:text-destructive transition-colors" disabled={scriptLocked}>
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                  {/* Add genre dropdown */}
                                  {availableGenres.length > 0 && !scriptLocked && (
                                    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setGenreDropdownOpen(false); }}>
                                      <button
                                        onClick={() => setGenreDropdownOpen(!genreDropdownOpen)}
                                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-full px-2.5 py-1 hover:border-primary/40 transition-colors"
                                      >
                                        <Plus className="h-3 w-3" />
                                        Add
                                      </button>
                                      {genreDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 w-44 max-h-60 overflow-y-auto">
                                          {availableGenres.map((g) => (
                                            <button
                                              key={g}
                                              onClick={() => addGenre(g)}
                                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors text-foreground"
                                            >
                                              {g}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {genres.length === 0 && (
                                  <p className="text-xs text-muted-foreground/50 italic">No genres set — run script analysis to auto-detect</p>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })()}
                      </div>

                      {/* Global Elements */}
                      {analysis.global_elements && (
                        <Collapsible>
                          <CollapsibleTrigger className="w-full">
                            <div data-help-id="dev-global-elements" className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-primary" />
                                <h3 className="font-display text-lg font-bold">Global Elements</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                {allElementsReviewed ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                                )}
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                            <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6">
                              <GlobalElementsManager data={analysis.global_elements as any} analysisId={analysis.id} filmId={analysis.film_id} onAllReviewedChange={setAllElementsReviewed} sceneLocations={sceneLocations} scenePropOwnership={scenePropOwnership} />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* ── Ratings Classification (Content Safety) ── */}
                      {devParsedScenes && devParsedScenes.length > 0 && (
                        <section data-help-id="dev-content-safety">
                          {scriptLocked ? (
                            <Collapsible>
                              <CollapsibleTrigger className="w-full">
                                <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-primary" />
                                    <h3 className="font-display text-lg font-bold">Ratings Classification</h3>
                                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded flex items-center gap-1">
                                      <Lock className="h-3 w-3" /> Locked
                                    </span>
                                  </div>
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                                <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground">
                                      Script breakdown and content safety analysis are locked. Changes are propagated to Production and downstream phases.
                                    </p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shrink-0 ml-4"
                                      onClick={handleUnlockScript}
                                      disabled={locking}
                                    >
                                      {locking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                                      Unlock
                                    </Button>
                                  </div>
                                  <ContentSafetyMatrix
                                    scenes={devParsedScenes as any[] || []}
                                    storagePath={analysis?.storage_path || ""}
                                    filmId={filmId}
                                    language={language}
                                    nudity={nudity}
                                    violence={violence}
                                    handleToggle={handleToggle}
                                    setLanguage={setLanguage}
                                    setNudity={setNudity}
                                    setViolence={setViolence}
                                    alreadyAnalyzed={ratingsApproved}
                                  />
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : (
                            <Collapsible>
                              <CollapsibleTrigger className="w-full">
                                <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <Film className="h-5 w-5 text-primary" />
                                    <h3 className="font-display text-lg font-bold">Ratings Classification</h3>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {ratingsApproved ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                                    )}
                                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                                <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6">
                                  {!contentSafetyRun ? (
                                    <div className="flex flex-col items-center gap-4 text-center py-4">
                                      <p className="text-sm text-muted-foreground max-w-md">
                                        Run the AI-powered content safety analysis to scan your script against MPAA guidelines and flag potential concerns.
                                      </p>
                                      <Button
                                        onClick={() => setContentSafetyRun(true)}
                                        size="lg"
                                        className="gap-2"
                                      >
                                        Run Content Safety Analysis
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="space-y-6">
                                      <ContentSafetyMatrix
                                        scenes={devParsedScenes as any[] || []}
                                        storagePath={analysis?.storage_path || ""}
                                        filmId={filmId}
                                        language={language}
                                        nudity={nudity}
                                        violence={violence}
                                        handleToggle={handleToggle}
                                        setLanguage={setLanguage}
                                        setNudity={setNudity}
                                        setViolence={setViolence}
                                        alreadyAnalyzed={ratingsApproved}
                                      />
                                    </div>
                                  )}
                                  <div className="flex justify-end pt-4 border-t border-border mt-4">
                                    <Button
                                      size="sm"
                                      variant={ratingsApproved ? "default" : "outline"}
                                      className={cn("gap-1.5", ratingsApproved ? "bg-green-600 hover:bg-green-700 text-white" : "opacity-60")}
                                      onClick={() => {
                                        const next = !ratingsApproved;
                                        setRatingsApproved(next);
                                        persistApproval("ratings_approved", next);
                                      }}
                                    >
                                      <ThumbsUp className="h-3 w-3" />
                                      {ratingsApproved ? "Approved" : "Approve"}
                                    </Button>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </section>
                      )}

                      {analysis.visual_summary && directorProfile && (
                        <Collapsible>
                          <CollapsibleTrigger className="w-full">
                            <div data-help-id="dev-visual-summary" className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Film className="h-5 w-5 text-primary" />
                                <h3 className="font-display text-lg font-bold">Visual Story Summary</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                {visualSummaryApproved ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                                )}
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <EditableVisualSummary
                              analysisId={analysis.id}
                              initialSummary={analysis.visual_summary as string || ""}
                              initialStyle={(analysis.global_elements as any)?.signature_style || ""}
                              globalElements={analysis.global_elements as any}
                              approved={visualSummaryApproved}
                              onApprovedChange={(v: boolean) => {
                                setVisualSummaryApproved(v);
                                persistApproval("visual_summary_approved", v);
                              }}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  )}
                </section>
              )}
              {/* Lock Fundamentals */}
              {analysis?.status === "complete" && !fundamentalsLocked && (
                <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center gap-3">
                  <Button
                    size="lg"
                    onClick={() => { setFundamentalsLocked(true); setActiveTab("vision"); }}
                    className="w-full max-w-sm h-11 font-display font-bold uppercase tracking-wider gap-2"
                  >
                    <Lock className="h-4 w-4" /> Lock Fundamentals
                  </Button>
                  <p className="text-xs text-muted-foreground">Lock fundamentals to proceed to Vision.</p>
                </div>
              )}
              {fundamentalsLocked && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <p className="text-sm font-medium text-green-400">Fundamentals locked</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ VISION TAB ═══ */}
        <TabsContent value="vision" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="mx-auto max-w-5xl px-6 pt-6 pb-10 space-y-6">
              {analysis?.status === "complete" && fundamentalsLocked ? (
                <>
                  {/* ── Director's Vision ── */}
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="w-full">
                      <div data-help-id="dev-director-vision" className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Camera className="h-5 w-5 text-primary" />
                          <h3 className="font-display text-lg font-bold">Director's Vision</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {directorProfile ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          )}
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6">
                        <DirectorVisionPanel disabled={scriptLocked} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Production Bible */}
                  {directorProfile && (
                    <Collapsible defaultOpen>
                      <CollapsibleTrigger className="w-full">
                        <div data-help-id="dev-production-bible" className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            <h3 className="font-display text-lg font-bold">Production Bible</h3>
                          </div>
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6">
                          <ProductionBiblePanel />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Lock Vision */}
                  {!visionComplete && !propagating && directorProfile && (() => {
                    const canLockVision = allElementsReviewed && ratingsApproved && !!directorProfile && bibleComplete;
                    const missingItems: string[] = [];
                    if (!allElementsReviewed) missingItems.push("Global Elements");
                    if (!ratingsApproved) missingItems.push("Ratings Classification");
                    if (!directorProfile) missingItems.push("Director's Vision");
                    if (!bibleComplete) missingItems.push("Production Bible");
                    return (
                      <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center gap-3">
                        <Button
                          size="lg"
                          disabled={!canLockVision}
                          onClick={async () => {
                            setPropagating(true);
                            if (filmId && analysis?.id) {
                              const { data: unenriched } = await supabase
                                .from("parsed_scenes")
                                .select("id")
                                .eq("film_id", filmId)
                                .eq("enriched", false)
                                .order("scene_number", { ascending: true });
                              if (unenriched && unenriched.length > 0) {
                                runEnrichmentBatches(unenriched.map((s) => s.id), analysis.id);
                              } else {
                                // All already enriched — skip propagation
                                setPropagating(false);
                                setVisionComplete(true);
                                setActiveTab("breakdown");
                              }
                            }
                          }}
                          className="w-full max-w-sm h-11 font-display font-bold uppercase tracking-wider gap-2"
                        >
                          <Lock className="h-4 w-4" /> Lock Vision
                        </Button>
                        {!canLockVision && missingItems.length > 0 ? (
                          <p className="text-xs text-yellow-500 flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Approve all sections first: {missingItems.join(", ")}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Lock vision to proceed to Scene Breakdown.</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Propagation Progress */}
                  {propagating && filmId && (
                    <PropagationProgress
                      filmId={filmId}
                      onComplete={() => {
                        setPropagating(false);
                        setPropagationDone(true);
                        setVisionComplete(true);
                        setActiveTab("breakdown");
                      }}
                    />
                  )}

                  {visionComplete && !propagating && (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 flex items-center justify-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <p className="text-sm font-medium text-green-400">Vision locked & implemented</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">Lock Fundamentals to unlock the Vision section.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ SCENE BREAKDOWN TAB ═══ */}
        <TabsContent value="breakdown" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="mx-auto max-w-5xl px-6 pt-6 pb-10 space-y-6">
              {analysis?.status === "complete" && visionComplete ? (
                <>
                  <SceneBreakdownFromDB
                    filmId={filmId!}
                    storagePath={analysis.storage_path}
                    breakdownOpen={breakdownOpen}
                    setBreakdownOpen={setBreakdownOpen}
                    onAllApprovedChange={setAllScenesApproved}
                    onReviewStatsChange={setReviewStats}
                    analysisId={analysis.id}
                    reviewStats={reviewStats}
                  />

                  {/* ── Lock Script ── */}
                  {devParsedScenes && devParsedScenes.length > 0 && !scriptLocked && ratingsApproved && (
                    <section>
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="w-full">
                          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-5 w-5 text-destructive" />
                              <h3 className="font-display text-lg font-bold">Lock Script</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              {allScenesApproved && allElementsReviewed && film?.time_period && visualSummaryApproved && ratingsApproved ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                              )}
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6 space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                                <Lock className="h-6 w-6 text-destructive" />
                              </div>
                              <div className="flex-1">
                                <p className="font-display font-semibold text-foreground">Ready to Lock Script</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Locking finalizes your script breakdown, visual settings, and content safety classifications. All data will be propagated throughout Production and Post-Production.
                                </p>
                                {!allElementsReviewed && (
                                  <p className="text-xs text-yellow-500 mt-2 flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    All Global Elements sections must be marked as "Completed" before locking.
                                  </p>
                                )}
                              </div>
                              <Button
                                onClick={handleLockScript}
                                disabled={locking || !film?.time_period || !allElementsReviewed}
                                size="lg"
                                variant="destructive"
                                className="gap-2 shrink-0"
                              >
                                {locking ? (
                                  <><Loader2 className="h-4 w-4 animate-spin" /> Locking…</>
                                ) : (
                                  <><Lock className="h-4 w-4" /> Lock Script</>
                                )}
                              </Button>
                            </div>
                            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-1.5">
                              <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                                ⚠ This action cannot be undone
                              </p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                Once locked, all settings — characters, locations, visual direction, and ratings — become permanent for this version. If you need to make changes after locking, you must create a new version copy from the Project Versions page with the option to reset specific settings.
                              </p>
                            </div>
                            {!film?.time_period && (
                              <p className="text-xs text-destructive flex items-center gap-1.5">
                                <Clock className="h-3 w-3" /> A time period must be set before locking.
                              </p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </section>
                  )}
                  {/* Development Complete */}
                  <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center gap-3">
                    <Button
                      size="lg"
                      onClick={() => setDevComplete(true)}
                      disabled={devComplete}
                      className={cn(
                        "w-full max-w-md h-12 text-base font-display font-bold uppercase tracking-wider transition-all duration-300",
                        devComplete
                          ? "bg-green-600 hover:bg-green-600 text-white border-green-500 [box-shadow:0_0_20px_-4px_rgba(22,163,74,0.5)]"
                          : ""
                      )}
                    >
                      {devComplete ? (
                        <>
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Development Complete
                        </>
                      ) : (
                        "Development Complete"
                      )}
                    </Button>
                    {devComplete && (
                      <p className="text-xs font-medium text-green-400 flex items-center gap-1.5">
                        <Lock className="h-3 w-3" />
                        Development is now locked.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">Lock Vision to unlock the Scene Breakdown.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>




      {/* Script text preview popup — draggable & resizable, top-level so it works from any section */}
      <DraggableScriptPopup
        open={!!scriptPreview}
        onClose={() => setScriptPreview(null)}
        title={scriptPreview?.heading ?? ""}
        subtitle="Original screenplay formatting"
      >
        <div className="px-6 py-4">
          <div
            className="mx-auto bg-white text-black shadow-lg"
            style={{
              fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
              fontSize: "12px",
              lineHeight: "1.0",
              padding: "72px 60px 72px 90px",
              maxWidth: "612px",
              minHeight: "400px",
            }}
          >
            {(() => {
              const highlightTerm = scriptPreview?.highlight?.replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*/i, "").trim();
              const renderHighlighted = (text: string) => {
                if (!highlightTerm || highlightTerm.length < 3) return text;
                const idx = text.toLowerCase().indexOf(highlightTerm.toLowerCase());
                if (idx === -1) return text;
                return (
                  <>
                    {text.slice(0, idx)}
                    <span style={{ backgroundColor: "#FACC15", color: "#000", padding: "0 2px", borderRadius: 2 }}>
                      {text.slice(idx, idx + highlightTerm.length)}
                    </span>
                    {text.slice(idx + highlightTerm.length)}
                  </>
                );
              };

              return scriptPreview?.text.split("\n").map((line, i) => {
                const trimmed = line.trim();
                const isHeading = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(trimmed);
                const isCharacter = trimmed === trimmed.toUpperCase() && trimmed.length > 1 && trimmed.length < 40 && !isHeading && !/^\(/.test(trimmed);
                const isParenthetical = /^\(.*\)$/.test(trimmed);
                const isDialogue = !isHeading && !isCharacter && !isParenthetical && line.startsWith("  ") && !line.startsWith("    ");

                if (isHeading) {
                  return <p key={i} style={{ textTransform: "uppercase", fontWeight: "bold", marginTop: i === 0 ? 0 : 24, marginBottom: 12 }}>{renderHighlighted(trimmed)}</p>;
                }
                if (isCharacter) {
                  return <p key={i} style={{ textAlign: "center", textTransform: "uppercase", marginTop: 18, marginBottom: 0, paddingLeft: "20%" }}>{renderHighlighted(trimmed)}</p>;
                }
                if (isParenthetical) {
                  return <p key={i} style={{ paddingLeft: "25%", fontStyle: "italic", marginBottom: 0, marginTop: 0 }}>{renderHighlighted(trimmed)}</p>;
                }
                if (isDialogue) {
                  return <p key={i} style={{ paddingLeft: "15%", paddingRight: "15%", marginBottom: 0, marginTop: 0 }}>{renderHighlighted(trimmed)}</p>;
                }
                if (!trimmed) return <div key={i} style={{ height: 12 }} />;
                return <p key={i} style={{ marginTop: 12, marginBottom: 0 }}>{renderHighlighted(trimmed)}</p>;
              });
            })()}
          </div>
        </div>
      </DraggableScriptPopup>
    </div>
  );
};

/* ══════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════ */
/* ── Wrapper: loads scenes from parsed_scenes table (single source of truth) ── */
const SceneBreakdownFromDB = ({ filmId, storagePath, breakdownOpen, setBreakdownOpen, onAllApprovedChange, onReviewStatsChange, analysisId, reviewStats }: {
  filmId: string; storagePath: string; breakdownOpen: boolean; setBreakdownOpen: (v: boolean) => void;
  onAllApprovedChange?: (v: boolean) => void; onReviewStatsChange?: (stats: { approved: number; rejected: number; pending: number }) => void;
  analysisId?: string; reviewStats?: { approved: number; rejected: number; pending: number } | null;
}) => {
  const { data: scenes, isLoading } = useQuery({
    queryKey: ["parsed-scenes-breakdown", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parsed_scenes")
        .select("*")
        .eq("film_id", filmId)
        .order("scene_number");
      if (error) throw error;
      // Map parsed_scenes row format to the shape components expect
      return (data || []).map((s: any) => {
        // Reconstruct slug line from structured fields (heading column may contain full scene text)
        let slugLine = "";
        const intExt = (s.int_ext || "").trim().toUpperCase();
        const locName = (s.location_name || "").trim().toUpperCase();
        const dayNight = (s.day_night || "").trim().toUpperCase();
        if (intExt && locName) {
          slugLine = `${intExt}. ${locName}`;
          if (dayNight) slugLine += ` – ${dayNight}`;
        } else {
          // Fallback: try to extract from heading's first line
          const rawHeading = s.heading || "";
          const firstLine = rawHeading.split(/\n/)[0].replace(/\s{2,}/g, " ").trim();
          const slugMatch = firstLine.match(/^((?:INT|EXT|INT\/EXT|I\/E)[.\s/].{0,150}?)(?:\s{2,}|\n|$)/i);
          slugLine = slugMatch ? slugMatch[1].trim() : firstLine.substring(0, 100);
        }
        return {
        scene_number: s.scene_number,
        scene_heading: slugLine,
        description: s.description || "",
        characters: s.characters || [],
        character_details: s.character_details || [],
        key_objects: s.key_objects || [],
        wardrobe: s.wardrobe || [],
        picture_vehicles: s.picture_vehicles || [],
        environment_details: s.environment_details || "",
        stunts: s.stunts || [],
        sfx: s.sfx || [],
        vfx: s.vfx || [],
        sound_cues: s.sound_cues || [],
        animals: s.animals || [],
        extras: s.extras || "",
        special_makeup: s.special_makeup || [],
        mood: s.mood || "",
        int_ext: s.int_ext || "",
        day_night: s.day_night || "",
        location_name: s.location_name || "",
        estimated_page_count: s.estimated_page_count || 0,
        cinematic_elements: s.cinematic_elements || {},
        visual_design: s.visual_design || {},
      };
      });
    },
    enabled: !!filmId,
  });

  if (isLoading || !scenes) return null;

  return (
    <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-bold">Scene Breakdown</h3>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {scenes.length} scenes
            </span>
            {reviewStats && (reviewStats.approved > 0 || reviewStats.rejected > 0) && (
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {reviewStats.approved} approved · {reviewStats.rejected} rejected · {reviewStats.pending} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${breakdownOpen ? "rotate-180" : ""}`} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6">
          <SceneBreakdownSection
            scenes={scenes}
            storagePath={storagePath}
            onAllApprovedChange={onAllApprovedChange}
            onReviewStatsChange={onReviewStatsChange}
            analysisId={analysisId}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const SceneBreakdownSection = ({ scenes, storagePath, onAllApprovedChange, onReviewStatsChange, analysisId }: { scenes: any[]; storagePath: string; onAllApprovedChange?: (v: boolean) => void; onReviewStatsChange?: (stats: { approved: number; rejected: number; pending: number }) => void; analysisId?: string }) => {
  const [approvedSet, setApprovedSet] = useState<Set<number>>(new Set());
  const [rejectedSet, setRejectedSet] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const allApproved = approvedSet.size === scenes.length;

  // Load persisted approvals from DB on mount
  useEffect(() => {
    if (!analysisId) { setLoaded(true); return; }
    (async () => {
      const { data } = await supabase
        .from("script_analyses")
        .select("scene_approvals, scene_rejections")
        .eq("id", analysisId)
        .single();
      if (data) {
        const approvals = Array.isArray(data.scene_approvals) ? data.scene_approvals as number[] : [];
        const rejections = Array.isArray(data.scene_rejections) ? data.scene_rejections as number[] : [];
        setApprovedSet(new Set(approvals));
        setRejectedSet(new Set(rejections));
      }
      setLoaded(true);
    })();
  }, [analysisId]);

  // Persist to DB whenever approvals change (after initial load)
  useEffect(() => {
    if (!analysisId || !loaded) return;
    supabase
      .from("script_analyses")
      .update({
        scene_approvals: [...approvedSet] as any,
        scene_rejections: [...rejectedSet] as any,
      })
      .eq("id", analysisId)
      .then();
  }, [approvedSet, rejectedSet, analysisId, loaded]);

  useEffect(() => {
    onAllApprovedChange?.(allApproved);
  }, [allApproved, onAllApprovedChange]);

  useEffect(() => {
    onReviewStatsChange?.({ approved: approvedSet.size, rejected: rejectedSet.size, pending: scenes.length - approvedSet.size - rejectedSet.size });
  }, [approvedSet.size, rejectedSet.size, scenes.length, onReviewStatsChange]);

  const approveScene = (i: number) => {
    setApprovedSet((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
    setRejectedSet((prev) => { const n = new Set(prev); n.delete(i); return n; });
  };

  const rejectScene = (i: number) => {
    setRejectedSet((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
    setApprovedSet((prev) => { const n = new Set(prev); n.delete(i); return n; });
  };

  const toggleAll = () => {
    if (allApproved) {
      setApprovedSet(new Set());
    } else {
      setApprovedSet(new Set(scenes.map((_, i) => i)));
      setRejectedSet(new Set());
    }
  };

  const reviewedCount = approvedSet.size + rejectedSet.size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Expand each scene to review the AI-generated visual intelligence. Approve scenes to lock them in for production.
        </p>
        <Button variant={allApproved ? "default" : "default"} size="sm" className={cn("gap-1.5 shrink-0", allApproved && "bg-green-600 hover:bg-green-700 text-white")} onClick={toggleAll}>
          <ThumbsUp className="h-3.5 w-3.5" />
          {allApproved ? "Unapprove All" : "Approve All"}
        </Button>
      </div>
      {scenes.map((scene: any, i: number) => (
        <SceneReviewCard
          key={i} scene={scene} index={i} storagePath={storagePath}
          approved={approvedSet.has(i)} rejected={rejectedSet.has(i)}
          onToggleApproved={() => approveScene(i)} onToggleRejected={() => rejectScene(i)}
        />
      ))}
    </div>
  );
};

const SceneReviewCard = ({ scene, index, storagePath, approved, rejected, onToggleApproved, onToggleRejected }: { scene: any; index: number; storagePath: string; approved: boolean; rejected: boolean; onToggleApproved: () => void; onToggleRejected: () => void }) => {
  const [expanded, setExpanded] = useState(false);
  const [scriptParagraphs, setScriptParagraphs] = useState<{ type: string; text: string }[] | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptPage, setScriptPage] = useState<string | null>(scene.page || null);
  const { openScriptViewer, setScriptViewerScenes, setScriptViewerLoading } = useScriptViewer();

  const parseFdxScene = (xml: string): { type: string; text: string }[] => {
    const heading = scene.scene_heading?.trim();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const paragraphs = Array.from(doc.querySelectorAll("Paragraph"));

    // Find the paragraph containing this scene's heading
    let startIdx = -1;
    let endIdx = paragraphs.length;

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const type = p.getAttribute("Type") || "";
      const texts = Array.from(p.querySelectorAll("Text"));
      const content = texts.map((t) => t.textContent || "").join("").trim();

      if (type === "Scene Heading") {
        if (startIdx === -1 && heading && content.toUpperCase().includes(heading.toUpperCase())) {
          startIdx = i;
          // Extract page number from SceneProperties
          const sp = p.querySelector("SceneProperties");
          if (sp) {
            const pg = sp.getAttribute("Page");
            if (pg && !scriptPage) setScriptPage(pg);
          }
        } else if (startIdx !== -1) {
          endIdx = i;
          break;
        }
      }
    }

    if (startIdx === -1) startIdx = 0;

    const result: { type: string; text: string }[] = [];
    for (let i = startIdx; i < endIdx; i++) {
      const p = paragraphs[i];
      const type = p.getAttribute("Type") || "Action";
      const texts = Array.from(p.querySelectorAll("Text"));
      const content = texts.map((t) => t.textContent || "").join("");
      if (content.trim()) {
        result.push({ type, text: content });
      }
    }
    return result;
  };

  const parsePlainTextScene = (fullText: string): { type: string; text: string }[] => {
    const heading = scene.scene_heading?.trim();
    return parseSceneFromPlainText(fullText, heading);
  };

  /** Parse PDF with position-aware screenplay classification */
  const parsePdfScene = async (bytes: Uint8Array): Promise<{ type: string; text: string }[]> => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

    // Standard US Letter screenplay: 612pt wide
    // Action: ~72pt (1") left margin
    // Dialogue: ~180pt (~2.5")
    // Parenthetical: ~216pt (~3")
    // Character: ~252pt (~3.5")
    // Transition: right-aligned (~432pt+)
    const PAGE_WIDTH = 612;

    interface PdfLine { text: string; x: number; y: number; page: number }
    const allLines: PdfLine[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const items = (tc.items as any[]).filter((it) => it.str != null && it.transform);
      // Group by Y coordinate (rows)
      const rowMap = new Map<number, { text: string; x: number }[]>();
      for (const item of items) {
        const y = Math.round(item.transform[5] / 2) * 2;
        if (!rowMap.has(y)) rowMap.set(y, []);
        rowMap.get(y)!.push({ text: item.str, x: item.transform[4] });
      }
      const rows = Array.from(rowMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([yKey, cells]) => {
          cells.sort((a, b) => a.x - b.x);
          return { text: cells.map((c) => c.text).join(""), x: cells[0].x, y: yKey, page: i };
        });
      allLines.push(...rows);
    }

    // Isolate the target scene
    const heading = scene.scene_heading?.trim() || "";
    const headingPattern = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let startIdx = -1;
    let endIdx = allLines.length;
    for (let i = 0; i < allLines.length; i++) {
      const t = allLines[i].text.trim();
      if (startIdx < 0) {
        if (new RegExp(headingPattern, "i").test(t) || /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/i.test(t) && t.includes(heading.split(" ").slice(1, 3).join(" ").toUpperCase())) {
          startIdx = i;
        }
      } else if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/i.test(t)) {
        endIdx = i;
        break;
      }
    }
    if (startIdx < 0) startIdx = 0;
    const sceneLines = allLines.slice(startIdx, endIdx);

    // Classify each line based on X indentation
    const result: { type: string; text: string }[] = [];
    let lastType = "";
    for (const line of sceneLines) {
      const trimmed = line.text.trim();
      if (!trimmed) continue;
      const x = line.x;

      let type: string;
      if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/i.test(trimmed)) {
        type = "Scene Heading";
      } else if (/^(CUT TO:|FADE OUT|FADE IN|DISSOLVE TO:|SMASH CUT|MATCH CUT)/i.test(trimmed)) {
        type = "Transition";
      } else if (x >= 230 && /^[A-Z][A-Z\s'.()0-9-]+$/.test(trimmed) && trimmed.length < 45) {
        type = "Character";
      } else if (x >= 195 && /^\(/.test(trimmed)) {
        type = "Parenthetical";
      } else if (x >= 155 && x < 230 && (lastType === "Character" || lastType === "Dialogue" || lastType === "Parenthetical")) {
        type = "Dialogue";
      } else if (x >= 155 && lastType === "Dialogue") {
        // Continuation of dialogue on next line
        type = "Dialogue";
      } else {
        type = "Action";
      }

      result.push({ type, text: trimmed });
      lastType = type;
    }
    return result;
  };

  const loadScript = async () => {
    const sceneNum = scene.scene_number ?? index + 1;
    const title = scene.scene_heading || `Scene ${sceneNum}`;

    if (scriptParagraphs !== null) {
      openScriptViewer({
        title,
        description: "Original screenplay formatting",
        scenes: [{ sceneNum, heading: title, paragraphs: scriptParagraphs }],
      });
      return;
    }

    openScriptViewer({ title, description: "Original screenplay formatting" });
    setScriptLoading(true);
    try {
      const { data, error } = await supabase.storage.from("scripts").download(storagePath);
      if (error || !data) throw error || new Error("Download failed");

      const bytes = new Uint8Array(await data.arrayBuffer());
      const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

      let parsed: { type: string; text: string }[];

      if (isPdf) {
        parsed = await parsePdfScene(bytes);
      } else {
        const full = new TextDecoder().decode(bytes);
        const isFdx = full.trimStart().startsWith("<?xml") || full.includes("<FinalDraft");
        parsed = isFdx ? parseFdxScene(full) : parsePlainTextScene(full);
      }

      setScriptParagraphs(parsed);
      setScriptViewerScenes([{ sceneNum, heading: title, paragraphs: parsed }]);
    } catch {
      const fallback = [{ type: "Action", text: "[Could not load script file]" }];
      setScriptParagraphs(fallback);
      setScriptViewerScenes([{ sceneNum, heading: title, paragraphs: fallback }]);
    } finally {
      setScriptLoading(false);
    }
  };

  return (
    <div id={`scene-${scene.scene_number ?? index + 1}`} className={`rounded-xl border overflow-hidden transition-colors ${approved ? "border-primary/40 bg-primary/5" : rejected ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity text-left"
        >
          <span className="flex h-8 w-8 min-w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold font-mono shrink-0">
            {scene.scene_number ?? index + 1}
          </span>
          <div>
            <p className="font-display font-semibold text-sm">{scene.scene_heading || "Untitled Scene"}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {scene.description || "No description"}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {rejected && <span className="text-xs text-destructive font-medium">Needs Work</span>}
          {approved && <span className="text-xs text-primary font-medium">Approved</span>}
          <Button data-script-btn variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2" onClick={loadScript}>
            <ScrollText className="h-3 w-3" />
            Script
          </Button>
          <div
            role="checkbox"
            aria-checked={approved}
            onClick={onToggleApproved}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer ${approved ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary"}`}
          >
            {approved && <CheckCircle className="h-3.5 w-3.5" />}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="p-1">
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <EditableSceneContent
          scene={scene}
          index={index}
          storagePath={storagePath}
          approved={approved}
          rejected={rejected}
          onToggleApproved={onToggleApproved}
          onToggleRejected={onToggleRejected}
        />
      )}

      {/* Script viewer is now handled by global ScriptViewerProvider */}
    </div>
  );
};

/* ── Editable Scene Content ── */
const EditableSceneContent = ({
  scene, index, storagePath, approved, rejected, onToggleApproved, onToggleRejected,
}: {
  scene: any; index: number; storagePath: string; approved: boolean; rejected: boolean;
  onToggleApproved: () => void; onToggleRejected: () => void;
}) => {
  const filmId = useFilmId();
  const [desc, setDesc] = useState<string>(scene.description || "");
  const vd = scene.visual_design || {};
  const [atmosphere, setAtmosphere] = useState<string>(vd.atmosphere || scene.mood || "");
  const [lighting, setLighting] = useState<string>(vd.lighting_style || scene.day_night || "");
  const [palette, setPalette] = useState<string>(vd.color_palette || "");
  const [references, setReferences] = useState<string>(vd.visual_references || "");
  const [location, setLocation] = useState<string>(scene.location_name || scene.scene_heading || "");
  const [intExt, setIntExt] = useState<string>(scene.int_ext || "");
  const [dayNight, setDayNight] = useState<string>(scene.day_night || "");
  const [characters, setCharacters] = useState<{ name: string; emotional_tone: string; key_expressions: string; physical_behavior: string }[]>(() => {
    const details = scene.character_details || [];
    const names = scene.characters || [];
    if (details.length > 0) {
      return details.map((c: any) => ({
        name: c.name || "",
        emotional_tone: c.emotional_tone || "",
        key_expressions: c.key_expressions || "",
        physical_behavior: c.physical_behavior || "",
      }));
    }
    return names.map((c: any) => typeof c === "string"
      ? { name: c, emotional_tone: "", key_expressions: "", physical_behavior: "" }
      : { name: c.name || "", emotional_tone: c.emotional_tone || "", key_expressions: c.key_expressions || "", physical_behavior: c.physical_behavior || "" }
    );
  });
  const [wardrobe, setWardrobe] = useState<{ character: string; clothing_style: string; condition: string; hair_makeup: string }[]>(
    (scene.wardrobe || []).map((w: any) => ({
      character: w.character || "",
      clothing_style: w.clothing_style || "",
      condition: w.condition || "",
      hair_makeup: w.hair_makeup || "",
    }))
  );
  const cinematicData = scene.cinematic_elements || {};
  const [cameraFeel, setCameraFeel] = useState<string>(cinematicData.camera_feel || "");
  const [motionCues, setMotionCues] = useState<string>(cinematicData.motion_cues || "");
  const [shotSuggestions, setShotSuggestions] = useState<string>(
    (cinematicData.shot_suggestions || []).join(" · ")
  );
  const [envDetails, setEnvDetails] = useState<string>(scene.environment_details || "");
  const [keyObjects, setKeyObjects] = useState<string[]>(scene.key_objects || []);
  const [stunts, setStunts] = useState<string[]>(scene.stunts || []);
  const [sfx, setSfx] = useState<string[]>(scene.sfx || []);
  const [vfx, setVfx] = useState<string[]>(scene.vfx || []);
  const [soundCues, setSoundCues] = useState<string[]>(scene.sound_cues || []);
  const [animals, setAnimals] = useState<string[]>(scene.animals || []);
  const [extras, setExtras] = useState<string>(scene.extras || "");
  const [specialMakeup, setSpecialMakeup] = useState<string[]>(scene.special_makeup || []);
  const [pictureVehicles, setPictureVehicles] = useState<string[]>(scene.picture_vehicles || []);

  const [newItem, setNewItem] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; idx: number; kind?: string } | null>(null);

  // Auto-save scene edits to parsed_scenes table with debounce
  const initialMountRef = useRef(true);
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    if (!filmId) return;
    const sceneNumber = scene.scene_number ?? index + 1;
    const timeout = setTimeout(async () => {
      await supabase
        .from("parsed_scenes")
        .update({
          description: desc,
          mood: atmosphere,
          day_night: dayNight,
          location_name: location,
          int_ext: intExt,
          environment_details: envDetails,
          key_objects: keyObjects,
          character_details: characters as any,
          wardrobe: wardrobe as any,
          cinematic_elements: {
            camera_feel: cameraFeel,
            motion_cues: motionCues,
            shot_suggestions: shotSuggestions.split(" · ").filter(Boolean),
          } as any,
          visual_design: {
            atmosphere,
            lighting_style: lighting,
            color_palette: palette,
            visual_references: references,
          } as any,
          stunts,
          sfx,
          vfx,
          sound_cues: soundCues,
          animals,
          extras,
          special_makeup: specialMakeup,
          picture_vehicles: pictureVehicles,
        })
        .eq("film_id", filmId)
        .eq("scene_number", sceneNumber);
    }, 800);
    return () => clearTimeout(timeout);
  }, [desc, atmosphere, lighting, palette, references, location, intExt, dayNight, characters, wardrobe, cameraFeel, motionCues, shotSuggestions, envDetails, keyObjects, stunts, sfx, vfx, soundCues, animals, extras, specialMakeup, pictureVehicles, filmId]);

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "character") {
      setCharacters((prev) => prev.filter((_, i) => i !== deleteTarget.idx));
    } else if (deleteTarget.kind === "wardrobe") {
      setWardrobe((prev) => prev.filter((_, i) => i !== deleteTarget.idx));
    } else {
      setKeyObjects((prev) => prev.filter((_, i) => i !== deleteTarget.idx));
    }
    setDeleteTarget(null);
  };

  const addObject = () => {
    const val = newItem.trim();
    if (!val) return;
    setKeyObjects((prev) => [...prev, val]);
    setNewItem("");
  };

  return (
    <>
      <div className="border-t border-border p-5 space-y-5 text-sm">
        {/* Description */}
        <Section icon={FileText} label="Description">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="text-xs min-h-[60px] bg-background border-border" style={{ fieldSizing: 'content' } as React.CSSProperties} />
        </Section>

        {/* Location */}
        <Section icon={LocateFixed} label="Location">
          <Textarea value={location} onChange={(e) => setLocation(e.target.value)} className="text-xs min-h-[40px] bg-background border-border" style={{ fieldSizing: 'content' } as React.CSSProperties} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Tag label="INT / EXT" value={intExt || "—"} />
            <Tag label="Time of Day" value={dayNight || "—"} />
          </div>
        </Section>

        {/* Mood & Visual Design */}
        <Section icon={Palette} label="Visual Design">
          <div className="grid grid-cols-2 gap-2">
            <EditableTag label="Mood / Tone" value={atmosphere} onChange={setAtmosphere} />
            <EditableTag label="Lighting" value={lighting} onChange={setLighting} />
            <EditableTag label="Palette" value={palette} onChange={setPalette} />
            <EditableTag label="References" value={references} onChange={setReferences} />
          </div>
        </Section>

        {/* Characters */}
        <Section icon={Users} label="Characters">
          <div className="space-y-3">
            {characters.map((c, ci) => (
              <div key={ci} className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Input
                    value={c.name}
                    onChange={(e) => {
                      const next = [...characters];
                      next[ci] = { ...next[ci], name: e.target.value };
                      setCharacters(next);
                    }}
                    className="text-xs font-bold h-7 w-40 bg-background border-border uppercase"
                    placeholder="Character name"
                  />
                  <button
                    onClick={() => setDeleteTarget({ label: c.name || "this character", idx: ci, kind: "character" } as any)}
                    className="rounded-full p-1 hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Emotion</p>
                    <Input value={c.emotional_tone} onChange={(e) => { const n = [...characters]; n[ci] = { ...n[ci], emotional_tone: e.target.value }; setCharacters(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Expressions</p>
                    <Input value={c.key_expressions} onChange={(e) => { const n = [...characters]; n[ci] = { ...n[ci], key_expressions: e.target.value }; setCharacters(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Behavior</p>
                    <Input value={c.physical_behavior} onChange={(e) => { const n = [...characters]; n[ci] = { ...n[ci], physical_behavior: e.target.value }; setCharacters(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCharacters([...characters, { name: "", emotional_tone: "", key_expressions: "", physical_behavior: "" }])}>
              <Plus className="h-3 w-3" /> Add Character
            </Button>
          </div>
        </Section>

        {/* Wardrobe */}
        <Section icon={Users} label="Wardrobe">
          <div className="space-y-3">
            {wardrobe.map((w, wi) => (
              <div key={wi} className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-foreground">{w.character || "—"}</span>
                  <button
                    onClick={() => setDeleteTarget({ label: `${w.character}'s wardrobe`, idx: wi, kind: "wardrobe" } as any)}
                    className="rounded-full p-1 hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Outfit</p>
                    <Input value={w.clothing_style} onChange={(e) => { const n = [...wardrobe]; n[wi] = { ...n[wi], clothing_style: e.target.value }; setWardrobe(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Condition</p>
                    <Input value={w.condition} onChange={(e) => { const n = [...wardrobe]; n[wi] = { ...n[wi], condition: e.target.value }; setWardrobe(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Hair / Makeup</p>
                    <Input value={w.hair_makeup} onChange={(e) => { const n = [...wardrobe]; n[wi] = { ...n[wi], hair_makeup: e.target.value }; setWardrobe(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setWardrobe([...wardrobe, { character: "", clothing_style: "", condition: "", hair_makeup: "" }])}>
              <Plus className="h-3 w-3" /> Add Wardrobe Entry
            </Button>
          </div>
        </Section>

        {/* Cinematic Elements */}
        <Section icon={Camera} label="Cinematic Elements">
          <div className="grid grid-cols-2 gap-2">
            <EditableTag label="Camera" value={cameraFeel} onChange={setCameraFeel} />
            <EditableTag label="Motion" value={motionCues} onChange={setMotionCues} />
          </div>
          <div className="mt-2">
            <EditableTag label="Shot Suggestions" value={shotSuggestions} onChange={setShotSuggestions} />
          </div>
        </Section>

        {/* Environment */}
        <Section icon={MapPin} label="Environment">
          <Textarea value={envDetails} onChange={(e) => setEnvDetails(e.target.value)} className="text-xs min-h-[40px] bg-background border-border" placeholder="Environment description…" style={{ fieldSizing: 'content' } as React.CSSProperties} />
        </Section>

        {/* Props */}
        <Section icon={MapPin} label="Props">
          <div className="flex flex-wrap gap-1.5">
            {keyObjects.map((obj, i) => (
              <span
                key={i}
                className="text-xs bg-secondary text-muted-foreground rounded-full pl-2.5 pr-1 py-0.5 border border-border flex items-center gap-1 group"
              >
                {obj}
                <button
                  onClick={() => setDeleteTarget({ label: obj, idx: i })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-destructive/20 p-0.5"
                >
                  <X className="h-3 w-3 text-destructive" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addObject())}
                placeholder="Add item…"
                className="h-6 text-xs w-28 bg-background border-border"
              />
              <button onClick={addObject} className="rounded-full p-0.5 hover:bg-primary/10 transition-colors">
                <Plus className="h-3.5 w-3.5 text-primary" />
              </button>
            </div>
          </div>
        </Section>

        {/* Production Breakdown */}
        <Section icon={Swords} label="Stunts / Action">
          <TagList items={stunts} emptyLabel="No stunts in this scene" />
        </Section>

        <Section icon={Zap} label="SFX (Practical Effects)">
          <TagList items={sfx} emptyLabel="No practical effects" />
        </Section>

        <Section icon={Wand2} label="VFX (Visual Effects)">
          <TagList items={vfx} emptyLabel="No visual effects" />
        </Section>

        <Section icon={Volume2} label="Sound Cues">
          <TagList items={soundCues} emptyLabel="No specific sound cues" />
        </Section>

        <Section icon={Dog} label="Animals">
          <TagList items={animals} emptyLabel="No animals" />
        </Section>

        <Section icon={UserPlus} label="Extras / Background">
          <p className={`text-xs ${extras ? "text-foreground" : "text-muted-foreground/50 italic"}`}>{extras || "No extras"}</p>
        </Section>

        <Section icon={Paintbrush} label="Special Makeup / Prosthetics">
          <TagList items={specialMakeup} emptyLabel="No special makeup" />
        </Section>

        {pictureVehicles.length > 0 && (
          <Section icon={Film} label="Picture Vehicles">
            <TagList items={pictureVehicles} emptyLabel="No vehicles" />
          </Section>
        )}

        {scene.estimated_page_count > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ScrollText className="h-3.5 w-3.5" />
            <span>Est. {scene.estimated_page_count} page{scene.estimated_page_count !== 1 ? "s" : ""}</span>
          </div>
        )}




        {/* Actions row */}
        <div className="pt-2 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5", rejected && "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90")}
            onClick={onToggleRejected}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            {rejected ? "Rejected ✗" : "Reject Scene"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5", approved && "bg-green-600 text-white border-green-600 hover:bg-green-700")}
            onClick={onToggleApproved}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {approved ? "Approved" : "Approve"}
          </Button>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteTarget?.label}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/* ── Editable Tag ── */
const EditableTag = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="bg-secondary rounded-lg px-3 py-2">
    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-1">{label}</p>
    <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="text-xs min-h-[32px] p-1.5 bg-background border-border resize-none" style={{ fieldSizing: 'content' } as React.CSSProperties} />
  </div>
);

const Section = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-1.5 text-primary">
      <Icon className="h-3.5 w-3.5" />
      <span className="font-semibold text-xs uppercase tracking-wider">{label}</span>
    </div>
    {children}
  </div>
);

const Tag = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-secondary rounded-lg px-3 py-2">
    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-foreground">{value}</p>
  </div>
);

const TagList = ({ items, emptyLabel }: { items: string[]; emptyLabel: string }) => (
  items.length > 0 ? (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className="text-xs bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 border border-border">{item}</span>
      ))}
    </div>
  ) : (
    <p className="text-xs text-muted-foreground/50 italic">{emptyLabel}</p>
  )
);

/* ── MPAA Content Safety ── */
const MPAA_CATEGORIES = [
  { key: "language", label: "Language", desc: "Profanity, slurs, crude language" },
  { key: "violence", label: "Violence", desc: "Physical violence, gore, weapons" },
  { key: "nudity", label: "Nudity / Sexual Content", desc: "Nudity, sexual situations, suggestive content" },
  { key: "substance", label: "Substance Use", desc: "Drug use, alcohol, smoking" },
  { key: "thematic", label: "Thematic Elements", desc: "Disturbing themes, mature subject matter" },
] as const;

type MPAARating = "G" | "PG" | "PG-13" | "R" | "NC-17";

interface ContentFlag {
  sceneIndex: number;
  sceneHeading: string;
  category: string;
  type: "description" | "dialogue";
  excerpt: string;
  severity: MPAARating;
  reason?: string;
}

type RatingOrUnrated = MPAARating | "NR";
const RATING_TEMPLATES: { rating: RatingOrUnrated; label: string; desc: string }[] = [
  { rating: "G", label: "G — General Audiences", desc: "No objectionable content" },
  { rating: "PG", label: "PG — Parental Guidance", desc: "Mild language, brief mild violence" },
  { rating: "PG-13", label: "PG-13 — Parents Cautioned", desc: "Some violence, brief strong language" },
  { rating: "R", label: "R — Restricted", desc: "Strong language, violence, some nudity" },
  { rating: "NC-17", label: "NC-17 — Adults Only", desc: "Explicit content not suitable for children" },
  { rating: "NR", label: "Not Rated", desc: "Content has not been submitted for rating" },
];

/* regex patterns and local analysis removed — now handled by AI edge function */

const ExpandableFlaggedScene = ({ flag, scene, scriptText, onSaveScript }: { flag: ContentFlag; scene?: any; scriptText?: string | null; onSaveScript?: (text: string) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [scriptPopupOpen, setScriptPopupOpen] = useState(false);

  // Estimate page number: ~55 lines per page in standard screenplay format
  const estimatePageNumber = (): number | null => {
    if (!scriptText) return null;
    const excerptClean = flag.excerpt.replace(/^…|…$/g, "").trim();
    const idx = scriptText.indexOf(excerptClean);
    const searchIdx = idx >= 0 ? idx : scriptText.toUpperCase().indexOf(flag.sceneHeading.toUpperCase());
    if (searchIdx < 0) return null;
    const linesBeforeExcerpt = scriptText.substring(0, searchIdx).split("\n").length;
    return Math.max(1, Math.ceil(linesBeforeExcerpt / 55));
  };

  // Get a page-sized window of script text around the flagged excerpt
  const getScriptPageText = (): { text: string; highlightStart: number; highlightEnd: number } => {
    if (!scriptText) return { text: "", highlightStart: -1, highlightEnd: -1 };
    const excerptClean = flag.excerpt.replace(/^…|…$/g, "").trim();
    let idx = scriptText.indexOf(excerptClean);
    let highlightLen = excerptClean.length;

    if (idx < 0) {
      // Try scene heading
      idx = scriptText.toUpperCase().indexOf(flag.sceneHeading.toUpperCase());
      highlightLen = flag.sceneHeading.length;
    }
    if (idx < 0) return { text: scriptText.substring(0, 3000), highlightStart: -1, highlightEnd: -1 };

    // Show ~55 lines centered around the excerpt (one "page")
    const lines = scriptText.split("\n");
    let charCount = 0;
    let excerptLine = 0;
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= idx) { excerptLine = i; break; }
      charCount += lines[i].length + 1;
    }

    const pageStart = Math.max(0, excerptLine - 20);
    const pageEnd = Math.min(lines.length, pageStart + 55);
    const pageLines = lines.slice(pageStart, pageEnd);
    const pageText = pageLines.join("\n");

    // Recalculate highlight position within the page
    const pageCharOffset = lines.slice(0, pageStart).reduce((sum, l) => sum + l.length + 1, 0);
    const hlStart = idx - pageCharOffset;
    const hlEnd = hlStart + highlightLen;

    return { text: pageText, highlightStart: hlStart, highlightEnd: hlEnd };
  };

  const openEditor = () => {
    if (scriptText) {
      const excerptClean = flag.excerpt.replace(/^…|…$/g, "").trim();
      const idx = scriptText.indexOf(excerptClean);
      if (idx >= 0) {
        const lineStart = scriptText.lastIndexOf("\n", Math.max(0, idx - 200));
        const lineEnd = scriptText.indexOf("\n", Math.min(scriptText.length, idx + excerptClean.length + 200));
        setEditText(scriptText.substring(lineStart >= 0 ? lineStart + 1 : 0, lineEnd >= 0 ? lineEnd : scriptText.length));
      } else {
        const headIdx = scriptText.toUpperCase().indexOf(flag.sceneHeading.toUpperCase());
        if (headIdx >= 0) {
          const end = Math.min(scriptText.length, headIdx + 800);
          setEditText(scriptText.substring(headIdx, end));
        } else {
          setEditText("(Could not locate scene text in script)");
        }
      }
      setEditing(true);
    }
  };

  const handleSave = () => {
    if (!scriptText || !onSaveScript) return;
    const excerptClean = flag.excerpt.replace(/^…|…$/g, "").trim();
    const idx = scriptText.indexOf(excerptClean);
    if (idx >= 0) {
      const lineStart = scriptText.lastIndexOf("\n", Math.max(0, idx - 200));
      const lineEnd = scriptText.indexOf("\n", Math.min(scriptText.length, idx + excerptClean.length + 200));
      const oldSection = scriptText.substring(lineStart >= 0 ? lineStart + 1 : 0, lineEnd >= 0 ? lineEnd : scriptText.length);
      const newScript = scriptText.replace(oldSection, editText);
      onSaveScript(newScript);
    }
    setEditing(false);
  };

  const pageNum = estimatePageNumber();
  const pageData = scriptPopupOpen ? getScriptPageText() : null;

  // Render highlighted script text
  const renderHighlightedScript = () => {
    if (!pageData) return null;
    const { text, highlightStart, highlightEnd } = pageData;
    if (highlightStart < 0 || highlightEnd < 0) {
      return formatScriptLines(text);
    }
    const before = text.substring(0, highlightStart);
    const highlight = text.substring(highlightStart, highlightEnd);
    const after = text.substring(highlightEnd);
    return (
      <>
        {formatScriptLines(before)}
        <mark className="rounded px-0.5" style={{ backgroundColor: "#FACC15", color: "#000" }}>{highlight}</mark>
        {formatScriptLines(after)}
      </>
    );
  };

  return (
    <>
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-destructive/10 transition-colors text-left"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive text-xs font-bold font-mono shrink-0">
              {flag.sceneIndex + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-foreground truncate">{flag.sceneHeading}</p>
                {pageNum && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setScriptPopupOpen(true); }}
                    className="shrink-0 text-[10px] font-mono text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded transition-colors"
                    title={`View script page ${pageNum}`}
                  >
                    p.{pageNum}
                  </button>
                )}
              </div>
              <p className="text-xs text-destructive font-medium truncate">{flag.excerpt}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{flag.category}</span>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", flag.severity === "R" || flag.severity === "NC-17" ? "bg-destructive/20 text-destructive" : "bg-amber-500/20 text-amber-400")}>{flag.severity}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </button>
        {expanded && (
          <div className="border-t border-destructive/10 p-4 space-y-4 bg-card/50">
            {flag.reason && (
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Why flagged</p>
                <p className="text-sm text-foreground">{flag.reason}</p>
              </div>
            )}
            {scene && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {scene.int_ext && <Tag label="Int/Ext" value={scene.int_ext} />}
                  {scene.day_night && <Tag label="Time" value={scene.day_night} />}
                  {scene.location_name && <Tag label="Location" value={scene.location_name} />}
                </div>
                {scene.description && (
                  <Section icon={Eye} label="Description">
                    <p className="text-sm text-muted-foreground">{scene.description}</p>
                  </Section>
                )}
                {((scene.character_details as any[])?.length > 0 || scene.characters?.length > 0) && (
                  <Section icon={Users} label="Characters">
                    {((scene.character_details as any[])?.length > 0 ? (scene.character_details as any[]) : (scene.characters || []).map((name: string) => ({ name, emotional_tone: "", key_expressions: "", physical_behavior: "" }))).map((c: any, ci: number) => (
                      <div key={ci} className="bg-secondary rounded-lg p-3 space-y-1">
                        <p className="text-sm font-semibold">{c.name}</p>
                        {c.emotional_tone && c.emotional_tone !== "neutral" && (
                          <p className="text-xs text-muted-foreground"><span className="text-muted-foreground/60">Emotion:</span> {c.emotional_tone}</p>
                        )}
                        {c.key_expressions && c.key_expressions !== "not specified" && (
                          <p className="text-xs text-muted-foreground"><span className="text-muted-foreground/60">Expressions:</span> {c.key_expressions}</p>
                        )}
                        {c.physical_behavior && c.physical_behavior !== "not specified" && (
                          <p className="text-xs text-muted-foreground"><span className="text-muted-foreground/60">Behavior:</span> {c.physical_behavior}</p>
                        )}
                      </div>
                    ))}
                  </Section>
                )}
              </>
            )}
            {scriptText && onSaveScript && !editing && (
              <Button variant="outline" size="sm" onClick={openEditor} className="gap-1.5">
                <ScrollText className="h-3.5 w-3.5" /> Edit Script
              </Button>
            )}
            {editing && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Edit Script Text</p>
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[160px] text-xs font-mono bg-background resize-y"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave}>Save & Re-analyze</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Script Page Popup Dialog */}
      <Dialog open={scriptPopupOpen} onOpenChange={setScriptPopupOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-3 text-base">
              <ScrollText className="h-4 w-4 text-primary" />
              <span>Script — Page {pageNum}</span>
              <span className="text-xs font-normal text-muted-foreground ml-auto">Scene {flag.sceneIndex + 1}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[70vh] p-0">
            <div className="bg-white mx-6 my-4 rounded shadow-md" style={{ padding: "48px 60px", minHeight: 600 }}>
              <pre className="whitespace-pre-wrap text-black leading-relaxed" style={{ fontFamily: "'Courier Prime', 'Courier New', monospace", fontSize: 12 }}>
                {renderHighlightedScript()}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/** Format plain-text script lines with screenplay styling */
function formatScriptLines(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <br key={i} />;
    // Scene heading
    if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s/i.test(trimmed)) {
      return <div key={i} className="font-bold uppercase mt-3 mb-1">{trimmed}</div>;
    }
    // Character name (indented, all caps)
    if (/^\s{2,}[A-Z][A-Z\s.'()-]+$/.test(line) && trimmed.length < 40) {
      return <div key={i} className="text-center uppercase mt-2">{trimmed}</div>;
    }
    // Parenthetical
    if (/^\s*\(/.test(line) && trimmed.endsWith(")")) {
      return <div key={i} className="italic" style={{ marginLeft: "25%" }}>{trimmed}</div>;
    }
    // Dialogue (indented)
    if (/^\s{2,}/.test(line) && !line.startsWith("    ")) {
      return <div key={i} style={{ marginLeft: "15%", marginRight: "15%" }}>{trimmed}</div>;
    }
    // Transition
    if (/^(FADE|CUT|DISSOLVE|SMASH|MATCH)\s*(TO|IN|OUT)/i.test(trimmed)) {
      return <div key={i} className="text-right uppercase mt-2">{trimmed}</div>;
    }
    return <div key={i}>{line}</div>;
  });
}

const ContentSafetyMatrix = ({
  scenes, storagePath, filmId, language, nudity, violence, handleToggle, setLanguage, setNudity, setViolence, alreadyAnalyzed,
}: {
  scenes: any[];
  storagePath: string;
  filmId?: string;
  language: boolean; nudity: boolean; violence: boolean;
  handleToggle: (field: string, setter: (v: boolean) => void) => (val: boolean) => void;
  setLanguage: (v: boolean) => void; setNudity: (v: boolean) => void; setViolence: (v: boolean) => void;
  alreadyAnalyzed?: boolean;
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<RatingOrUnrated | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(!!alreadyAnalyzed);
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [suggestedRating, setSuggestedRating] = useState<MPAARating>("G");
  const [loading, setLoading] = useState(false);
  const [persistedLoaded, setPersistedLoaded] = useState(false);

  const [ratingJustification, setRatingJustification] = useState("");
  const [scriptText, setScriptText] = useState<string | null>(null);
  const { toast } = useToast();

  // Load persisted analysis results from content_safety table
  useEffect(() => {
    if (!filmId || persistedLoaded) return;
    (async () => {
      const { data } = await supabase
        .from("content_safety")
        .select("*")
        .eq("film_id", filmId)
        .maybeSingle() as any;
      if (data) {
        if (data.suggested_rating) {
          setSuggestedRating(data.suggested_rating as MPAARating);
        }
        if (data.rating_justification) {
          setRatingJustification(data.rating_justification);
        }
        if (data.flags && Array.isArray(data.flags) && (data.flags as any[]).length > 0) {
          setFlags((data.flags as any[]).map((f: any) => ({
            sceneIndex: f.sceneIndex ?? 0,
            sceneHeading: f.sceneHeading || "",
            category: f.category || "thematic",
            type: f.type || "description",
            excerpt: f.excerpt || "",
            severity: f.severity || "PG",
            reason: f.reason || "",
          })));
          setScriptLoaded(true);
        }
      }
      setPersistedLoaded(true);
    })();
  }, [filmId, persistedLoaded]);

  // Persist analysis results to content_safety table
  const persistResults = useCallback(async (rating: string, justification: string, contentFlags: ContentFlag[]) => {
    if (!filmId) return;
    await supabase
      .from("content_safety")
      .update({
        suggested_rating: rating,
        rating_justification: justification,
        flags: contentFlags as any,
      } as any)
      .eq("film_id", filmId);
  }, [filmId]);

  const runAnalysis = useCallback(async () => {
    if (!storagePath) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-content-safety", {
        body: { storage_path: storagePath, scenes, film_id: filmId },
      });
      if (error) throw error;
      const aiFlags: ContentFlag[] = (data.flags || []).map((f: any) => ({
        sceneIndex: f.scene_index ?? 0,
        sceneHeading: f.scene_heading || "",
        category: f.category || "thematic",
        type: f.type || "description",
        excerpt: f.excerpt || "",
        severity: f.severity || "PG",
        reason: f.reason || "",
      }));
      const rating = data.suggested_rating || "G";
      const justification = data.rating_justification || "";
      setFlags(aiFlags);
      setSuggestedRating(rating);
      setRatingJustification(justification);
      setScriptLoaded(true);
      // Persist to DB
      persistResults(rating, justification, aiFlags);
    } catch (e: any) {
      console.error("Content safety analysis failed:", e);
      toast({ title: "Analysis failed", description: e?.message || "Could not analyze script", variant: "destructive" });
      setFlags([]);
      setSuggestedRating("G");
      setScriptLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [storagePath, scenes, filmId, toast, persistResults]);

  // Load script text for editing (parse FDX XML to plain text, or reconstruct from parsed_scenes for PDFs)
  useEffect(() => {
    if (!storagePath || scriptText !== null) return;

    const loadFromParsedScenes = () => {
      if (!scenes || scenes.length === 0) return;
      const reconstructed = scenes
        .sort((a: any, b: any) => (a.scene_number ?? 0) - (b.scene_number ?? 0))
        .map((s: any) => s.raw_text || s.text || "")
        .filter(Boolean)
        .join("\n\n");
      if (reconstructed.trim()) {
        setScriptText(reconstructed);
      }
    };

    supabase.storage.from("scripts").download(storagePath).then(({ data }) => {
      if (!data) {
        loadFromParsedScenes();
        return;
      }
      data.text().then((raw) => {
        const isFdx = raw.trimStart().startsWith("<?xml") || raw.includes("<FinalDraft");
        if (isFdx) {
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(raw, "text/xml");
            const paragraphs = Array.from(doc.querySelectorAll("Paragraph"));
            const lines: string[] = [];
            for (const p of paragraphs) {
              const type = p.getAttribute("Type") || "Action";
              const texts = Array.from(p.querySelectorAll("Text"));
              const content = texts.map((t) => t.textContent || "").join("").trim();
              if (!content) continue;
              if (type === "Scene Heading") lines.push("", content.toUpperCase(), "");
              else if (type === "Character") lines.push("", "    " + content.toUpperCase());
              else if (type === "Parenthetical") lines.push("    " + content);
              else if (type === "Dialogue") lines.push("  " + content);
              else if (type === "Transition") lines.push("", content.toUpperCase(), "");
              else lines.push(content);
            }
            setScriptText(lines.join("\n").trim());
          } catch {
            setScriptText(raw);
          }
        } else {
          // Check if the text looks like binary garbage (PDF read as text)
          const controlChars = (raw.slice(0, 500).match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
          if (controlChars > 10) {
            // Binary file (likely PDF) — reconstruct from parsed scenes
            loadFromParsedScenes();
          } else {
            setScriptText(raw);
          }
        }
      });
    });
  }, [storagePath, scriptText, scenes]);

  useEffect(() => {
    if (!storagePath || scriptLoaded) return;
    runAnalysis();
  }, [storagePath, scriptLoaded, runAnalysis]);

  const handleSaveScript = async (newText: string) => {
    if (!storagePath) return;
    const blob = new Blob([newText], { type: "text/plain" });
    const { error } = await supabase.storage.from("scripts").update(storagePath, blob, { upsert: true });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setScriptText(newText);
    toast({ title: "Script saved", description: "Click Re-analyze to update content safety results." });
  };

  const flagsByCategory = flags.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {} as Record<string, ContentFlag[]>);

  if (loading) {
    const sceneCount = scenes?.length || 0;
    return (
      <div className="rounded-xl border border-border bg-card p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <div>
            <p className="font-display font-bold">Analyzing Content Safety</p>
            <p className="text-xs text-muted-foreground">
              Scanning {sceneCount} scene{sceneCount !== 1 ? "s" : ""} against MPAA guidelines…
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {scenes?.slice(0, 8).map((s: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs animate-pulse" style={{ animationDelay: `${i * 150}ms` }}>
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-muted-foreground truncate">
                Scene {s.scene_number ?? i + 1}: {s.heading || `Scene ${i + 1}`}
              </span>
            </div>
          ))}
          {sceneCount > 8 && (
            <p className="text-xs text-muted-foreground pl-5">…and {sceneCount - 8} more</p>
          )}
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-primary animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <Tabs defaultValue="auto" className="w-full">
        <TabsList className="w-full bg-secondary mb-6">
          <TabsTrigger value="auto" className="flex-1">Auto (MPAA)</TabsTrigger>
          <TabsTrigger value="templates" className="flex-1">Templates</TabsTrigger>
          <TabsTrigger value="custom" className="flex-1">Custom</TabsTrigger>
        </TabsList>
        <TabsContent value="auto">
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setScriptLoaded(false); }}>
                <RefreshCw className="h-3.5 w-3.5" />
                Re-analyze
              </Button>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary">
              <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-display font-bold text-lg">Suggested Rating: <span className="text-primary">{suggestedRating}</span></p>
                <p className="text-sm text-muted-foreground">{ratingJustification || "Based on AI holistic analysis of original script text"}</p>
              </div>
              <span className={cn(
                "text-xs font-bold px-3 py-1.5 rounded-full",
                (suggestedRating === "G" || suggestedRating === "PG") && "bg-green-500/20 text-green-400",
                suggestedRating === "PG-13" && "bg-amber-500/20 text-amber-400",
                (suggestedRating === "R" || suggestedRating === "NC-17") && "bg-destructive/20 text-destructive",
              )}>{suggestedRating}</span>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content Breakdown by Category</p>
              {MPAA_CATEGORIES.map(({ key, label, desc }) => {
                const catFlags = flagsByCategory[key] || [];
                return (
                  <Collapsible key={key}>
                    <CollapsibleTrigger className="w-full">
                      <div className="rounded-lg border border-border bg-secondary/50 p-3 hover:bg-secondary/80 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="text-left">
                            <p className="text-sm font-semibold">{label}</p>
                            <p className="text-xs text-muted-foreground">{desc}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {catFlags.length > 0 ? (
                              <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                {catFlags.length} flag{catFlags.length !== 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">Clear</span>
                            )}
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {catFlags.length > 0 ? (
                        <div className="space-y-2 mt-2 ml-2">
                          {catFlags.map((flag, fi) => {
                            const matchedScene = scenes.find((_: any, i: number) => i === flag.sceneIndex);
                            return <ExpandableFlaggedScene key={fi} flag={flag} scene={matchedScene} scriptText={scriptText} onSaveScript={handleSaveScript} />;
                          })}
                        </div>
                      ) : (
                        <div className="mt-2 ml-2 p-3 text-xs text-muted-foreground/50 text-center">
                          No issues in this category
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
            {flags.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm font-medium">No content concerns detected</p>
                <p className="text-xs mt-1">All scenes pass general audience guidelines</p>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="templates">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Select a target rating to override the auto-detected settings. Scenes that conflict with the chosen rating will be flagged.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {RATING_TEMPLATES.map((t) => {
                const isActive = selectedTemplate === t.rating;
                return (
                  <button
                    key={t.rating}
                    onClick={() => setSelectedTemplate(isActive ? null : t.rating)}
                    className={cn("rounded-lg border p-4 text-left transition-colors", isActive ? "border-primary bg-primary/10" : "border-border bg-secondary hover:border-primary/50")}
                  >
                    <p className="text-sm font-semibold text-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </button>
                );
              })}
            </div>
            {selectedTemplate && (() => {
              if (selectedTemplate === "NR") {
                return (
                  <div className="mt-4 p-4 rounded-lg bg-muted border border-border text-center">
                    <p className="text-sm text-muted-foreground">This content will not be submitted for an MPAA rating.</p>
                  </div>
                );
              }
              const ratingOrder: MPAARating[] = ["G", "PG", "PG-13", "R", "NC-17"];
              const templateIdx = ratingOrder.indexOf(selectedTemplate as MPAARating);
              const conflicts = flags.filter((f) => ratingOrder.indexOf(f.severity) > templateIdx);
              if (conflicts.length === 0) {
                return (
                  <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mx-auto mb-1" />
                    <p className="text-sm text-green-400 font-medium">Script is compatible with {selectedTemplate} rating</p>
                  </div>
                );
              }
              return (
                <div className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive font-medium">
                      {conflicts.length} scene{conflicts.length !== 1 ? "s" : ""} conflict with {selectedTemplate} rating
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Modify these scenes to meet the target rating, then re-approve them.</p>
                  </div>
                  {conflicts.map((flag, fi) => {
                    const matchedScene = scenes.find((_: any, i: number) => i === flag.sceneIndex);
                    return <ExpandableFlaggedScene key={fi} flag={flag} scene={matchedScene} scriptText={scriptText} onSaveScript={handleSaveScript} />;
                  })}
                </div>
              );
            })()}
          </div>
        </TabsContent>
        <TabsContent value="custom">
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground mb-2">Manually toggle content flags to override the auto-detected settings.</p>
            <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
              <Label htmlFor="language" className="text-sm font-medium cursor-pointer">Language</Label>
              <Switch id="language" checked={language} onCheckedChange={handleToggle("language", setLanguage)} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
              <Label htmlFor="nudity" className="text-sm font-medium cursor-pointer">Nudity</Label>
              <Switch id="nudity" checked={nudity} onCheckedChange={handleToggle("nudity", setNudity)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                <Label htmlFor="violence" className="text-sm font-medium cursor-pointer">Violence</Label>
                <Switch id="violence" checked={violence} onCheckedChange={handleToggle("violence", setViolence)} />
              </div>
              {violence && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-amber-400 text-sm animate-fade-in">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Violence flag enabled — content may be restricted on some platforms.</span>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const EditableVisualSummary = ({ analysisId, initialSummary, initialStyle, globalElements, approved, onApprovedChange }: {
  analysisId: string; initialSummary: string; initialStyle: string; globalElements: any;
  approved: boolean; onApprovedChange: (v: boolean) => void;
}) => {
  const [summary, setSummary] = useState(initialSummary);
  const [style, setStyle] = useState(initialStyle);
  const initialMountRef = useRef(true);

  useEffect(() => {
    if (initialMountRef.current) { initialMountRef.current = false; return; }
    const timeout = setTimeout(async () => {
      await supabase.from("script_analyses").update({ visual_summary: summary }).eq("id", analysisId);
    }, 800);
    return () => clearTimeout(timeout);
  }, [summary, analysisId]);

  useEffect(() => {
    if (initialMountRef.current) return;
    const timeout = setTimeout(async () => {
      const updated = { ...globalElements, signature_style: style };
      await supabase.from("script_analyses").update({ global_elements: updated as any }).eq("id", analysisId);
    }, 800);
    return () => clearTimeout(timeout);
  }, [style, analysisId]);

  return (
    <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6 space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground block">Visual Summary</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Describe the overall visual story summary..."
          className="w-full min-h-[100px] text-sm bg-background border border-border rounded-md p-3 resize-y text-foreground placeholder:text-muted-foreground leading-relaxed"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
      </div>
      <div className="space-y-2 border-t border-border pt-4">
        <label className="text-xs font-semibold text-foreground block">Signature Style</label>
        <textarea
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder="Describe the overall visual signature style..."
          className="w-full min-h-[80px] text-sm bg-background border border-border rounded-md p-3 resize-y text-foreground placeholder:text-muted-foreground"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
      </div>
      <div className="flex justify-end pt-4 border-t border-border">
        <Button
          size="sm"
          variant={approved ? "default" : "outline"}
          className={cn("gap-1.5", approved ? "bg-green-600 hover:bg-green-700 text-white" : "opacity-60")}
          onClick={() => onApprovedChange(!approved)}
        >
          <ThumbsUp className="h-3 w-3" />
          {approved ? "Approved" : "Approve"}
        </Button>
      </div>
    </div>
  );
};

/* ── Secondary Time Period Field (generic for any field) ── */
const SecondaryTimePeriodField = ({ initialValue, placeholder, disabled, fieldKey, analysisId, periodIndex, globalElements, className }: {
  initialValue: string; placeholder: string; disabled: boolean; fieldKey: string; analysisId: string; periodIndex: number; globalElements: any; className?: string;
}) => {
  const [value, setValue] = useState(initialValue || "");
  const initialMountRef = useRef(true);

  useEffect(() => {
    if (initialMountRef.current) { initialMountRef.current = false; return; }
    const timeout = setTimeout(async () => {
      const updated = { ...globalElements };
      if (updated.temporal_analysis?.secondary_time_periods?.[periodIndex]) {
        updated.temporal_analysis.secondary_time_periods[periodIndex][fieldKey] = value;
        await supabase.from("script_analyses").update({ global_elements: updated as any }).eq("id", analysisId);
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [value, analysisId, periodIndex, fieldKey]);

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className={className || "w-32 h-7 text-xs"}
      disabled={disabled}
    />
  );
};

const DevelopmentTab = ({ value, icon: Icon, label, disabled, locked }: { value: string; icon: any; label: string; disabled?: boolean; locked?: boolean }) => (
  <TabsTrigger
    value={value}
    disabled={disabled}
    className={cn(
      "relative gap-2 px-5 py-2 text-xs font-display font-semibold uppercase tracking-wider transition-all rounded-t-lg rounded-b-none border border-border/60 border-b-0 -mb-px",
      disabled
        ? "text-muted-foreground/40 cursor-not-allowed bg-secondary/20 opacity-50"
        : "text-muted-foreground hover:text-foreground bg-secondary/40 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:border-border data-[state=active]:shadow-[0_-2px_8px_-2px_rgba(47,125,255,0.15)] data-[state=active]:z-10 data-[state=inactive]:hover:bg-secondary/70"
    )}
  >
    <Icon className="h-3.5 w-3.5" />
    {label}
    {locked && <CheckCircle className="h-3 w-3 text-green-500" />}
    {disabled && <Lock className="h-3 w-3 text-muted-foreground/40" />}
  </TabsTrigger>
);

export default Development;
