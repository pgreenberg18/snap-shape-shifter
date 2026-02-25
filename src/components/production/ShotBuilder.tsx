import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Camera, Users, MapPin, Box, Shirt, Eye, Zap,
  Image, Film, Coins,
} from "lucide-react";

interface ShotBuilderProps {
  shot: {
    id: string;
    prompt_text: string | null;
    camera_angle: string | null;
    characters?: string[];
  } | null;
  scene: any;
  onUpdateShot: (id: string, updates: { prompt_text?: string; camera_angle?: string }) => void;
  onRehearsal: () => void;
  onRollCamera: () => void;
  isGenerating: boolean;
  sceneElements?: {
    location?: string;
    props?: string[];
    wardrobe?: string[];
    characters?: string[];
  };
}

const ShotBuilder = ({
  shot,
  scene,
  onUpdateShot,
  onRehearsal,
  onRollCamera,
  isGenerating,
  sceneElements,
}: ShotBuilderProps) => {
  const [description, setDescription] = useState(shot?.prompt_text || "");
  const [angle, setAngle] = useState(shot?.camera_angle || "");

  useEffect(() => {
    setDescription(shot?.prompt_text || "");
    setAngle(shot?.camera_angle || "");
  }, [shot?.id]);

  if (!shot) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <Camera className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground/60 font-display">
            Select or create a shot to begin building.
          </p>
        </div>
      </div>
    );
  }

  const handleBlur = () => {
    if (description !== shot.prompt_text || angle !== shot.camera_angle) {
      onUpdateShot(shot.id, { prompt_text: description, camera_angle: angle });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Shot Description */}
          <div>
            <label className="flex items-center gap-1.5 mb-1.5">
              <Eye className="h-3 w-3 text-primary/70" />
              <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">
                Shot Description
              </span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleBlur}
              placeholder="He studies the photograph, hands trembling…"
              className="min-h-[80px] text-sm font-mono bg-black border-border/60 placeholder:text-muted-foreground/30 field-sizing-content cinema-inset resize-none"
            />
          </div>

          {/* Characters */}
          <div>
            <label className="flex items-center gap-1.5 mb-1.5">
              <Users className="h-3 w-3 text-primary/70" />
              <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">
                Characters
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(sceneElements?.characters || scene?.characters || []).map((char: string) => (
                <Badge
                  key={char}
                  variant="secondary"
                  className="text-[10px] font-mono bg-secondary/80 border-border/50"
                >
                  {char}
                </Badge>
              ))}
              {(!sceneElements?.characters?.length && !scene?.characters?.length) && (
                <span className="text-[10px] text-muted-foreground/40 font-mono italic">No characters detected</span>
              )}
            </div>
          </div>

          {/* Scene Elements */}
          <div className="space-y-2">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-primary/70" /> Scene Context
            </span>
            <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-2">
              {/* Location */}
              {(sceneElements?.location || scene?.setting) && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-[10px] font-mono text-foreground/70">
                    {sceneElements?.location || scene?.setting}
                  </span>
                </div>
              )}
              {/* Props */}
              {sceneElements?.props && sceneElements.props.length > 0 && (
                <div className="flex items-start gap-2">
                  <Box className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {sceneElements.props.map((p) => (
                      <span key={p} className="text-[9px] font-mono text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Wardrobe */}
              {sceneElements?.wardrobe && sceneElements.wardrobe.length > 0 && (
                <div className="flex items-start gap-2">
                  <Shirt className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {sceneElements.wardrobe.map((w) => (
                      <span key={w} className="text-[9px] font-mono text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">{w}</span>
                    ))}
                  </div>
                </div>
              )}
              {!sceneElements?.location && !scene?.setting && !sceneElements?.props?.length && !sceneElements?.wardrobe?.length && (
                <span className="text-[9px] text-muted-foreground/40 font-mono italic">No scene elements available</span>
              )}
            </div>
          </div>

          {/* Token / Cost Indicator */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/30 bg-secondary/10">
            <Coins className="h-3 w-3 text-primary/50" />
            <span className="text-[9px] font-mono text-muted-foreground/60">
              Est. cost: 1 credit (still) · 5 credits (video)
            </span>
          </div>
        </div>
      </ScrollArea>

      {/* Generation Buttons */}
      <div className="border-t border-border p-4 flex gap-3">
        <Button
          variant="secondary"
          onClick={onRehearsal}
          disabled={isGenerating || !description}
          className={cn(
            "flex-1 h-11 font-display font-bold text-[11px] uppercase tracking-wider gap-2",
            "cinema-inset active:translate-y-px"
          )}
        >
          <Image className="h-4 w-4" /> Rehearsal
        </Button>
        <Button
          onClick={onRollCamera}
          disabled={isGenerating || !description}
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
