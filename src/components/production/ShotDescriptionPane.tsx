import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Eye, Users, MapPin, Box, Shirt, Camera,
  UserCheck, Package, Loader2, Wrench,
} from "lucide-react";

export type RepairTarget = "character" | "prop" | "wardrobe";

interface ShotDescriptionPaneProps {
  shot: {
    id: string;
    prompt_text: string | null;
    camera_angle: string | null;
  } | null;
  scene: any;
  onUpdateShot: (id: string, updates: { prompt_text?: string; camera_angle?: string }) => void;
  sceneElements?: {
    location?: string;
    props?: string[];
    wardrobe?: string[];
    characters?: string[];
  };
  /** Called when user clicks a targeted repair button */
  onRepair?: (target: RepairTarget, hint: string) => void;
  /** Whether a repair generation is currently running */
  isRepairing?: boolean;
  /** Which repair target is currently generating */
  repairTarget?: RepairTarget | null;
  /** Whether anchors exist (repairs only make sense after generation) */
  hasAnchors?: boolean;
}

const REPAIR_BUTTONS: { target: RepairTarget; label: string; icon: typeof UserCheck; hint: string }[] = [
  { target: "character", label: "Fix Character", icon: UserCheck, hint: "Correct character identity, face, and body proportions" },
  { target: "prop",      label: "Fix Prop",      icon: Package,   hint: "Correct prop appearance, position, and scale" },
  { target: "wardrobe",  label: "Fix Wardrobe",  icon: Shirt,     hint: "Correct clothing style, color, and fit" },
];

const ShotDescriptionPane = ({
  shot,
  scene,
  onUpdateShot,
  sceneElements,
  onRepair,
  isRepairing = false,
  repairTarget = null,
  hasAnchors = false,
}: ShotDescriptionPaneProps) => {
  const [description, setDescription] = useState(shot?.prompt_text || "");
  const [angle, setAngle] = useState(shot?.camera_angle || "");

  useEffect(() => {
    setDescription(shot?.prompt_text || "");
    setAngle(shot?.camera_angle || "");
  }, [shot?.id]);

  if (!shot) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <Camera className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-xs text-muted-foreground/60 font-display">
            Select or create a shot to describe it.
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
            {(sceneElements?.location || scene?.setting) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <span className="text-[10px] font-mono text-foreground/70">
                  {sceneElements?.location || scene?.setting}
                </span>
              </div>
            )}
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

        {/* ── Targeted Repair Buttons ── */}
        {hasAnchors && onRepair && (
          <div className="space-y-2">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wrench className="h-3 w-3 text-primary/70" /> Targeted Repairs
            </span>
            <div className="grid grid-cols-3 gap-2">
              {REPAIR_BUTTONS.map(({ target, label, icon: Icon, hint }) => {
                const isActive = isRepairing && repairTarget === target;
                return (
                  <Button
                    key={target}
                    variant="secondary"
                    size="sm"
                    disabled={isRepairing}
                    onClick={() => onRepair(target, hint)}
                    className={cn(
                      "h-9 text-[9px] font-mono font-bold uppercase tracking-wider gap-1.5 cinema-inset active:translate-y-px",
                      isActive && "animate-pulse-glow border-primary/40"
                    )}
                  >
                    {isActive ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                    {label}
                  </Button>
                );
              })}
            </div>
            <p className="text-[8px] font-mono text-muted-foreground/40 leading-relaxed">
              Re-generates the selected anchor with region-specific corrections applied.
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default ShotDescriptionPane;
