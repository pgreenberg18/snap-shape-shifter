import { useState, useCallback } from "react";
import { Film, Camera, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFilmId } from "@/hooks/useFilm";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import ShotViewport from "@/components/production/ShotViewport";
import OpticsSuitePanel from "@/components/production/OpticsSuitePanel";

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

const Production = () => {
  const filmId = useFilmId();
  const { data: analysis } = useLatestAnalysis(filmId);
  const [activeSceneIdx, setActiveSceneIdx] = useState<number | null>(null);
  const [viewportAspect, setViewportAspect] = useState(16 / 9);

  const handleAspectChange = useCallback((ratio: number) => {
    setViewportAspect(ratio);
  }, []);

  const scenes: any[] =
    analysis?.status === "complete" && Array.isArray(analysis.scene_breakdown)
      ? (analysis.scene_breakdown as any[])
      : [];

  const activeScene = activeSceneIdx !== null ? scenes[activeSceneIdx] : null;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* ── Left: Scene Navigator (25%) ── */}
      <aside className="w-1/4 min-w-[260px] max-w-[360px] border-r border-border bg-card flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Film className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold tracking-wide uppercase text-foreground">
            Scene Navigator
          </h2>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            {scenes.length}
          </span>
        </div>

        <ScrollArea className="flex-1">
          {scenes.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <p className="font-display font-semibold mb-1">No scenes available</p>
              <p className="text-xs">Upload and analyze a script in the Development phase first.</p>
            </div>
          ) : (
            <div className="py-1">
              {scenes.map((scene: any, i: number) => {
                const isActive = activeSceneIdx === i;
                return (
                  <button
                    key={i}
                    onClick={() => setActiveSceneIdx(i)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-l-2",
                      isActive
                        ? "border-l-primary bg-primary/5"
                        : "border-l-transparent hover:bg-secondary/60"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-mono font-bold mt-0.5",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {scene.scene_number ?? i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-xs font-display font-semibold truncate",
                          isActive ? "text-primary" : "text-foreground"
                        )}
                      >
                        {scene.scene_heading || "Untitled Scene"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                        {scene.description || `${scene.int_ext || ""} · ${scene.time_of_day || ""}`}
                      </p>
                    </div>
                    {isActive && (
                      <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* ── Center: Shot Construction Zone ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeScene ? (
          <div className="flex-1 flex flex-col">
            {/* Scene header bar */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/60 backdrop-blur-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary text-sm font-mono font-bold">
                {activeScene.scene_number ?? (activeSceneIdx! + 1)}
              </span>
              <div>
                <h1 className="font-display text-lg font-bold text-foreground">
                  {activeScene.scene_heading || "Untitled Scene"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {activeScene.int_ext} · {activeScene.time_of_day}
                  {activeScene.setting && ` · ${activeScene.setting}`}
                </p>
              </div>
              {/* Aspect ratio indicator */}
              <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/80 border border-border/50">
                <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
                  {viewportAspect > 2 ? "2.39:1" : "16:9"}
                </span>
              </div>
            </div>

            {/* Shot Construction Viewport */}
            <div className="flex-1 overflow-y-auto py-4">
              <ShotViewport aspectRatio={viewportAspect} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                <Camera className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">
                Select a Scene to Begin Shot Construction
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Choose a scene from the navigator to start building shots, camera angles, and AI generation prompts.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ── Right: Optic & Sensor Suite ── */}
      {activeScene && <OpticsSuitePanel onAspectRatioChange={handleAspectChange} />}
    </div>
  );
};

export default Production;
