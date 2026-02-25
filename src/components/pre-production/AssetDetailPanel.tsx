import { useState, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload, Loader2, Eye, Film, Save, Sparkles, type LucideIcon,
} from "lucide-react";
import AssetAuditionPane from "./AssetAuditionPane";

interface AssetDetailPanelProps {
  itemName: string;
  displayName: string;
  icon: LucideIcon;
  filmId: string;
  assetType: "location" | "prop" | "wardrobe" | "vehicle";
  subtitle?: string;
  refImageUrl?: string;
  refDescription?: string;
  sceneNumbers?: number[];
  onOpenScene?: (sceneNum: number) => void;
  onUploadReference?: (file: File) => void;
  isAnalyzing?: boolean;
  onDescriptionChange?: (desc: string) => void;
}

const AssetDetailPanel = ({
  itemName,
  displayName: label,
  icon: Icon,
  filmId,
  assetType,
  subtitle,
  refImageUrl,
  refDescription,
  sceneNumbers,
  onOpenScene,
  onUploadReference,
  isAnalyzing,
  onDescriptionChange,
}: AssetDetailPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(refDescription || "");
  const [showAudition, setShowAudition] = useState(false);

  const handleDescChange = (val: string) => {
    setDescription(val);
    onDescriptionChange?.(val);
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
              {refImageUrl ? (
                <img src={refImageUrl} alt={label} className="h-full w-full object-cover" />
              ) : (
                <Icon className="h-6 w-6 text-muted-foreground/40" />
              )}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">{label}</h2>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && onUploadReference) onUploadReference(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="gap-2"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload Reference
            </Button>
          </div>
        </div>

        {/* Reference image preview */}
        {(refImageUrl || isAnalyzing) && (
          <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
            {refImageUrl && (
              <img
                src={refImageUrl}
                alt="Reference"
                className="h-16 w-16 rounded-lg object-cover border border-border"
              />
            )}
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Reference Image
              </p>
              {isAnalyzing ? (
                <p className="text-xs text-primary mt-0.5 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Analyzing…
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                  <Eye className="h-3 w-3" /> AI-analyzed description available
                </p>
              )}
            </div>
          </div>
        )}

        {/* Scene Appearances */}
        {sceneNumbers && sceneNumbers.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 cinema-shadow">
            <div className="flex items-center gap-2 mb-3">
              <Film className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                Scenes
              </h3>
              <span className="text-xs text-muted-foreground/50">
                {sceneNumbers.length} appearance{sceneNumbers.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sceneNumbers.map((sn) => (
                <button
                  key={sn}
                  onClick={() => onOpenScene?.(sn)}
                  className="inline-flex items-center justify-center h-7 min-w-[28px] px-2 rounded-md border border-border bg-secondary/50 text-xs font-display font-semibold text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                  title={`View Scene ${sn}`}
                >
                  {sn}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Description / Details */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 cinema-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                {assetType === "wardrobe" ? "Wardrobe Details" : assetType === "vehicle" ? "Vehicle Details" : assetType === "location" ? "Location Details" : "Prop Details"}
              </h3>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => handleDescChange(e.target.value)}
              placeholder={
                assetType === "wardrobe"
                  ? "Dark leather jacket, worn at the elbows, paired with faded jeans…"
                  : assetType === "vehicle"
                  ? "1970 Dodge Challenger, matte black, dented right fender…"
                  : assetType === "location"
                  ? "A dimly lit corner bar with neon signage and vinyl booths…"
                  : "Antique pocket watch, brass, cracked glass face…"
              }
              className="min-h-[80px] bg-secondary/50 border-border text-sm resize-none"
            />
          </div>
        </div>

        {/* Visual Audition */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 cinema-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                Visual Options
              </h3>
            </div>
          </div>
          <AssetAuditionPane
            filmId={filmId}
            assetType={assetType}
            assetName={itemName}
          />
        </div>
      </div>
    </ScrollArea>
  );
};

export default AssetDetailPanel;
