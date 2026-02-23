import { useState } from "react";
import { useShots } from "@/hooks/useFilm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Film, ChevronRight, Loader2, Sparkles,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
} from "lucide-react";

type CameraMove = "pan-left" | "pan-right" | "push-in" | "pull-out";

const CAMERA_MOVES: { key: CameraMove; label: string; icon: typeof ArrowLeft }[] = [
  { key: "pan-left", label: "Pan Left", icon: ArrowLeft },
  { key: "pan-right", label: "Pan Right", icon: ArrowRight },
  { key: "push-in", label: "Push In", icon: ArrowUp },
  { key: "pull-out", label: "Pull Out", icon: ArrowDown },
];

const StoryboardPanel = () => {
  const { data: shots, isLoading } = useShots();
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [hasPanel, setHasPanel] = useState(false);
  const [activeMove, setActiveMove] = useState<CameraMove | null>(null);

  const selectedShot = shots?.find((s) => s.id === selectedShotId) ?? null;

  const selectShot = (id: string) => {
    setSelectedShotId(id);
    setHasPanel(false);
    setActiveMove(null);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1800));
    setHasPanel(true);
    setGenerating(false);
  };

  const toggleMove = (move: CameraMove) => {
    setActiveMove((prev) => (prev === move ? null : move));
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Shot sidebar */}
      <aside className="w-[280px] min-w-[240px] border-r border-border bg-card flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Shots
          </h2>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {shots?.length ?? 0} in breakdown
          </p>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : !shots?.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Film className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="font-display font-semibold">No shots yet</p>
              <p className="text-xs mt-1">Create shots in the Production phase to populate this list.</p>
            </div>
          ) : (
            <div className="py-1">
              {shots.map((shot) => {
                const isActive = selectedShotId === shot.id;
                return (
                  <button
                    key={shot.id}
                    onClick={() => selectShot(shot.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-l-2",
                      isActive
                        ? "border-l-primary bg-primary/5"
                        : "border-l-transparent hover:bg-secondary/60"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-display",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {shot.scene_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-display font-semibold truncate",
                          isActive ? "text-primary" : "text-foreground"
                        )}
                      >
                        Scene {shot.scene_number}
                      </p>
                      {shot.camera_angle && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {shot.camera_angle}
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* Main pre-viz canvas */}
      <main className="flex-1 overflow-y-auto">
        {selectedShot ? (
          <div className="p-6 space-y-6 max-w-3xl">
            {/* Shot header + Generate */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Scene {selectedShot.scene_number} — Pre-Viz Canvas
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedShot.camera_angle ?? "No camera angle set"}
                  {selectedShot.prompt_text && ` · ${selectedShot.prompt_text.slice(0, 60)}…`}
                </p>
              </div>
              <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Generate Fast Pre-Viz Panel</>
                )}
              </Button>
            </div>

            {/* Pre-Viz Panel */}
            {hasPanel ? (
              <div className="space-y-4">
                {/* 16:9 canvas with camera overlay */}
                <div className="relative aspect-video rounded-xl border border-border bg-secondary/50 overflow-hidden cinema-shadow">
                  {/* Placeholder frame */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Film className="h-10 w-10 mx-auto text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground/40 font-display uppercase tracking-wider">
                        Scene {selectedShot.scene_number} · Pre-Viz Frame
                      </p>
                    </div>
                  </div>

                  {/* Camera movement overlay */}
                  {activeMove && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <CameraArrowOverlay move={activeMove} />
                    </div>
                  )}
                </div>

                {/* Director's Markup Toolbar */}
                <div className="rounded-xl border border-border bg-card p-4 cinema-shadow">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    Director's Markup
                  </p>
                  <div className="flex gap-2">
                    {CAMERA_MOVES.map(({ key, label, icon: Icon }) => (
                      <Button
                        key={key}
                        variant={activeMove === key ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleMove(key)}
                        className={cn(
                          "gap-1.5 flex-1",
                          activeMove === key && "ring-2 ring-destructive/40 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : !generating ? (
              <div className="rounded-xl border border-border bg-accent/30 backdrop-blur-sm p-12 text-center cinema-shadow">
                <Film className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Click <span className="text-primary font-semibold">Generate Fast Pre-Viz Panel</span> to create a quick preview for{" "}
                  <span className="text-primary font-semibold">Scene {selectedShot.scene_number}</span>.
                </p>
                <p className="text-xs text-muted-foreground/50 mt-2">
                  Uses a fast, lightweight model for rapid iteration.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-12 flex flex-col items-center gap-4 cinema-shadow">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-display font-semibold text-foreground">Generating pre-viz frame…</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Running fast SDXL Lightning pass for Scene {selectedShot.scene_number}.
                  </p>
                </div>
                <div className="aspect-video w-full rounded-lg bg-secondary animate-pulse mt-2" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 h-full">
            <div className="text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                <Film className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">
                Storyboard Pre-Viz
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Select a shot from the sidebar to open the pre-viz canvas.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

/* ── Camera arrow overlay — red tactical markup ── */
const CameraArrowOverlay = ({ move }: { move: CameraMove }) => {
  const configs: Record<CameraMove, { rotation: string; label: string }> = {
    "pan-left": { rotation: "rotate-180", label: "PAN LEFT" },
    "pan-right": { rotation: "rotate-0", label: "PAN RIGHT" },
    "push-in": { rotation: "-rotate-90", label: "PUSH IN" },
    "pull-out": { rotation: "rotate-90", label: "PULL OUT" },
  };
  const { rotation, label } = configs[move];

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Arrow */}
      <svg
        viewBox="0 0 120 40"
        className={cn("w-40 h-14 drop-shadow-lg", rotation)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="10" y1="20" x2="90" y2="20" stroke="hsl(345 100% 60%)" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 4" />
        <polygon points="90,10 115,20 90,30" fill="hsl(345 100% 60%)" />
      </svg>
      {/* Label */}
      <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-destructive bg-background/70 px-2 py-0.5 rounded">
        {label}
      </span>
    </div>
  );
};

export default StoryboardPanel;
