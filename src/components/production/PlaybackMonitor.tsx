import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Camera, Film, Play, Pause, Maximize, Volume2, VolumeX,
  Star, CheckCircle, Trash2,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { SHOT_COLORS } from "@/lib/shot-colors";
import AnchorPicker from "./AnchorPicker";
import type { AnchorScore } from "./AnchorPicker";
import DiffOverlay from "./DiffOverlay";
import type { DiffPair } from "./DiffOverlay";

export interface Take {
  id: number;
  thumbnailUrl: string | null;
  rating: number; // 0-3
  circled: boolean;
  label?: string;
}

const EMPTY_TAKES: Take[] = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  thumbnailUrl: null,
  rating: 0,
  circled: false,
}));

interface PlaybackMonitorProps {
  aspectRatio: number;
  takes: Take[];
  activeTakeIdx: number | null;
  onSelectTake: (idx: number) => void;
  onRateTake: (idx: number, rating: number) => void;
  onCircleTake: (idx: number) => void;
  onDeleteTake: (idx: number) => void;
  /** Index of the active shot within the scene (for color frame) */
  shotColorIndex?: number;
  /** Anchor mode props — when provided, replaces Take Bin */
  anchorUrls?: string[];
  anchorScores?: AnchorScore[];
  selectedAnchorIdx?: number | null;
  onSelectAnchor?: (idx: number) => void;
  /** Diff overlay — shown after targeted repair */
  diffPair?: DiffPair | null;
  onCloseDiff?: () => void;
}

const StarRating = ({ rating, onRate }: { rating: number; onRate: (r: number) => void }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3].map((star) => (
      <button
        key={star}
        onClick={(e) => { e.stopPropagation(); onRate(rating === star ? 0 : star); }}
        className="transition-colors"
      >
        <Star
          className={cn(
            "h-3.5 w-3.5",
            star <= rating ? "fill-primary text-primary" : "text-muted-foreground/30 hover:text-muted-foreground/60"
          )}
        />
      </button>
    ))}
  </div>
);

