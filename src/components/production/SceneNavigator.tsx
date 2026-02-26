import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Film, Sun, Moon, Sunrise, Sunset, ArrowRightLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ── Status types ── */
type SceneStatus = "not_started" | "shots_created" | "takes_generated" | "approved";

function getSceneStatus(scene: any, shotsForScene: number): SceneStatus {
  if (scene.approved) return "approved";
  if (scene.has_takes) return "takes_generated";
  if (shotsForScene > 0) return "shots_created";
  return "not_started";
}

const STATUS_COLORS: Record<SceneStatus, { dot: string; border: string }> = {
  not_started: { dot: "bg-muted-foreground/30", border: "border-l-transparent" },
  shots_created: { dot: "bg-amber-500/70", border: "border-l-amber-500/50" },
  takes_generated: { dot: "bg-primary/70", border: "border-l-primary/50" },
  approved: { dot: "bg-emerald-500", border: "border-l-emerald-500" },
};

const TimeIcon = ({ time }: { time?: string }) => {
  if (!time) return null;
  const t = time.toUpperCase();
  if (t.includes("NIGHT")) return <Moon className="h-3 w-3 text-blue-400/60" />;
  if (t.includes("DAWN") || t.includes("MORNING")) return <Sunrise className="h-3 w-3 text-amber-400/60" />;
  if (t.includes("DUSK") || t.includes("EVENING") || t.includes("SUNSET")) return <Sunset className="h-3 w-3 text-orange-400/60" />;
  return <Sun className="h-3 w-3 text-yellow-400/60" />;
};

const IntExtBadge = ({ value }: { value?: string }) => {
  if (!value) return null;
  const isInt = value.toUpperCase().includes("INT");
  const isExt = value.toUpperCase().includes("EXT");
  const isBoth = isInt && isExt;
  return (
    <span className={cn(
      "text-[8px] font-mono font-bold px-1 py-0.5 rounded",
      isBoth ? "bg-purple-500/15 text-purple-400/80" :
      isInt ? "bg-blue-500/15 text-blue-400/80" :
      "bg-green-500/15 text-green-400/80"
    )}>
      {isBoth ? "I/E" : isInt ? "INT" : "EXT"}
    </span>
  );
};

interface SceneNavigatorProps {
  scenes: any[];
  activeSceneIdx: number | null;
  onSelectScene: (idx: number) => void;
  shotCounts?: Record<number, number>;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
}

const SceneNavigator = ({
  scenes,
  activeSceneIdx,
  onSelectScene,
  shotCounts = {},
  width,
  onResizeStart,
}: SceneNavigatorProps) => {
  return (
    <aside
      className="border-r border-border bg-card flex flex-col relative"
      style={{ width, minWidth: 200, flexShrink: 0 }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Film className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-bold tracking-wide uppercase text-foreground">
          Scenes
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
              const sceneNum = scene.scene_number ?? i + 1;
              const count = shotCounts[sceneNum] ?? 0;
              const status = getSceneStatus(scene, count);
              const colors = STATUS_COLORS[status];

              return (
                <button
                  key={i}
                  onClick={() => onSelectScene(i)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 transition-colors border-l-2 group/scene relative",
                    isActive
                      ? "border-l-primary bg-primary/5"
                      : colors.border + " hover:bg-secondary/60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {/* Status dot */}
                    <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", isActive ? "bg-primary" : colors.dot)} />
                    {/* Scene number */}
                    <span className={cn(
                      "font-mono text-[10px] font-bold shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}>
                      {sceneNum}.
                    </span>
                    {/* INT/EXT badge */}
                    <IntExtBadge value={scene.int_ext} />
                    {/* Time of day */}
                    <TimeIcon time={scene.time_of_day} />
                    {/* Shot count */}
                    {count > 0 && (
                      <span className="ml-auto text-[9px] font-mono text-muted-foreground/50 shrink-0">
                        {count} shot{count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    "text-xs font-display font-semibold mt-1 break-words leading-snug",
                    isActive ? "text-primary" : "text-foreground"
                  )}>
                    {scene.scene_heading || scene.location_name || "Untitled Scene"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug group-hover/scene:line-clamp-3">
                    {scene.description || ""}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
        onMouseDown={onResizeStart}
      />
    </aside>
  );
};

export default SceneNavigator;
