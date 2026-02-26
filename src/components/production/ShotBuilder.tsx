import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sparkles, Camera, Image, Coins, Crosshair, Film, Loader2 } from "lucide-react";

type GenerationMode = "anchor" | "animate" | "targeted_edit";

interface ShotBuilderProps {
  shot: {
    id: string;
    prompt_text: string | null;
  } | null;
  onGenerate: (mode: GenerationMode) => void;
  isGenerating: boolean;
  generationMode: GenerationMode | null;
  hasAnchors: boolean;        // true when anchor frames exist for this shot
  selectedAnchorUrl?: string; // url of the chosen anchor frame
}

const ShotBuilder = ({
  shot,
  onGenerate,
  isGenerating,
  generationMode,
  hasAnchors,
  selectedAnchorUrl,
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

  const isAnchoring = isGenerating && generationMode === "anchor";
  const isAnimating = isGenerating && generationMode === "animate";

  return (
    <div className="border-t border-border/50 shrink-0">
      {/* Token / Cost Indicator */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30">
        <Coins className="h-3 w-3 text-primary/50" />
        <span className="text-[9px] font-mono text-muted-foreground/60">
          Est. cost: 1 credit (anchor) · 5 credits (clip)
        </span>
      </div>

      {/* Two-stage workflow */}
      <div className="p-4 space-y-2">
        {/* Stage label */}
        <div className="flex items-center gap-2 mb-1">
          <div className={cn(
            "h-1.5 w-1.5 rounded-full",
            hasAnchors ? "bg-primary" : "bg-muted-foreground/30"
          )} />
          <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
            {hasAnchors ? "Stage 2 — Animate" : "Stage 1 — Anchor Frame"}
          </span>
        </div>

        {!hasAnchors ? (
          /* ── Stage 1: Generate Anchor Frames ── */
          <Button
            onClick={() => onGenerate("anchor")}
            disabled={isGenerating || !shot.prompt_text}
            className={cn(
              "w-full h-11 font-display font-bold text-[11px] uppercase tracking-wider gap-2",
              "shadow-[0_0_20px_-4px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_28px_-4px_hsl(var(--primary)/0.45)]",
              "cinema-inset active:translate-y-px",
              isAnchoring && "animate-pulse-glow"
            )}
          >
            {isAnchoring ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating Anchors…</>
            ) : (
              <><Crosshair className="h-4 w-4" /> Generate Anchors (4)</>
            )}
          </Button>
        ) : (
          /* ── Stage 2: Rehearsal (still) + Roll Camera (clip) ── */
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => onGenerate("anchor")}
              disabled={isGenerating || !shot.prompt_text}
              className={cn(
                "flex-1 h-11 font-display font-bold text-[11px] uppercase tracking-wider gap-2",
                "cinema-inset active:translate-y-px"
              )}
            >
              <Image className="h-4 w-4" /> Re-Anchor
            </Button>
            <Button
              onClick={() => onGenerate("animate")}
              disabled={isGenerating || !shot.prompt_text || !selectedAnchorUrl}
              className={cn(
                "flex-1 h-11 font-display font-bold text-[11px] uppercase tracking-wider gap-2",
                "shadow-[0_0_20px_-4px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_28px_-4px_hsl(var(--primary)/0.45)]",
                "cinema-inset active:translate-y-px",
                isAnimating && "animate-pulse-glow"
              )}
            >
              {isAnimating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Rolling…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Roll Camera</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShotBuilder;