const PlaybackMonitor = ({
  aspectRatio,
  takes,
  activeTakeIdx,
  onSelectTake,
  onRateTake,
  onCircleTake,
  onDeleteTake,
  shotColorIndex,
  anchorUrls = [],
  anchorScores,
  selectedAnchorIdx,
  onSelectAnchor,
  diffPair,
  onCloseDiff,
}: PlaybackMonitorProps) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const activeTake = activeTakeIdx !== null ? takes[activeTakeIdx] : null;
  const isAnchorMode = anchorUrls.length > 0;

  // Resizable divider
  const [takeBinWidth, setTakeBinWidth] = useState(160);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = takeBinWidth;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startW.current - (ev.clientX - startX.current);
      setTakeBinWidth(Math.max(120, Math.min(300, startW.current + (startX.current - ev.clientX))));
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [takeBinWidth]);

  // Color frame style for the viewer
  const colorFrameStyle: React.CSSProperties | undefined =
    shotColorIndex != null
      ? {
          boxShadow: `inset 0 0 0 3px hsl(${SHOT_COLORS[shotColorIndex % SHOT_COLORS.length].hsl})`,
        }
      : undefined;

  return (
    <div className="flex px-2" style={{ gap: 0 }}>
      {/* ── Viewer Frame (fills remaining space) ── */}
      <div className="flex-1 min-w-0 flex items-start justify-center">
        <div className="w-full">
          <AspectRatio ratio={aspectRatio}>
            <div
              className="relative w-full h-full rounded-lg bg-black shadow-[inset_0_4px_30px_rgba(0,0,0,0.8)] overflow-hidden border border-border/40"
              style={colorFrameStyle}
            >
              {/* Camera HUD */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
                <div className="absolute inset-[5%] border border-white/[0.06] rounded-sm" />
                <div className="absolute inset-[10%] border border-dashed border-white/[0.04] rounded-sm" />
                {["top-3 left-3", "top-3 right-3 rotate-90", "bottom-3 left-3 -rotate-90", "bottom-3 right-3 rotate-180"].map((pos) => (
                  <div key={pos} className={cn("absolute w-5 h-5", pos)}>
                    <div className="absolute top-0 left-0 w-full h-px bg-primary/30" />
                    <div className="absolute top-0 left-0 h-full w-px bg-primary/30" />
                  </div>
                ))}
                {/* REC */}
                <div className="absolute top-3 right-10 flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-destructive animate-pulse-glow" />
                  <span className="text-[10px] font-mono font-bold text-destructive/80 tracking-widest">REC</span>
                </div>
              </div>

              {/* Content */}
              {activeTake?.thumbnailUrl ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="text-center space-y-2">
                    <Film className="h-12 w-12 text-primary/60 mx-auto" />
                    <p className="text-xs font-mono text-muted-foreground">
                      Take {(activeTakeIdx ?? 0) + 1} · Generated
                    </p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Camera className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-mono text-muted-foreground/50 tracking-wide">STAND BY</p>
                  </div>
                </div>
              )}

              {/* Playback controls overlay (bottom) */}
              {activeTake?.thumbnailUrl && (
                <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
                  <div className="flex items-center gap-3">
                    <button className="text-white/70 hover:text-white transition-colors">
                      <Play className="h-5 w-5" />
                    </button>
                    <div className="flex-1 h-1 bg-white/20 rounded-full">
                      <div className="h-full w-1/3 bg-primary rounded-full" />
                    </div>
                    <span className="text-[10px] font-mono text-white/50">00:05</span>
                    <button className="text-white/70 hover:text-white transition-colors">
                      <Volume2 className="h-4 w-4" />
                    </button>
                    <button className="text-white/70 hover:text-white transition-colors">
                      <Maximize className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Star rating overlay */}
                  <div className="flex items-center justify-between mt-2">
                    <StarRating
                      rating={activeTake.rating}
                      onRate={(r) => onRateTake(activeTakeIdx!, r)}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onCircleTake(activeTakeIdx!)}
                      className={cn(
                        "h-7 text-[10px] font-mono gap-1.5",
                        activeTake.circled && "bg-primary/20 text-primary border-primary/40"
                      )}
                    >
                      <CheckCircle className="h-3 w-3" />
                      {activeTake.circled ? "Selected" : "Select Take"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Diff overlay after targeted repair */}
              {diffPair && onCloseDiff && (
                <DiffOverlay diff={diffPair} onClose={onCloseDiff} />
              )}
            </div>
          </AspectRatio>
        </div>
      </div>

      {/* ── Resizable Divider ── */}
      <div
        onMouseDown={onDividerMouseDown}
        className="w-1.5 shrink-0 cursor-col-resize z-10 group hover:bg-primary/20 transition-colors flex items-center justify-center"
      >
        <div className="w-0.5 h-8 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50 transition-colors" />
      </div>

      {/* ── Anchor Picker OR Take Bin (right side, stacked) ── */}
      <div className="shrink-0 flex flex-col" style={{ width: takeBinWidth }}>
        {isAnchorMode && onSelectAnchor ? (
          <AnchorPicker
            anchorUrls={anchorUrls}
            selectedIdx={selectedAnchorIdx ?? null}
            onSelect={onSelectAnchor}
            scores={anchorScores}
          />
        ) : (
          <div className="flex flex-col gap-1.5 h-full">
            <div className="flex items-center gap-2 px-1">
              <Film className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                Take Bin
              </span>
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              {takes.map((take, idx) => (
                <div
                  key={take.id}
                  className={cn(
                    "relative aspect-video rounded-md overflow-hidden cursor-pointer transition-all duration-200 border-2",
                    take.circled
                      ? "border-primary ring-2 ring-primary/40 shadow-[0_0_16px_-4px_hsl(51_100%_50%/0.3)]"
                      : activeTakeIdx === idx
                        ? "border-primary/40"
                        : "border-border/40 hover:border-border",
                    !take.thumbnailUrl && "opacity-50 cursor-default"
                  )}
                  onClick={() => take.thumbnailUrl && onSelectTake(idx)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <div className="absolute inset-0 bg-black shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)]">
                    {take.thumbnailUrl ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="h-4 w-4 text-primary/40" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[8px] font-mono text-muted-foreground/30">EMPTY</span>
                      </div>
                    )}
                  </div>

                  {/* Take number */}
                  <div className="absolute top-0.5 left-1 z-10">
                    <span className={cn(
                      "text-[8px] font-mono font-bold px-1 py-0.5 rounded",
                      take.circled ? "bg-primary text-primary-foreground" : "bg-black/60 text-muted-foreground"
                    )}>
                      T{idx + 1}
                    </span>
                  </div>

                  {/* Star rating (mini) */}
                  {take.thumbnailUrl && take.rating > 0 && (
                    <div className="absolute bottom-0.5 left-1 z-10 flex gap-px">
                      {[1, 2, 3].map((s) => (
                        <Star key={s} className={cn("h-2 w-2", s <= take.rating ? "fill-primary text-primary" : "text-transparent")} />
                      ))}
                    </div>
                  )}

                  {/* Circled indicator */}
                  {take.circled && (
                    <div className="absolute top-0.5 right-1 z-10">
                      <CheckCircle className="h-3 w-3 text-primary drop-shadow-sm" />
                    </div>
                  )}

                  {/* Hover actions */}
                  {hoveredIdx === idx && take.thumbnailUrl && (
                    <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center gap-1.5 animate-fade-in">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => { e.stopPropagation(); onCircleTake(idx); }}
                            className={cn(
                              "h-6 w-6 rounded-full flex items-center justify-center transition-colors",
                              take.circled ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary"
                            )}
                          >
                            <CheckCircle className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          {take.circled ? "Deselect" : "Select Take"}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteTake(idx); }}
                            className="h-6 w-6 rounded-full flex items-center justify-center bg-secondary hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">Delete Take</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { EMPTY_TAKES };
export default PlaybackMonitor;
