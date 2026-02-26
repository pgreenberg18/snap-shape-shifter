import { cn } from "@/lib/utils";
import { Crosshair, Check, Image } from "lucide-react";

interface AnchorPickerProps {
  anchorUrls: string[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
}

const AnchorPicker = ({ anchorUrls, selectedIdx, onSelect }: AnchorPickerProps) => {
  if (anchorUrls.length === 0) return null;

  return (
    <div className="px-4 pb-2">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <Crosshair className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
            Anchor Frames
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/50 ml-auto">
            Select the best frame to animate
          </span>
        </div>

        {/* 4-up grid */}
        <div className="grid grid-cols-4 gap-2">
          {anchorUrls.map((url, idx) => {
            const isSelected = selectedIdx === idx;
            return (
              <button
                key={idx}
                onClick={() => onSelect(idx)}
                className={cn(
                  "relative aspect-video rounded-md overflow-hidden transition-all duration-200 border-2 group",
                  isSelected
                    ? "border-primary ring-2 ring-primary/30 shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)]"
                    : "border-border/40 hover:border-border hover:shadow-md"
                )}
              >
                {/* Background — placeholder since URLs are stubs */}
                <div className="absolute inset-0 bg-black shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)]">
                  {url.startsWith("http") && !url.includes("placeholder") ? (
                    <img src={url} alt={`Anchor ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className={cn(
                        "h-6 w-6 transition-colors",
                        isSelected ? "text-primary/60" : "text-muted-foreground/20 group-hover:text-muted-foreground/40"
                      )} />
                    </div>
                  )}
                </div>

                {/* Rank badge */}
                <div className={cn(
                  "absolute top-1.5 left-1.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-black/70 text-muted-foreground"
                )}>
                  A{idx + 1}
                </div>

                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 z-10">
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                )}

                {/* Hover overlay */}
                {!isSelected && (
                  <div className="absolute inset-0 z-10 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnchorPicker;
