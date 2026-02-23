import { useState, useCallback } from "react";
import { Camera, Sparkles, Trash2, CheckCircle, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ── Types ── */
interface Take {
  id: number;
  thumbnailUrl: string | null;
  circled: boolean;
}

const EMPTY_TAKES: Take[] = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  thumbnailUrl: null,
  circled: false,
}));

/* ── Component ── */
const ShotViewport = () => {
  const [takes, setTakes] = useState<Take[]>(EMPTY_TAKES);
  const [activeTakeIdx, setActiveTakeIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [performanceIntensity, setPerformanceIntensity] = useState([50]);
  const [focusSoftness, setFocusSoftness] = useState([30]);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeTake = activeTakeIdx !== null ? takes[activeTakeIdx] : null;

  const handleCircle = useCallback(
    (idx: number) => {
      setTakes((prev) =>
        prev.map((t, i) => ({ ...t, circled: i === idx ? !t.circled : false }))
      );
    },
    []
  );

  const handleDelete = useCallback((idx: number) => {
    setTakes((prev) =>
      prev.map((t, i) =>
        i === idx ? { ...t, thumbnailUrl: null, circled: false } : t
      )
    );
    setActiveTakeIdx((prev) => (prev === idx ? null : prev));
  }, []);

  const handleGenerate = useCallback(() => {
    setIsGenerating(true);
    // Find first empty slot
    const emptyIdx = takes.findIndex((t) => !t.thumbnailUrl);
    const targetIdx = emptyIdx !== -1 ? emptyIdx : takes.length - 1;

    setTimeout(() => {
      setTakes((prev) =>
        prev.map((t, i) =>
          i === targetIdx
            ? { ...t, thumbnailUrl: `generated-${Date.now()}` }
            : t
        )
      );
      setActiveTakeIdx(targetIdx);
      setIsGenerating(false);
    }, 3000);
  }, [takes]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Viewfinder ── */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-2">
        <div className="w-full max-w-4xl">
          <AspectRatio ratio={16 / 9}>
            <div className="relative w-full h-full rounded-lg bg-black shadow-[inset_0_4px_30px_rgba(0,0,0,0.8)] overflow-hidden border border-border/40">
              {/* Camera HUD Overlay */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* Crosshairs */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
                {/* Safe-action margins */}
                <div className="absolute inset-[5%] border border-white/[0.06] rounded-sm" />
                <div className="absolute inset-[10%] border border-dashed border-white/[0.04] rounded-sm" />
                {/* Corner brackets */}
                {[
                  "top-3 left-3",
                  "top-3 right-3 rotate-90",
                  "bottom-3 left-3 -rotate-90",
                  "bottom-3 right-3 rotate-180",
                ].map((pos) => (
                  <div key={pos} className={cn("absolute w-5 h-5", pos)}>
                    <div className="absolute top-0 left-0 w-full h-px bg-primary/30" />
                    <div className="absolute top-0 left-0 h-full w-px bg-primary/30" />
                  </div>
                ))}
                {/* REC indicator */}
                <div className="absolute top-3 right-10 flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-destructive animate-pulse-glow" />
                  <span className="text-[10px] font-mono font-bold text-destructive/80 tracking-widest">
                    REC
                  </span>
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
                    <p className="text-xs font-mono text-muted-foreground/50 tracking-wide">
                      NO SIGNAL
                    </p>
                  </div>
                </div>
              )}
            </div>
          </AspectRatio>
        </div>
      </div>

      {/* ── Control Bar ── */}
      <div className="px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-6 rounded-xl border border-border bg-card p-4 cinema-inset">
          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={cn(
              "h-12 px-6 rounded-lg font-display font-bold text-sm uppercase tracking-widest transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "shadow-[0_0_20px_-4px_hsl(51_100%_50%/0.3)] hover:shadow-[0_0_28px_-4px_hsl(51_100%_50%/0.45)]",
              isGenerating && "animate-pulse-glow"
            )}
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating ? "Generating…" : "Generate Shot"}
          </Button>

          {/* Divider */}
          <div className="w-px h-10 bg-border" />

          {/* Fader Sliders */}
          <div className="flex-1 flex items-center gap-8">
            <FaderSlider
              label="Performance Intensity"
              value={performanceIntensity}
              onChange={setPerformanceIntensity}
            />
            <FaderSlider
              label="Focus Softness"
              value={focusSoftness}
              onChange={setFocusSoftness}
            />
          </div>
        </div>
      </div>

      {/* ── 5-Take Bin (Filmstrip) ── */}
      <div className="px-4 pb-2">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Film className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
              Take Bin
            </span>
          </div>

          {/* Filmstrip perforations top */}
          <div className="flex gap-[2px] mb-1 px-1">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-[3px] rounded-full bg-white/[0.03]"
              />
            ))}
          </div>

          <div className="flex gap-2">
            {takes.map((take, idx) => (
              <TakeCard
                key={take.id}
                take={take}
                index={idx}
                isActive={activeTakeIdx === idx}
                isHovered={hoveredIdx === idx}
                onSelect={() => take.thumbnailUrl && setActiveTakeIdx(idx)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onCircle={() => handleCircle(idx)}
                onDelete={() => handleDelete(idx)}
              />
            ))}
          </div>

          {/* Filmstrip perforations bottom */}
          <div className="flex gap-[2px] mt-1 px-1">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-[3px] rounded-full bg-white/[0.03]"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Fader Slider ── */
const FaderSlider = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number[];
  onChange: (v: number[]) => void;
}) => (
  <div className="flex-1 space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-[10px] font-mono text-primary tabular-nums">
        {value[0]}%
      </span>
    </div>
    <Slider
      value={value}
      onValueChange={onChange}
      max={100}
      step={1}
      className="fader-slider"
    />
  </div>
);

