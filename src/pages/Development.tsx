import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Upload, Type, CheckCircle, FileText, Sparkles, Loader2, Film, Eye,
  Camera, Palette, MapPin, Users, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown,
  AlertTriangle, ScrollText, X, Plus, LocateFixed, Shield, Lock, Unlock,
  Clock, Save, Rewind, FastForward, AlertCircle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useContentSafety, useFilm, useFilmId } from "@/hooks/useFilm";
import { supabase } from "@/integrations/supabase/client";
import GlobalElementsManager from "@/components/development/GlobalElementsManager";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/* ── Constants ── */
const ACCEPTED_EXTENSIONS = [".fdx", ".fountain", ".rtf", ".pdf", ".docx", ".sexp", ".mmsw", ".fdr", ".txt"];
const ACCEPTED_LABEL = ".fdx, .fountain, .rtf, .pdf, .docx, .sexp, .mmsw, .fdr";

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
  { label: "Uploading script", key: "upload" },
  { label: "Parsing screenplay format", key: "parse" },
  { label: "Extracting scenes", key: "extract" },
];

const AnalysisProgress = ({ status, filmId }: { status?: string; filmId?: string }) => {
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
      // Fetch the last 3 enriched scenes for the activity feed
      const { data: recentScenes } = await supabase
        .from("parsed_scenes")
        .select("scene_number, heading, description, characters")
        .eq("film_id", filmId!)
        .eq("enriched", true)
        .order("scene_number", { ascending: false })
        .limit(3);
      return {
        total: total || 0,
        enriched: enriched || 0,
        recentScenes: (recentScenes || []).reverse(),
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
      <div className="flex items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-lg truncate">
            {isEnriching ? "Enriching scenes with AI…" : "Parsing your screenplay…"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Elapsed: {formatTime(elapsed)}
            {isEnriching && enrichTotal > 0 && ` · ${enrichDone} of ${enrichTotal} scenes`}
            {isEnriching && estimatedRemaining !== null && ` · ${formatEstimate(estimatedRemaining)}`}
            {!isEnriching && " · This usually takes a few seconds"}
          </p>
        </div>
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
          return (
            <div key={step.key} className="flex items-center gap-3">
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
              <span className={cn(
                "text-sm transition-colors flex-1",
                isDone && "text-foreground",
                isActive && "text-foreground font-semibold",
                !isDone && !isActive && "text-muted-foreground/50"
              )}>
                {step.label}
              </span>
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
            <span className={cn(
              "text-sm transition-colors flex-1",
              isEnriching && "text-foreground font-semibold",
              !isEnriching && !parsingDone && "text-muted-foreground/50",
              parsingDone && !isEnriching && "text-foreground",
            )}>
              AI scene enrichment
            </span>
            {isEnriching && enrichTotal > 0 && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {enrichDone}/{enrichTotal}
              </span>
            )}
          </div>
          {isEnriching && (
            <div className="ml-9 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-700 ease-out"
                style={{ width: `${enrichPct}%` }}
              />
            </div>
          )}

          {/* Live activity feed during enrichment */}
          {isEnriching && recentScenes.length > 0 && (
            <div className="ml-9 mt-2 space-y-1.5 border-l-2 border-primary/20 pl-3">
              {recentScenes.map((scene: any) => (
                <div key={scene.scene_number} className="text-xs space-y-0.5 animate-in fade-in duration-500">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-foreground font-medium truncate">
                      Scene {scene.scene_number}: {scene.heading}
                    </span>
                  </div>
                  {scene.description && (
                    <p className="text-muted-foreground ml-[18px] line-clamp-1">
                      {scene.description}
                    </p>
                  )}
                  {scene.characters && scene.characters.length > 0 && (
                    <div className="ml-[18px] flex items-center gap-1 flex-wrap">
                      <Users className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground/70 truncate">
                        {scene.characters.slice(0, 4).join(", ")}
                        {scene.characters.length > 4 && ` +${scene.characters.length - 4}`}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
  const { toast } = useToast();
  const [allScenesApproved, setAllScenesApproved] = useState(false);
  const [contentSafetyRun, setContentSafetyRun] = useState(false);
  const [locking, setLocking] = useState(false);
  const [allElementsReviewed, setAllElementsReviewed] = useState(false);
  const [reviewStats, setReviewStats] = useState<{ approved: number; rejected: number; pending: number } | null>(null);
  const [timePeriod, setTimePeriod] = useState("");
  const [timePeriodSaving, setTimePeriodSaving] = useState(false);
  const [filmTitle, setFilmTitle] = useState("");
  const [versionName, setVersionName] = useState("");
  const [writers, setWriters] = useState("");
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [visualSummaryApproved, setVisualSummaryApproved] = useState(false);
  const [ratingsApproved, setRatingsApproved] = useState(false);
  const [aiNotesApproved, setAiNotesApproved] = useState(false);
  const enrichingRef = useRef(false);

  // Parallel batch enrichment helper (5 concurrent)
  const runEnrichmentBatches = useCallback((sceneIds: string[], analysisId: string) => {
    if (enrichingRef.current || !analysisId) return; // prevent duplicate loops
    enrichingRef.current = true;

    const CONCURRENCY = 5;
    const RETRY_DELAY = 3000;

    (async () => {
      let i = 0;
      while (i < sceneIds.length) {
        const batch = sceneIds.slice(i, i + CONCURRENCY);
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

        // Check for rate limits — if any 429, wait and retry the whole batch
        const hasRateLimit = results.some(
          (r) => r.status === "rejected" && String(r.reason).includes("429")
        );
        if (hasRateLimit) {
          console.warn("Rate limited, waiting before retry…");
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
          continue; // retry same batch
        }

        i += CONCURRENCY;
      }
      enrichingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["script-analysis", filmId] });
    })();
  }, [filmId, queryClient]);

  // Resume enrichment on page load if there are unenriched scenes
  useEffect(() => {
    if (!analysis || !filmId) return;
    if (analysis.status !== "enriching" && analysis.status !== "analyzing") return;
    if (enrichingRef.current) return;

    (async () => {
      // Find unenriched scene IDs
      const { data: unenriched } = await supabase
        .from("parsed_scenes")
        .select("id")
        .eq("film_id", filmId)
        .eq("enriched", false);

      if (unenriched && unenriched.length > 0) {
        console.log(`Resuming enrichment for ${unenriched.length} remaining scenes`);
        runEnrichmentBatches(
          unenriched.map((s) => s.id),
          analysis.id
        );
      }
    })();
  }, [analysis?.id, analysis?.status, filmId, runEnrichmentBatches]);

  /* Sync section approval states from DB */
  useEffect(() => {
    if (!analysis) return;
    setVisualSummaryApproved(!!(analysis as any).visual_summary_approved);
    setRatingsApproved(!!(analysis as any).ratings_approved);
    setAiNotesApproved(!!(analysis as any).ai_notes_approved);
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
  }, [film?.time_period, film?.title, film?.version_name, (film as any)?.writers]);

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

    // Upload file to storage only — analysis is triggered separately
    const path = `${filmId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("scripts").upload(path, file);
    if (uploadErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      return;
    }

    setUploadedFile(file.name);
    setUploadedPath(path);
    setUploading(false);
    toast({ title: "Script uploaded", description: "Click Analyze to begin breakdown." });
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
      // Reanalyze: reset existing record
      const { error: resetErr } = await supabase
        .from("script_analyses")
        .update({
          status: "pending",
          scene_breakdown: null,
          global_elements: null,
          visual_summary: null,
          ai_generation_notes: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", analysis.id);

      if (resetErr) {
        toast({ title: "Failed to start reanalysis", description: resetErr.message, variant: "destructive" });
        setAnalyzing(false);
        return;
      }
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
    if (sceneIds.length > 0) {
      toast({ title: "Parsing complete", description: `${sceneIds.length} scenes found. Starting AI enrichment…` });
      runEnrichmentBatches(sceneIds, analysisId);
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

    // 2. Auto-populate characters from breakdown
    if (analysis?.scene_breakdown && Array.isArray(analysis.scene_breakdown)) {
      try {
        // Extract unique character names from all scenes
        const nameSet = new Set<string>();
        for (const scene of analysis.scene_breakdown as any[]) {
          if (!Array.isArray(scene.characters)) continue;
          for (const c of scene.characters) {
            let raw = typeof c === "string" ? c : c?.name;
            if (!raw || typeof raw !== "string") continue;
            // Normalize: strip age hints, parentheticals, duplicates
            raw = raw.replace(/\s*\(.*?\)\s*/g, "").replace(/^"|"$/g, "").trim().toUpperCase();
            if (raw && raw.length > 1 && !raw.includes("TEAM") && !raw.includes("OFFICERS") && !raw.includes("UNSEEN") && !raw.includes("SILHOUETTE")) {
              nameSet.add(raw);
            }
          }
        }

        if (nameSet.size > 0) {
          // Check which characters already exist
          const { data: existing } = await supabase
            .from("characters")
            .select("name")
            .eq("film_id", filmId);
          const existingNames = new Set((existing ?? []).map((c) => c.name.toUpperCase()));
          const newChars = [...nameSet]
            .filter((n) => !existingNames.has(n))
            .map((name) => ({
              film_id: filmId,
              name: name.charAt(0) + name.slice(1).toLowerCase(), // Title case
            }));

          if (newChars.length > 0) {
            await supabase.from("characters").insert(newChars);
            queryClient.invalidateQueries({ queryKey: ["characters"] });
          }
        }
      } catch (e) {
        console.error("Failed to auto-populate characters:", e);
      }
    }

    setLocking(false);
    setBreakdownOpen(false);
    queryClient.invalidateQueries({ queryKey: ["film", filmId] });
    toast({ title: "Script Locked", description: "Breakdown finalized. Characters and assets propagated to Pre-Production." });
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

  /* Fallback: keyword-based detection if AI didn't provide temporal_analysis */
  const timeShifts = useMemo(() => {
    if (secondaryTimePeriods.length > 0) return []; // AI handled it
    if (!analysis?.scene_breakdown || !Array.isArray(analysis.scene_breakdown)) return [];

    // Determine base year: from time_period field, or default to current year
    const currentYear = new Date().getFullYear();
    let baseYear = currentYear;
    const periodStr = (film?.time_period || timePeriod || "").trim();
    if (periodStr) {
      const yearMatch = periodStr.match(/\b(1[0-9]{3}|2[0-9]{3})\b/);
      if (yearMatch) baseYear = parseInt(yearMatch[1], 10);
      else if (/present/i.test(periodStr)) baseYear = currentYear;
    }

    const FLASHBACK_KEYWORDS = ["flashback", "flash back", "flash-back", "years earlier", "years ago", "years later", "years before", "months earlier", "months ago", "months later", "days earlier", "days later", "flash forward", "flashforward", "flash-forward", "time jump", "memory", "year earlier", "year later"];
    const shifts: { type: string; sceneHeading: string; sceneIndex: number; calculatedYear: string }[] = [];

    for (const [i, scene] of (analysis.scene_breakdown as any[]).entries()) {
      const heading = (scene.scene_heading || "").toLowerCase();
      const desc = (scene.description || "").toLowerCase();
      const combined = `${heading} ${desc}`;
      const originalHeading = scene.scene_heading || `Scene ${i + 1}`;

      for (const kw of FLASHBACK_KEYWORDS) {
        if (!combined.includes(kw)) continue;

        const type = kw.includes("forward") || kw.includes("later") ? "Flash Forward"
          : kw.includes("memory") ? "Memory" : "Flashback";

        let calculatedYear = "";

        // 1. Check for explicit year in heading (e.g., "INT. SCHOOL - DAY 1991")
        const explicitYear = (originalHeading + " " + (scene.description || ""))
          .match(/\b(1[0-9]{3}|2[0-9]{3})\b/);
        if (explicitYear) {
          calculatedYear = explicitYear[1];
        } else {
          // 2. Parse relative offsets like "20 YEARS EARLIER", "1 YEAR LATER", "SIX MONTHS AGO"
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
              // Approximate: show "~YEAR" for months
              const yearOffset = Math.round(num / 12);
              if (yearOffset >= 1) {
                calculatedYear = `~${isPast ? baseYear - yearOffset : baseYear + yearOffset}`;
              } else {
                calculatedYear = `${baseYear} (${num} months ${isPast ? "earlier" : "later"})`;
              }
            } else if (unit.startsWith("day") && num > 0) {
              calculatedYear = `${baseYear} (${num} days ${isPast ? "earlier" : "later"})`;
            }
          }
        }

        shifts.push({ type, sceneHeading: originalHeading, sceneIndex: i, calculatedYear });
        break;
      }
    }
    return shifts;
  }, [analysis?.scene_breakdown, secondaryTimePeriods.length, film?.time_period, timePeriod]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">
      {/* ── Script Details ── */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="w-full">
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg font-bold">Script Details</h3>
              {analysis && (
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-primary" /> Uploaded
                </span>
              )}
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 shrink-0"
                      >
                        {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Reanalyze
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS.join(",")} className="hidden" onChange={handleFileChange} />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer backdrop-blur-md bg-card/50 ${
                        dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      {uploadedFile ? (
                        <>
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                            <CheckCircle className="h-6 w-6 text-primary" />
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
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                            <Type className="h-6 w-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-display font-semibold text-foreground">
                              {uploading ? "Uploading…" : "Drop your screenplay here"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{ACCEPTED_LABEL} — or click to browse</p>
                          </div>
                          <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-xs text-muted-foreground">
                            <Upload className="h-3.5 w-3.5" />
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
            <h2 className="font-display text-2xl font-bold mb-4">Script Breakdown</h2>
          )}

          {/* Loading state with progress */}
          {isAnalyzing && <AnalysisProgress status={analysis?.status} filmId={filmId} />}

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
                  setAnalyzing(false);
                  if (invokeErr) {
                    toast({ title: "Retry failed", description: invokeErr.message, variant: "destructive" });
                  } else {
                    queryClient.invalidateQueries({ queryKey: ["script-analysis", filmId] });
                    toast({ title: "Re-analysis started", description: "Your script is being analyzed again." });
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

          {/* Complete results */}
          {analysis?.status === "complete" && (
            <div className="space-y-6">
              {/* Visual Summary */}
              {analysis.visual_summary && (
                <Collapsible>
                  <CollapsibleTrigger className="w-full">
                    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
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
                    <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6 space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-foreground block">Visual Summary</label>
                        <textarea
                          defaultValue={analysis.visual_summary as string}
                          placeholder="Describe the overall visual story summary..."
                          className="w-full min-h-[100px] text-sm bg-background border border-border rounded-md p-3 resize-y text-foreground placeholder:text-muted-foreground leading-relaxed"
                          style={{ fieldSizing: 'content' } as React.CSSProperties}
                        />
                      </div>
                      <div className="space-y-2 border-t border-border pt-4">
                        <label className="text-xs font-semibold text-foreground block">Signature Style</label>
                        <textarea
                          defaultValue={(analysis.global_elements as any)?.signature_style || ""}
                          placeholder="Describe the overall visual signature style..."
                          className="w-full min-h-[80px] text-sm bg-background border border-border rounded-md p-3 resize-y text-foreground placeholder:text-muted-foreground"
                          style={{ fieldSizing: 'content' } as React.CSSProperties}
                        />
                      </div>
                      <div className="flex justify-end pt-4 border-t border-border">
                        <Button
                          size="sm"
                          variant={visualSummaryApproved ? "default" : "outline"}
                          className={cn("gap-1.5", visualSummaryApproved ? "bg-green-600 hover:bg-green-700 text-white" : "opacity-60")}
                          onClick={() => {
                            const next = !visualSummaryApproved;
                            setVisualSummaryApproved(next);
                            persistApproval("visual_summary_approved", next);
                          }}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          {visualSummaryApproved ? "Approved" : "Approve"}
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ── Time Period ── */}
              <Collapsible>
                <CollapsibleTrigger className="w-full">
                  <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <h3 className="font-display text-lg font-bold">Time Period</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {film?.time_period ? (
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
                      {secondaryTimePeriods.map((period: any, i: number) => (
                        <div key={i} className="rounded-lg bg-secondary p-3 space-y-1.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 shrink-0">
                              {(period.type || "").toLowerCase().includes("forward") || (period.type || "").toLowerCase().includes("epilogue") ? (
                                <FastForward className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Rewind className="h-3.5 w-3.5 text-primary" />
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground">{period.label}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {period.type} · {period.estimated_year_or_range}
                                {period.approximate_scene_count ? ` · ~${period.approximate_scene_count} scenes` : ""}
                                {period.estimated_percentage_of_script ? ` · ${period.estimated_percentage_of_script}` : ""}
                              </p>
                            </div>
                          </div>
                          {Array.isArray(period.evidence) && period.evidence.length > 0 && (
                            <ul className="text-[10px] text-muted-foreground space-y-0.5 pl-9 list-disc">
                              {period.evidence.map((e: string, j: number) => (
                                <li key={j}>{e}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
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
                            <p className="text-[10px] text-muted-foreground uppercase">{shift.type}</p>
                          </div>
                          <Input
                            defaultValue={shift.calculatedYear}
                            placeholder="e.g. 1955"
                            className="w-52 h-8 text-xs"
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

              {analysis.scene_breakdown && Array.isArray(analysis.scene_breakdown) && (
                <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
                  <CollapsibleTrigger className="w-full">
                    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-primary" />
                        <h3 className="font-display text-lg font-bold">Scene Breakdown</h3>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                          {(analysis.scene_breakdown as any[]).length} scenes
                        </span>
                        {reviewStats && (reviewStats.approved > 0 || reviewStats.rejected > 0) && (
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                            {reviewStats.approved} approved · {reviewStats.rejected} rejected · {reviewStats.pending} pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {allScenesApproved ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${breakdownOpen ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6">
                      <SceneBreakdownSection
                        scenes={analysis.scene_breakdown as any[]}
                        storagePath={analysis.storage_path}
                        onAllApprovedChange={setAllScenesApproved}
                        onReviewStatsChange={setReviewStats}
                        analysisId={analysis.id}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Global Elements — collapsed by default */}
              {analysis.global_elements && (
                <Collapsible>
                  <CollapsibleTrigger className="w-full">
                    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
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
                  <CollapsibleContent>
                    <div className="rounded-xl border border-border border-t-0 rounded-t-none bg-card p-6">
                      <GlobalElementsManager data={analysis.global_elements as any} analysisId={analysis.id} onAllReviewedChange={setAllElementsReviewed} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* AI Generation Notes */}
              <EditableAIGenerationNotes
                initialValue={(analysis.ai_generation_notes as string) || ""}
                visualSummary={(analysis.visual_summary as string) || ""}
                timePeriod={film?.time_period || timePeriod}
                signatureStyle={(analysis.global_elements as any)?.signature_style || ""}
                approved={aiNotesApproved}
                onApprovedChange={(v: boolean) => {
                  setAiNotesApproved(v);
                  persistApproval("ai_notes_approved", v);
                }}
              />
            </div>
          )}
        </section>
      )}

      {/* ── Step 3: Content Safety Matrix ── */}
      {analysis?.scene_breakdown && (
        <section>
          {scriptLocked ? (
            /* ── LOCKED STATE — collapsible like Global Elements ── */
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
                    scenes={analysis?.scene_breakdown as any[] || []}
                    storagePath={analysis?.storage_path || ""}
                    language={language}
                    nudity={nudity}
                    violence={violence}
                    handleToggle={handleToggle}
                    setLanguage={setLanguage}
                    setNudity={setNudity}
                    setViolence={setViolence}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <>
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
                        scenes={analysis?.scene_breakdown as any[] || []}
                        storagePath={analysis?.storage_path || ""}
                        language={language}
                        nudity={nudity}
                        violence={violence}
                        handleToggle={handleToggle}
                        setLanguage={setLanguage}
                        setNudity={setNudity}
                        setViolence={setViolence}
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
          </>
          )}
        </section>
      )}

      {/* ── Step 4: Lock Script ── */}
      {analysis?.scene_breakdown && !scriptLocked && (
        <section>
          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
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
    </div>
  );
};

/* ══════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════ */
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
        <Button variant={allApproved ? "secondary" : "default"} size="sm" className="gap-1.5 shrink-0" onClick={toggleAll}>
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
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptParagraphs, setScriptParagraphs] = useState<{ type: string; text: string }[] | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptPage, setScriptPage] = useState<string | null>(scene.page || null);

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
    if (!heading) return [{ type: "Action", text: fullText }];

    const headingPattern = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const startMatch = fullText.match(new RegExp(`^(.*${headingPattern}.*)$`, "mi"));
    if (!startMatch || startMatch.index === undefined) return [{ type: "Action", text: fullText }];

    const startIdx = startMatch.index;
    const afterHeading = fullText.substring(startIdx + startMatch[0].length);
    const nextScene = afterHeading.match(/\n\s*((?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.).+)/i);
    const endIdx = nextScene?.index !== undefined
      ? startIdx + startMatch[0].length + nextScene.index
      : fullText.length;

    const sceneText = fullText.substring(startIdx, endIdx).trim();
    // Simple heuristic: lines in ALL CAPS with no period at end are likely characters
    return sceneText.split("\n").filter((l) => l.trim()).map((line) => {
      const trimmed = line.trim();
      if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/.test(trimmed)) return { type: "Scene Heading", text: trimmed };
      if (/^[A-Z][A-Z\s'.()-]+$/.test(trimmed) && trimmed.length < 40) return { type: "Character", text: trimmed };
      return { type: "Action", text: trimmed };
    });
  };

  const loadScript = async () => {
    if (scriptParagraphs !== null) {
      setScriptOpen(true);
      return;
    }
    setScriptLoading(true);
    setScriptOpen(true);
    try {
      const { data, error } = await supabase.storage.from("scripts").download(storagePath);
      if (error || !data) throw error || new Error("Download failed");
      const full = await data.text();

      // Detect FDX (XML) vs plain text
      const isFdx = full.trimStart().startsWith("<?xml") || full.includes("<FinalDraft");
      const parsed = isFdx ? parseFdxScene(full) : parsePlainTextScene(full);
      setScriptParagraphs(parsed);
    } catch {
      setScriptParagraphs([{ type: "Action", text: "[Could not load script file]" }]);
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
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold font-mono">
            {scene.scene_number ?? index + 1}
          </span>
          <div>
            <p className="font-display font-semibold text-sm">{scene.scene_heading || "Untitled Scene"}</p>
            <p className="text-xs text-muted-foreground">
              {scene.int_ext} · {scene.time_of_day}
              {scriptPage && <span className="ml-2 text-primary/60">p. {scriptPage}</span>}
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

      {/* Script Dialog — printed page appearance */}
      <Dialog open={scriptOpen} onOpenChange={setScriptOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" />
              {scene.scene_heading || `Scene ${scene.scene_number ?? index + 1}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Original screenplay formatting
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 pb-6">
            {scriptLoading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-20">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading script…
              </div>
            ) : (
              <div
                className="mx-auto bg-white text-black shadow-lg"
                style={{
                  fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
                  fontSize: "12px",
                  lineHeight: "1.0",
                  padding: "72px 60px 72px 90px",
                  maxWidth: "612px",
                  minHeight: "792px",
                }}
              >
                {scriptParagraphs?.map((p, i) => {
                  switch (p.type) {
                    case "Scene Heading":
                      return (
                        <p key={i} style={{ textTransform: "uppercase", fontWeight: "bold", marginTop: i === 0 ? 0 : 24, marginBottom: 12 }}>
                          <span>{scene.scene_number ?? index + 1}</span>
                          <span style={{ marginLeft: 24 }}>{p.text}</span>
                        </p>
                      );
                    case "Character":
                      return (
                        <p key={i} style={{ textTransform: "uppercase", textAlign: "left", paddingLeft: "37%", marginTop: 18, marginBottom: 0 }}>
                          {p.text}
                        </p>
                      );
                    case "Parenthetical":
                      return (
                        <p key={i} style={{ paddingLeft: "28%", fontStyle: "italic", marginTop: 0, marginBottom: 0 }}>
                          {p.text}
                        </p>
                      );
                    case "Dialogue":
                      return (
                        <p key={i} style={{ paddingLeft: "17%", paddingRight: "17%", marginTop: 0, marginBottom: 0 }}>
                          {p.text}
                        </p>
                      );
                    case "Transition":
                      return (
                        <p key={i} style={{ textAlign: "right", textTransform: "uppercase", marginTop: 18, marginBottom: 12 }}>
                          {p.text}
                        </p>
                      );
                    default: // Action
                      return (
                        <p key={i} style={{ marginTop: 12, marginBottom: 0 }}>
                          {p.text}
                        </p>
                      );
                  }
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
  const [desc, setDesc] = useState<string>(scene.description || "");
  const [atmosphere, setAtmosphere] = useState<string>(scene.visual_design?.atmosphere || "");
  const [lighting, setLighting] = useState<string>(scene.visual_design?.lighting_style || "");
  const [palette, setPalette] = useState<string>(scene.visual_design?.color_palette || "");
  const [references, setReferences] = useState<string>(scene.visual_design?.visual_references || "");
  const [location, setLocation] = useState<string>(scene.setting || scene.scene_heading || "");
  const [characters, setCharacters] = useState<{ name: string; emotional_tone: string; key_expressions: string; physical_behavior: string }[]>(
    (scene.characters || []).map((c: any) => ({
      name: c.name || "",
      emotional_tone: c.emotional_tone || "",
      key_expressions: c.key_expressions || "",
      physical_behavior: c.physical_behavior || "",
    }))
  );
  const [wardrobe, setWardrobe] = useState<{ character: string; clothing_style: string; condition: string; hair_makeup: string }[]>(
    (scene.wardrobe || []).map((w: any) => ({
      character: w.character || "",
      clothing_style: w.clothing_style || "",
      condition: w.condition || "",
      hair_makeup: w.hair_makeup || "",
    }))
  );
  const [cameraFeel, setCameraFeel] = useState<string>(scene.cinematic_elements?.camera_feel || "");
  const [motionCues, setMotionCues] = useState<string>(scene.cinematic_elements?.motion_cues || "");
  const [shotSuggestions, setShotSuggestions] = useState<string>(
    (scene.cinematic_elements?.shot_suggestions || []).join(" · ")
  );
  const [envDetails, setEnvDetails] = useState<string>(scene.environment_details || "");
  const [keyObjects, setKeyObjects] = useState<string[]>(scene.key_objects || []);
  const [imagePrompt, setImagePrompt] = useState<string>(scene.image_prompt || "");
  const [videoPrompt, setVideoPrompt] = useState<string>(scene.video_prompt || "");

  const [newItem, setNewItem] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; idx: number; kind?: string } | null>(null);

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
        </Section>

        {/* Visual Design */}
        <Section icon={Palette} label="Visual Design">
          <div className="grid grid-cols-2 gap-2">
            <EditableTag label="Atmosphere" value={atmosphere} onChange={setAtmosphere} />
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

        {/* Environment & Props */}
        <Section icon={MapPin} label="Environment & Props">
          <Textarea value={envDetails} onChange={(e) => setEnvDetails(e.target.value)} className="text-xs min-h-[40px] bg-background border-border" placeholder="Environment description…" style={{ fieldSizing: 'content' } as React.CSSProperties} />
          <div className="flex flex-wrap gap-1.5 mt-2">
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

        {/* AI Generation Prompts */}
        <Section icon={Sparkles} label="AI Generation Prompts">
          <p className="text-xs font-mono text-primary/70 mb-1">IMAGE PROMPT</p>
          <Textarea value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} className="text-xs min-h-[80px] bg-background border-border font-mono" style={{ fieldSizing: 'content' } as React.CSSProperties} />
          <p className="text-xs font-mono text-primary/70 mb-1 mt-3">VIDEO PROMPT</p>
          <Textarea value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} className="text-xs min-h-[80px] bg-background border-border font-mono" style={{ fieldSizing: 'content' } as React.CSSProperties} />
        </Section>

        {/* Continuity Flags */}
        {scene.continuity_flags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {scene.continuity_flags.map((flag: string, i: number) => (
              <span key={i} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-0.5">{flag}</span>
            ))}
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
            className={cn("gap-1.5", approved && "bg-primary text-primary-foreground border-primary hover:bg-primary/90")}
            onClick={onToggleApproved}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {approved ? "Approved ✓" : "Approve Scene"}
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

const RATING_TEMPLATES: { rating: MPAARating; label: string; desc: string }[] = [
  { rating: "G", label: "G — General Audiences", desc: "No objectionable content" },
  { rating: "PG", label: "PG — Parental Guidance", desc: "Mild language, brief mild violence" },
  { rating: "PG-13", label: "PG-13 — Parents Cautioned", desc: "Some violence, brief strong language" },
  { rating: "R", label: "R — Restricted", desc: "Strong language, violence, some nudity" },
];

/* regex patterns and local analysis removed — now handled by AI edge function */

const ExpandableFlaggedScene = ({ flag, scene, scriptText, onSaveScript }: { flag: ContentFlag; scene?: any; scriptText?: string | null; onSaveScript?: (text: string) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const openEditor = () => {
    if (scriptText) {
      // Find the scene's text in the full script and show a window around the excerpt
      const excerptClean = flag.excerpt.replace(/^…|…$/g, "").trim();
      const idx = scriptText.indexOf(excerptClean);
      if (idx >= 0) {
        const lineStart = scriptText.lastIndexOf("\n", Math.max(0, idx - 200));
        const lineEnd = scriptText.indexOf("\n", Math.min(scriptText.length, idx + excerptClean.length + 200));
        setEditText(scriptText.substring(lineStart >= 0 ? lineStart + 1 : 0, lineEnd >= 0 ? lineEnd : scriptText.length));
      } else {
        // Show scene heading area
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
    // Replace the old section with the edited one
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

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-destructive/10 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive text-xs font-bold font-mono shrink-0">
            {flag.sceneIndex + 1}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{flag.sceneHeading}</p>
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
                {scene.time_of_day && <Tag label="Time" value={scene.time_of_day} />}
                {scene.setting && <Tag label="Setting" value={scene.setting} />}
              </div>
              {scene.description && (
                <Section icon={Eye} label="Description">
                  <p className="text-sm text-muted-foreground">{scene.description}</p>
                </Section>
              )}
              {scene.characters?.length > 0 && (
                <Section icon={Users} label="Characters">
                  {scene.characters.map((c: any, ci: number) => (
                    <div key={ci} className="bg-secondary rounded-lg p-3">
                      <p className="text-sm font-semibold">{c.name}</p>
                      {c.emotional_tone && <p className="text-xs text-muted-foreground mt-1">Tone: {c.emotional_tone}</p>}
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
  );
};


const ContentSafetyMatrix = ({
  scenes, storagePath, language, nudity, violence, handleToggle, setLanguage, setNudity, setViolence,
}: {
  scenes: any[];
  storagePath: string;
  language: boolean; nudity: boolean; violence: boolean;
  handleToggle: (field: string, setter: (v: boolean) => void) => (val: boolean) => void;
  setLanguage: (v: boolean) => void; setNudity: (v: boolean) => void; setViolence: (v: boolean) => void;
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<MPAARating | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [suggestedRating, setSuggestedRating] = useState<MPAARating>("G");
  const [loading, setLoading] = useState(false);

  const [ratingJustification, setRatingJustification] = useState("");
  const [scriptText, setScriptText] = useState<string | null>(null);
  const { toast } = useToast();

  const runAnalysis = useCallback(async () => {
    if (!storagePath) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-content-safety", {
        body: { storage_path: storagePath, scenes },
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
      setFlags(aiFlags);
      setSuggestedRating(data.suggested_rating || "G");
      setRatingJustification(data.rating_justification || "");
      setScriptLoaded(true);
    } catch (e: any) {
      console.error("Content safety analysis failed:", e);
      toast({ title: "Analysis failed", description: e?.message || "Could not analyze script", variant: "destructive" });
      setFlags([]);
      setSuggestedRating("G");
      setScriptLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [storagePath, scenes, toast]);

  // Load script text for editing (parse FDX XML to plain text)
  useEffect(() => {
    if (!storagePath || scriptText !== null) return;
    supabase.storage.from("scripts").download(storagePath).then(({ data }) => {
      if (!data) return;
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
          setScriptText(raw);
        }
      });
    });
  }, [storagePath, scriptText]);

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
    return (
      <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Analyzing script for content safety…</span>
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
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
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
              const ratingOrder: MPAARating[] = ["G", "PG", "PG-13", "R", "NC-17"];
              const templateIdx = ratingOrder.indexOf(selectedTemplate);
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

const EditableAIGenerationNotes = ({ initialValue, visualSummary, timePeriod, signatureStyle, approved, onApprovedChange }: { initialValue: string; visualSummary?: string; timePeriod?: string; signatureStyle?: string; approved: boolean; onApprovedChange: (v: boolean) => void }) => {
  const [value, setValue] = useState(() => {
    if (initialValue) return initialValue;
    const parts: string[] = [];
    if (timePeriod) parts.push(`Time Period: ${timePeriod}. Ensure all generated visuals reflect this era accurately — architecture, clothing, vehicles, signage, and technology should be period-appropriate.`);
    if (signatureStyle) parts.push(`Signature Style: ${signatureStyle}`);
    if (visualSummary) parts.push(`Visual Direction: ${visualSummary}`);
    if (parts.length === 0) return "";
    return parts.join("\n\n");
  });
  return (
    <Collapsible>
      <CollapsibleTrigger className="w-full">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-bold">AI Generation Notes</h3>
          </div>
          <div className="flex items-center gap-2">
            {approved ? (
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
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add notes about overall visual approach, consistency requirements, or special considerations..."
            className="min-h-[100px] text-sm bg-background resize-y"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <div className="flex justify-end pt-2 border-t border-border">
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
      </CollapsibleContent>
    </Collapsible>
  );
};

export default Development;
