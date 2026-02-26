import { useState, useCallback, useRef, useEffect } from "react";
import { Camera } from "lucide-react";
import { useFilmId } from "@/hooks/useFilm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const { data: analysis } = useLatestAnalysis(filmId);
  const { data: allShots = [] } = useShotsForFilm(filmId);

  const [activeSceneIdx, setActiveSceneIdx] = useState<number | null>(null);
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  const [viewportAspect, setViewportAspect] = useState(16 / 9);
  const [sidebarWidth, setSidebarWidth] = useState(260);
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

  const scenes: any[] =
    analysis?.status === "complete" && Array.isArray(analysis.scene_breakdown)
      ? (analysis.scene_breakdown as any[])
      : [];

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

  // Generation via orchestrate-generation edge function
  const handleGenerate = useCallback(async (mode: "anchor" | "animate" | "targeted_edit", overrideRepairTarget?: RepairTarget) => {
    if (!activeShot) return;
    setIsGenerating(true);
    setGenerationMode(mode);
    const effectiveRepairTarget = overrideRepairTarget ?? repairTarget;
    try {
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
      const { data, error } = await supabase.functions.invoke("orchestrate-generation", {
        body,
      });

      if (error) throw error;

      if (mode === "anchor" && data?.output_urls) {
        setAnchorUrls(data.output_urls);
        setSelectedAnchorIdx(0);
        // Use real scores from generation response
        const scores: AnchorScore[] = Array.isArray(data.scores)
          ? data.scores
          : data.output_urls.map(() => ({}));
        setAnchorScores(scores);
        // Also populate take bin with first anchor
        setTakes((prev) => {
          const emptyIdx = prev.findIndex((t) => !t.thumbnailUrl);
          const targetIdx = emptyIdx !== -1 ? emptyIdx : prev.length - 1;
          return prev.map((t, i) => i === targetIdx ? { ...t, thumbnailUrl: data.output_urls[0] } : t);
        });
        setActiveTakeIdx(takes.findIndex((t) => !t.thumbnailUrl));
      } else if (mode === "animate" && data?.output_urls?.[0]) {
        const emptyIdx = takes.findIndex((t) => !t.thumbnailUrl);
        const targetIdx = emptyIdx !== -1 ? emptyIdx : takes.length - 1;
        setTakes((prev) =>
          prev.map((t, i) => i === targetIdx ? { ...t, thumbnailUrl: data.output_urls[0] } : t)
        );
        setActiveTakeIdx(targetIdx);
      } else if (mode === "targeted_edit" && data?.output_urls?.[0]) {
        // Show diff overlay: original anchor vs repaired
        const originalUrl = selectedAnchorIdx !== null ? anchorUrls[selectedAnchorIdx] : null;
        if (originalUrl && effectiveRepairTarget) {
          setDiffPair({
            originalUrl,
            repairedUrl: data.output_urls[0],
            repairTarget: effectiveRepairTarget,
          });
        }
        // Replace the selected anchor with the repaired version
        if (selectedAnchorIdx !== null) {
          setAnchorUrls((prev) =>
            prev.map((url, i) => i === selectedAnchorIdx ? data.output_urls[0] : url)
          );
        }
      }
    } catch (err) {
      console.error("Generation failed:", err);
    } finally {
      setIsGenerating(false);
      setGenerationMode(null);
      setRepairTarget(null);
    }
  }, [activeShot, anchorUrls, selectedAnchorIdx, takes, repairTarget]);

  const handleRepair = useCallback((target: RepairTarget, _hint: string) => {
    setRepairTarget(target);
    handleGenerate("targeted_edit", target);
  }, [handleGenerate]);

  // Reset takes when switching shots
  const handleSelectShot = (id: string) => {
    setActiveShotId(id);
    setTakes(EMPTY_TAKES);
    setActiveTakeIdx(null);
    setAnchorUrls([]);
    setSelectedAnchorIdx(null);
    setAnchorScores([]);
    setDiffPair(null);
  };

  const handleSelectScene = (idx: number) => {
    setActiveSceneIdx(idx);
    setActiveShotId(null);
    setTakes(EMPTY_TAKES);
    setActiveTakeIdx(null);
    setAnchorUrls([]);
    setSelectedAnchorIdx(null);
    setAnchorScores([]);
    setDiffPair(null);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-[calc(100vh-64px)]">
        {/* ── LEFT: Scene Navigator ── */}
        <SceneNavigator
          scenes={scenes}
          activeSceneIdx={activeSceneIdx}
          onSelectScene={handleSelectScene}
          shotCounts={shotCounts}
          width={sidebarWidth}
          onResizeStart={handleResizeStart}
        />

        {/* ── CENTER: Script / Shots / Viewer ── */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {activeScene ? (
            <>
              {/* Scene header */}
              <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary text-sm font-mono font-bold">
                  {activeSceneNumber}
                </span>
                <div className="min-w-0">
                  <h1 className="font-display text-base font-bold text-foreground truncate">
                    {activeScene.scene_heading || "Untitled Scene"}
                  </h1>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {activeScene.int_ext} · {activeScene.time_of_day}
                    {activeScene.setting && ` · ${activeScene.setting}`}
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
                  <ScriptWorkspace
                    scene={activeScene}
                    sceneText={sceneTextData?.raw_text ?? undefined}
                    onCreateShot={(text, characters) => createShot.mutate({ text, characters })}
                    height={scriptPaneHeight}
                    onResizeStart={handleScriptHeightResize}
                    shotHighlights={shotHighlights}
                  />
                  <OpticsSuitePanel onAspectRatioChange={handleAspectChange} filmId={filmId} />
                  <ShotBuilder
                    shot={activeShot}
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                    generationMode={generationMode}
                    hasAnchors={anchorUrls.length > 0}
                    selectedAnchorUrl={selectedAnchorIdx !== null ? anchorUrls[selectedAnchorIdx] : undefined}
                  />
                  {/* Right edge resize handle */}
                  <div
                    onMouseDown={handleScriptColResize}
                    className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize bg-border/30 hover:bg-primary/30 transition-colors z-10"
                  />
                </div>

                {/* Right column: Playback Monitor → Shot Stack → Shot Description */}
                <div className="flex-1 flex flex-col overflow-y-auto py-3 min-w-0">
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
                  />
                  <ShotList
                    shots={sceneShots}
                    activeShotId={activeShotId}
                    onSelectShot={handleSelectShot}
                    onAddShot={() => createShot.mutate({ text: "", characters: [] })}
                  />
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
                <h2 className="font-display text-xl font-bold text-foreground">
                  Select a Scene to Begin
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Choose a scene from the navigator to start building shots, camera angles, and AI generation prompts.
                </p>
              </div>
            </div>
          )}
        </main>
      <VicePanel open={vicePanelOpen} onOpenChange={setVicePanelOpen} />
      </div>
    </TooltipProvider>
  );
};

export default Production;
