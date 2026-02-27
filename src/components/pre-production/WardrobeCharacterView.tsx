import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Shirt, Film, ChevronDown, ChevronRight, Lock, AlertCircle,
} from "lucide-react";

interface WardrobeCharacterViewProps {
  characterName: string;
  wardrobeItems: string[];
  filmId: string;
  /** All scene numbers where this character appears */
  characterSceneNumbers: number[];
  /** Scene headings keyed by scene number */
  sceneHeadings?: Record<number, string>;
  /** Display names for wardrobe items */
  displayName: (item: string) => string;
  /** Callback when a specific wardrobe item is clicked to open detail view */
  onSelectItem: (itemName: string) => void;
}

const WardrobeCharacterView = ({
  characterName,
  wardrobeItems,
  filmId,
  characterSceneNumbers,
  sceneHeadings,
  displayName,
  onSelectItem,
}: WardrobeCharacterViewProps) => {
  const [unassignedOpen, setUnassignedOpen] = useState(true);

  // Fetch locked wardrobe selections (film_assets with locked=true)
  const { data: lockedAssets = [] } = useQuery({
    queryKey: ["wardrobe-locked-assets", filmId, characterName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("film_assets")
        .select("*")
        .eq("film_id", filmId)
        .eq("asset_type", "wardrobe")
        .eq("locked", true);
      if (error) throw error;
      // Filter to only assets matching this character's wardrobe items
      return (data ?? []).filter((a) =>
        wardrobeItems.some((w) => {
          const cleanName = w.replace(/\s*\(.*?\)\s*$/, "").trim().toLowerCase();
          return a.asset_name.toLowerCase() === w.toLowerCase() ||
                 a.asset_name.toLowerCase() === cleanName;
        })
      );
    },
    enabled: !!filmId && wardrobeItems.length > 0,
  });

  // Fetch wardrobe scene assignments for this character
  const { data: sceneAssignments = [] } = useQuery({
    queryKey: ["wardrobe-scene-assignments-char", filmId, characterName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wardrobe_scene_assignments")
        .select("*")
        .eq("film_id", filmId)
        .eq("character_name", characterName);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!filmId && !!characterName,
  });

  // Map: wardrobe item -> locked asset image
  const lockedImageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of lockedAssets) {
      // Match by asset_name to wardrobe item names
      for (const w of wardrobeItems) {
        const cleanName = w.replace(/\s*\(.*?\)\s*$/, "").trim().toLowerCase();
        if (asset.asset_name.toLowerCase() === w.toLowerCase() ||
            asset.asset_name.toLowerCase() === cleanName) {
          if (asset.image_url) map.set(w, asset.image_url);
        }
      }
    }
    return map;
  }, [lockedAssets, wardrobeItems]);

  // Map: wardrobe item -> assigned scene numbers
  const assignmentsByItem = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const a of sceneAssignments) {
      const item = a.clothing_item as string;
      if (!map.has(item)) map.set(item, []);
      map.get(item)!.push(a.scene_number as number);
    }
    return map;
  }, [sceneAssignments]);

  // All assigned scene numbers (across all wardrobe items for this character)
  const allAssignedScenes = useMemo(() => {
    const set = new Set<number>();
    for (const [, scenes] of assignmentsByItem) {
      for (const sn of scenes) set.add(sn);
    }
    return set;
  }, [assignmentsByItem]);

  // Unassigned scenes: character scenes with no wardrobe assignment
  const unassignedScenes = useMemo(() => {
    return characterSceneNumbers.filter((sn) => !allAssignedScenes.has(sn)).sort((a, b) => a - b);
  }, [characterSceneNumbers, allAssignedScenes]);

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
            <Shirt className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">{characterName}</h2>
            <p className="text-xs text-muted-foreground">
              {wardrobeItems.length} wardrobe item{wardrobeItems.length !== 1 ? "s" : ""} ·{" "}
              {characterSceneNumbers.length} scene{characterSceneNumbers.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Wardrobe Selections Grid */}
        <div className="rounded-xl border border-border bg-card p-5 cinema-shadow space-y-4">
          <div className="flex items-center gap-2">
            <Shirt className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
              Wardrobe Selections
            </h3>
            <span className="text-xs text-muted-foreground/50">
              {lockedImageMap.size} locked / {wardrobeItems.length} total
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {wardrobeItems.map((item) => {
              const imageUrl = lockedImageMap.get(item);
              const assignedScenes = assignmentsByItem.get(item) ?? [];
              const sortedScenes = [...assignedScenes].sort((a, b) => a - b);

              return (
                <button
                  key={item}
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    "group relative rounded-xl border overflow-hidden transition-all text-left",
                    imageUrl
                      ? "border-primary/30 bg-primary/5 hover:border-primary hover:ring-1 hover:ring-primary/30"
                      : "border-border bg-card hover:border-primary/50 hover:bg-secondary/50"
                  )}
                >
                  {/* Image / Placeholder */}
                  <div className="aspect-[3/4] overflow-hidden bg-secondary relative">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={displayName(item)}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                        <Shirt className="h-8 w-8 text-muted-foreground/30" />
                        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                          Not yet selected
                        </span>
                      </div>
                    )}
                    {imageUrl && (
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow-lg">
                        <Lock className="h-2.5 w-2.5" /> Locked
                      </div>
                    )}
                  </div>

                  {/* Label + Scene Numbers */}
                  <div className="p-2.5 space-y-1.5">
                    <p className="text-xs font-display font-semibold text-foreground leading-snug truncate">
                      {displayName(item)}
                    </p>

                    {sortedScenes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {sortedScenes.map((sn) => (
                          <span
                            key={sn}
                            className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded bg-secondary text-[10px] font-display font-semibold text-muted-foreground"
                            title={sceneHeadings?.[sn] || `Scene ${sn}`}
                          >
                            {sn}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/50 italic">
                        No scenes assigned
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Unassigned Scenes */}
        {unassignedScenes.length > 0 && (
          <Collapsible open={unassignedOpen} onOpenChange={setUnassignedOpen}>
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 cinema-shadow">
              <CollapsibleTrigger className="w-full flex items-center gap-2">
                {unassignedOpen
                  ? <ChevronDown className="h-4 w-4 text-destructive/70" />
                  : <ChevronRight className="h-4 w-4 text-destructive/70" />
                }
                <AlertCircle className="h-4 w-4 text-destructive/70" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                  Unassigned Scenes
                </h3>
                <span className="ml-auto text-xs text-destructive/70 font-semibold">
                  {unassignedScenes.length} scene{unassignedScenes.length !== 1 ? "s" : ""}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-[10px] text-muted-foreground mt-2 mb-3">
                  These scenes feature <span className="font-semibold text-foreground">{characterName}</span> but have no wardrobe assigned yet.
                </p>
                <div className="space-y-1.5">
                  {unassignedScenes.map((sn) => (
                    <div
                      key={sn}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 bg-background/50 border border-border"
                    >
                      <Film className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-display text-xs font-semibold text-foreground min-w-[32px]">
                        Sc {sn}
                      </span>
                      {sceneHeadings?.[sn] && (
                        <span className="text-[11px] text-muted-foreground truncate flex-1">
                          {sceneHeadings[sn]}
                        </span>
                      )}
                      <span className="text-[9px] text-destructive/60 uppercase tracking-wider shrink-0">
                        No costume
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* All scenes assigned indicator */}
        {unassignedScenes.length === 0 && characterSceneNumbers.length > 0 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-display font-semibold text-foreground">All Scenes Covered</p>
              <p className="text-xs text-muted-foreground">
                Every scene featuring {characterName} has a wardrobe assignment.
              </p>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default WardrobeCharacterView;
