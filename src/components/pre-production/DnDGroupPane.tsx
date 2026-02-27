import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { parseSceneFromPlainText } from "@/lib/parse-script-text";
import type { CharacterTier, CharacterRanking } from "@/hooks/useCharacterRanking";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensors,
  useSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight, GripVertical, Plus, X, Pencil, Check, Merge, Upload, Loader2, Eye, ScrollText, Search, ArrowRightLeft, Package, MapPin, Shirt, Car, Undo2, type LucideIcon } from "lucide-react";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import AssetDetailPanel from "./AssetDetailPanel";
import WardrobeCharacterView from "./WardrobeCharacterView";
import ResizableSidebar from "./ResizableSidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useScriptViewer } from "@/components/ScriptViewerDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/* ── Types ── */
interface ItemGroup {
  id: string;
  name: string;
  children: string[];
}

interface ReclassifyOption {
  label: string;
  value: string;
  icon: LucideIcon;
}

interface DnDGroupPaneProps {
  items: string[];
  filmId: string | undefined;
  storagePrefix: string;
  icon: LucideIcon;
  title: string;
  emptyMessage: string;
  subtitles?: Record<string, string>;
  expandableSubtitles?: boolean;
  sceneBreakdown?: any[];
  storagePath?: string;
  reclassifyOptions?: ReclassifyOption[];
  onReclassify?: (item: string, targetCategory: string) => void;
  /** Pre-seed groups from Global Elements (used when no localStorage groups exist yet) */
  initialGroups?: { id: string; name: string; children: string[] }[];
  /** Names to exclude from key_objects matching (e.g. vehicle names excluded from props) */
  excludeFromKeyObjects?: string[];
  /** All scene numbers in the film (for wardrobe per-scene assignment) */
  allSceneNumbers?: number[];
  /** Scene headings keyed by scene number */
  sceneHeadings?: Record<number, string>;
  /** Character ranking order (normalized names) for sorting wardrobe groups */
  characterOrder?: string[];
  /** Character rankings for tier grouping in wardrobe sidebar */
  characterRankings?: CharacterRanking[];
}

// ... keep existing code (persistence helpers, CONTEXT_MAP)
const storageKey = (prefix: string, filmId: string, suffix: string) => `${prefix}-${suffix}-${filmId}`;

const loadJson = <T,>(prefix: string, filmId: string, suffix: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(storageKey(prefix, filmId, suffix));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveJson = (prefix: string, filmId: string, suffix: string, data: any) => {
  localStorage.setItem(storageKey(prefix, filmId, suffix), JSON.stringify(data));
};

const CONTEXT_MAP: Record<string, string> = {
  locations: "location",
  props: "prop",
  wardrobe: "wardrobe",
  vehicles: "vehicle",
};

/** Convert a string to Title Case (each word capitalized) */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\S/g, (match) => match.toUpperCase());
}

/* ── Find scenes containing an item by storagePrefix type ── */

/** Check if two strings are a meaningful match (not just substring noise) */
function isSignificantMatch(itemName: string, fieldValue: string): boolean {
  const a = itemName.toLowerCase().trim();
  const b = fieldValue.toLowerCase().trim();
  if (!a || !b) return false;
  // Exact match
  if (a === b) return true;
  // One fully contains the other, but the shorter must be a "significant" portion
  // to prevent "car" matching "cardinal" or "office" matching every location
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (!longer.includes(shorter)) return false;
  // The shorter string must be at least 4 chars and represent a word boundary match
  if (shorter.length < 4) return false;
  // Check word boundary: shorter must appear as a whole word (or word prefix of 5+ chars) in longer
  const escaped = shorter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordBoundaryRegex = new RegExp(`(?:^|[\\s\\-–—/.,;:'"()])${escaped}(?:$|[\\s\\-–—/.,;:'"()])`, "i");
  // Also accept if shorter IS the longer (already handled) or if it's at string boundaries
  const startsOrEnds = longer.startsWith(shorter) || longer.endsWith(shorter);
  return wordBoundaryRegex.test(` ${longer} `) || (startsOrEnds && shorter.length >= 5);
}

function findScenesForItem(itemName: string, scenes: any[], storagePrefix: string, excludeFromKeyObjects?: string[]): { sceneIndex: number; scene: any }[] {
  const nameLower = itemName.toLowerCase().trim();
  const results: { sceneIndex: number; scene: any }[] = [];
  const excludeSet = new Set((excludeFromKeyObjects || []).map((e) => e.toLowerCase()));

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    let found = false;

    if (storagePrefix === "locations") {
      // Match against location_name field (most reliable) and scene_heading
      const locationName = (scene.location_name || "").toLowerCase().trim();
      const heading = (scene.heading || scene.scene_heading || "").toLowerCase();
      const cleanHeading = heading.replace(/^(?:int\.?\s*\/?\s*ext\.?|ext\.?\s*\/?\s*int\.?|int\.?|ext\.?|i\/e\.?)\s*[-–—.\s]*/i, "")
        .replace(/\s*[-–—]\s*(?:day|night|morning|evening|dawn|dusk|afternoon|later|continuous|same time|moments?\s+later|sunset|sunrise|\d{4})\s*$/i, "").trim();
      
      // Primary: exact or near-exact match on location_name
      if (locationName && (locationName === nameLower || isSignificantMatch(nameLower, locationName))) {
        found = true;
      }
      // Secondary: check scene heading for the location name
      if (!found && cleanHeading && isSignificantMatch(nameLower, cleanHeading)) {
        found = true;
      }
    } else if (storagePrefix === "props") {
      if (Array.isArray(scene.key_objects)) {
        found = scene.key_objects.some((o: string) => {
          if (typeof o !== "string") return false;
          const oLower = o.toLowerCase().trim();
          if (excludeSet.has(oLower)) return false;
          return isSignificantMatch(nameLower, oLower);
        });
      }
    } else if (storagePrefix === "wardrobe") {
      if (Array.isArray(scene.wardrobe)) {
        found = scene.wardrobe.some((w: any) => {
          const style = (w?.clothing_style || "").toLowerCase();
          const condition = (w?.condition || "").toLowerCase();
          return isSignificantMatch(nameLower, style) || isSignificantMatch(nameLower, condition);
        });
      }
    } else if (storagePrefix === "vehicles") {
      if (Array.isArray(scene.picture_vehicles)) {
        found = scene.picture_vehicles.some((v: string) => typeof v === "string" && isSignificantMatch(nameLower, v));
      }
    }

    if (found) results.push({ sceneIndex: i, scene });
  }
  return results;
}

