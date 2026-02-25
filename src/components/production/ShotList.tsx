import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Crosshair, Plus, Film } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Shot {
  id: string;
  scene_number: number;
  prompt_text: string | null;
  camera_angle: string | null;
  video_url: string | null;
  label?: string;
}

interface ShotListProps {
  shots: Shot[];
  activeShotId: string | null;
  onSelectShot: (id: string) => void;
  onAddShot: () => void;
}

const ShotList = ({ shots, activeShotId, onSelectShot, onAddShot }: ShotListProps) => {
  return (
    <div className="border-b border-border bg-card/30">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
        <Crosshair className="h-3.5 w-3.5 text-primary/70" />
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">
          Shot Stack
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/50 ml-1">
          {shots.length} shot{shots.length !== 1 ? "s" : ""}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddShot}
          className="ml-auto h-6 text-[10px] font-mono gap-1 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add Shot
        </Button>
      </div>

      {shots.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[11px] text-muted-foreground/60 font-mono">
            Highlight script text above and click "Create Shot" to begin.
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-32">
          <div className="p-1.5 flex flex-wrap gap-1.5">
            {shots.map((shot, idx) => {
              const isActive = activeShotId === shot.id;
              const hasVideo = !!shot.video_url;
              return (
                <button
                  key={shot.id}
                  onClick={() => onSelectShot(shot.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left min-w-[140px] max-w-[280px]",
                    "cinema-inset active:translate-y-px",
                    isActive
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/50 bg-secondary/40 hover:bg-secondary/70"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-mono font-bold shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {idx + 1}
                  </span>
                  {hasVideo && <Film className="h-3 w-3 text-emerald-500/70 shrink-0" />}
                  <span className="text-[10px] text-foreground/80 truncate flex-1">
                    {shot.camera_angle || shot.prompt_text?.slice(0, 40) || "Untitled shot"}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default ShotList;
