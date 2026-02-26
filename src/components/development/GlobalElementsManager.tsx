import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  MapPin, Users, Shirt, Box, Paintbrush, Link2, Unlink, ChevronDown,
  ChevronRight, Check, Merge, Tag, X, Plus, AlertCircle, CheckCircle2, ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

/* ── Types ────────────────────────────────────────────────── */

export interface ElementGroup {
  id: string;
  parentName: string;
  variants: string[];
}

export interface CategoryData {
  ungrouped: string[];
  groups: ElementGroup[];
}

type CategoryKey = "locations" | "characters" | "wardrobe" | "props" | "visual_design";

interface CategoryMeta {
  key: CategoryKey;
  label: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryMeta[] = [
  { key: "characters", label: "Characters", icon: <Users className="h-4 w-4" /> },
  { key: "locations", label: "Locations", icon: <MapPin className="h-4 w-4" /> },
  { key: "wardrobe", label: "Wardrobe", icon: <Shirt className="h-4 w-4" /> },
  { key: "props", label: "Props", icon: <Box className="h-4 w-4" /> },
  { key: "visual_design", label: "Visual Design", icon: <Paintbrush className="h-4 w-4" /> },
];

/* ── Helpers ───────────────────────────────────────────────── */

function buildVisualDesignCategory(raw: any): CategoryData {
  const vd = raw?.visual_design;
  const groups: ElementGroup[] = [];
  const ungrouped: string[] = [];

  const VISUAL_CATEGORIES: { key: string; label: string }[] = [
    { key: "color_palette", label: "Color Palette" },
    { key: "lighting_language", label: "Lighting Language" },
    { key: "atmospheric_motifs", label: "Atmospheric Motifs" },
    { key: "symbolic_elements", label: "Symbolic Elements" },
  ];

  if (vd && typeof vd === "object") {
    for (const { key, label } of VISUAL_CATEGORIES) {
      const items: string[] = Array.isArray(vd[key]) ? vd[key].filter((s: any) => typeof s === "string" && s.trim()) : [];
      if (items.length > 0) {
        groups.push({ id: uid(), parentName: label, variants: items });
      }
    }
  }

  // Also pull scene-aggregated moods as a group if available
  const sceneMoods: string[] = Array.isArray(raw?.scene_moods) ? [...new Set(raw.scene_moods as string[])] : [];
  if (sceneMoods.length > 0) {
    groups.push({ id: uid(), parentName: "Scene Moods", variants: sceneMoods });
  }

  // Fallback: if no structured data, use legacy visual_motifs flat list
  if (groups.length === 0) {
    const motifs = raw?.visual_motifs;
    if (Array.isArray(motifs)) ungrouped.push(...motifs.filter((s: any) => typeof s === "string" && s.trim()));
  }

  return { ungrouped, groups };
}

function buildInitialData(raw: any, sceneLocations?: string[]): Record<CategoryKey, CategoryData> {
  const extract = (keys: string[]): string[] => {
    const items: string[] = [];
    for (const k of keys) {
      const val = raw?.[k];
      if (Array.isArray(val)) items.push(...val);
      else if (typeof val === "string" && val) items.push(val);
    }
    return [...new Set(items)];
  };

  const charNames = extract(["recurring_characters", "characters"]).map((c) => {
    // Strip descriptions: "JOHN - a middle-aged teacher" → "JOHN", "HOWARD WELLS (40s)" → "HOWARD WELLS"
    let name = c.replace(/\s*\(.*?\)\s*/g, "").replace(/\s*\([^)]*$/g, "").trim();
    const dashIdx = name.indexOf(" - ");
    const colonIdx = name.indexOf(": ");
    const commaIdx = name.indexOf(", ");
    const cutIdx = [dashIdx, colonIdx, commaIdx].filter((i) => i > 0).sort((a, b) => a - b)[0];
    return cutIdx ? name.substring(0, cutIdx).trim() : name.trim();
  });

  // Auto-group wardrobe by character name
  const wardrobeItems = extract(["recurring_wardrobe"]);
  const wardrobeGroups: ElementGroup[] = [];
  const wardrobeUngrouped: string[] = [];
  const wardrobeByChar = new Map<string, string[]>();

  for (const item of wardrobeItems) {
    const dashMatch = item.match(/^([A-Z][A-Za-z'\s]+?)\s*[-–—:]\s+(.+)$/);
    const possessiveMatch = item.match(/^([A-Z][A-Za-z'\s]+?)'s\s+(.+)$/i);
    const charName = dashMatch?.[1]?.trim() || possessiveMatch?.[1]?.trim().toUpperCase();
    if (charName && charName.length > 1) {
      const normalized = charName.toUpperCase();
      if (!wardrobeByChar.has(normalized)) wardrobeByChar.set(normalized, []);
      wardrobeByChar.get(normalized)!.push(item);
    } else {
      wardrobeUngrouped.push(item);
    }
  }
  for (const [charName, items] of wardrobeByChar) {
    if (items.length >= 1) {
      wardrobeGroups.push({ id: uid(), parentName: charName.charAt(0) + charName.slice(1).toLowerCase(), variants: items });
    } else {
      wardrobeUngrouped.push(...items);
    }
  }

  // ── Location processing ──────────────────────────────────
  const VEHICLE_PATTERNS = /^(?:CAR|HOWARD'S CAR|COP CAR|LARRY'S CAR|RACHEL'S CAR|CORVETTE|CARGO VAN.*|VAN|TRUCK|BUS|SUV|SEDAN|MOTORCYCLE|AMBULANCE|TAXI|LIMOUSINE|CONVERTIBLE)$/i;
  const VEHICLE_WORDS = /\b(car|truck|van|corvette|sedan|motorcycle|ambulance|taxi|limousine|convertible|suv)\b/i;

  const rawLocations = extract(["recurring_locations"]);
  // Also include locations from parsed scenes for better grouping coverage
  if (sceneLocations) {
    for (const sl of sceneLocations) {
      if (sl && !rawLocations.includes(sl)) rawLocations.push(sl);
    }
  }
  // Step 1: Split combined sluglines (separated by /)
  const splitLocations: string[] = [];
  for (const loc of rawLocations) {
    // Split on " / " but not on sub-location dashes like "WELLS' HOME - KITCHEN"
    const parts = loc.split(/\s*\/\s*/);
    for (const part of parts) {
      const cleaned = part
        .replace(/^(?:INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)\s*[-–—.\s]*/i, "")
        .replace(/\s*[-–—]\s*(?:DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|LATER|CONTINUOUS|MOMENTS LATER)\s*$/i, "")
        .trim();
      if (cleaned) splitLocations.push(cleaned);
    }
  }

  // Step 2: Normalize for deduplication
  const normalizeLocation = (name: string): string => {
    let n = name.toUpperCase().trim();
    // Normalize separators: ". " and "  " → " - "
    n = n.replace(/\.\s+/g, " - ").replace(/\s{2,}/g, " ");
    // Normalize possessives: ' and ' → '
    n = n.replace(/['']/g, "'");
    // WELLS' HOUSE → WELLS' HOME (normalize variant)
    n = n.replace(/\bHOUSE\b/g, "HOME");
    // UNIVERSITY LABORATORY → UNIVERSITY - LABORATORY, UNIVERSITY LAB → UNIVERSITY - LABORATORY
    n = n.replace(/\bLAB\b/g, "LABORATORY");
    // Normalize "UNIVERSITY LABORATORY" → "UNIVERSITY - LABORATORY" when no separator exists
    // but only if it's clearly a sub-location pattern
    return n;
  };

  // Deduplicate: keep the most descriptive version of each normalized form
  const locByNorm = new Map<string, string>();
  for (const loc of splitLocations) {
    const norm = normalizeLocation(loc);
    const existing = locByNorm.get(norm);
    if (!existing || loc.length > existing.length) {
      locByNorm.set(norm, loc);
    }
  }

  // Step 3: Filter out vehicles
  const dedupedLocations = [...locByNorm.values()].filter(loc => {
    const upper = loc.toUpperCase().trim();
    if (VEHICLE_PATTERNS.test(upper)) return false;
    // Filter entries that are purely a vehicle reference (e.g. "HOWARD'S CAR")
    // Check if the entire location is a vehicle (possessive + vehicle word)
    const stripped = upper.replace(/^[A-Z']+'S\s+/i, "").trim();
    if (VEHICLE_WORDS.test(stripped) && stripped.split(/\s+/).length <= 2) return false;
    if (VEHICLE_WORDS.test(upper) && upper.split(/\s+/).length <= 2) return false;
    return true;
  });

  // Step 4: Group by shared base location
  // Extract the base/root of a location: "WELLS' HOME - KITCHEN" → "WELLS' HOME"
  const getLocationBase = (name: string): string => {
    const upper = name.toUpperCase().replace(/['']/g, "'").replace(/\.\s+/g, " - ");
    // Normalize HOUSE→HOME
    const normalized = upper.replace(/\bHOUSE\b/g, "HOME");
    // Get base before first separator
    const sepMatch = normalized.match(/^(.+?)\s*[-–—]\s+/);
    if (sepMatch) return sepMatch[1].trim();
    // For multi-word locations, try to find a groupable root
    // e.g., "UNIVERSITY PARKING LOT" → check if "UNIVERSITY" is a base
    return normalized.trim();
  };

  // Build a map of base → locations
  const baseMap = new Map<string, string[]>();
  const COMMON_SUFFIXES_LOC = new Set(["ROOM", "HALLWAY", "CORRIDOR", "LOBBY", "ENTRANCE", "EXIT", "OFFICE", "FLOOR", "LOT", "AREA", "PARKING LOT", "STAIR WELL", "SIDE STREET", "FRONT ENTRANCE", "SIDE ENTRANCE", "BACK DECK", "DECK"]);

  for (const loc of dedupedLocations) {
    const base = getLocationBase(loc);
    // Try to find if this location's base matches or is contained in an existing base
    let matched = false;
    for (const [existingBase, items] of baseMap) {
      // Check if bases are essentially the same or one contains the other
      if (existingBase === base ||
          existingBase.startsWith(base + " ") || base.startsWith(existingBase + " ") ||
          existingBase.startsWith(base + "'") || base.startsWith(existingBase + "'")) {
        // Use the shorter base as the canonical one
        const canonBase = existingBase.length <= base.length ? existingBase : base;
        if (canonBase !== existingBase) {
          const items2 = baseMap.get(existingBase)!;
          baseMap.delete(existingBase);
          baseMap.set(canonBase, items2);
        }
        baseMap.get(canonBase)!.push(loc);
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (!baseMap.has(base)) baseMap.set(base, []);
      baseMap.get(base)!.push(loc);
    }
  }

  // Now also try to merge bases that share a significant word (e.g., "UNIVERSITY" groups with "UNIVERSITY PARKING LOT")
  const bases = [...baseMap.keys()];
  for (let i = 0; i < bases.length; i++) {
    for (let j = i + 1; j < bases.length; j++) {
      if (!baseMap.has(bases[i]) || !baseMap.has(bases[j])) continue;
      const a = bases[i], b = bases[j];
      // Check if one base starts with the other (e.g., "HOSPITAL" matches "HOSPITAL CORRIDOR")
      if (a.startsWith(b + " ") || a.startsWith(b + "'") || b.startsWith(a + " ") || b.startsWith(a + "'") || a === b) {
        const canon = a.length <= b.length ? a : b;
        const other = canon === a ? b : a;
        const merged = [...baseMap.get(canon)!, ...baseMap.get(other)!];
        baseMap.delete(other);
        baseMap.set(canon, merged);
      }
    }
  }

  const locationGroups: ElementGroup[] = [];
  const locationUngrouped: string[] = [];

  for (const [base, items] of baseMap) {
    // Deduplicate within group
    const unique = [...new Set(items)];
    // Group if 2+ items, OR if there's a single item with a sub-location separator
    // (meaning it's a sub-location like "DOCTOR'S OFFICE - ULTRASOUND ROOM")
    const hasSubLocations = unique.some(loc => {
      const upper = loc.toUpperCase().replace(/['']/g, "'").replace(/\.\s+/g, " - ");
      return upper.replace(/\bHOUSE\b/g, "HOME").includes(" - ");
    });
    if (unique.length >= 2 || (unique.length === 1 && hasSubLocations)) {
      const parentName = base.charAt(0) + base.slice(1).toLowerCase().replace(/'/g, "'");
      locationGroups.push({ id: uid(), parentName, variants: unique });
    } else {
      locationUngrouped.push(...unique);
    }
  }

  // Filter vehicles and locations out of props, then deduplicate similar items
  const VEHICLE_PATTERNS_PROPS = /\b(car|truck|van|bus|suv|sedan|pickup|motorcycle|bike|bicycle|helicopter|plane|airplane|aircraft|jet|boat|ship|yacht|ambulance|taxi|cab|limousine|limo|convertible|coupe|wagon|minivan|rv|trailer|tractor|forklift|scooter|moped|hovercraft|submarine)\b/i;
  const rawProps = extract(["recurring_props"]);
  const locationNamesUpper = new Set([...locationUngrouped, ...locationGroups.flatMap(g => g.variants)].map(l => l.toUpperCase()));

  // Step 1: Filter out vehicles and locations
  const filteredProps = rawProps.filter(p => {
    const upper = p.toUpperCase().trim();
    // Remove if it matches a known location
    if (locationNamesUpper.has(upper)) return false;
    // Remove if it's clearly a vehicle
    if (VEHICLE_PATTERNS_PROPS.test(p)) return false;
    return true;
  });

  // Step 2: Deduplicate similar props by normalizing
  const normalizeProp = (p: string): string => {
    let n = p.toLowerCase().trim();
    // Strip possessives and character prefixes: "Rachel's Phone" → "phone", "RACHEL'S PHONE" → "phone"
    n = n.replace(/^[a-z]+(?:'s|s)?\s+/i, "");
    // Strip "his/her/their/the/a/an"
    n = n.replace(/^(?:his|her|their|the|a|an)\s+/i, "");
    // Normalize common synonyms
    n = n.replace(/\btelephone\b/g, "phone")
         .replace(/\bcellphone\b/g, "phone")
         .replace(/\bcell phone\b/g, "phone")
         .replace(/\bmobile phone\b/g, "phone")
         .replace(/\bmobile\b/g, "phone")
         .replace(/\bsmartphone\b/g, "phone")
         .replace(/\bhandgun\b/g, "gun")
         .replace(/\bpistol\b/g, "gun")
         .replace(/\brevolver\b/g, "gun")
         .replace(/\brifle\b/g, "gun")
         .replace(/\bfirearm\b/g, "gun")
         .replace(/\bshotgun\b/g, "gun")
         .replace(/\blaptop\b/g, "computer")
         .replace(/\bnotebook computer\b/g, "computer")
         .replace(/\bphoto(?:graph)?\b/g, "photograph")
         .replace(/\bpic(?:ture)?\b/g, "photograph");
    // Remove non-alphanumeric for comparison
    return n.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  };

  const propGroups: ElementGroup[] = [];
  const propUngrouped: string[] = [];
  const propByNorm = new Map<string, string[]>();

  for (const p of filteredProps) {
    const norm = normalizeProp(p);
    if (!norm) { propUngrouped.push(p); continue; }
    if (!propByNorm.has(norm)) propByNorm.set(norm, []);
    propByNorm.get(norm)!.push(p);
  }

  for (const [, items] of propByNorm) {
    if (items.length >= 2) {
      // Use the shortest, cleanest item as the parent name
      const parent = items.sort((a, b) => a.length - b.length)[0];
      propGroups.push({ id: uid(), parentName: parent, variants: items });
    } else {
      propUngrouped.push(...items);
    }
  }

  return {
    locations: { ungrouped: locationUngrouped, groups: locationGroups },
    characters: { ungrouped: [...new Set(charNames)], groups: [] },
    wardrobe: { ungrouped: wardrobeUngrouped, groups: wardrobeGroups },
    props: { ungrouped: propUngrouped, groups: propGroups },
    visual_design: buildVisualDesignCategory(raw),
  };
}

let _uid = 0;
const uid = () => `grp_${++_uid}_${Date.now()}`;

/* ── Main Component ───────────────────────────────────────── */

interface Props {
  data: any;
  analysisId?: string;
  filmId?: string;
  onAllReviewedChange?: (allReviewed: boolean) => void;
  sceneLocations?: string[];
}

export default function GlobalElementsManager({ data, analysisId, filmId, onAllReviewedChange, sceneLocations }: Props) {
  const managed = data?._managed;
  // Use managed data only if locations are present (not null), otherwise rebuild
  const [categories, setCategories] = useState<Record<CategoryKey, CategoryData>>(() => {
    if (managed?.categories && managed.categories.locations) return managed.categories;
    return buildInitialData(data, sceneLocations);
  });
  const [signatureStyle, setSignatureStyle] = useState<string>(data?.signature_style || "");
  const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeParentName, setMergeParentName] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<CategoryKey | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [reviewStatus, setReviewStatus] = useState<Record<CategoryKey, "unreviewed" | "needs_review" | "completed">>(
    managed?.reviewStatus || {
      characters: "unreviewed",
      locations: "unreviewed",
      wardrobe: "unreviewed",
      props: "unreviewed",
      visual_design: "unreviewed",
    },
  );
  const initialMount = useRef(true);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Notify parent when all sections are reviewed
  useEffect(() => {
    const allCompleted = CATEGORIES.every(({ key }) => {
      const cat = categories[key];
      const hasContent = cat.ungrouped.length > 0 || cat.groups.length > 0;
      return !hasContent || reviewStatus[key] === "completed";
    });
    onAllReviewedChange?.(allCompleted);
  }, [reviewStatus, categories, onAllReviewedChange]);

  // Persist managed state to DB
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    if (!analysisId) return;
    const timeout = setTimeout(async () => {
      const updatedGlobal = { ...data, _managed: { categories, reviewStatus } };
      await supabase
        .from("script_analyses")
        .update({ global_elements: updatedGlobal as any })
        .eq("id", analysisId);
    }, 500);
    return () => clearTimeout(timeout);
  }, [categories, reviewStatus, analysisId]);

  /* selection — first click selects, second click on same item enters edit mode */
  const toggleSelect = useCallback((item: string, category: CategoryKey) => {
    // If already selected, enter edit mode instead of deselecting
    if (selected.has(item) && activeCategory === category) {
      setEditingItem(item);
      setEditText(item);
      setTimeout(() => editInputRef.current?.focus(), 0);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        if (activeCategory && activeCategory !== category) return prev;
        next.add(item);
      }
      if (next.size === 0) setActiveCategory(null);
      else setActiveCategory(category);
      return next;
    });
  }, [activeCategory, selected]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setActiveCategory(null);
    setEditingItem(null);
  }, []);

  /* rename item — update local state + propagate to DB */
  const renameItem = useCallback(async (oldName: string, newName: string, category: CategoryKey) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingItem(null);
      return;
    }

    // Update local categories state
    setCategories((prev) => {
      const cat = { ...prev[category] };
      cat.ungrouped = cat.ungrouped.map((u) => (u === oldName ? trimmed : u));
      cat.groups = cat.groups.map((g) => ({
        ...g,
        parentName: g.parentName === oldName ? trimmed : g.parentName,
        variants: g.variants.map((v) => (v === oldName ? trimmed : v)),
      }));

      const updated = { ...prev, [category]: cat };

      // When a character is renamed, also update wardrobe group names
      if (category === "characters") {
        const wardrobe = { ...updated.wardrobe };
        const oldUpper = oldName.toUpperCase();
        wardrobe.groups = wardrobe.groups.map((g) =>
          g.parentName.toUpperCase() === oldUpper
            ? { ...g, parentName: trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase() }
            : g
        );
        updated.wardrobe = wardrobe;
      }

      return updated;
    });

    // Update selection set
    setSelected((prev) => {
      if (!prev.has(oldName)) return prev;
      const next = new Set(prev);
      next.delete(oldName);
      next.add(trimmed);
      return next;
    });

    setEditingItem(null);

    // Propagate to DB if filmId available
    if (!filmId) return;

    try {
      if (category === "characters") {
        // Update characters table
        await supabase
          .from("characters")
          .update({ name: trimmed })
          .eq("film_id", filmId)
          .eq("name", oldName);
        // Update parsed_scenes characters arrays
        const { data: scenes } = await supabase
          .from("parsed_scenes")
          .select("id, characters")
          .eq("film_id", filmId);
        if (scenes) {
          for (const scene of scenes) {
            const chars: string[] = Array.isArray(scene.characters) ? scene.characters : [];
            if (chars.includes(oldName)) {
              const updated = chars.map((c: string) => (c === oldName ? trimmed : c));
              await supabase.from("parsed_scenes").update({ characters: updated }).eq("id", scene.id);
            }
          }
        }
        // Update wardrobe_scene_assignments
        await supabase
          .from("wardrobe_scene_assignments")
          .update({ character_name: trimmed })
          .eq("film_id", filmId)
          .eq("character_name", oldName);
        // Update asset_identity_registry
        await supabase
          .from("asset_identity_registry")
          .update({ display_name: trimmed })
          .eq("film_id", filmId)
          .eq("display_name", oldName)
          .eq("asset_type", "character");
      } else if (category === "locations") {
        // Update parsed_scenes location_name
        await supabase
          .from("parsed_scenes")
          .update({ location_name: trimmed })
          .eq("film_id", filmId)
          .eq("location_name", oldName);
        // Update asset_identity_registry
        await supabase
          .from("asset_identity_registry")
          .update({ display_name: trimmed })
          .eq("film_id", filmId)
          .eq("display_name", oldName)
          .eq("asset_type", "location");
      } else if (category === "props") {
        // Update parsed_scenes key_objects arrays
        const { data: scenes } = await supabase
          .from("parsed_scenes")
          .select("id, key_objects")
          .eq("film_id", filmId);
        if (scenes) {
          for (const scene of scenes) {
            const objs: string[] = Array.isArray(scene.key_objects) ? scene.key_objects : [];
            if (objs.includes(oldName)) {
              const updated = objs.map((o: string) => (o === oldName ? trimmed : o));
              await supabase.from("parsed_scenes").update({ key_objects: updated }).eq("id", scene.id);
            }
          }
        }
        // Update asset_identity_registry
        await supabase
          .from("asset_identity_registry")
          .update({ display_name: trimmed })
          .eq("film_id", filmId)
          .eq("display_name", oldName)
          .eq("asset_type", "prop");
      } else if (category === "wardrobe") {
        // Update wardrobe_scene_assignments
        await supabase
          .from("wardrobe_scene_assignments")
          .update({ clothing_item: trimmed })
          .eq("film_id", filmId)
          .eq("clothing_item", oldName);
        // Update asset_identity_registry
        await supabase
          .from("asset_identity_registry")
          .update({ display_name: trimmed })
          .eq("film_id", filmId)
          .eq("display_name", oldName)
          .eq("asset_type", "wardrobe");
      }

      // Update film_assets
      await supabase
        .from("film_assets")
        .update({ asset_name: trimmed })
        .eq("film_id", filmId)
        .eq("asset_name", oldName);
    } catch (err) {
      console.error("Failed to propagate rename:", err);
    }
  }, [filmId]);

  /* merge flow */
  const openMerge = useCallback(() => {
    if (selected.size < 2 || !activeCategory) return;
    const items = Array.from(selected);
    setMergeParentName(items[0]);
    setMergeDialogOpen(true);
  }, [selected, activeCategory]);

  const confirmMerge = useCallback(() => {
    if (!activeCategory || !mergeParentName.trim()) return;
    const items = Array.from(selected);

    setCategories((prev) => {
      const cat = { ...prev[activeCategory] };
      const newGroup: ElementGroup = {
        id: uid(),
        parentName: mergeParentName.trim(),
        variants: items,
      };
      cat.ungrouped = cat.ungrouped.filter((u) => !selected.has(u));
      cat.groups = cat.groups.map((g) => ({
        ...g,
        variants: g.variants.filter((v) => !selected.has(v)),
      })).filter((g) => g.variants.length > 0);
      cat.groups = [...cat.groups, newGroup];

      const updated = { ...prev, [activeCategory]: cat };

      // When characters are merged, also consolidate their wardrobe groups
      if (activeCategory === "characters") {
        const mergedCharNames = new Set(items.map((n) => n.toUpperCase()));
        const parentUpper = mergeParentName.trim().toUpperCase();
        mergedCharNames.add(parentUpper);

        const wardrobe = { ...updated.wardrobe };
        const consolidatedVariants: string[] = [];
        const keptGroups: ElementGroup[] = [];

        for (const wg of wardrobe.groups) {
          if (mergedCharNames.has(wg.parentName.toUpperCase())) {
            consolidatedVariants.push(...wg.variants);
          } else {
            keptGroups.push(wg);
          }
        }

        // Also pull matching ungrouped wardrobe items
        const remainingUngrouped: string[] = [];
        for (const item of wardrobe.ungrouped) {
          const upper = item.toUpperCase();
          if ([...mergedCharNames].some((cn) => upper.startsWith(cn + " ") || upper.startsWith(cn + "'S ") || upper.startsWith(cn + "S ") || upper.startsWith(cn + " - ") || upper.startsWith(cn + ": "))) {
            consolidatedVariants.push(item);
          } else {
            remainingUngrouped.push(item);
          }
        }

        if (consolidatedVariants.length > 0) {
          const parentLabel = mergeParentName.trim().charAt(0).toUpperCase() + mergeParentName.trim().slice(1).toLowerCase();
          keptGroups.push({ id: uid(), parentName: parentLabel, variants: consolidatedVariants });
        }

        wardrobe.groups = keptGroups;
        wardrobe.ungrouped = remainingUngrouped;
        updated.wardrobe = wardrobe;
      }

      return updated;
    });

    clearSelection();
    setMergeDialogOpen(false);
  }, [activeCategory, mergeParentName, selected, clearSelection]);

  /* unlink */
  const unlinkGroup = useCallback((category: CategoryKey, groupId: string) => {
    setCategories((prev) => {
      const cat = { ...prev[category] };
      const group = cat.groups.find((g) => g.id === groupId);
      if (!group) return prev;
      cat.ungrouped = [...cat.ungrouped, ...group.variants];
      cat.groups = cat.groups.filter((g) => g.id !== groupId);
      return { ...prev, [category]: cat };
    });
  }, []);

  /* delete item */
  const deleteItem = useCallback((category: CategoryKey, item: string) => {
    setCategories((prev) => {
      const cat = { ...prev[category] };
      cat.ungrouped = cat.ungrouped.filter((u) => u !== item);
      return { ...prev, [category]: cat };
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(item);
      if (next.size === 0) setActiveCategory(null);
      return next;
    });
  }, []);

  /* add item */
  const addItem = useCallback((category: CategoryKey) => {
    if (!newItemText.trim()) return;
    setCategories((prev) => {
      const cat = { ...prev[category] };
      cat.ungrouped = [...cat.ungrouped, newItemText.trim()];
      return { ...prev, [category]: cat };
    });
    setNewItemText("");
    setAddingTo(null);
  }, [newItemText]);

  const toggleGroupExpand = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const hasItems = (cat: CategoryData) => cat.ungrouped.length > 0 || cat.groups.length > 0;

  return (
    <div className="space-y-3">
      {CATEGORIES.map(({ key, label, icon }) => {
        const cat = categories[key];
        const showSection = hasItems(cat) || key === expandedCategory;
        if (!showSection && !hasItems(cat)) return null;
        const isExpanded = expandedCategory === key;

        return (
          <div key={key} className="rounded-lg border border-border bg-card/50 overflow-hidden">
            {/* Section header */}
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : key)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className="text-primary">{icon}</span>
              <span className="font-display text-sm font-semibold">{label}</span>
              <span className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {cat.groups.length > 0 && `${cat.groups.length} grouped · `}
                  {cat.ungrouped.length} item{cat.ungrouped.length !== 1 ? "s" : ""}
                </span>
                {hasItems(cat) && (
                  reviewStatus[key] === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : reviewStatus[key] === "needs_review" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )
                )}
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {/* Merge action bar */}
                {selected.size >= 2 && activeCategory === key && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                    <Merge className="h-4 w-4 text-primary" />
                    <span className="text-xs text-primary font-medium">
                      {selected.size} items selected
                    </span>
                    <Button size="sm" variant="default" className="ml-auto gap-1.5 h-7 text-xs" onClick={openMerge}>
                      <Link2 className="h-3 w-3" />
                      Link Together
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={clearSelection}>
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                )}

                {/* Grouped items */}
                {[...cat.groups].sort((a, b) => a.parentName.localeCompare(b.parentName)).map((group) => {
                  const isOpen = expandedGroups.has(group.id);
                  return (
                    <div key={group.id} className="rounded-md border border-primary/20 bg-primary/5 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button onClick={() => toggleGroupExpand(group.id)} className="flex items-center gap-1.5 flex-1 text-left">
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-primary" /> : <ChevronRight className="h-3.5 w-3.5 text-primary" />}
                          <Tag className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-semibold text-foreground">{group.parentName}</span>
                          <span className="text-xs text-muted-foreground ml-1">({group.variants.length} linked)</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground hover:text-destructive gap-1"
                          onClick={() => unlinkGroup(key, group.id)}
                        >
                          <Unlink className="h-3 w-3" />
                          Unlink
                        </Button>
                      </div>
                      {isOpen && (
                        <div className="px-3 pb-2 flex flex-wrap gap-1.5 border-t border-primary/10 pt-2">
                          {[...group.variants].sort((a, b) => a.localeCompare(b)).map((v, i) => {
                            const isSelected = selected.has(v) && activeCategory === key;
                            const isDisabled = activeCategory !== null && activeCategory !== key;
                            const isEditing = editingItem === v;
                            return (
                              <span
                                key={i}
                                className={cn(
                                  "text-xs rounded-full px-2.5 py-0.5 border transition-all select-none inline-flex items-center gap-1 cursor-pointer",
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30"
                                    : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:bg-accent",
                                  isDisabled && "opacity-40",
                                  isEditing && "ring-2 ring-primary/50",
                                )}
                              >
                                {isEditing ? (
                                  <input
                                    ref={editInputRef}
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") renameItem(v, editText, key);
                                      if (e.key === "Escape") setEditingItem(null);
                                    }}
                                    onBlur={() => renameItem(v, editText, key)}
                                    className="bg-transparent outline-none text-xs w-auto min-w-[40px] text-inherit"
                                    style={{ width: `${Math.max(editText.length, 3)}ch` }}
                                    autoFocus
                                  />
                                ) : (
                                  <button
                                    disabled={isDisabled}
                                    onClick={() => toggleSelect(v, key)}
                                    className="cursor-pointer"
                                  >
                                    {isSelected && <Check className="inline h-3 w-3 mr-0.5" />}
                                    {v}
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Ungrouped items – selectable & deletable chips */}
                {cat.ungrouped.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {[...cat.ungrouped].sort((a, b) => a.localeCompare(b)).map((item, i) => {
                      const isSelected = selected.has(item) && activeCategory === key;
                      const isDisabled = activeCategory !== null && activeCategory !== key;
                      const isEditing = editingItem === item;
                      return (
                        <span
                          key={i}
                          className={cn(
                            "text-xs rounded-full px-2.5 py-1 border transition-all select-none inline-flex items-center gap-1",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30"
                              : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:bg-accent",
                            isDisabled && "opacity-40",
                            isEditing && "ring-2 ring-primary/50",
                          )}
                        >
                          {isEditing ? (
                            <input
                              ref={editInputRef}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") renameItem(item, editText, key);
                                if (e.key === "Escape") setEditingItem(null);
                              }}
                              onBlur={() => renameItem(item, editText, key)}
                              className="bg-transparent outline-none text-xs w-auto min-w-[40px] text-inherit"
                              style={{ width: `${Math.max(editText.length, 3)}ch` }}
                              autoFocus
                            />
                          ) : (
                            <button
                              disabled={isDisabled}
                              onClick={() => toggleSelect(item, key)}
                              className="cursor-pointer"
                            >
                              {isSelected && <Check className="inline h-3 w-3 mr-0.5" />}
                              {item}
                            </button>
                          )}
                          {!isEditing && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteItem(key, item); }}
                              className="ml-0.5 opacity-50 hover:opacity-100 hover:text-destructive transition-opacity"
                              title="Remove"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Add item */}
                {addingTo === key ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      placeholder={`Add ${label.toLowerCase()} item...`}
                      className="h-8 text-xs bg-background flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addItem(key);
                        if (e.key === "Escape") { setAddingTo(null); setNewItemText(""); }
                      }}
                    />
                    <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => addItem(key)}>
                      Add
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingTo(null); setNewItemText(""); }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground gap-1"
                    onClick={() => { setAddingTo(key); setNewItemText(""); }}
                  >
                    <Plus className="h-3 w-3" />
                    Add {label.toLowerCase()}
                  </Button>
                )}

                {cat.ungrouped.length > 1 && selected.size === 0 && addingTo !== key && (
                  <p className="text-xs text-muted-foreground italic">
                    Click to select, click again to edit name, press Enter to save
                  </p>
                )}

                {/* Review status buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-border mt-3">
                  <span className="text-xs text-muted-foreground mr-auto">Review Status:</span>
                  <Button
                    size="sm"
                    variant={reviewStatus[key] === "needs_review" ? "default" : "outline"}
                    className={cn("h-7 text-xs gap-1.5", reviewStatus[key] === "needs_review" ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : "opacity-60")}
                    onClick={() => setReviewStatus(prev => ({ ...prev, [key]: prev[key] === "needs_review" ? "unreviewed" : "needs_review" }))}
                  >
                    <AlertCircle className="h-3 w-3" />
                    Still Needs Review
                  </Button>
                  <Button
                    size="sm"
                    variant={reviewStatus[key] === "completed" ? "default" : "outline"}
                    className={cn("h-7 text-xs gap-1.5", reviewStatus[key] === "completed" ? "bg-green-600 hover:bg-green-700 text-white" : "opacity-60")}
                    onClick={() => setReviewStatus(prev => ({ ...prev, [key]: prev[key] === "completed" ? "unreviewed" : "completed" }))}
                  >
                    <ThumbsUp className="h-3 w-3" />
                    Approved
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}


      {/* Merge dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Link Elements Together</DialogTitle>
            <DialogDescription>
              These items will be grouped under a single parent name. You can unlink them later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Parent Name</label>
              <Input
                value={mergeParentName}
                onChange={(e) => setMergeParentName(e.target.value)}
                placeholder="e.g. Wells Home"
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Items being linked</label>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selected).map((item) => (
                  <span key={item} className="text-xs bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 border border-border">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setMergeDialogOpen(false); clearSelection(); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmMerge} disabled={!mergeParentName.trim()} className="gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Link Together
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