/* ── Main component ── */
const DnDGroupPane = ({ items, filmId, storagePrefix, icon: Icon, title, emptyMessage, subtitles, expandableSubtitles, sceneBreakdown, storagePath, reclassifyOptions, onReclassify, initialGroups, excludeFromKeyObjects, allSceneNumbers, sceneHeadings, characterOrder, characterRankings }: DnDGroupPaneProps) => {
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [mergedAway, setMergedAway] = useState<Set<string>>(new Set());
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [refImages, setRefImages] = useState<Record<string, string>>({});
  const [refDescriptions, setRefDescriptions] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mergeDialog, setMergeDialog] = useState<{ source: string; target: string } | null>(null);
  const [analyzingItem, setAnalyzingItem] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [multiMergeDialog, setMultiMergeDialog] = useState<string[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftItems, setDraftItems] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [collapsedTiers, setCollapsedTiers] = useState<Set<string>>(new Set(["LEAD", "STRONG_SUPPORT", "FEATURE", "UNDER_5", "BACKGROUND"]));
  // Wardrobe: per-character scene counts derived from wardrobe_scene_assignments
  const [wardrobeSceneCounts, setWardrobeSceneCounts] = useState<Map<string, number>>(new Map());
  // Wardrobe: manual tier overrides for character groups (persisted to localStorage)
  const [wardrobeTierOverrides, setWardrobeTierOverrides] = useState<Record<string, CharacterTier>>({});
  const [wardrobeSortOverrides, setWardrobeSortOverrides] = useState<Record<string, number>>({});
  // Undo history for wardrobe changes (tier/sort overrides + group membership + renames)
  const [wardrobeUndoStack, setWardrobeUndoStack] = useState<Array<{
    tierOverrides: Record<string, CharacterTier>;
    sortOverrides: Record<string, number>;
    groups?: ItemGroup[];
    renames?: Record<string, string>;
  }>>([]);

  // Load/save wardrobe tier overrides
  useEffect(() => {
    if (!filmId || storagePrefix !== "wardrobe") return;
    try {
      const raw = localStorage.getItem(`wardrobe-tier-overrides-${filmId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setWardrobeTierOverrides(parsed.tierOverrides || {});
        setWardrobeSortOverrides(parsed.sortOverrides || {});
      }
    } catch {}
  }, [filmId, storagePrefix]);

  const pushWardrobeUndo = useCallback(() => {
    setWardrobeUndoStack(prev => [...prev.slice(-19), {
      tierOverrides: { ...wardrobeTierOverrides },
      sortOverrides: { ...wardrobeSortOverrides },
      groups: groups.map(g => ({ ...g, children: [...g.children] })),
      renames: { ...renames },
    }]);
  }, [wardrobeTierOverrides, wardrobeSortOverrides, groups, renames]);

  const persistWardrobeTierOverrides = useCallback((tiers: Record<string, CharacterTier>, sorts: Record<string, number>) => {
    pushWardrobeUndo();
    setWardrobeTierOverrides(tiers);
    setWardrobeSortOverrides(sorts);
    if (filmId) {
      localStorage.setItem(`wardrobe-tier-overrides-${filmId}`, JSON.stringify({ tierOverrides: tiers, sortOverrides: sorts }));
    }
  }, [filmId, pushWardrobeUndo]);

  const prevSelectedItemRef = useRef<string | null>(null);
  // Script viewer — use global provider
  const { openScriptViewer, setScriptViewerScenes, setScriptViewerLoading } = useScriptViewer();

  // Fetch wardrobe scene counts from DB
  const fetchWardrobeSceneCounts = useCallback(async () => {
    if (storagePrefix !== "wardrobe" || !filmId) return;
    const { data } = await supabase
      .from("wardrobe_scene_assignments")
      .select("character_name, scene_number")
      .eq("film_id", filmId);
    if (!data) return;
    const counts = new Map<string, number>();
    const charScenes = new Map<string, Set<number>>();
    for (const row of data) {
      const key = (row.character_name as string).toUpperCase();
      if (!charScenes.has(key)) charScenes.set(key, new Set());
      charScenes.get(key)!.add(row.scene_number as number);
    }
    for (const [char, scenes] of charScenes) {
      counts.set(char, scenes.size);
    }
    setWardrobeSceneCounts(counts);
  }, [storagePrefix, filmId]);

  const handleWardrobeUndo = useCallback(() => {
    if (wardrobeUndoStack.length === 0) return;
    const prev = wardrobeUndoStack[wardrobeUndoStack.length - 1];
    setWardrobeUndoStack(s => s.slice(0, -1));
    setWardrobeTierOverrides(prev.tierOverrides);
    setWardrobeSortOverrides(prev.sortOverrides);
    if (filmId) {
      localStorage.setItem(`wardrobe-tier-overrides-${filmId}`, JSON.stringify({ tierOverrides: prev.tierOverrides, sortOverrides: prev.sortOverrides }));
    }
    if (prev.groups) {
      setGroups(prev.groups);
      if (filmId) saveJson(storagePrefix, filmId, "groups", prev.groups);
    }
    if (prev.renames) {
      setRenames(prev.renames);
      if (filmId) saveJson(storagePrefix, filmId, "renames", prev.renames);
    }
    if (prev.groups && filmId && storagePrefix === "wardrobe") {
      (async () => {
        for (const g of prev.groups!) {
          for (const item of g.children) {
            const cleanName = ((prev.renames?.[item]) || item).replace(/\s*\([^)]+\)\s*$/, "").trim();
            await supabase
              .from("wardrobe_scene_assignments")
              .update({ character_name: g.name })
              .eq("film_id", filmId)
              .eq("clothing_item", cleanName);
          }
        }
        fetchWardrobeSceneCounts();
      })();
    }
    toast.success("Undone");
  }, [wardrobeUndoStack, filmId, storagePrefix, fetchWardrobeSceneCounts]);

  // Ctrl+Z keyboard shortcut for wardrobe undo
  useEffect(() => {
    if (storagePrefix !== "wardrobe") return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey && wardrobeUndoStack.length > 0) {
        e.preventDefault();
        handleWardrobeUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [storagePrefix, handleWardrobeUndo, wardrobeUndoStack.length]);

  useEffect(() => {
    fetchWardrobeSceneCounts();
  }, [fetchWardrobeSceneCounts]);

  // Load persisted state — seed from initialGroups if no localStorage groups exist
  // For wardrobe: reconcile group membership from DB (wardrobe_scene_assignments) to survive localStorage clears
  useEffect(() => {
    if (!filmId) return;

    const loadState = async () => {
      const savedGroups = loadJson<ItemGroup[]>(storagePrefix, filmId, "groups", []);
      let loadedGroups: ItemGroup[];
      if (savedGroups.length > 0) {
        loadedGroups = savedGroups;
      } else if (initialGroups && initialGroups.length > 0) {
        loadedGroups = initialGroups;
        saveJson(storagePrefix, filmId, "groups", initialGroups);
      } else {
        loadedGroups = [];
      }

      // Migration: strip "(character)" suffixes from wardrobe item keys in persisted data
      if (storagePrefix === "wardrobe") {
        const charSuffixRegex = /\s*\([^)]+\)\s*$/;
        let migrated = false;
        const keyMap = new Map<string, string>(); // old key -> new key

        const migrateChildren = (children: string[]) => {
          return children.map((c) => {
            if (charSuffixRegex.test(c)) {
              const cleaned = c.replace(charSuffixRegex, "").trim();
              keyMap.set(c, cleaned);
              migrated = true;
              return cleaned;
            }
            return c;
          });
        };

        loadedGroups = loadedGroups.map((g) => ({ ...g, children: migrateChildren(g.children) }));

        if (migrated) {
          saveJson(storagePrefix, filmId, "groups", loadedGroups);
          const savedRenames = loadJson<Record<string, string>>(storagePrefix, filmId, "renames", {});
          const savedRefImages = loadJson<Record<string, string>>(storagePrefix, filmId, "refImages", {});
          const savedRefDescs = loadJson<Record<string, string>>(storagePrefix, filmId, "refDescs", {});
          const migrateRecord = (rec: Record<string, string>) => {
            const next: Record<string, string> = {};
            for (const [k, v] of Object.entries(rec)) {
              next[keyMap.get(k) || k] = v;
            }
            return next;
          };
          saveJson(storagePrefix, filmId, "renames", migrateRecord(savedRenames));
          saveJson(storagePrefix, filmId, "refImages", migrateRecord(savedRefImages));
          saveJson(storagePrefix, filmId, "refDescs", migrateRecord(savedRefDescs));
          const savedMerged = loadJson<string[]>(storagePrefix, filmId, "merged", []);
          saveJson(storagePrefix, filmId, "merged", savedMerged.map((m) => keyMap.get(m) || m));
        }

        // Reconcile wardrobe groups from DB: move items to the character recorded in wardrobe_scene_assignments
        const { data: dbAssignments } = await supabase
          .from("wardrobe_scene_assignments")
          .select("clothing_item, character_name")
          .eq("film_id", filmId);

        if (dbAssignments && dbAssignments.length > 0) {
          // Build a map: clothing_item (lowercase) -> DB character_name (most frequent)
          const itemCharMap = new Map<string, string>();
          const itemCharCounts = new Map<string, Map<string, number>>();
          for (const row of dbAssignments) {
            const item = (row.clothing_item as string).toLowerCase().trim();
            const char = row.character_name as string;
            if (!itemCharCounts.has(item)) itemCharCounts.set(item, new Map());
            const counts = itemCharCounts.get(item)!;
            counts.set(char, (counts.get(char) || 0) + 1);
          }
          for (const [item, counts] of itemCharCounts) {
            let bestChar = "";
            let bestCount = 0;
            for (const [char, count] of counts) {
              if (count > bestCount) { bestChar = char; bestCount = count; }
            }
            if (bestChar) itemCharMap.set(item, bestChar);
          }

          // Move items between groups to match DB assignments
          let reconciled = false;
          const nextGroups = loadedGroups.map((g) => ({ ...g, children: [...g.children] }));

          for (const [itemLower, dbChar] of itemCharMap) {
            // Find which group currently has this item
            let currentGroup: typeof nextGroups[0] | null = null;
            let itemKey = "";
            for (const g of nextGroups) {
              const found = g.children.find((c) => c.toLowerCase().trim() === itemLower);
              if (found) { currentGroup = g; itemKey = found; break; }
            }
            if (!itemKey || !currentGroup) continue;
            // Check if item is already in the correct character group
            if (currentGroup.name.toUpperCase() === dbChar.toUpperCase()) continue;
            // Find or create the target group
            let targetGroup = nextGroups.find((g) => g.name.toUpperCase() === dbChar.toUpperCase());
            if (!targetGroup) {
              targetGroup = {
                id: `wardrobe-char-${dbChar.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
                name: dbChar,
                children: [],
              };
              nextGroups.push(targetGroup);
            }
            // Move item
            currentGroup.children = currentGroup.children.filter((c) => c !== itemKey);
            if (!targetGroup.children.includes(itemKey)) {
              targetGroup.children.push(itemKey);
            }
            reconciled = true;
          }

          if (reconciled) {
            loadedGroups = nextGroups;
            saveJson(storagePrefix, filmId, "groups", loadedGroups);
          }
        }
      }

      // Wardrobe: ensure every character group has a "Default Wardrobe" as first child
      if (storagePrefix === "wardrobe") {
        let defaultAdded = false;
        const DEFAULT_WARDROBE = "Default Wardrobe";
        for (const g of loadedGroups) {
          const hasDefault = g.children.some((c) => c === DEFAULT_WARDROBE);
          if (!hasDefault && g.children.length >= 0) {
            g.children = [DEFAULT_WARDROBE, ...g.children.filter((c) => c !== DEFAULT_WARDROBE)];
            defaultAdded = true;
          }
        }
        if (defaultAdded) {
          saveJson(storagePrefix, filmId, "groups", loadedGroups);
        }
      }

      setGroups(loadedGroups);
      setCollapsed(new Set(loadedGroups.map((g) => g.id)));
      setMergedAway(new Set(loadJson<string[]>(storagePrefix, filmId, "merged", [])));
      setRenames(loadJson(storagePrefix, filmId, "renames", {}));
      setRefImages(loadJson(storagePrefix, filmId, "refImages", {}));
      setRefDescriptions(loadJson(storagePrefix, filmId, "refDescs", {}));
    };

    loadState();
  }, [filmId, storagePrefix, initialGroups]);

  const persistGroups = useCallback((next: ItemGroup[]) => {
    setGroups(next);
    if (filmId) saveJson(storagePrefix, filmId, "groups", next);
  }, [filmId, storagePrefix]);

  const persistMerged = useCallback((next: Set<string>) => {
    setMergedAway(next);
    if (filmId) saveJson(storagePrefix, filmId, "merged", [...next]);
  }, [filmId, storagePrefix]);

  const persistRenames = useCallback((next: Record<string, string>) => {
    setRenames(next);
    if (filmId) saveJson(storagePrefix, filmId, "renames", next);
  }, [filmId, storagePrefix]);

  const persistRefImages = useCallback((next: Record<string, string>) => {
    setRefImages(next);
    if (filmId) saveJson(storagePrefix, filmId, "refImages", next);
  }, [filmId, storagePrefix]);

  const persistRefDescs = useCallback((next: Record<string, string>) => {
    setRefDescriptions(next);
    if (filmId) saveJson(storagePrefix, filmId, "refDescs", next);
  }, [filmId, storagePrefix]);

  // Visible items = items minus merged-away ones
  const visibleItems = useMemo(() => items.filter((i) => !mergedAway.has(i)), [items, mergedAway]);

  const query = searchQuery.toLowerCase().trim();

  const filteredVisibleItems = useMemo(() => {
    if (!query) return visibleItems;
    return visibleItems.filter((i) => {
      const name = (renames[i] || i).toLowerCase();
      return name.includes(query);
    });
  }, [visibleItems, query, renames]);

  const ungrouped = useMemo(() => {
    const grouped = new Set(groups.flatMap((g) => g.children));
    return filteredVisibleItems.filter((l) => !grouped.has(l));
  }, [filteredVisibleItems, groups]);

  // For wardrobe: auto-assign any ungrouped items into their character groups
  useEffect(() => {
    if (storagePrefix !== "wardrobe" || !subtitles || ungrouped.length === 0) return;
    let updated = false;
    const nextGroups = groups.map((g) => ({ ...g, children: [...g.children] }));
    const newGroups: ItemGroup[] = [];
    for (const item of ungrouped) {
      const charName = subtitles[item];
      if (!charName) continue;
      const existingGroup = nextGroups.find((g) => g.name.toUpperCase() === charName.toUpperCase());
      if (existingGroup) {
        if (!existingGroup.children.includes(item)) {
          existingGroup.children.push(item);
          updated = true;
        }
      } else {
        // Create a new group for this character
        const newGroup = newGroups.find((g) => g.name.toUpperCase() === charName.toUpperCase());
        if (newGroup) {
          if (!newGroup.children.includes(item)) newGroup.children.push(item);
        } else {
          newGroups.push({
            id: `wardrobe-char-${charName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
            name: charName,
            children: [item],
          });
        }
        updated = true;
      }
    }
    if (updated) persistGroups([...nextGroups, ...newGroups]);
  }, [storagePrefix, subtitles, ungrouped, groups, persistGroups]);

  // Cleanup draft items when navigating away from them
  useEffect(() => {
    const prevItem = prevSelectedItemRef.current;
    prevSelectedItemRef.current = selectedItem;
    
    if (prevItem && draftItems.has(prevItem) && prevItem !== selectedItem) {
      // Check if this draft item has any locked film_asset
      if (filmId) {
        supabase
          .from("film_assets")
          .select("id")
          .eq("film_id", filmId)
          .eq("asset_type", "wardrobe")
          .eq("asset_name", prevItem)
          .eq("locked", true)
          .maybeSingle()
          .then(({ data }) => {
            if (!data) {
              // No locked asset — remove from groups and clean up assignments
              setDraftItems(prev => {
                const next = new Set(prev);
                next.delete(prevItem);
                return next;
              });
              persistGroups(groups.map((g) => ({
                ...g,
                children: g.children.filter((c) => c !== prevItem),
              })));
              // Clean up scene assignments for the draft
              supabase
                .from("wardrobe_scene_assignments")
                .delete()
                .eq("film_id", filmId)
                .eq("clothing_item", prevItem)
                .then(() => {});
            } else {
              // Has been saved — no longer a draft
              setDraftItems(prev => {
                const next = new Set(prev);
                next.delete(prevItem);
                return next;
              });
            }
          });
      }
    }
  }, [selectedItem, draftItems, filmId, groups, persistGroups]);

  const filteredGroups = useMemo(() => {
    if (!query) return groups;
    return groups.filter((g) => {
      if (g.name.toLowerCase().includes(query)) return true;
      return g.children.some((c) => (renames[c] || c).toLowerCase().includes(query));
    });
  }, [groups, query, renames]);

  // For wardrobe: sort groups by character ranking order
  const sortedFilteredGroups = useMemo(() => {
    if (storagePrefix !== "wardrobe" || !characterOrder || characterOrder.length === 0) return filteredGroups;
    return [...filteredGroups].sort((a, b) => {
      const aIdx = characterOrder.indexOf(a.name.toUpperCase());
      const bIdx = characterOrder.indexOf(b.name.toUpperCase());
      const aPos = aIdx === -1 ? 9999 : aIdx;
      const bPos = bIdx === -1 ? 9999 : bIdx;
      return aPos - bPos;
    });
  }, [filteredGroups, characterOrder, storagePrefix]);

  // Tier metadata for wardrobe sidebar grouping
  const TIER_META: Record<CharacterTier, { label: string; color: string }> = {
    LEAD: { label: "Lead", color: "bg-primary/15 text-primary border-primary/30" },
    STRONG_SUPPORT: { label: "Strong Support", color: "bg-primary/10 text-primary/80 border-primary/20" },
    FEATURE: { label: "Feature", color: "bg-primary/10 text-primary/70 border-primary/20" },
    UNDER_5: { label: "Under 5", color: "bg-primary/10 text-primary/60 border-primary/15" },
    BACKGROUND: { label: "Background", color: "bg-primary/5 text-primary/50 border-primary/10" },
  };
  const TIER_ORDER: CharacterTier[] = ["LEAD", "STRONG_SUPPORT", "FEATURE", "UNDER_5", "BACKGROUND"];

  // Use the script-based character rankings as the source of truth for tiers
  const getWardrobeTier = useCallback((charName: string, baseRankings: Map<string, CharacterTier>): CharacterTier => {
    return baseRankings.get(charName.toUpperCase()) ?? "BACKGROUND";
  }, []);

  // Build tier-grouped structure for wardrobe sidebar
  const tierGroupedData = useMemo(() => {
    if (storagePrefix !== "wardrobe" || !characterRankings || characterRankings.length === 0) return null;
    const baseRankingMap = new Map<string, CharacterTier>();
    for (const r of characterRankings) {
      baseRankingMap.set(r.nameNormalized, r.tier);
    }

    // Use wardrobe scene counts to determine effective tier
    const useWardrobeTiers = wardrobeSceneCounts.size > 0;

    const result: { tier: CharacterTier; groups: ItemGroup[] }[] = [];
    const TIER_ORDER_LOCAL: CharacterTier[] = ["LEAD", "STRONG_SUPPORT", "FEATURE", "UNDER_5", "BACKGROUND"];

    for (const tier of TIER_ORDER_LOCAL) {
      const tierGroups = sortedFilteredGroups.filter((g) => {
        // Manual override takes priority
        const manualTier = wardrobeTierOverrides[g.id];
        if (manualTier) return manualTier === tier;
        const effectiveTier = useWardrobeTiers
          ? getWardrobeTier(g.name, baseRankingMap)
          : (baseRankingMap.get(g.name.toUpperCase()) ?? "BACKGROUND");
        return effectiveTier === tier;
      });
      // Sort: manual sort overrides first, then by scene count
      tierGroups.sort((a, b) => {
        const sa = wardrobeSortOverrides[a.id];
        const sb = wardrobeSortOverrides[b.id];
        if (sa !== undefined && sb !== undefined) return sa - sb;
        if (sa !== undefined) return -1;
        if (sb !== undefined) return 1;
        const countA = wardrobeSceneCounts.get(a.name.toUpperCase()) ?? 0;
        const countB = wardrobeSceneCounts.get(b.name.toUpperCase()) ?? 0;
        return countB - countA;
      });
      if (tierGroups.length > 0) result.push({ tier, groups: tierGroups });
    }
    return result;
  }, [storagePrefix, characterRankings, sortedFilteredGroups, wardrobeSceneCounts, getWardrobeTier, wardrobeTierOverrides, wardrobeSortOverrides]);

  const displayName = useCallback((item: string) => {
    const raw = renames[item] || item;
    // Strip trailing character-name parentheticals e.g. "Jacket (howard)" -> "Jacket"
    const cleaned = raw.replace(/\s*\([^)]+\)\s*$/, "").trim();
    return toTitleCase(cleaned || raw);
  }, [renames]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const draggedItem = active.id as string;
    const targetId = over.id as string;

    // Wardrobe: character group dropped on a tier header
    if (targetId.startsWith("wardrobeTier:") && storagePrefix === "wardrobe") {
      const newTier = targetId.replace("wardrobeTier:", "") as CharacterTier;
      const draggedGroup = groups.find((g) => g.id === draggedItem);
      if (!draggedGroup) return;
      const newTierOverrides = { ...wardrobeTierOverrides, [draggedGroup.id]: newTier };
      // Reset sort for this group in new tier
      const newSortOverrides = { ...wardrobeSortOverrides };
      delete newSortOverrides[draggedGroup.id];
      persistWardrobeTierOverrides(newTierOverrides, newSortOverrides);
      setCollapsedTiers(prev => { const next = new Set(prev); next.delete(newTier); return next; });
      toast.success(`Moved "${toTitleCase(draggedGroup.name)}" to ${TIER_META[newTier]?.label || newTier}`);
      return;
    }

    // Wardrobe: character group dropped on another character group (reorder / cross-tier)
    if (storagePrefix === "wardrobe" && tierGroupedData) {
      const draggedGroup = groups.find((g) => g.id === draggedItem);
      const targetGroup = groups.find((g) => g.id === targetId);
      if (draggedGroup && targetGroup && draggedGroup.id !== targetGroup.id) {
        // Determine target's tier
        const getGroupTier = (g: ItemGroup): CharacterTier => {
          if (wardrobeTierOverrides[g.id]) return wardrobeTierOverrides[g.id];
          if (characterRankings) {
            const r = characterRankings.find(r => r.nameNormalized === g.name.toUpperCase());
            if (r) return r.tier;
          }
          return "BACKGROUND";
        };
        const targetTier = getGroupTier(targetGroup);
        const sourceTier = getGroupTier(draggedGroup);

        // Find target's tier group
        const targetTierData = tierGroupedData.find(t => t.tier === targetTier);
        if (targetTierData) {
          const targetIdx = targetTierData.groups.findIndex(g => g.id === targetGroup.id);
          const tierChars = [...targetTierData.groups];

          if (sourceTier !== targetTier) {
            // Remove from old position if present
            const oldIdx = tierChars.findIndex(g => g.id === draggedGroup.id);
            if (oldIdx >= 0) tierChars.splice(oldIdx, 1);
            tierChars.splice(targetIdx, 0, draggedGroup);
          } else {
            const fromIdx = tierChars.findIndex(g => g.id === draggedGroup.id);
            if (fromIdx >= 0) {
              tierChars.splice(fromIdx, 1);
              tierChars.splice(targetIdx, 0, draggedGroup);
            }
          }

          const newSortOverrides = { ...wardrobeSortOverrides };
          tierChars.forEach((g, i) => { newSortOverrides[g.id] = i; });

          const newTierOverrides = { ...wardrobeTierOverrides };
          if (sourceTier !== targetTier) {
            newTierOverrides[draggedGroup.id] = targetTier;
            setCollapsedTiers(prev => { const next = new Set(prev); next.delete(targetTier); return next; });
          }

          persistWardrobeTierOverrides(newTierOverrides, newSortOverrides);
          return;
        }
      }
    }

    if (targetId.startsWith("group::")) {
      if (storagePrefix === "wardrobe") pushWardrobeUndo();
      const groupId = targetId.replace("group::", "");
      const targetGroup = groups.find((g) => g.id === groupId);

      // Collect all items to move: multi-selected (if dragged item is part of selection) or just the one
      const itemsToMove = multiSelected.size >= 2 && multiSelected.has(draggedItem)
        ? [...multiSelected]
        : [draggedItem];

      let updatedRenames = { ...renames };
      for (const item of itemsToMove) {
        const sourceGroup = groups.find((g) => g.children.includes(item));
        if (storagePrefix === "wardrobe" && sourceGroup && targetGroup && sourceGroup.id !== targetGroup.id) {
          const sourceName = sourceGroup.name;
          const currentDisplay = updatedRenames[item] || item;
          if (!currentDisplay.toLowerCase().includes(`(${sourceName.toLowerCase()})`)) {
            updatedRenames[item] = `${currentDisplay} (${sourceName})`;
          }
        }
      }
      if (Object.keys(updatedRenames).length !== Object.keys(renames).length ||
          Object.entries(updatedRenames).some(([k, v]) => renames[k] !== v)) {
        persistRenames(updatedRenames);
      }

      const next = groups.map((g) => {
        const cleaned = { ...g, children: g.children.filter((c) => !itemsToMove.includes(c)) };
        if (cleaned.id === groupId) {
          const toAdd = itemsToMove.filter((i) => !cleaned.children.includes(i));
          return { ...cleaned, children: [...cleaned.children, ...toAdd] };
        }
        return cleaned;
      });
      persistGroups(next);
      toast.success(itemsToMove.length > 1 ? `Moved ${itemsToMove.length} items` : "Moved to group");
      setMultiSelected(new Set());

      // Update wardrobe_scene_assignments character_name in DB and refresh counts
      if (storagePrefix === "wardrobe" && filmId && targetGroup) {
        (async () => {
          for (const item of itemsToMove) {
            const cleanName = (updatedRenames[item] || item).replace(/\s*\([^)]+\)\s*$/, "").trim();
            await supabase
              .from("wardrobe_scene_assignments")
              .update({ character_name: targetGroup.name })
              .eq("film_id", filmId)
              .eq("clothing_item", cleanName);
          }
          fetchWardrobeSceneCounts();
        })();
      }
      return;
    }
    if (ungrouped.includes(targetId) && ungrouped.includes(draggedItem)) {
      setMergeDialog({ source: draggedItem, target: targetId });
      return;
    }
  };

  const handleMerge = useCallback(() => {
    if (!mergeDialog) return;
    const next = new Set(mergedAway);
    next.add(mergeDialog.source);
    persistMerged(next);
    persistGroups(groups.map((g) => ({ ...g, children: g.children.filter((c) => c !== mergeDialog.source) })));
    toast.success(`Merged "${displayName(mergeDialog.source)}" into "${displayName(mergeDialog.target)}"`);
    setMergeDialog(null);
  }, [mergeDialog, mergedAway, persistMerged, groups, persistGroups, displayName]);

  const handleRenameItem = useCallback(async (itemId: string) => {
    if (!editName.trim()) return;
    const newName = editName.trim();
    const oldDisplayName = renames[itemId] || itemId;
    persistRenames({ ...renames, [itemId]: newName });
    setEditingItemId(null);
    setEditName("");

    // For wardrobe items, propagate rename to film_assets and wardrobe_scene_assignments
    if (storagePrefix === "wardrobe" && filmId) {
      const cleanOld = oldDisplayName.replace(/\s*\([^)]+\)\s*$/, "").trim();
      // Update film_assets
      const { data: matchingAssets } = await supabase
        .from("film_assets")
        .select("id, asset_name")
        .eq("film_id", filmId)
        .eq("asset_type", "wardrobe");
      if (matchingAssets) {
        for (const asset of matchingAssets) {
          if (asset.asset_name.toLowerCase() === cleanOld.toLowerCase() ||
              asset.asset_name.toLowerCase() === itemId.toLowerCase()) {
            await supabase.from("film_assets").update({ asset_name: newName }).eq("id", asset.id);
          }
        }
      }
      // Update wardrobe_scene_assignments
      await supabase
        .from("wardrobe_scene_assignments" as any)
        .update({ clothing_item: newName } as any)
        .eq("film_id", filmId)
        .or(`clothing_item.eq.${cleanOld},clothing_item.eq.${itemId}`);
    }

    toast.success("Renamed");
  }, [editName, renames, persistRenames, storagePrefix, filmId]);

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    persistGroups([...groups, { id: crypto.randomUUID(), name: newGroupName.trim(), children: [] }]);
    setNewGroupName("");
    setCreatingGroup(false);
  };

  const handleDeleteGroup = (groupId: string) => {
    persistGroups(groups.filter((g) => g.id !== groupId));
    toast.success("Group removed");
  };

  const handleRemoveFromGroup = (groupId: string, item: string) => {
    persistGroups(groups.map((g) => g.id === groupId ? { ...g, children: g.children.filter((c) => c !== item) } : g));
  };

  const handleRenameGroup = (groupId: string) => {
    if (!editName.trim()) return;
    persistGroups(groups.map((g) => (g.id === groupId ? { ...g, name: editName.trim() } : g)));
    setEditingGroupId(null);
    setEditName("");
  };

  const handleUnmerge = useCallback((item: string) => {
    const next = new Set(mergedAway);
    next.delete(item);
    persistMerged(next);
    toast.success(`"${displayName(item)}" restored`);
  }, [mergedAway, persistMerged, displayName]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleUploadReference = useCallback(async (itemId: string, file: File) => {
    if (!filmId) return;
    const ext = file.name.split(".").pop() || "jpg";
    const safeName = itemId.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const path = `${filmId}/${storagePrefix}/${safeName}-ref.${ext}`;
    setAnalyzingItem(itemId);
    const { error: uploadErr } = await supabase.storage.from("character-assets").upload(path, file, { upsert: true });
    if (uploadErr) { toast.error("Upload failed"); setAnalyzingItem(null); return; }
    const { data: urlData } = supabase.storage.from("character-assets").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    persistRefImages({ ...refImages, [itemId]: publicUrl });
    toast.success("Reference uploaded — analyzing…");
    const context = CONTEXT_MAP[storagePrefix] || "prop";
    try {
      const { data: analysisData, error: analysisErr } = await supabase.functions.invoke("analyze-reference-image", {
        body: { imageUrl: publicUrl, context },
      });
      if (analysisErr) throw analysisErr;
      if (analysisData?.description) {
        persistRefDescs({ ...refDescriptions, [itemId]: analysisData.description.trim() });
        toast.success("Reference analyzed");
      }
    } catch (err) {
      console.error("Reference analysis failed:", err);
      toast.error("Could not analyze reference image");
    } finally {
      setAnalyzingItem(null);
    }
  }, [filmId, storagePrefix, refImages, refDescriptions, persistRefImages, persistRefDescs]);

  /* ── Open script viewer for one or more items ── */
  const openScriptForItems = useCallback(async (itemNames: string[], dialogTitle: string, targetSceneNum?: number) => {
    if (!sceneBreakdown || sceneBreakdown.length === 0) {
      toast.error("No script analysis available");
      return;
    }

    // Find all matching scenes across all item names
    const allMatches = new Map<number, any>();
    for (const name of itemNames) {
      const matches = findScenesForItem(name, sceneBreakdown, storagePrefix, excludeFromKeyObjects);
      for (const m of matches) {
        const sn = m.scene.scene_number ? parseInt(m.scene.scene_number, 10) : m.sceneIndex + 1;
        if (targetSceneNum !== undefined && sn !== targetSceneNum) continue;
        if (!allMatches.has(m.sceneIndex)) allMatches.set(m.sceneIndex, m.scene);
      }
    }

    if (allMatches.size === 0) {
      toast.info("No scenes found referencing this item in the script breakdown");
      return;
    }

    const desc = `${allMatches.size} scene${allMatches.size !== 1 ? "s" : ""} referencing this item · highlighted in yellow`;
    openScriptViewer({ title: dialogTitle, description: desc, highlightTerms: itemNames });

    // Sort scenes by scene number
    const sortedScenes = [...allMatches.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, scene]) => scene);

    if (!storagePath) {
      setScriptViewerScenes(sortedScenes.map((scene: any) => ({
        sceneNum: scene.scene_number ? parseInt(scene.scene_number, 10) : 0,
        heading: scene.heading || scene.scene_heading || "Unknown",
        paragraphs: [
          { type: "Scene Heading", text: scene.heading || scene.scene_heading || "" },
          { type: "Action", text: scene.description || "" },
        ],
      })));
      return;
    }

    try {
      const { data, error } = await supabase.storage.from("scripts").download(storagePath);
      if (error || !data) throw error || new Error("Download failed");
      const full = await data.text();
      const isFdx = full.trimStart().startsWith("<?xml") || full.includes("<FinalDraft");

      const parsedScenes: { sceneNum: number; heading: string; paragraphs: { type: string; text: string }[] }[] = [];

      for (const scene of sortedScenes) {
        const heading = (scene.heading || scene.scene_heading || "").trim();
        const sceneNum = scene.scene_number ? parseInt(scene.scene_number, 10) : 0;

        if (isFdx) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(full, "text/xml");
          const paragraphs = Array.from(doc.querySelectorAll("Paragraph"));
          let startIdx = -1, endIdx = paragraphs.length;
          for (let i = 0; i < paragraphs.length; i++) {
            const p = paragraphs[i];
            const pType = p.getAttribute("Type") || "";
            const texts = Array.from(p.querySelectorAll("Text"));
            const content = texts.map((t) => t.textContent || "").join("").trim();
            if (pType === "Scene Heading") {
              if (startIdx === -1 && heading && content.toUpperCase().includes(heading.toUpperCase())) {
                startIdx = i;
              } else if (startIdx !== -1) { endIdx = i; break; }
            }
          }
          if (startIdx === -1) continue;
          const result: { type: string; text: string }[] = [];
          for (let i = startIdx; i < endIdx; i++) {
            const p = paragraphs[i];
            const pType = p.getAttribute("Type") || "Action";
            const texts = Array.from(p.querySelectorAll("Text"));
            const content = texts.map((t) => t.textContent || "").join("");
            if (content.trim()) result.push({ type: pType, text: content });
          }
          parsedScenes.push({ sceneNum, heading: heading || "Unknown", paragraphs: result });
        } else {
          if (!heading) continue;
          const parsed = parseSceneFromPlainText(full, heading);
          parsedScenes.push({ sceneNum, heading: heading || "Unknown", paragraphs: parsed });
        }
      }

      setScriptViewerScenes(parsedScenes);
    } catch {
      toast.error("Could not load script file");
      setScriptViewerScenes(sortedScenes.map((scene: any) => ({
        sceneNum: scene.scene_number ? parseInt(scene.scene_number, 10) : 0,
        heading: scene.heading || scene.scene_heading || "Unknown",
        paragraphs: [
          { type: "Scene Heading", text: scene.heading || scene.scene_heading || "" },
          { type: "Action", text: scene.description || "[Could not load script file]" },
        ],
      })));
    }
  }, [sceneBreakdown, storagePath, storagePrefix, openScriptViewer, setScriptViewerScenes]);

  const handleItemClick = useCallback((itemName: string) => {
    if (expandableSubtitles && subtitles?.[itemName]) {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        next.has(itemName) ? next.delete(itemName) : next.add(itemName);
        return next;
      });
      return;
    }
    openScriptForItems([itemName], displayName(itemName));
  }, [expandableSubtitles, subtitles, openScriptForItems, displayName]);

  const handleGroupClick = useCallback((group: ItemGroup) => {
    if (group.children.length === 0) return;
    openScriptForItems(group.children, group.name);
  }, [openScriptForItems]);

  const mergedCount = mergedAway.size;

  // Map storagePrefix to assetType for the detail panel
  const assetTypeMap: Record<string, "location" | "prop" | "wardrobe" | "vehicle"> = {
    locations: "location",
    props: "prop",
    wardrobe: "wardrobe",
    vehicles: "vehicle",
  };
  const detailAssetType = assetTypeMap[storagePrefix] || "prop";

  // Compute scene numbers for selected item
  const selectedSceneNumbers = useMemo(() => {
    if (!selectedItem || !sceneBreakdown) return [];
    const matches = findScenesForItem(selectedItem, sceneBreakdown, storagePrefix, excludeFromKeyObjects);
    return matches.map((m) => {
      const sn = m.scene.scene_number ? parseInt(m.scene.scene_number, 10) : m.sceneIndex + 1;
      return sn;
    }).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
  }, [selectedItem, sceneBreakdown, storagePrefix]);

  // When an item is clicked in the sidebar, select it for the detail panel
  const handleSelectItem = useCallback((itemName: string, e?: React.MouseEvent) => {
    if (e && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setMultiSelected(prev => {
        const next = new Set(prev);
        if (next.has(itemName)) next.delete(itemName); else next.add(itemName);
        return next;
      });
      return;
    }
    setMultiSelected(new Set());
    setSelectedGroup(null);
    setSelectedItem((prev) => prev === itemName ? null : itemName);
  }, []);

  // When a group header is clicked in wardrobe mode, show character-level view
  const handleSelectGroup = useCallback((groupName: string) => {
    if (storagePrefix !== "wardrobe") return;
    setSelectedItem(null);
    setMultiSelected(new Set());
    setSelectedGroup((prev) => prev === groupName ? null : groupName);
  }, [storagePrefix]);

  const handleMultiMerge = useCallback(() => {
    if (!multiMergeDialog || multiMergeDialog.length < 2) return;
    const [, ...rest] = multiMergeDialog;
    const next = new Set(mergedAway);
    for (const item of rest) next.add(item);
    persistMerged(next);
    persistGroups(groups.map((g) => ({ ...g, children: g.children.filter((c) => !rest.includes(c)) })));
    toast.success(`${rest.length} items merged`);
    setMultiSelected(new Set());
    setMultiMergeDialog(null);
  }, [multiMergeDialog, mergedAway, persistMerged, groups, persistGroups]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-center">
        <div className="space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
            <Icon className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  /* ── Highlight helper ── */
  const highlightTerms = (text: string, terms: string[]) => {
    if (terms.length === 0) return text;
    // Build patterns: use full terms first, then extract significant individual words (4+ chars)
    const allPatterns: string[] = [];
    for (const t of terms) {
      // Strip parenthetical counts like "(2)" and trim
      const clean = t.replace(/\s*\([\d]+\)\s*/g, "").trim();
      if (clean) allPatterns.push(clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      // Also add significant individual words from multi-word terms
      const words = clean.split(/[\s,\-–—]+/).filter(w => w.length >= 4);
      for (const w of words) {
        const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!allPatterns.includes(escaped)) allPatterns.push(escaped);
      }
    }
    if (allPatterns.length === 0) return text;
    // Sort longest first so full phrases match before individual words
    allPatterns.sort((a, b) => b.length - a.length);
    const re = new RegExp(`(${allPatterns.join("|")})`, "gi");
    const parts = text.split(re);
    if (parts.length === 1) return text;
    return parts.map((part, j) =>
      re.test(part) ? <mark key={j} style={{ backgroundColor: "#facc15", color: "black", padding: "0 2px", borderRadius: 2 }}>{part}</mark> : part
    );
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ═══ LEFT SIDEBAR — Item List ═══ */}
      <ResizableSidebar defaultWidth={380} minWidth={220} maxWidthPercent={30}>
        <div className="px-4 py-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {visibleItems.length} items{mergedCount > 0 ? ` · ${mergedCount} merged` : ""} · drag to merge
              </p>
            </div>
            <div className="flex items-center gap-1">
              {storagePrefix === "wardrobe" && wardrobeUndoStack.length > 0 && (
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 text-muted-foreground" onClick={handleWardrobeUndo} title="Undo last move">
                  <Undo2 className="h-3 w-3" /> Undo
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setCreatingGroup(true)}>
                <Plus className="h-3 w-3" /> Group
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}…`}
              className="h-8 text-sm pl-8 bg-background"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="py-1">
              {creatingGroup && (
                <div className="flex items-center gap-2 mx-3 mt-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
                  <Input autoFocus value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()} placeholder="Group name…" className="h-7 text-xs bg-background" />
                  <Button size="sm" onClick={handleCreateGroup} className="h-7 text-xs shrink-0">Create</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCreatingGroup(false)} className="h-7 shrink-0 px-1.5"><X className="h-3.5 w-3.5" /></Button>
                </div>
              )}

              {/* Groups — with tier headers for wardrobe */}
              {tierGroupedData ? (
                <>
                {tierGroupedData.map(({ tier, groups: tierGroups }) => {
                  const isTierCollapsed = collapsedTiers.has(tier);
                  return (
                  <WardrobeTierDropZone key={tier} tier={tier}>
                    <div
                      className="flex items-center gap-2 px-4 pt-3 pb-1 cursor-pointer hover:bg-secondary/30 transition-colors"
                      onClick={() => setCollapsedTiers(prev => {
                        const next = new Set(prev);
                        next.has(tier) ? next.delete(tier) : next.add(tier);
                        return next;
                      })}
                    >
                      {isTierCollapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-display font-bold uppercase tracking-widest border",
                        TIER_META[tier].color
                      )}>
                        {TIER_META[tier].label}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40">{tierGroups.length}</span>
                      <div className="flex-1 border-t border-border/30 ml-1" />
                    </div>
                    {!isTierCollapsed && tierGroups.map((group) => (
                      <DraggableWardrobeGroup key={group.id} groupId={group.id}>
                        <SidebarGroup
                          group={group}
                          icon={Icon}
                          isCollapsed={collapsed.has(group.id)}
                          onToggle={() => toggleCollapse(group.id)}
                          onDelete={() => handleDeleteGroup(group.id)}
                          onRemoveChild={(item) => handleRemoveFromGroup(group.id, item)}
                          isEditing={editingGroupId === group.id}
                          editName={editName}
                          onStartEdit={() => { setEditingGroupId(group.id); setEditingItemId(null); setEditName(group.name); }}
                          onEditChange={setEditName}
                          onSaveEdit={() => handleRenameGroup(group.id)}
                          displayName={displayName}
                          selectedItem={selectedItem}
                          onSelectItem={handleSelectItem}
                          refImages={refImages}
                          multiSelected={multiSelected}
                          onMultiMerge={(ids) => setMultiMergeDialog(ids)}
                          isGroupSelected={selectedGroup === group.name}
                          onGroupNameClick={storagePrefix === "wardrobe" ? () => handleSelectGroup(group.name) : undefined}
                          childrenDraggable={storagePrefix === "wardrobe"}
                        />
                      </DraggableWardrobeGroup>
                    ))}
                  </WardrobeTierDropZone>
                  );
                })}
                {activeId && TIER_ORDER.filter(t => !tierGroupedData.some(g => g.tier === t)).map(tier => (
                  <WardrobeTierDropZone key={`empty-${tier}`} tier={tier}>
                    <div className="flex items-center gap-2 px-4 pt-3 pb-1 opacity-50">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-display font-bold uppercase tracking-widest border",
                        TIER_META[tier].color
                      )}>
                        {TIER_META[tier].label}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">Drop here</span>
                    </div>
                  </WardrobeTierDropZone>
                ))}
                </>
              ) : (
                sortedFilteredGroups.map((group) => (
                  <SidebarGroup
                    key={group.id}
                    group={group}
                    icon={Icon}
                    isCollapsed={collapsed.has(group.id)}
                    onToggle={() => toggleCollapse(group.id)}
                    onDelete={() => handleDeleteGroup(group.id)}
                    onRemoveChild={(item) => handleRemoveFromGroup(group.id, item)}
                    isEditing={editingGroupId === group.id}
                    editName={editName}
                    onStartEdit={() => { setEditingGroupId(group.id); setEditingItemId(null); setEditName(group.name); }}
                    onEditChange={setEditName}
                    onSaveEdit={() => handleRenameGroup(group.id)}
                    displayName={displayName}
                    selectedItem={selectedItem}
                    onSelectItem={handleSelectItem}
                    refImages={refImages}
                    multiSelected={multiSelected}
                    onMultiMerge={(ids) => setMultiMergeDialog(ids)}
                    isGroupSelected={selectedGroup === group.name}
                    onGroupNameClick={storagePrefix === "wardrobe" ? () => handleSelectGroup(group.name) : undefined}
                  />
                ))
              )}

              {/* Ungrouped — hidden for wardrobe since items auto-assign to character groups */}
              {ungrouped.length > 0 && storagePrefix !== "wardrobe" && (
                <div className="px-2 py-1">
                  <div className="flex items-center gap-2 px-2 py-2">
                    <h3 className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {sortedFilteredGroups.length > 0 ? "Ungrouped" : `All ${title}`}
                    </h3>
                    <span className="text-[10px] text-muted-foreground/50">{ungrouped.length}</span>
                    <div className="flex-1 border-t border-border/30 ml-1" />
                  </div>
                  {ungrouped.map((item) => (
                    <ContextMenu key={item}>
                      <ContextMenuTrigger asChild>
                        <div>
                          <SidebarItem
                            id={item}
                            label={displayName(item)}
                            icon={Icon}
                            isSelected={selectedItem === item}
                            isMultiSelected={multiSelected.has(item)}
                            onSelect={(e) => handleSelectItem(item, e)}
                            refImageUrl={refImages[item]}
                            reclassifyOptions={reclassifyOptions}
                            onReclassify={onReclassify}
                          />
                        </div>
                      </ContextMenuTrigger>
                      {multiSelected.size >= 2 && multiSelected.has(item) && (
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => setMultiMergeDialog([...multiSelected])}
                            className="gap-2"
                          >
                            <Merge className="h-4 w-4" />
                            Merge {multiSelected.size} items
                          </ContextMenuItem>
                        </ContextMenuContent>
                      )}
                    </ContextMenu>
                  ))}
                </div>
              )}

              {/* Merged away */}
              {mergedCount > 0 && (
                <div className="px-2 py-1">
                  <div className="flex items-center gap-2 px-2 py-2">
                    <h3 className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Merged Away</h3>
                    <span className="text-[10px] text-muted-foreground/50">{mergedCount}</span>
                    <div className="flex-1 border-t border-border/30 ml-1" />
                  </div>
                  {[...mergedAway].filter((m) => items.includes(m)).map((item) => (
                    <div key={item} className="flex items-center gap-2 px-4 py-2 opacity-50">
                      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground truncate flex-1 line-through">{displayName(item)}</p>
                      <button onClick={() => handleUnmerge(item)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0" title="Restore">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DragOverlay>
              {activeId ? (
                <div className="rounded-lg border border-primary bg-card p-2 flex items-center gap-2 shadow-xl rotate-2 scale-105">
                  <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <p className="text-xs font-display font-semibold text-foreground truncate">{displayName(activeId)}</p>
                  {multiSelected.size >= 2 && multiSelected.has(activeId) && (
                    <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{multiSelected.size}</span>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </ScrollArea>
      </ResizableSidebar>

      {/* ═══ RIGHT — Detail Panel ═══ */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {selectedItem && filmId ? (
          <AssetDetailPanel
            itemName={selectedItem}
            displayName={displayName(selectedItem)}
            icon={Icon}
            filmId={filmId}
            assetType={detailAssetType}
            subtitle={subtitles?.[selectedItem]}
            refImageUrl={refImages[selectedItem]}
            refDescription={refDescriptions[selectedItem] || subtitles?.[selectedItem]}
            sceneNumbers={selectedSceneNumbers}
            onOpenScene={(sn) => openScriptForItems([selectedItem], `Scene ${sn} — ${displayName(selectedItem)}`, sn)}
            onUploadReference={(file) => handleUploadReference(selectedItem, file)}
            isAnalyzing={analyzingItem === selectedItem}
            onDescriptionChange={(desc) => persistRefDescs({ ...refDescriptions, [selectedItem]: desc })}
            allSceneNumbers={allSceneNumbers}
            sceneHeadings={sceneHeadings}
          />
        ) : selectedGroup && filmId && storagePrefix === "wardrobe" ? (
          (() => {
            const groupData = groups.find((g) => g.name === selectedGroup);
            const wardrobeItems = groupData?.children ?? [];
            // Find scenes where this character appears
            const charScenes = sceneBreakdown
              ? sceneBreakdown
                  .filter((s: any) => {
                    const chars = Array.isArray(s.characters) ? s.characters : [];
                    return chars.some((c: string) =>
                      c.toUpperCase().trim() === selectedGroup.toUpperCase().trim()
                    );
                  })
                  .map((s: any) => s.scene_number as number)
                  .filter((n: number) => !isNaN(n))
                  .sort((a: number, b: number) => a - b)
              : [];
            return (
              <WardrobeCharacterView
                characterName={selectedGroup}
                wardrobeItems={wardrobeItems}
                filmId={filmId}
                characterSceneNumbers={charScenes}
                sceneHeadings={sceneHeadings}
                displayName={displayName}
                onSelectItem={(item) => { setSelectedGroup(null); setSelectedItem(item); }}
                onCreateCostume={(sceneNumber) => {
                  // Generate a unique draft item name
                  const baseName = `New Costume`;
                  let draftName = baseName;
                  let counter = 1;
                  const existingNames = new Set(wardrobeItems.map(w => w.toLowerCase()));
                  while (existingNames.has(draftName.toLowerCase())) {
                    counter++;
                    draftName = `${baseName} ${counter}`;
                  }
                  // Add the draft item to this character's group
                  const nextGroups = groups.map((g) => {
                    if (g.name === selectedGroup) {
                      return { ...g, children: [...g.children, draftName] };
                    }
                    return g;
                  });
                  persistGroups(nextGroups);
                  // Track as draft
                  setDraftItems(prev => new Set([...prev, draftName]));
                  // Pre-assign the scene
                  supabase.from("wardrobe_scene_assignments").upsert({
                    film_id: filmId,
                    character_name: selectedGroup,
                    clothing_item: draftName,
                    scene_number: sceneNumber,
                  }).then(() => {});
                  // Navigate to the new item's detail panel
                  setSelectedGroup(null);
                  setSelectedItem(draftName);
                }}
              />
            );
          })()
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 h-full">
            <div className="text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                <Icon className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                {storagePrefix === "wardrobe"
                  ? "Click a character name to view their wardrobe overview, or select a specific costume for details."
                  : "Select an item from the list to view details, upload references, and generate visual options."}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Merge confirmation */}
      <AlertDialog open={!!mergeDialog} onOpenChange={(open) => !open && setMergeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Merge className="h-5 w-5 text-primary" /> Merge Items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge <span className="font-semibold text-foreground">"{mergeDialog && displayName(mergeDialog.source)}"</span> into{" "}
              <span className="font-semibold text-foreground">"{mergeDialog && displayName(mergeDialog.target)}"</span>.
              The duplicate will be hidden. You can restore it later from the "Merged Away" section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge}>Merge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Multi-merge confirmation */}
      <AlertDialog open={!!multiMergeDialog} onOpenChange={(open) => !open && setMultiMergeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Merge className="h-5 w-5 text-primary" /> Merge {multiMergeDialog?.length ?? 0} Items?</AlertDialogTitle>
            <AlertDialogDescription>
              The first selected item will be kept. The other {(multiMergeDialog?.length ?? 0) - 1} duplicate(s) will be hidden. You can restore them from the "Merged Away" section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMultiMerge}>Merge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Script viewer is now handled by global ScriptViewerProvider */}
    </div>
  );
};

/* ── Draggable item card with rename + reference upload ── */
const DraggableItem = ({
  id, label, icon: Icon, isOverlay, subtitle,
  refImageUrl, isAnalyzing, onUploadReference,
  isEditing, editName, onStartEdit, onEditChange, onSaveEdit, onCancelEdit,
  onClick, reclassifyOptions, onReclassify,
}: {
  id: string; label: string; icon: LucideIcon; isOverlay: boolean; subtitle?: string;
  refImageUrl?: string; isAnalyzing?: boolean; onUploadReference?: (file: File) => void;
  isEditing?: boolean; editName?: string;
  onStartEdit?: () => void; onEditChange?: (v: string) => void;
  onSaveEdit?: () => void; onCancelEdit?: () => void;
  onClick?: () => void;
  reclassifyOptions?: ReclassifyOption[];
  onReclassify?: (item: string, target: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id });
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div
      ref={(node) => { setNodeRef(node); if (!isOverlay) setDropRef(node); }}
      className={cn(
        "rounded-lg border bg-card p-3 flex flex-col gap-2 transition-all select-none",
        !isEditing && "cursor-grab active:cursor-grabbing",
        isOverlay && "shadow-xl ring-2 ring-primary/40 rotate-2 scale-105",
        isDragging && "opacity-30",
        isOver && !isDragging && "border-primary ring-2 ring-primary/20 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        {refImageUrl ? (
          <img src={refImageUrl} alt="" className="h-7 w-7 rounded object-cover border border-border shrink-0" />
        ) : (
          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
        )}
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <Input
              autoFocus
              value={editName}
              onChange={(e) => onEditChange?.(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit?.(); if (e.key === "Escape") onCancelEdit?.(); }}
              className="h-7 text-sm bg-background flex-1"
            />
            <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-7 px-1.5 shrink-0"><Check className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-7 px-1.5 shrink-0"><X className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1 cursor-pointer" onClick={onClick}>
              <p className="text-xs font-display font-semibold text-foreground truncate hover:text-primary transition-colors">{label}</p>
            </div>
            {onUploadReference && (
              <>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadReference(f); e.target.value = ""; }} />
                <button
                  onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                  className="shrink-0 text-muted-foreground/40 hover:text-primary transition-colors p-0.5"
                  title="Upload reference image"
                >
                  {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <Upload className="h-3 w-3" />}
                </button>
              </>
            )}
            {onStartEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
                className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"
                title="Rename"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {onClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                className="shrink-0 text-muted-foreground/40 hover:text-primary transition-colors p-0.5"
                title="View in script"
              >
                <ScrollText className="h-3 w-3" />
              </button>
            )}
            {reclassifyOptions && reclassifyOptions.length > 0 && onReclassify && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"
                    title="Move to another category"
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  {reclassifyOptions.map((opt) => {
                    const OptIcon = opt.icon;
                    return (
                      <DropdownMenuItem key={opt.value} onClick={() => onReclassify(id, opt.value)} className="gap-2 text-xs">
                        <OptIcon className="h-3.5 w-3.5" />
                        Move to {opt.label}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuItem onClick={() => onReclassify(id, "_dismiss")} className="gap-2 text-xs text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                    Not a prop (dismiss)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>
      {!isEditing && subtitle && (
        <p className="text-[10px] text-muted-foreground leading-relaxed pl-6 flex items-start gap-1">
          {refImageUrl && <Eye className="h-2.5 w-2.5 mt-0.5 shrink-0 text-primary/60" />}
          <span className="line-clamp-3">{subtitle}</span>
        </p>
      )}
      {isAnalyzing && (
        <p className="text-[10px] text-primary pl-6 flex items-center gap-1">
          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Analyzing reference…
        </p>
      )}
    </div>
  );
};

/* ── Sidebar Item (compact list row) ── */
const SidebarItem = ({
  id, label, icon: Icon, isSelected, isMultiSelected, onSelect, refImageUrl,
  reclassifyOptions, onReclassify,
}: {
  id: string; label: string; icon: LucideIcon; isSelected: boolean;
  isMultiSelected?: boolean;
  onSelect: (e?: React.MouseEvent) => void; refImageUrl?: string;
  reclassifyOptions?: ReclassifyOption[];
  onReclassify?: (item: string, target: string) => void;
}) => {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id });
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id });

  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node); }}
      className={cn(
        "w-full text-left px-4 py-2.5 flex items-center gap-2 transition-all border-l-2 cursor-pointer",
        isSelected ? "border-l-primary bg-primary/5" : "border-l-transparent hover:bg-secondary/60",
        isMultiSelected && "bg-primary/10 ring-1 ring-primary/30 border-l-primary",
        isOver && !isSelected && "bg-primary/10 border-l-primary ring-1 ring-primary/30"
      )}
      onClick={(e) => onSelect(e)}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors" onClick={(e) => e.stopPropagation()}>
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <div className="shrink-0">
        <div className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden",
          isSelected ? "bg-primary/20" : "bg-secondary"
        )}>
          {refImageUrl ? (
            <img src={refImageUrl} alt={label} className="h-full w-full object-cover" />
          ) : (
            <Icon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-display font-semibold truncate", isSelected ? "text-primary" : "text-foreground")}>
          {label}
        </p>
      </div>
      {reclassifyOptions && reclassifyOptions.length > 0 && onReclassify && (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5">
                <ArrowRightLeft className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              {reclassifyOptions.map((opt) => {
                const OptIcon = opt.icon;
                return (
                  <DropdownMenuItem key={opt.value} onClick={() => onReclassify(id, opt.value)} className="gap-2 text-xs">
                    <OptIcon className="h-3.5 w-3.5" />
                    Move to {opt.label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuItem onClick={() => onReclassify(id, "_dismiss")} className="gap-2 text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                Not a prop (dismiss)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};

/* ── Wardrobe tier drop zone ── */
const WardrobeTierDropZone = ({ tier, children }: { tier: CharacterTier; children: React.ReactNode }) => {
  const { isOver, setNodeRef } = useDroppable({ id: `wardrobeTier:${tier}` });
  return (
    <div ref={setNodeRef} className={cn("transition-all", isOver && "bg-primary/10 ring-1 ring-primary/30 rounded")}>
      {children}
    </div>
  );
};

/* ── Draggable wardrobe character group wrapper ── */
const DraggableWardrobeGroup = ({ groupId, children }: { groupId: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: groupId });
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: groupId });
  return (
    <div
      ref={(node) => { setNodeRef(node); setDropRef(node); }}
      className={cn(
        "transition-all",
        isDragging && "opacity-30",
        isOver && !isDragging && "ring-1 ring-primary/30 rounded"
      )}
    >
      <div className="flex items-center">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 text-muted-foreground/30 hover:text-muted-foreground transition-colors pl-2 py-2">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
};

/* ── Draggable child row within a group ── */
function DraggableGroupChild({ id, icon: Icon, label, isSelected, isMultiSelected, onClick, onRemove, refImageUrl }: {
  id: string; icon: LucideIcon; label: string; isSelected: boolean;
  isMultiSelected: boolean; onClick: (e: React.MouseEvent) => void;
  onRemove: () => void; refImageUrl?: string;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setDragRef}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 cursor-pointer transition-all border-l-2",
        isSelected ? "border-l-primary bg-primary/5" : "border-l-transparent hover:bg-secondary/40",
        isMultiSelected && "bg-primary/10 ring-1 ring-primary/30 border-l-primary",
        isDragging && "opacity-30"
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors" onClick={(e) => e.stopPropagation()}>
        <GripVertical className="h-3 w-3" />
      </div>
      <div className="h-6 w-6 rounded overflow-hidden bg-secondary flex items-center justify-center shrink-0">
        {refImageUrl ? (
          <img src={refImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
      <p className={cn("text-xs font-display font-semibold truncate flex-1", isSelected ? "text-primary" : "text-foreground")}>{label}</p>
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-muted-foreground/40 hover:text-destructive p-0.5 shrink-0 opacity-0 group-hover:opacity-100">
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

/* ── Sidebar Group (collapsible) ── */
const SidebarGroup = ({
  group, icon: Icon, isCollapsed, onToggle, onDelete, onRemoveChild,
  isEditing, editName, onStartEdit, onEditChange, onSaveEdit,
  displayName, selectedItem, onSelectItem, refImages,
  multiSelected, onMultiMerge, isGroupSelected, onGroupNameClick,
  childrenDraggable,
}: {
  group: ItemGroup; icon: LucideIcon; isCollapsed: boolean; onToggle: () => void;
  onDelete: () => void; onRemoveChild: (item: string) => void;
  isEditing: boolean; editName: string;
  onStartEdit: () => void; onEditChange: (v: string) => void; onSaveEdit: () => void;
  displayName: (item: string) => string;
  selectedItem: string | null; onSelectItem: (name: string, e?: React.MouseEvent) => void;
  refImages: Record<string, string>;
  multiSelected?: Set<string>;
  onMultiMerge?: (ids: string[]) => void;
  isGroupSelected?: boolean;
  onGroupNameClick?: () => void;
  childrenDraggable?: boolean;
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: `group::${group.id}` });

  return (
    <div ref={setNodeRef} className={cn(
      "mx-2 my-1 rounded-xl border transition-all",
      isGroupSelected ? "border-primary ring-1 ring-primary/20 bg-primary/5" :
      isOver ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border bg-card/50"
    )}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5",
          onGroupNameClick && "cursor-pointer hover:bg-secondary/40 transition-colors"
        )}
        onClick={onGroupNameClick ? () => { onGroupNameClick(); if (isCollapsed) onToggle(); } : undefined}
      >
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <Input autoFocus value={editName} onChange={(e) => onEditChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); }} className="h-7 text-xs bg-background flex-1" />
            <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-7 px-1.5"><Check className="h-3 w-3" /></Button>
          </div>
        ) : (
          <>
            <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className={cn("font-display text-xs font-bold flex-1 truncate", isGroupSelected ? "text-primary" : "text-foreground")}>{toTitleCase(group.name)}</p>
            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{group.children.length}</span>
            <button onClick={(e) => { e.stopPropagation(); onStartEdit(); }} className="text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"><Pencil className="h-2.5 w-2.5" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-muted-foreground/40 hover:text-destructive transition-colors p-0.5"><X className="h-3 w-3" /></button>
          </>
        )}
      </div>
      {!isCollapsed && group.children.length > 0 && (
        <div className="pb-1">
          {group.children.map((item) => {
            const isMulti = multiSelected?.has(item);
            return (
              <ContextMenu key={item}>
                <ContextMenuTrigger asChild>
                  {childrenDraggable ? (
                    <DraggableGroupChild
                      id={item}
                      icon={Icon}
                      label={displayName(item)}
                      isSelected={selectedItem === item}
                      isMultiSelected={!!isMulti}
                      onClick={(e) => onSelectItem(item, e)}
                      onRemove={() => onRemoveChild(item)}
                      refImageUrl={refImages[item]}
                    />
                  ) : (
                  <div
                    onClick={(e) => onSelectItem(item, e)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2 cursor-pointer transition-all border-l-2",
                      selectedItem === item ? "border-l-primary bg-primary/5" : "border-l-transparent hover:bg-secondary/40",
                      isMulti && "bg-primary/10 ring-1 ring-primary/30 border-l-primary"
                    )}
                  >
                    <div className="h-6 w-6 rounded overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                      {refImages[item] ? (
                        <img src={refImages[item]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Icon className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className={cn("text-xs font-display font-semibold truncate flex-1", selectedItem === item ? "text-primary" : "text-foreground")}>{displayName(item)}</p>
                    <button onClick={(e) => { e.stopPropagation(); onRemoveChild(item); }} className="text-muted-foreground/40 hover:text-destructive p-0.5 shrink-0 opacity-0 group-hover:opacity-100">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  )}
                </ContextMenuTrigger>
                {multiSelected && multiSelected.size >= 2 && isMulti && onMultiMerge && (
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => onMultiMerge([...multiSelected])}
                      className="gap-2"
                    >
                      <Merge className="h-4 w-4" />
                      Merge {multiSelected.size} items
                    </ContextMenuItem>
                  </ContextMenuContent>
                )}
              </ContextMenu>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Old components kept for backwards compatibility with Locations tab ── */
const GroupDropZone = ({
  group, icon: Icon, isCollapsed, onToggle, onDelete, onRemoveChild,
  isEditing, editName, onStartEdit, onEditChange, onSaveEdit, subtitles, displayName,
  refImages, refDescriptions, analyzingItem, onUploadReference,
  onItemClick, onGroupClick, expandableSubtitles, expandedItems,
}: {
  group: ItemGroup; icon: LucideIcon; isCollapsed: boolean; onToggle: () => void;
  onDelete: () => void; onRemoveChild: (item: string) => void;
  isEditing: boolean; editName: string;
  onStartEdit: () => void; onEditChange: (v: string) => void; onSaveEdit: () => void;
  subtitles?: Record<string, string>; displayName: (item: string) => string;
  refImages: Record<string, string>; refDescriptions: Record<string, string>;
  analyzingItem: string | null;
  onUploadReference: (itemId: string, file: File) => void;
  onItemClick?: (itemName: string) => void;
  onGroupClick?: (group: ItemGroup) => void;
  expandableSubtitles?: boolean;
  expandedItems?: Set<string>;
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: `group::${group.id}` });

  return (
    <div ref={setNodeRef} className={cn(
      "rounded-xl border transition-all",
      isOver ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border bg-card/50"
    )}>
      <div className="flex items-center gap-2 p-3">
        <button onClick={onToggle} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              autoFocus value={editName} onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); }}
              className="h-7 text-sm bg-background flex-1"
            />
            <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-7 px-1.5"><Check className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <>
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <p className="font-display text-xs font-bold text-foreground flex-1 cursor-pointer hover:text-primary transition-colors" onClick={() => onGroupClick?.(group)}>{toTitleCase(group.name)}</p>
            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{group.children.length}</span>
            {onGroupClick && (
              <button onClick={(e) => { e.stopPropagation(); onGroupClick(group); }} className="text-muted-foreground/40 hover:text-primary transition-colors p-0.5" title="View all in script">
                <ScrollText className="h-3 w-3" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onStartEdit(); }} className="text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"><Pencil className="h-3 w-3" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-muted-foreground/40 hover:text-destructive transition-colors p-0.5"><X className="h-3.5 w-3.5" /></button>
          </>
        )}
      </div>
      {!isCollapsed && group.children.length > 0 && (
        <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {group.children.map((item) => (
            <div key={item} className="rounded-lg border border-border bg-card p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {refImages[item] ? (
                  <img src={refImages[item]} alt="" className="h-6 w-6 rounded object-cover border border-border shrink-0" />
                ) : (
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <p className="text-xs font-display font-semibold text-foreground truncate flex-1 cursor-pointer hover:text-primary transition-colors" onClick={() => onItemClick?.(item)}>{displayName(item)}</p>
                <button onClick={(e) => { e.stopPropagation(); onItemClick?.(item); }} className="text-muted-foreground/40 hover:text-primary transition-colors p-0.5" title="View in script">
                  <ScrollText className="h-2.5 w-2.5" />
                </button>
                <button onClick={() => onRemoveChild(item)} className="text-muted-foreground/40 hover:text-destructive p-0.5 shrink-0"><X className="h-3 w-3" /></button>
              </div>
              {(() => {
                const desc = refDescriptions[item] || subtitles?.[item];
                if (!desc) return null;
                if (expandableSubtitles && !expandedItems?.has(item)) return null;
                return <p className="text-[10px] text-muted-foreground pl-5 line-clamp-2">{desc}</p>;
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DnDGroupPane;
