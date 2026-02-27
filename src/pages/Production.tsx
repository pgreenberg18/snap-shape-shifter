import { useState, useCallback, useRef, useEffect } from "react";
import { parseSceneFromPlainText, classifyScreenplayLines } from "@/lib/parse-script-text";
import { Camera, Film, ChevronRight } from "lucide-react";
import { useFilmId, useParsedScenes } from "@/hooks/useFilm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGenerationManager } from "@/hooks/useGenerationManager";
import { TooltipProvider } from "@/components/ui/tooltip";
import SceneNavigator from "@/components/production/SceneNavigator";
import ScriptWorkspace from "@/components/production/ScriptWorkspace";
import type { ShotHighlight } from "@/components/production/ScriptWorkspace";
import ShotList from "@/components/production/ShotList";
import type { Shot } from "@/components/production/ShotList";
import ShotBuilder from "@/components/production/ShotBuilder";
import ShotDescriptionPane from "@/components/production/ShotDescriptionPane";
import type { RepairTarget } from "@/components/production/ShotDescriptionPane";
import PlaybackMonitor, { EMPTY_TAKES } from "@/components/production/PlaybackMonitor";
import type { Take } from "@/components/production/PlaybackMonitor";
import OpticsSuitePanel from "@/components/production/OpticsSuitePanel";
import type { AnchorScore } from "@/components/production/AnchorPicker";
import type { DiffPair } from "@/components/production/DiffOverlay";
import ViceStatusBadge from "@/components/production/ViceStatusBadge";
import VicePanel from "@/components/production/VicePanel";
import { useScriptViewer } from "@/components/ScriptViewerDialog";

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
  });

