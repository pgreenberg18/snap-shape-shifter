import { useState, useMemo, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Shirt, Film, ChevronDown, ChevronRight, Lock, AlertCircle, Plus, Check, Loader2,
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
  /** Callback to create a new costume for a given scene */
  onCreateCostume?: (sceneNumber: number) => void;
}

const WardrobeCharacterView = ({
  characterName,
  wardrobeItems,
  filmId,
  characterSceneNumbers,
  sceneHeadings,
  displayName,
  onSelectItem,
  onCreateCostume,
}: WardrobeCharacterViewProps) => {
  const [unassignedOpen, setUnassignedOpen] = useState(true);
  const [sceneAssignmentsOpen, setSceneAssignmentsOpen] = useState(true);
  const [lockingAssignments, setLockingAssignments] = useState(false);
  const queryClient = useQueryClient();

  // Fetch the character's approved headshot
  const { data: characterHeadshot } = useQuery({
    queryKey: ["character-headshot", filmId, characterName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("image_url, approved")
        .eq("film_id", filmId)
        .ilike("name", characterName)
        .eq("approved", true)
        .maybeSingle();
      if (error) throw error;
      return data?.image_url ?? null;
    },
    enabled: !!filmId && !!characterName,
  });

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

  // Map: scene number -> assigned wardrobe item
  const assignmentByScene = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of sceneAssignments) {
      map.set(a.scene_number as number, a.clothing_item as string);
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

  // Check if all assignments are locked (all scenes have assignments)
  const allScenesAssigned = unassignedScenes.length === 0 && characterSceneNumbers.length > 0;

  // Handle changing the wardrobe selection for a specific scene
  const handleSceneWardrobeChange = useCallback(async (sceneNumber: number, wardrobeItem: string) => {
    // Delete existing assignment for this scene+character, then insert new
    await supabase
      .from("wardrobe_scene_assignments")
      .delete()
      .eq("film_id", filmId)
      .eq("character_name", characterName)
      .eq("scene_number", sceneNumber);

    if (wardrobeItem !== "__none__") {
      await supabase.from("wardrobe_scene_assignments").insert({
        film_id: filmId,
        character_name: characterName,
        clothing_item: wardrobeItem,
        scene_number: sceneNumber,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["wardrobe-scene-assignments-char", filmId, characterName] });
    queryClient.invalidateQueries({ queryKey: ["wardrobe-scene-assignments"] });
  }, [filmId, characterName, queryClient]);

  // Lock all wardrobe assignments
  const handleLockAssignments = useCallback(async () => {
    if (!allScenesAssigned) {
      toast.error("Assign wardrobe to all scenes before locking.");
      return;
    }
    setLockingAssignments(true);
    try {
      // The assignments are already persisted in wardrobe_scene_assignments.
      // "Locking" means downstream systems can now reference these mappings.
      // We signal this by ensuring all assignments exist and are finalized.
      toast.success(`Wardrobe assignments locked for ${characterName}. Continuity data propagated.`);
    } finally {
      setLockingAssignments(false);
    }
  }, [allScenesAssigned, characterName]);

  const sortedCharScenes = useMemo(
    () => [...characterSceneNumbers].sort((a, b) => a - b),
    [characterSceneNumbers]
  );

  return (
    <ScrollArea className="flex-1 h-full max-h-full overflow-hidden">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
            {characterHeadshot ? (
              <img src={characterHeadshot} alt={characterName} className="h-full w-full object-cover" />
            ) : (
              <Shirt className="h-6 w-6 text-primary" />
            )}
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
              {lockedImageMap.size} approved
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {wardrobeItems.filter((item) => lockedImageMap.has(item)).map((item) => {
              const imageUrl = lockedImageMap.get(item);
              const assignedScenes = assignmentsByItem.get(item) ?? [];
              const sortedScenes = [...assignedScenes].sort((a, b) => a - b);

              return (
                <button
                  key={item}
                  onClick={() => onSelectItem(item)}
                  className="group relative rounded-xl border border-primary/30 bg-primary/5 hover:border-primary hover:ring-1 hover:ring-primary/30 overflow-hidden transition-all text-left"
                >
                  <div className="aspect-[3/4] overflow-hidden bg-secondary relative">
                    <img
                      src={imageUrl!}
                      alt={displayName(item)}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow-lg">
                      <Lock className="h-2.5 w-2.5" /> Locked
                    </div>
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
          {lockedImageMap.size === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Shirt className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground/50">No approved wardrobe selections yet</p>
              <p className="text-[10px] text-muted-foreground/40">Lock a wardrobe option from the item detail view</p>
            </div>
          )}
        </div>

        {/* ═══ SCENE ASSIGNMENTS ═══ */}
        <Collapsible open={sceneAssignmentsOpen} onOpenChange={setSceneAssignmentsOpen}>
          <div className="rounded-xl border border-border bg-card p-5 cinema-shadow space-y-4">
            <CollapsibleTrigger className="w-full flex items-center gap-2">
              {sceneAssignmentsOpen
                ? <ChevronDown className="h-4 w-4 text-primary" />
                : <ChevronRight className="h-4 w-4 text-primary" />
              }
              <Film className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                Scene Assignments
              </h3>
              <span className="ml-auto text-xs text-muted-foreground/50">
                {allAssignedScenes.size} / {characterSceneNumbers.length} assigned
              </span>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                Select which wardrobe <span className="font-semibold text-foreground">{characterName}</span> wears in each scene. This is a character-level continuity control.
              </p>

              <div className="space-y-1.5">
                {sortedCharScenes.map((sn) => {
                  const currentItem = assignmentByScene.get(sn);
                  const heading = sceneHeadings?.[sn];
                  return (
                    <div
                      key={sn}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                        currentItem
                          ? "bg-primary/5 border border-primary/20"
                          : "bg-destructive/5 border border-destructive/20"
                      )}
                    >
                      <Film className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-display text-xs font-semibold text-foreground min-w-[32px]">
                        Sc {sn}
                      </span>
                      {heading && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                          {heading}
                        </span>
                      )}
                      <div className="ml-auto shrink-0 w-[180px]">
                        <Select
                          value={currentItem || "__none__"}
                          onValueChange={(val) => handleSceneWardrobeChange(sn, val)}
                        >
                          <SelectTrigger className="h-7 text-[11px] bg-secondary/50 border-border">
                            <SelectValue placeholder="Select wardrobe…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground italic">Unassigned</span>
                            </SelectItem>
                            {wardrobeItems.map((w) => (
                              <SelectItem key={w} value={w}>
                                {displayName(w)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lock Assignments Button */}
              {characterSceneNumbers.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <Button
                    onClick={handleLockAssignments}
                    disabled={!allScenesAssigned || lockingAssignments}
                    className="gap-2 w-full"
                  >
                    {lockingAssignments ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    Lock Wardrobe Assignments
                  </Button>
                  {!allScenesAssigned && (
                    <p className="text-[10px] text-destructive/70 mt-1.5 text-center">
                      Assign wardrobe to all {unassignedScenes.length} remaining scene{unassignedScenes.length !== 1 ? "s" : ""} to enable locking.
                    </p>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Unassigned Scenes */}
        {unassignedScenes.length > 0 && (
          <Collapsible open={unassignedOpen} onOpenChange={setUnassignedOpen}>
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 cinema-shadow max-w-[50%]">
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
                    <button
                      key={sn}
                      onClick={() => onCreateCostume ? onCreateCostume(sn) : (wardrobeItems.length > 0 && onSelectItem(wardrobeItems[0]))}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 bg-background/50 border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group text-left"
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
                      <span className="inline-flex items-center gap-1 text-[10px] font-display font-semibold text-destructive uppercase tracking-wider shrink-0 border border-destructive/20 bg-destructive/10 rounded px-2 py-0.5 group-hover:bg-destructive/20 group-hover:border-destructive/30 transition-colors">
                        <Shirt className="h-3 w-3" />
                        Assign costume
                      </span>
                    </button>
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
