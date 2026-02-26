import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sparkles, Camera, Image, Coins } from "lucide-react";

interface ShotBuilderProps {
  shot: {
    id: string;
    prompt_text: string | null;
  } | null;
  onRehearsal: () => void;
  onRollCamera: () => void;
  isGenerating: boolean;
}

const ShotBuilder = ({
  shot,
  onRehearsal,
  onRollCamera,
  isGenerating,
}: ShotBuilderProps) => {
  if (!shot) {
    return (
      <div className="flex items-center justify-center p-4 border-t border-border/50">
        <div className="text-center space-y-1">
          <Camera className="h-6 w-6 text-muted-foreground/30 mx-auto" />
          <p className="text-[10px] text-muted-foreground/50 font-display">
            Select a shot to generate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border/50 shrink-0">
      {/* Token / Cost Indicator */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30">
        <Coins className="h-3 w-3 text-primary/50" />
        <span className="text-[9px] font-mono text-muted-foreground/60">
          Est. cost: 1 credit (still) · 5 credits (video)
        </span>
      </div>

      {/* Generation Buttons */}
      <div className="p-4 flex gap-3">
        <Button
          variant="secondary"
          onClick={onRehearsal}
          disabled={isGenerating || !shot.prompt_text}
          className={cn(
            "flex-1 h-11 font-display font-bold text-[11px] uppercase tracking-wider gap-2",
            "cinema-inset active:translate-y-px"
          )}
        >
          <Image className="h-4 w-4" /> Rehearsal
        </Button>
        <Button
          onClick={onRollCamera}
          disabled={isGenerating || !shot.prompt_text}
          className={cn(
            "flex-1 h-11 font-display font-bold text-[11px] uppercase tracking-wider gap-2",
            "shadow-[0_0_20px_-4px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_28px_-4px_hsl(var(--primary)/0.45)]",
            "cinema-inset active:translate-y-px",
            isGenerating && "animate-pulse-glow"
          )}
        >
          <Sparkles className="h-4 w-4" />
          {isGenerating ? "Rolling…" : "Roll Camera"}
        </Button>
      </div>
    </div>
  );
};

export default ShotBuilder;