/* ── Take Card ── */
const TakeCard = ({
  take,
  index,
  isActive,
  isHovered,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onCircle,
  onDelete,
}: {
  take: Take;
  index: number;
  isActive: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCircle: () => void;
  onDelete: () => void;
}) => (
  <div
    className={cn(
      "relative flex-1 aspect-video rounded-md overflow-hidden cursor-pointer transition-all duration-200 border-2",
      take.circled
        ? "border-primary ring-2 ring-primary/40 shadow-[0_0_16px_-4px_hsl(51_100%_50%/0.3)]"
        : isActive
          ? "border-primary/40"
          : "border-border/40 hover:border-border",
      !take.thumbnailUrl && "opacity-50 cursor-default"
    )}
    onClick={onSelect}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    {/* Background */}
    <div className="absolute inset-0 bg-black shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)]">
      {take.thumbnailUrl ? (
        <div className="w-full h-full flex items-center justify-center">
          <Film className="h-5 w-5 text-primary/40" />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[9px] font-mono text-muted-foreground/30">
            EMPTY
          </span>
        </div>
      )}
    </div>

    {/* Take number label */}
    <div className="absolute top-1 left-1.5 z-10">
      <span
        className={cn(
          "text-[9px] font-mono font-bold px-1 py-0.5 rounded",
          take.circled
            ? "bg-primary text-primary-foreground"
            : "bg-black/60 text-muted-foreground"
        )}
      >
        T{index + 1}
      </span>
    </div>

    {/* Circled badge */}
    {take.circled && (
      <div className="absolute top-1 right-1.5 z-10">
        <CheckCircle className="h-3.5 w-3.5 text-primary drop-shadow-sm" />
      </div>
    )}

    {/* Hover actions */}
    {isHovered && take.thumbnailUrl && (
      <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center gap-2 animate-fade-in">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCircle();
              }}
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                take.circled
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary"
              )}
            >
              <CheckCircle className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {take.circled ? "Uncircle Take" : "Circle Take"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-8 w-8 rounded-full flex items-center justify-center bg-secondary hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Delete Take
          </TooltipContent>
        </Tooltip>
      </div>
    )}
  </div>
);

export default ShotViewport;
