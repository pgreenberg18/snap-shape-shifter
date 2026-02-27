import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload, Loader2, Eye, Film, Save, Sparkles, RotateCcw, Lock, ChevronDown, ChevronRight, type LucideIcon,
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
  /** All scene numbers in the film (for wardrobe scene assignment) */
  allSceneNumbers?: number[];
  /** Scene headings keyed by scene number */
  sceneHeadings?: Record<number, string>;
}

/* 8-view turnaround angles matching the character consistency engine */
const FITTING_ANGLES = [
  { index: 0, label: "Front" },
  { index: 1, label: "¾ Left" },
  { index: 2, label: "Profile Left" },
  { index: 3, label: "¾ Back Left" },
  { index: 4, label: "Back" },
  { index: 5, label: "¾ Back Right" },
  { index: 6, label: "Profile Right" },
  { index: 7, label: "¾ Right" },
];

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
  allSceneNumbers,
  sceneHeadings,
}: AssetDetailPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(refDescription || "");
  const queryClient = useQueryClient();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [scenesOpen, setScenesOpen] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [fittingOpen, setFittingOpen] = useState(false);

  // Sync description when selected item or external description changes
  useEffect(() => {
    setDescription(refDescription || "");
  }, [itemName, refDescription]);

  const handleDescChange = (val: string) => {
    setDescription(val);
    onDescriptionChange?.(val);
  };

  // ── Wardrobe: fetch scene assignments for this specific item ──
  const characterName = assetType === "wardrobe" ? (subtitle || "Unknown") : undefined;

  const { data: wardrobeItemScenes = [] } = useQuery({
    queryKey: ["wardrobe-scene-assignments", filmId, characterName, itemName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wardrobe_scene_assignments")
        .select("scene_number")
        .eq("film_id", filmId)
        .eq("character_name", characterName!)
        .eq("clothing_item", itemName);
      if (error) throw error;
      return (data ?? []).map((r) => r.scene_number).sort((a, b) => a - b);
    },
    enabled: assetType === "wardrobe" && !!characterName,
  });

  // For wardrobe: compute scenes where this item appears
  // Use explicit assignments if they exist, otherwise fall back to script-detected scenes
  const wardrobeScenesDisplay = useMemo(() => {
    if (assetType !== "wardrobe") return [];
    if (wardrobeItemScenes.length > 0) return wardrobeItemScenes;
    // Fall back to script-detected scenes
    return sceneNumbers ? [...sceneNumbers].sort((a, b) => a - b) : [];
  }, [assetType, wardrobeItemScenes, sceneNumbers]);

  // ── Wardrobe Fitting: fetch locked asset + character data for 8-view ──
  const { data: lockedAssetForItem } = useQuery({
    queryKey: ["wardrobe-locked-asset-detail", filmId, itemName],
    queryFn: async () => {
      const cleanName = itemName.replace(/\s*\(.*?\)\s*$/, "").trim();
      const { data, error } = await supabase
        .from("film_assets")
        .select("*")
        .eq("film_id", filmId)
        .eq("asset_type", "wardrobe")
        .eq("locked", true)
        .or(`asset_name.ilike.${cleanName},asset_name.ilike.${itemName}`);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: assetType === "wardrobe" && !!filmId,
  });

  const { data: characterData } = useQuery({
    queryKey: ["character-for-wardrobe-fitting", filmId, characterName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("id, name, image_url, approved")
        .eq("film_id", filmId)
        .ilike("name", characterName!)
        .eq("approved", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: assetType === "wardrobe" && !!filmId && !!characterName,
  });

  // Fetch existing wardrobe fitting views (if any)
  // These would be stored similar to character_consistency_views but for wardrobe
  // For now, show placeholders until the fitting generation system is built
  const hasLockedWardrobe = !!lockedAssetForItem;
  const hasApprovedCharacter = !!characterData?.approved;

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        {/* ═══ SLOT 1: Header + Details ═══ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
              {assetType === "wardrobe" && characterData?.image_url ? (
                <img src={characterData.image_url} alt={characterName || label} className="h-full w-full object-cover" />
              ) : refImageUrl ? (
                <img src={refImageUrl} alt={label} className="h-full w-full object-cover" />
              ) : (
                <Icon className="h-6 w-6 text-muted-foreground/40" />
              )}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">{label}</h2>
              {subtitle && assetType === "wardrobe" ? (
                <p className="text-xs text-muted-foreground">
                  Worn by <span className="font-semibold text-foreground/80">{subtitle}</span>
                </p>
              ) : subtitle ? (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
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

        {/* Description / Details */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <div className="rounded-xl border border-border bg-card p-4 cinema-shadow space-y-4">
            <CollapsibleTrigger className="w-full flex items-center gap-2">
              {detailsOpen ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
              <Icon className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                {assetType === "wardrobe" ? "Wardrobe Details" : assetType === "vehicle" ? "Vehicle Details" : assetType === "location" ? "Location Details" : "Prop Details"}
              </h3>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1.5 pt-2">
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
            </CollapsibleContent>
          </div>
        </Collapsible>

        <Collapsible open={scenesOpen} onOpenChange={setScenesOpen}>
          {assetType === "wardrobe" ? (
            <div className="rounded-xl border border-border bg-card p-4 cinema-shadow">
              <CollapsibleTrigger className="w-full flex items-center gap-2">
                {scenesOpen ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
                <Film className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                  Scenes
                </h3>
                <span className="text-xs text-muted-foreground/50">
                  {wardrobeScenesDisplay.length} appearance{wardrobeScenesDisplay.length !== 1 ? "s" : ""}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {wardrobeScenesDisplay.length > 0 ? (
                  <div className="pt-2 space-y-2">
                    <p className="text-[10px] text-muted-foreground">
                      Scenes where this wardrobe item is worn. Manage assignments from the character overview.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {wardrobeScenesDisplay.map((sn) => (
                        <button
                          key={sn}
                          onClick={() => onOpenScene?.(sn)}
                          className="inline-flex items-center justify-center h-7 min-w-[28px] px-2 rounded-md border border-border bg-secondary/50 text-xs font-display font-semibold text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                          title={sceneHeadings?.[sn] || `Scene ${sn}`}
                        >
                          {sn}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground/50 pt-2">
                    No scene assignments yet. Assign this wardrobe to scenes from the character overview.
                  </p>
                )}
              </CollapsibleContent>
            </div>
          ) : (
            sceneNumbers && sceneNumbers.length > 0 ? (
              <div className="rounded-xl border border-border bg-card p-4 cinema-shadow">
                <CollapsibleTrigger className="w-full flex items-center gap-2">
                  {scenesOpen ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
                  <Film className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                    Scenes
                  </h3>
                  <span className="text-xs text-muted-foreground/50">
                    {sceneNumbers.length} appearance{sceneNumbers.length !== 1 ? "s" : ""}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex flex-wrap gap-1.5 pt-2">
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
                </CollapsibleContent>
              </div>
            ) : null
          )}
        </Collapsible>

        <Collapsible open={selectionOpen} onOpenChange={setSelectionOpen}>
          <div className="rounded-xl border border-border bg-card p-4 cinema-shadow space-y-4">
            <CollapsibleTrigger className="w-full flex items-center gap-2">
              {selectionOpen ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                {assetType === "wardrobe" ? "Wardrobe Selection" : "Visual Options"}
              </h3>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-2">
                <AssetAuditionPane
                  filmId={filmId}
                  assetType={assetType}
                  assetName={itemName}
                />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* ═══ SLOT 4: Wardrobe Fitting (8-view turnaround) — wardrobe only ═══ */}
        {assetType === "wardrobe" && (
          <Collapsible open={fittingOpen} onOpenChange={setFittingOpen}>
            <div className="rounded-xl border border-border bg-card p-4 cinema-shadow space-y-4">
              <CollapsibleTrigger className="w-full flex items-center gap-2">
                {fittingOpen ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
                <RotateCcw className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                  Wardrobe Fitting
                </h3>
                <span className="text-xs text-muted-foreground/50">8-view turnaround</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {!hasLockedWardrobe ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <Lock className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground/50">Lock a wardrobe option above to enable fitting</p>
                    <p className="text-[10px] text-muted-foreground/40">
                      The 8-view fitting generates the locked actor wearing this costume from all angles
                    </p>
                  </div>
                ) : !hasApprovedCharacter ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <Lock className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground/50">Character must be cast first</p>
                    <p className="text-[10px] text-muted-foreground/40">
                      Lock {characterName}'s casting in the Characters tab to enable wardrobe fitting
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <p className="text-[10px] text-muted-foreground">
                      Generate 8 standardized views of <span className="font-semibold text-foreground">{characterName}</span> wearing this costume. These become the canonical visual reference for continuity.
                    </p>

                    <div className="grid grid-cols-4 gap-2">
                      {FITTING_ANGLES.map((angle) => (
                        <div
                          key={angle.index}
                          className="rounded-lg border border-border bg-secondary/30 overflow-hidden"
                        >
                          <div className="aspect-square flex items-center justify-center bg-secondary/50">
                            <RotateCcw className="h-5 w-5 text-muted-foreground/20" />
                          </div>
                          <p className="text-[9px] font-display font-semibold text-muted-foreground text-center py-1 uppercase tracking-wider">
                            {angle.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      disabled
                    >
                      <RotateCcw className="h-4 w-4" />
                      Generate Fitting Views
                    </Button>
                    <p className="text-[9px] text-muted-foreground/50 text-center">
                      Fitting generation coming soon — uses the same 8 angles as character consistency views
                    </p>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </div>
    </ScrollArea>
  );
};

export default AssetDetailPanel;