const useSceneText = (filmId: string | undefined, sceneNumber: number | undefined) =>
  useQuery({
    queryKey: ["scene-text", filmId, sceneNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parsed_scenes")
        .select("raw_text, characters, key_objects, wardrobe, location_name")
        .eq("film_id", filmId!)
        .eq("scene_number", sceneNumber!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!filmId && sceneNumber != null,
  });

const useShotsForFilm = (filmId: string | undefined) =>
  useQuery({
    queryKey: ["shots", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shots")
        .select("*")
        .eq("film_id", filmId!)
        .order("scene_number", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!filmId,
  });

const Production = () => {
  const filmId = useFilmId();
  const queryClient = useQueryClient();
  const { startGeneration, getGenerationsForShot } = useGenerationManager();
  const { openScriptViewer, setScriptViewerScenes } = useScriptViewer();
  const { data: analysis } = useLatestAnalysis(filmId);
  const { data: productionParsedScenes } = useParsedScenes();
  const { data: allShots = [] } = useShotsForFilm(filmId);

  const [activeSceneIdx, setActiveSceneIdx] = useState<number | null>(null);
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  const [viewportAspect, setViewportAspect] = useState(16 / 9);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [takes, setTakes] = useState<Take[]>(EMPTY_TAKES);
  const [activeTakeIdx, setActiveTakeIdx] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState<"anchor" | "animate" | "targeted_edit" | null>(null);
  const [anchorUrls, setAnchorUrls] = useState<string[]>([]);
  const [selectedAnchorIdx, setSelectedAnchorIdx] = useState<number | null>(null);
  const [anchorScores, setAnchorScores] = useState<AnchorScore[]>([]);
  const isDragging = useRef(false);
  const [repairTarget, setRepairTarget] = useState<RepairTarget | null>(null);
  const [diffPair, setDiffPair] = useState<DiffPair | null>(null);
  const [vicePanelOpen, setVicePanelOpen] = useState(false);
  const [isAutoShotting, setIsAutoShotting] = useState(false);
  const [scenesCollapsed, setScenesCollapsed] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persisted script pane dimensions
  const [scriptColWidth, setScriptColWidth] = useState(() => {
    const saved = localStorage.getItem("vfs-script-col-width");
    return saved ? Number(saved) : 380;
  });
  const [scriptPaneHeight, setScriptPaneHeight] = useState(() => {
    const saved = localStorage.getItem("vfs-script-pane-height");
    return saved ? Number(saved) : 192;
  });

  useEffect(() => { localStorage.setItem("vfs-script-col-width", String(scriptColWidth)); }, [scriptColWidth]);
  useEffect(() => { localStorage.setItem("vfs-script-pane-height", String(scriptPaneHeight)); }, [scriptPaneHeight]);

  const handleScriptColResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = scriptColWidth;
    const onMove = (ev: MouseEvent) => setScriptColWidth(Math.max(280, Math.min(600, startW + (ev.clientX - startX))));
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [scriptColWidth]);

  const handleScriptHeightResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = scriptPaneHeight;
    const onMove = (ev: MouseEvent) => setScriptPaneHeight(Math.max(100, Math.min(500, startH + (ev.clientY - startY))));
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [scriptPaneHeight]);

  const scenes: any[] = productionParsedScenes ?? [];

  const activeScene = activeSceneIdx !== null ? scenes[activeSceneIdx] : null;
  const activeSceneNumber = activeScene?.scene_number ?? (activeSceneIdx !== null ? activeSceneIdx + 1 : undefined);

  const { data: sceneTextData } = useSceneText(filmId, activeSceneNumber);

  // Shots for current scene
  const sceneShots: Shot[] = activeSceneNumber
    ? allShots.filter((s) => s.scene_number === activeSceneNumber)
    : [];

  // Shot counts per scene
  const shotCounts: Record<number, number> = {};
  allShots.forEach((s) => {
    shotCounts[s.scene_number] = (shotCounts[s.scene_number] || 0) + 1;
  });

  const activeShot = sceneShots.find((s) => s.id === activeShotId) ?? null;
  const activeShotIndex = sceneShots.findIndex((s) => s.id === activeShotId);

  // Build shot highlights for the script panel
  const shotHighlights: ShotHighlight[] = sceneShots.map((s, idx) => ({
    shotId: s.id,
    promptText: s.prompt_text || "",
    colorIndex: idx,
  }));

  // Scene elements from parsed data
  const sceneElements = sceneTextData ? {
    location: sceneTextData.location_name ?? undefined,
    characters: sceneTextData.characters as string[] | undefined,
    props: sceneTextData.key_objects as string[] | undefined,
    wardrobe: Array.isArray(sceneTextData.wardrobe)
      ? (sceneTextData.wardrobe as any[]).map((w: any) => typeof w === "string" ? w : w?.description ?? "").filter(Boolean)
      : undefined,
  } : undefined;

  const handleAspectChange = useCallback((ratio: number) => setViewportAspect(ratio), []);

  // Sidebar resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const maxWidth = window.innerWidth * 0.3;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setSidebarWidth(Math.max(200, Math.min(maxWidth, startWidth + (ev.clientX - startX))));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  // Helper: sync vice_dependencies from prompt ref codes
  const syncDependencies = useCallback(async (shotId: string, promptText: string | null) => {
    if (!filmId || !promptText) return;
    const matches = promptText.match(/\{\{([A-Z0-9_]+)\}\}/g);
    const codes = matches ? matches.map((m) => m.replace(/[{}]/g, "")) : [];

    // Fetch identity registry to get asset_type for each code
    if (codes.length > 0) {
      const { data: assets } = await supabase
        .from("asset_identity_registry")
        .select("internal_ref_code, asset_type")
        .eq("film_id", filmId)
        .in("internal_ref_code", codes);

      const rows = (assets || []).map((a) => ({
        film_id: filmId,
        source_token: a.internal_ref_code,
        source_type: a.asset_type,
        shot_id: shotId,
        dependency_type: "visual" as const,
      }));

      if (rows.length > 0) {
        await supabase.from("vice_dependencies").upsert(rows, { onConflict: "film_id,source_token,shot_id,dependency_type" });
      }
    }

    // Clean up stale dependencies (tokens no longer in prompt)
    const { data: existing } = await supabase
      .from("vice_dependencies")
      .select("id, source_token")
      .eq("shot_id", shotId)
      .eq("film_id", filmId);

    if (existing) {
      const stale = existing.filter((d) => !codes.includes(d.source_token));
      if (stale.length > 0) {
        await supabase.from("vice_dependencies").delete().in("id", stale.map((s) => s.id));
      }
    }
  }, [filmId]);

  // Create shot mutation
  const createShot = useMutation({
    mutationFn: async ({ text, characters }: { text: string; characters: string[] }) => {
      if (!filmId || !activeSceneNumber) return;
      const { data, error } = await supabase
        .from("shots")
        .insert({
          film_id: filmId,
          scene_number: activeSceneNumber,
          prompt_text: text,
          camera_angle: null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["shots", filmId] });
      if (data) {
        setActiveShotId(data.id);
        await syncDependencies(data.id, data.prompt_text);
      }
    },
  });

  const updateShot = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { prompt_text?: string; camera_angle?: string } }) => {
      const { error } = await supabase.from("shots").update(updates).eq("id", id);
      if (error) throw error;
      return { id, updates };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["shots", filmId] });
      if (result?.updates.prompt_text !== undefined) {
        await syncDependencies(result.id, result.updates.prompt_text ?? null);
      }
    },
  });

  // Take actions
  const handleRateTake = (idx: number, rating: number) => {
    setTakes((prev) => prev.map((t, i) => i === idx ? { ...t, rating } : t));
  };
  const handleCircleTake = (idx: number) => {
    setTakes((prev) => prev.map((t, i) => ({ ...t, circled: i === idx ? !t.circled : false })));
  };
  const handleDeleteTake = (idx: number) => {
    setTakes((prev) => prev.map((t, i) => i === idx ? { ...t, thumbnailUrl: null, rating: 0, circled: false } : t));
    setActiveTakeIdx((prev) => (prev === idx ? null : prev));
  };

  // Generation via global GenerationManager (persists across navigation)
  const handleGenerate = useCallback(async (mode: "anchor" | "animate" | "targeted_edit", overrideRepairTarget?: RepairTarget) => {
    if (!activeShot) return;
    setIsGenerating(true);
    setGenerationMode(mode);
    const effectiveRepairTarget = overrideRepairTarget ?? repairTarget;

    const body: Record<string, unknown> = {
      shot_id: activeShot.id,
      mode,
      anchor_url: mode === "animate"
        ? (selectedAnchorIdx !== null ? anchorUrls[selectedAnchorIdx] : undefined)
        : mode === "targeted_edit"
          ? (selectedAnchorIdx !== null ? anchorUrls[selectedAnchorIdx] : undefined)
          : undefined,
      anchor_count: 4,
    };
    if (mode === "targeted_edit" && effectiveRepairTarget) {
      body.repair_target = effectiveRepairTarget;
    }

    const shotId = activeShot.id;

    startGeneration(shotId, mode, body, (completed) => {
      const data = completed.result;
      if (!data?.output_urls) return;

      // Only update local UI state if user is still viewing this shot
      if (mode === "anchor") {
        setAnchorUrls(data.output_urls);
        setSelectedAnchorIdx(0);
        const scores: AnchorScore[] = Array.isArray(data.scores)
          ? data.scores
          : data.output_urls.map(() => ({}));
        setAnchorScores(scores);
        setTakes((prev) => {
          const emptyIdx = prev.findIndex((t) => !t.thumbnailUrl);
          const targetIdx = emptyIdx !== -1 ? emptyIdx : prev.length - 1;
          return prev.map((t, i) => i === targetIdx ? { ...t, thumbnailUrl: data.output_urls![0] } : t);
        });
      } else if (mode === "animate" && data.output_urls[0]) {
        setTakes((prev) => {
          const emptyIdx = prev.findIndex((t) => !t.thumbnailUrl);
          const targetIdx = emptyIdx !== -1 ? emptyIdx : prev.length - 1;
          return prev.map((t, i) => i === targetIdx ? { ...t, thumbnailUrl: data.output_urls![0] } : t);
        });
      } else if (mode === "targeted_edit" && data.output_urls[0]) {
        if (selectedAnchorIdx !== null) {
          const originalUrl = anchorUrls[selectedAnchorIdx];
          if (originalUrl && effectiveRepairTarget) {
            setDiffPair({
              originalUrl,
              repairedUrl: data.output_urls[0],
              repairTarget: effectiveRepairTarget,
            });
          }
          setAnchorUrls((prev) =>
            prev.map((url, i) => i === selectedAnchorIdx ? data.output_urls![0] : url)
          );
        }
      }

      setIsGenerating(false);
      setGenerationMode(null);
      setRepairTarget(null);
    });

    // Note: isGenerating stays true until onComplete fires (even across navigation)
  }, [activeShot, anchorUrls, selectedAnchorIdx, repairTarget, startGeneration]);

  const handleRepair = useCallback((target: RepairTarget, _hint: string) => {
    setRepairTarget(target);
    handleGenerate("targeted_edit", target);
  }, [handleGenerate]);

  // Auto-Shot: AI suggests most cinematic shot type from script context
  const handleAutoShot = useCallback(async () => {
    if (!sceneTextData?.raw_text || !filmId || !activeSceneNumber) return;
    setIsAutoShotting(true);
    try {
      // Use a portion of the script text as the shot suggestion basis
      const scriptText = sceneTextData.raw_text;
      // Create a shot from the full scene text with an AI-suggested camera angle
      const SHOT_SUGGESTIONS = [
        { pattern: /reveal|discover|find|realize/i, angle: "Slow Push-In Close-Up", desc: "Dramatic reveal — slow dolly in to capture the moment of discovery." },
        { pattern: /run|chase|flee|escape/i, angle: "Handheld Tracking Shot", desc: "Kinetic energy — handheld camera following the action at pace." },
        { pattern: /silent|still|pause|moment/i, angle: "Locked-Off Wide", desc: "Contemplative stillness — static wide to let the silence breathe." },
        { pattern: /argue|fight|confront|yell/i, angle: "Cross-Cut Close-Ups", desc: "Tension escalation — alternating tight close-ups between combatants." },
        { pattern: /enter|arrive|approach|walk/i, angle: "Crane Sweep Down", desc: "Grand entrance — crane descending to reveal the character arriving." },
        { pattern: /kiss|embrace|hold|touch/i, angle: "Orbiting Two-Shot", desc: "Intimate orbit — camera slowly circling the couple." },
        { pattern: /look|gaze|stare|watch/i, angle: "Rack Focus Close-Up", desc: "Point of view shift — rack focus from subject to object of gaze." },
        { pattern: /night|dark|shadow|moon/i, angle: "Low-Key Silhouette", desc: "Noir atmosphere — backlit silhouette with deep shadows." },
      ];

      const match = SHOT_SUGGESTIONS.find((s) => s.pattern.test(scriptText));
      const suggestion = match || { angle: "Master Wide Shot", desc: "Establishing master — wide coverage of the full scene geography." };

      // Create the shot with the suggested angle
      const { data, error } = await supabase
        .from("shots")
        .insert({
          film_id: filmId,
          scene_number: activeSceneNumber,
          prompt_text: scriptText.substring(0, 500),
          camera_angle: suggestion.angle,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        queryClient.invalidateQueries({ queryKey: ["shots", filmId] });
        setActiveShotId(data.id);
        await syncDependencies(data.id, data.prompt_text);
      }
      const { toast } = await import("sonner");
      toast.success(`Auto-Shot: ${suggestion.angle}`, { description: suggestion.desc });
    } catch (err) {
      console.error("Auto-shot failed:", err);
      const { toast } = await import("sonner");
      toast.error("Auto-Shot failed");
    } finally {
      setIsAutoShotting(false);
    }
  }, [sceneTextData, filmId, activeSceneNumber, queryClient, syncDependencies]);

  const [isLoadingGenerations, setIsLoadingGenerations] = useState(false);

  // Load previous generations when switching shots
  const handleSelectShot = useCallback(async (id: string) => {
    setActiveShotId(id);
    setTakes(EMPTY_TAKES);
    setActiveTakeIdx(null);
    setAnchorUrls([]);
    setSelectedAnchorIdx(null);
    setAnchorScores([]);
    setDiffPair(null);
    setIsLoadingGenerations(true);

    // Fetch completed generations for this shot
    try {
      const { data: gens } = await supabase
        .from("generations")
        .select("id, mode, output_urls, scores_json, status, created_at")
        .eq("shot_id", id)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!gens || gens.length === 0) return;

      // Restore latest anchor generation
      const latestAnchor = gens.find((g) => g.mode === "anchor" && g.output_urls && g.output_urls.length > 0);
      if (latestAnchor?.output_urls) {
        setAnchorUrls(latestAnchor.output_urls);
        setSelectedAnchorIdx(0);
        const scores: AnchorScore[] = Array.isArray(latestAnchor.scores_json)
          ? latestAnchor.scores_json as AnchorScore[]
          : latestAnchor.output_urls.map(() => ({}));
        setAnchorScores(scores);
      }

      // Restore completed animate/targeted_edit generations into take bin
      const videoGens = gens
        .filter((g) => (g.mode === "animate" || g.mode === "targeted_edit") && g.output_urls && g.output_urls.length > 0)
        .slice(0, 5);

      if (videoGens.length > 0) {
        setTakes((prev) =>
          prev.map((t, i) => {
            const gen = videoGens[i];
            if (gen?.output_urls?.[0]) {
              return { ...t, thumbnailUrl: gen.output_urls[0] };
            }
            return t;
          })
        );
        setActiveTakeIdx(0);
      }
    } catch (err) {
      console.error("Failed to load previous generations:", err);
    } finally {
      setIsLoadingGenerations(false);
    }
  }, []);

  const handleSelectScene = (idx: number) => {
    setActiveSceneIdx(idx);
    setActiveShotId(null);
    setTakes(EMPTY_TAKES);
    setActiveTakeIdx(null);
    setAnchorUrls([]);
    setSelectedAnchorIdx(null);
    setAnchorScores([]);
    setDiffPair(null);
    // Auto-collapse scene list after 200ms
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setScenesCollapsed(true), 200);
  };

  /* ── View script for a scene ── */
  const handleViewScript = useCallback(async (sceneIdx: number) => {
    const scene = scenes[sceneIdx];
    if (!scene) return;

    const sceneNum = scene.scene_number ?? sceneIdx + 1;
    const title = scene.scene_heading || `Scene ${sceneNum}`;

    openScriptViewer({ title, description: "Original screenplay formatting" });

    try {
      // Prefer raw_text already on the parsed scene — avoids a storage download
      if (scene.raw_text) {
        const lines = scene.raw_text.split("\n");
        const parsed = classifyScreenplayLines(lines);
        setScriptViewerScenes([{ sceneNum, heading: title, paragraphs: parsed }]);
        return;
      }

      // Fallback: download original script file
      if (!analysis?.storage_path) throw new Error("No script file");
      const { data, error } = await supabase.storage.from("scripts").download(analysis.storage_path);
      if (error || !data) throw error || new Error("Download failed");
      const full = await data.text();

      const heading = scene.scene_heading?.trim();
      const isFdx = full.trimStart().startsWith("<?xml") || full.includes("<FinalDraft");

      let parsed: { type: string; text: string }[];
      if (isFdx) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(full, "text/xml");
        const paragraphs = Array.from(doc.querySelectorAll("Paragraph"));
        let startIdx = -1;
        let endIdx = paragraphs.length;
        for (let i = 0; i < paragraphs.length; i++) {
          const p = paragraphs[i];
          const type = p.getAttribute("Type") || "";
          const content = Array.from(p.querySelectorAll("Text")).map((t) => t.textContent || "").join("").trim();
          if (type === "Scene Heading") {
            if (startIdx === -1 && heading && content.toUpperCase().includes(heading.toUpperCase())) {
              startIdx = i;
            } else if (startIdx !== -1) {
              endIdx = i;
              break;
            }
          }
        }
        if (startIdx === -1) startIdx = 0;
        parsed = [];
        for (let i = startIdx; i < endIdx; i++) {
          const p = paragraphs[i];
          const type = p.getAttribute("Type") || "Action";
          const content = Array.from(p.querySelectorAll("Text")).map((t) => t.textContent || "").join("");
          if (content.trim()) parsed.push({ type, text: content });
        }
      } else {
        parsed = parseSceneFromPlainText(full, heading);
      }

      setScriptViewerScenes([{ sceneNum, heading: title, paragraphs: parsed }]);
    } catch {
      setScriptViewerScenes([{ sceneNum, heading: title, paragraphs: [{ type: "Action", text: "[Could not load script file]" }] }]);
    }
  }, [scenes, analysis, openScriptViewer, setScriptViewerScenes]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-border bg-card px-6 py-3 flex items-baseline gap-3">
          <h1 className="font-display text-sm font-bold tracking-tight text-foreground whitespace-nowrap">Production</h1>
          <p className="text-[10px] text-muted-foreground truncate">Shot composition, camera direction, and visual generation — bring every scene to life.</p>
        </div>
        <div className="flex flex-1 min-h-0">
        {/* ── LEFT: Scene Navigator (Apple-style slide) ── */}
        <div
          className="shrink-0 overflow-hidden"
          style={{
            width: scenesCollapsed ? 0 : sidebarWidth,
            opacity: scenesCollapsed ? 0 : 1,
            transition: 'width 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-out',
            willChange: 'width, opacity',
          }}
        >
          <div data-help-id="prod-scene-navigator">
          <SceneNavigator
            scenes={scenes}
            activeSceneIdx={activeSceneIdx}
            onSelectScene={handleSelectScene}
            onViewScript={handleViewScript}
            shotCounts={shotCounts}
            width={sidebarWidth}
            onResizeStart={handleResizeStart}
          />
          </div>
        </div>

        {/* ── CENTER: Script / Shots / Viewer ── */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {activeScene ? (
            <>
              {/* Scene header */}
              <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
                {scenesCollapsed && (
                  <button
                    onClick={() => setScenesCollapsed(false)}
                    className="flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors shrink-0 mr-1"
                    title="Show scenes list"
                  >
                    <Film className="h-3.5 w-3.5" />
                    <span>Scenes</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary text-sm font-mono font-bold">
                  {activeSceneNumber}
                </span>
                <div className="min-w-0">
                  <h1 className="font-display text-base font-bold text-foreground truncate">
                    {activeScene.scene_heading || "Untitled Scene"}
                  </h1>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {activeScene.int_ext} · {activeScene.day_night}
                    {activeScene.location_name && ` · ${activeScene.location_name}`}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <ViceStatusBadge onClick={() => setVicePanelOpen(true)} />
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/80 border border-border/50">
                    <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
                      {viewportAspect > 2 ? "2.39:1" : "16:9"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Two-column: Left = Script+Builder, Right = Viewer+TakeBin+ShotStack */}
              <div className="flex-1 flex min-h-0">
                {/* Left column: Script → Master Control Deck → Generation Buttons */}
                <div style={{ width: scriptColWidth }} className="min-w-[280px] max-w-[600px] flex border-r-0 flex-col overflow-hidden shrink-0 relative">
                  {sceneShots.length === 0 && (
                    <div className="px-4 py-1.5 bg-primary/5 border-b border-primary/20">
                      <p className="text-[11px] text-primary/70 font-mono text-center">
                        Highlight script text below and click "Create Shot from Selection" to begin.
                      </p>
                    </div>
                  )}
                  <div data-help-id="prod-script-workspace">
                  <ScriptWorkspace
                    scene={activeScene}
                    sceneText={sceneTextData?.raw_text ?? undefined}
                    onCreateShot={(text, characters) => createShot.mutate({ text, characters })}
                    height={scriptPaneHeight}
                    onResizeStart={handleScriptHeightResize}
                    shotHighlights={shotHighlights}
                    onAutoShot={handleAutoShot}
                    isAutoShotting={isAutoShotting}
                  />
                  </div>
                  <div data-help-id="prod-optics-suite">
                  <OpticsSuitePanel onAspectRatioChange={handleAspectChange} filmId={filmId} />
                  </div>
                  <div data-help-id="prod-shot-builder">
                  <ShotBuilder
                    shot={activeShot}
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                    generationMode={generationMode}
                    hasAnchors={anchorUrls.length > 0}
                    selectedAnchorUrl={selectedAnchorIdx !== null ? anchorUrls[selectedAnchorIdx] : undefined}
                  />
                  </div>
                  {/* Right edge resize handle */}
                  <div
                    onMouseDown={handleScriptColResize}
                    className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize bg-border/30 hover:bg-primary/30 transition-colors z-10"
                  />
                </div>

                {/* Right column: Playback Monitor → Shot Stack → Shot Description */}
                <div className="flex-1 flex flex-col overflow-y-auto py-3 min-w-0">
                  <div data-help-id="prod-playback-monitor">
                  <PlaybackMonitor
                    aspectRatio={viewportAspect}
                    takes={takes}
                    activeTakeIdx={activeTakeIdx}
                    onSelectTake={setActiveTakeIdx}
                    onRateTake={handleRateTake}
                    onCircleTake={handleCircleTake}
                    onDeleteTake={handleDeleteTake}
                    shotColorIndex={activeShotIndex >= 0 ? activeShotIndex : undefined}
                    anchorUrls={anchorUrls}
                    anchorScores={anchorScores}
                    selectedAnchorIdx={selectedAnchorIdx}
                    onSelectAnchor={setSelectedAnchorIdx}
                    diffPair={diffPair}
                    onCloseDiff={() => setDiffPair(null)}
                    isLoadingGenerations={isLoadingGenerations}
                  />
                  </div>
                  <div data-help-id="prod-shot-list">
                  <ShotList
                    shots={sceneShots}
                    activeShotId={activeShotId}
                    onSelectShot={handleSelectShot}
                    onAddShot={() => createShot.mutate({ text: "", characters: [] })}
                  />
                  </div>
                  <ShotDescriptionPane
                    shot={activeShot}
                    scene={activeScene}
                    onUpdateShot={(id, updates) => updateShot.mutate({ id, updates })}
                    sceneElements={sceneElements}
                    onRepair={handleRepair}
                    isRepairing={isGenerating && generationMode === "targeted_edit"}
                    repairTarget={repairTarget}
                    hasAnchors={anchorUrls.length > 0}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                  <Camera className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Select a Scene to Begin
                </h2>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Choose a scene from the navigator to start building shots, camera angles, and AI generation prompts.
                </p>
              </div>
            </div>
          )}
        </main>
      <VicePanel open={vicePanelOpen} onOpenChange={setVicePanelOpen} />
      </div>
      </div>
    </TooltipProvider>
  );
};

export default Production;
