import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, ArrowLeftRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DiffPair {
  originalUrl: string;
  repairedUrl: string;
  repairTarget: string; // "character" | "prop" | "wardrobe"
}

type DiffMode = "slider" | "toggle";

interface DiffOverlayProps {
  diff: DiffPair;
  onClose: () => void;
}

const DiffOverlay = ({ diff, onClose }: DiffOverlayProps) => {
  const [mode, setMode] = useState<DiffMode>("slider");
  const [sliderPos, setSliderPos] = useState(50);
  const [showOriginal, setShowOriginal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateSlider = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSlider(e.clientX);
  }, [updateSlider]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateSlider(e.clientX);
  }, [updateSlider]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const targetLabel = diff.repairTarget.charAt(0).toUpperCase() + diff.repairTarget.slice(1);

  return (
    <div className="absolute inset-0 z-30 flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/80 backdrop-blur-sm border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">
            {targetLabel} Repair Diff
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={mode === "slider" ? "default" : "ghost"}
            onClick={() => setMode("slider")}
            className="h-6 w-6 p-0"
          >
            <ArrowLeftRight className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant={mode === "toggle" ? "default" : "ghost"}
            onClick={() => setMode("toggle")}
            className="h-6 w-6 p-0"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Diff viewer */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden cursor-col-resize select-none"
        onPointerDown={mode === "slider" ? handlePointerDown : undefined}
        onPointerMove={mode === "slider" ? handlePointerMove : undefined}
        onPointerUp={mode === "slider" ? handlePointerUp : undefined}
      >
        {mode === "slider" ? (
          <>
            {/* Repaired (full layer) */}
            <img
              src={diff.repairedUrl}
              alt="Repaired"
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
            />
            {/* Original (clipped by slider) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPos}%` }}
            >
              <img
                src={diff.originalUrl}
                alt="Original"
                className="absolute inset-0 h-full object-contain"
                style={{ width: `${containerRef.current?.offsetWidth ?? 0}px` }}
                draggable={false}
              />
            </div>
            {/* Slider line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-primary/90 backdrop-blur flex items-center justify-center shadow-lg">
                <ArrowLeftRight className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </div>
            {/* Labels */}
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
              Original
            </div>
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-primary uppercase tracking-wider">
              Repaired
            </div>
          </>
        ) : (
          /* Toggle mode */
          <>
            <img
              src={showOriginal ? diff.originalUrl : diff.repairedUrl}
              alt={showOriginal ? "Original" : "Repaired"}
              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-200"
              draggable={false}
            />
            <button
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
              className="absolute inset-0 z-10"
            />
            <div className={cn(
              "absolute top-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-black/70 text-[10px] font-mono uppercase tracking-wider transition-colors",
              showOriginal ? "text-muted-foreground" : "text-primary"
            )}>
              {showOriginal ? "Original — Hold to compare" : "Repaired — Hold to compare"}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DiffOverlay;
