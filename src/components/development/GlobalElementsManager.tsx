import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  MapPin, Users, Shirt, Box, Paintbrush, Link2, Unlink, ChevronDown,
  ChevronRight, Check, Merge, Tag, X, Plus, AlertCircle, CheckCircle2, ThumbsUp, GripVertical,
} from "lucide-react";
import { useScriptViewer } from "@/components/ScriptViewerDialog";
import { parseSceneFromPlainText } from "@/lib/parse-script-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getLocationBase, isLikelyVehicleLocation, normalizeLocationKey, splitAndCleanLocations } from "@/lib/global-elements-normalization";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";

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

export interface ScenePropData {
  scene_number: number;
  characters: string[];
  key_objects: string[];
  location_name: string;
  wardrobe?: any[];
  picture_vehicles?: string[];
}

function buildInitialData(raw: any, sceneLocations?: string[], scenePropOwnership?: ScenePropData[]): Record<CategoryKey, CategoryData> {
  const extract = (keys: string[]): string[] => {
    const items: string[] = [];
    for (const k of keys) {
      const val = raw?.[k];
      if (Array.isArray(val)) items.push(...val);
      else if (typeof val === "string" && val) items.push(val);
    }
    return [...new Set(items)];
  };

  const toTitleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

  const TITLE_PREFIXES = /^(?:professor|prof\.?|doctor|dr\.?|mr\.?|mrs\.?|ms\.?|miss|sir|lady|lord|detective|det\.?|officer|agent|captain|capt\.?|sergeant|sgt\.?|lieutenant|lt\.?|reverend|rev\.?|father|mother|sister|brother|judge|king|queen|prince|princess)\s+/i;

  const stripCharacterMeta = (name: string): string => {
    let cleaned = name.replace(/\s*\(.*?\)\s*/g, "").replace(/\s*\([^)]*$/g, "").trim();
    const dashIdx = cleaned.indexOf(" - ");
    const colonIdx = cleaned.indexOf(": ");
    const commaIdx = cleaned.indexOf(", ");
    const cutIdx = [dashIdx, colonIdx, commaIdx].filter((i) => i > 0).sort((a, b) => a - b)[0];
    cleaned = cutIdx ? cleaned.substring(0, cutIdx).trim() : cleaned;
    return cleaned;
  };

  const normalizeCharacterKey = (name: string): string =>
    stripCharacterMeta(name)
      .replace(TITLE_PREFIXES, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const rawCharacterSources = [
    ...extract(["recurring_characters", "characters"]),
    ...(scenePropOwnership?.flatMap((scene) => scene.characters || []) ?? []),
  ];
  const cleanedCharacterNames = rawCharacterSources.map(stripCharacterMeta).filter(Boolean);

  const characterCanonicalByNorm = new Map<string, string>();
  for (const rawName of cleanedCharacterNames) {
    const norm = normalizeCharacterKey(rawName);
    if (!norm) continue;
    const display = toTitleCase(rawName.toLowerCase());
    const existing = characterCanonicalByNorm.get(norm);
    if (!existing || display.length > existing.length) {
      characterCanonicalByNorm.set(norm, display);
    }
  }

  const normKeys = [...characterCanonicalByNorm.keys()];
  const mergeNormMap = new Map<string, string>();
  for (const a of normKeys) {
    const aParts = a.split(/\s+/).filter(Boolean);
    for (const b of normKeys) {
      if (a === b) continue;
      const bParts = b.split(/\s+/).filter(Boolean);
      if (aParts.length < bParts.length && aParts.every((part) => bParts.includes(part))) {
        mergeNormMap.set(a, b);
      }
    }
  }

  const resolveCharacterNorm = (norm: string): string => {
    let resolved = norm;
    const visited = new Set<string>();
    while (mergeNormMap.has(resolved) && !visited.has(resolved)) {
      visited.add(resolved);
      resolved = mergeNormMap.get(resolved)!;
    }
    return resolved;
  };

  const toCanonicalCharacterLabel = (name: string): string | null => {
    const norm = resolveCharacterNorm(normalizeCharacterKey(name));
    if (!norm) return null;
    return characterCanonicalByNorm.get(norm) || toTitleCase(stripCharacterMeta(name).toLowerCase()) || null;
  };

  const characterVariantMap = new Map<string, Set<string>>();
  for (const rawName of cleanedCharacterNames) {
    const normalized = normalizeCharacterKey(rawName);
    if (!normalized) continue;
    const resolvedNorm = resolveCharacterNorm(normalized);
    const display = toTitleCase(stripCharacterMeta(rawName).toLowerCase());
    if (!display) continue;
    if (!characterVariantMap.has(resolvedNorm)) characterVariantMap.set(resolvedNorm, new Set());
    characterVariantMap.get(resolvedNorm)!.add(display);
  }

  const characterGroups: ElementGroup[] = [];
  const characterUngrouped: string[] = [];

  for (const [norm, variantsSet] of characterVariantMap) {
    const variants = [...variantsSet];
    const canonical = characterCanonicalByNorm.get(norm) || [...variants].sort((a, b) => b.length - a.length)[0];
    if (!canonical) continue;

    if (variants.length > 1) {
      const orderedVariants = [canonical, ...variants.filter((v) => v !== canonical)];
      characterGroups.push({ id: uid(), parentName: canonical, variants: orderedVariants });
    } else {
      characterUngrouped.push(canonical);
    }
  }

  characterGroups.sort((a, b) => b.variants.length - a.variants.length || a.parentName.localeCompare(b.parentName));
  characterUngrouped.sort((a, b) => a.localeCompare(b));

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
  const rawLocations = extract(["recurring_locations"]);
  if (sceneLocations) {
    for (const sl of sceneLocations) {
      if (sl && !rawLocations.includes(sl)) rawLocations.push(sl);
    }
  }

  const cleanedLocations = rawLocations
    .flatMap((loc) => splitAndCleanLocations(loc))
    .filter((loc) => !isLikelyVehicleLocation(loc));

  // Deduplicate: keep the most descriptive version of each normalized form
  const locByNorm = new Map<string, string>();
  for (const loc of cleanedLocations) {
    const norm = normalizeLocationKey(loc);
    const existing = locByNorm.get(norm);
    if (!existing || loc.length > existing.length) {
      locByNorm.set(norm, loc);
    }
  }

  const dedupedLocations = [...locByNorm.values()];

  // Group by shared base location
  const baseMap = new Map<string, string[]>();

  for (const loc of dedupedLocations) {
    const base = getLocationBase(loc);

    let matched = false;
    for (const [existingBase, items] of baseMap) {
      const existingNorm = normalizeLocationKey(existingBase);
      const baseNorm = normalizeLocationKey(base);
      if (
        existingNorm === baseNorm ||
        existingNorm.startsWith(baseNorm + " ") ||
        baseNorm.startsWith(existingNorm + " ") ||
        existingNorm.replace(/'S\b/g, "") === baseNorm.replace(/'S\b/g, "")
      ) {
        const canonBase = existingBase.length <= base.length ? existingBase : base;
        if (canonBase !== existingBase) {
          const moved = baseMap.get(existingBase)!;
          baseMap.delete(existingBase);
          baseMap.set(canonBase, moved);
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

  const locationGroups: ElementGroup[] = [];
  const locationUngrouped: string[] = [];

  for (const [base, items] of baseMap) {
    const uniqueByNorm = new Map<string, string>();
    for (const item of items) {
      const norm = normalizeLocationKey(item);
      const existing = uniqueByNorm.get(norm);
      if (!existing || item.length > existing.length) {
        uniqueByNorm.set(norm, item);
      }
    }
    const unique = [...uniqueByNorm.values()];

    const hasSubLocations = unique.some((loc) => normalizeLocationKey(loc).includes(" - "));
    if (unique.length >= 2 || (unique.length === 1 && hasSubLocations)) {
      const parentName = base.charAt(0) + base.slice(1).toLowerCase();
      locationGroups.push({ id: uid(), parentName, variants: unique });
    } else {
      locationUngrouped.push(...unique);
    }
  }

  // Filter vehicles and locations out of props, then deduplicate similar items
  const VEHICLE_PATTERNS_PROPS = /\b(car|truck|van|bus|suv|sedan|pickup|motorcycle|bike|bicycle|helicopter|plane|airplane|aircraft|jet|boat|ship|yacht|ambulance|taxi|cab|limousine|limo|convertible|coupe|wagon|minivan|rv|trailer|tractor|forklift|scooter|moped|hovercraft|submarine|tesla|miata|corvette)\b/i;
  const rawProps = extract(["recurring_props"]);
  const locationNames = [...locationUngrouped, ...locationGroups.flatMap(g => g.variants)];
  const locationNameKeys = new Set(locationNames.map((l) => normalizeLocationKey(l)));

  // Step 1: Filter out vehicles and locations
  const filteredProps = rawProps.filter(p => {
    const normalized = normalizeLocationKey(p);
    // Remove if it matches a known location
    if (locationNameKeys.has(normalized)) return false;
    // Remove if it's clearly a vehicle
    if (VEHICLE_PATTERNS_PROPS.test(p) || isLikelyVehicleLocation(p)) return false;
    return true;
  });

  // Step 2: Classify glasses by context (drinking vs eyewear)
  const DRINKING_GLASS_CONTEXT = /\b(beer|wine|vodka|whiskey|cocktail|champagne|shot|drinking|water|juice)\b/i;
  const EYEWEAR_CONTEXT = /\b(reading|sun|prescription|spectacle|eyeglasses|wire-rim|thick-frame)\b/i;

  const classifyGlasses = (propName: string, sceneContext?: { characters: string[]; key_objects: string[]; location_name: string }): string => {
    const lower = propName.toLowerCase();
    if (!/\bglasses\b/i.test(lower)) return lower;
    // If explicitly qualified
    if (DRINKING_GLASS_CONTEXT.test(lower) || /\bglass of\b/i.test(lower)) return "drinkware";
    if (EYEWEAR_CONTEXT.test(lower) || /\bspectacles?\b/i.test(lower)) return "eyewear";
    // Check scene context for nearby drinkware clues
    if (sceneContext) {
      const allObjects = sceneContext.key_objects.join(" ").toLowerCase();
      if (/\b(beer|vodka|wine|whiskey|cocktail|bar|drink)\b/.test(allObjects)) return "drinkware";
    }
    // Default bare "glasses" to eyewear
    return "eyewear";
  };

  // Step 3: Deduplicate similar props by normalizing
  const normalizeProp = (p: string): string => {
    let n = p.toLowerCase().trim();
    // Strip character ownership prefixes: "Rachel's Phone" / "Rachel - Phone" → "phone"
    n = n
      .replace(/^([a-z][a-z'.-]*(?:\s+[a-z][a-z'.-]*){0,2})['’]s\s+/i, "")
      .replace(/^([a-z][a-z'.-]*(?:\s+[a-z][a-z'.-]*){0,2})\s*[-–—:]\s+/i, "");
    // Strip pronouns/articles
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

  // Step 4: Build prop ownership map from scene data
  // For each prop, track which characters and locations it co-occurs with
  const propOwnerMap = new Map<string, { chars: Map<string, number>; locs: Map<string, number> }>();

  if (scenePropOwnership) {
    for (const scene of scenePropOwnership) {
      for (const obj of scene.key_objects) {
        const norm = normalizeProp(obj);
        if (!norm) continue;

        // Handle glasses differentiation
        let effectiveNorm = norm;
        if (/\bglasses\b/.test(norm) || /\bglass\b/.test(norm)) {
          const glassType = classifyGlasses(obj, scene);
          effectiveNorm = glassType === "drinkware" ? "drinkware glass" : norm;
        }

        if (!propOwnerMap.has(effectiveNorm)) propOwnerMap.set(effectiveNorm, { chars: new Map(), locs: new Map() });
        const entry = propOwnerMap.get(effectiveNorm)!;

        // Track character co-occurrence
        for (const char of scene.characters) {
          let name = char.replace(/\s*\(.*?\)\s*/g, "").trim();
          const dashIdx = name.indexOf(" - ");
          if (dashIdx > 0) name = name.substring(0, dashIdx).trim();
          if (name) entry.chars.set(name, (entry.chars.get(name) || 0) + 1);
        }

        // Track location co-occurrence
        if (scene.location_name) {
          const locBase = getLocationBase(scene.location_name);
          entry.locs.set(locBase, (entry.locs.get(locBase) || 0) + 1);
        }
      }
    }
  }

  // Step 5: Group props by character/location ownership or similarity
  const propGroups: ElementGroup[] = [];
  const propUngrouped: string[] = [];
  const propByNorm = new Map<string, string[]>();

  // Separate glasses by context
  const processedProps: string[] = [];
  for (const p of filteredProps) {
    const lower = p.toLowerCase();
    if (/\bglasses\b/i.test(lower) && !DRINKING_GLASS_CONTEXT.test(lower) && !EYEWEAR_CONTEXT.test(lower)) {
      // Find this prop's scene context
      const sceneCtx = scenePropOwnership?.find(s =>
        s.key_objects.some(o => o.toLowerCase() === lower)
      );
      const glassType = classifyGlasses(p, sceneCtx);
      if (glassType === "drinkware") {
        processedProps.push(p + " (drinkware)");
      } else {
        processedProps.push(p + " (eyewear)");
      }
    } else {
      processedProps.push(p);
    }
  }

  // Build normalized groups
  for (const p of processedProps) {
    // Strip the context tag for normalization but keep it for display
    const displayName = p.replace(/ \((drinkware|eyewear)\)$/, "");
    const contextTag = p.match(/ \((drinkware|eyewear)\)$/)?.[1];

    let norm = normalizeProp(displayName);
    // Keep glasses types separate
    if (contextTag === "drinkware") norm = "drinkware glass";
    else if (contextTag === "eyewear" && /\bglass/i.test(norm)) norm = "eyewear glasses";

    if (!norm) { propUngrouped.push(displayName); continue; }
    if (!propByNorm.has(norm)) propByNorm.set(norm, []);
    propByNorm.get(norm)!.push(displayName);
  }

  // Now group: first try explicit ownership labels, then scene-based ownership, then fallback to similarity
  const charGroupMap = new Map<string, string[]>(); // character → props
  const locGroupMap = new Map<string, string[]>();  // location → props
  const remainingProps: string[] = [];

  const extractExplicitCharacterOwner = (label: string): string | null => {
    const possessiveMatch = label.match(/^([A-Za-z][A-Za-z'’.\-\s]{1,60}?)['’]s\s+/i);
    const dashedMatch = label.match(/^([A-Za-z][A-Za-z'’.\-\s]{1,60}?)\s*[-–—:]\s+/i);
    const candidate = possessiveMatch?.[1]?.trim() || dashedMatch?.[1]?.trim();
    if (!candidate) return null;
    const norm = resolveCharacterNorm(normalizeCharacterKey(candidate));
    if (!norm || !characterCanonicalByNorm.has(norm)) return null;
    return characterCanonicalByNorm.get(norm)!;
  };

  for (const [norm, items] of propByNorm) {
    const ownership = propOwnerMap.get(norm);
    let assigned = false;

    let explicitOwner: string | null = null;
    for (const item of items) {
      explicitOwner = extractExplicitCharacterOwner(item);
      if (explicitOwner) break;
    }

    if (explicitOwner) {
      if (!charGroupMap.has(explicitOwner)) charGroupMap.set(explicitOwner, []);
      charGroupMap.get(explicitOwner)!.push(...items);
      assigned = true;
    }

    if (!assigned && ownership) {
      // Find dominant character — assign when ownership is reasonably clear
      const sortedChars = [...ownership.chars.entries()].sort((a, b) => b[1] - a[1]);

      if (sortedChars.length > 0) {
        const [topChar, topCount] = sortedChars[0];
        const totalCharScenes = [...ownership.chars.values()].reduce((a, b) => a + b, 0);
        const canonicalChar = toCanonicalCharacterLabel(topChar) || toTitleCase(stripCharacterMeta(topChar).toLowerCase());
        const strongCharOwnership = topCount >= 2 || topCount / Math.max(totalCharScenes, 1) >= 0.34;

        if (canonicalChar && strongCharOwnership) {
          if (!charGroupMap.has(canonicalChar)) charGroupMap.set(canonicalChar, []);
          charGroupMap.get(canonicalChar)!.push(...items);
          assigned = true;
        }
      }

      // If not character-owned, try location ownership
      if (!assigned) {
        const sortedLocs = [...ownership.locs.entries()].sort((a, b) => b[1] - a[1]);
        if (sortedLocs.length > 0) {
          const [locName, locCount] = sortedLocs[0];
          const totalLocScenes = [...ownership.locs.values()].reduce((a, b) => a + b, 0);
          const strongLocOwnership = locCount >= 2 || locCount / Math.max(totalLocScenes, 1) >= 0.34;

          if (strongLocOwnership) {
            if (!locGroupMap.has(locName)) locGroupMap.set(locName, []);
            locGroupMap.get(locName)!.push(...items);
            assigned = true;
          }
        }
      }
    }

    if (!assigned) {
      if (items.length >= 2) {
        const parent = [...items].sort((a, b) => a.length - b.length)[0];
        propGroups.push({ id: uid(), parentName: parent, variants: [...new Set(items)] });
      } else {
        remainingProps.push(...items);
      }
    }
  }

  // Convert character groups to ElementGroups
  for (const [charName, items] of charGroupMap) {
    const label = toCanonicalCharacterLabel(charName) || toTitleCase(stripCharacterMeta(charName).toLowerCase());
    propGroups.push({ id: uid(), parentName: label, variants: [...new Set(items)] });
  }

  // Convert location groups to ElementGroups
  for (const [locName, items] of locGroupMap) {
    const label = locName.charAt(0) + locName.slice(1).toLowerCase();
    propGroups.push({ id: uid(), parentName: `📍 ${label}`, variants: [...new Set(items)] });
  }

  propUngrouped.push(...remainingProps);

  // Title-case all prop labels
  const tcPropUngrouped = propUngrouped.map(toTitleCase);
  const tcPropGroups = propGroups.map(g => ({
    ...g,
    parentName: toTitleCase(g.parentName),
    variants: g.variants.map(toTitleCase),
  }));

  return {
    locations: { ungrouped: locationUngrouped, groups: locationGroups },
    characters: { ungrouped: characterUngrouped, groups: characterGroups },
    wardrobe: { ungrouped: wardrobeUngrouped, groups: wardrobeGroups },
    props: { ungrouped: tcPropUngrouped, groups: tcPropGroups },
    visual_design: buildVisualDesignCategory(raw),
  };
}

const MANAGED_SCHEMA_VERSION = 3;

let _uid = 0;
const uid = () => `grp_${++_uid}_${Date.now()}`;

/* ── Main Component ───────────────────────────────────────── */

interface Props {
  data: any;
  analysisId?: string;
  filmId?: string;
  onAllReviewedChange?: (allReviewed: boolean) => void;
  sceneLocations?: string[];
  scenePropOwnership?: ScenePropData[];
}

export default function GlobalElementsManager({ data, analysisId, filmId, onAllReviewedChange, sceneLocations, scenePropOwnership }: Props) {
  const managed = data?._managed;
  const managedVersion = typeof managed?.version === "number" ? managed.version : 1;

  // Check if managed categories actually have content — if all categories are empty
  // but raw data exists, we should rebuild from raw data (handles corrupted saves)
  const managedCatsExist = Boolean(managed?.categories && managed.categories.locations && managedVersion >= MANAGED_SCHEMA_VERSION);
  const managedCatsEmpty = managedCatsExist && CATEGORIES.every(({ key }) => {
    const cat = managed.categories[key];
    if (!cat) return true;
    return (cat.ungrouped?.length ?? 0) === 0 && (cat.groups?.length ?? 0) === 0;
  });
  const hasRawData = Boolean(
    (Array.isArray(data?.recurring_characters) && data.recurring_characters.length > 0) ||
    (Array.isArray(data?.recurring_locations) && data.recurring_locations.length > 0) ||
    (Array.isArray(data?.recurring_props) && data.recurring_props.length > 0)
  );
  const useManagedCategories = managedCatsExist && !(managedCatsEmpty && hasRawData);

  const [categories, setCategories] = useState<Record<CategoryKey, CategoryData>>(() => {
    if (useManagedCategories) return managed.categories;
    return buildInitialData(data, sceneLocations, scenePropOwnership);
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
  const hydratedWithSceneContextRef = useRef(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);
  const categoriesRef = useRef(categories);
  const reviewStatusRef = useRef(reviewStatus);
  categoriesRef.current = categories;
  reviewStatusRef.current = reviewStatus;

  useEffect(() => {
    if (hydratedWithSceneContextRef.current) return;
    if (typeof scenePropOwnership === "undefined") return;

    if (!useManagedCategories) {
      setCategories(buildInitialData(data, sceneLocations, scenePropOwnership));
      hydratedWithSceneContextRef.current = true;
      return;
    }

    setCategories((prev) => {
      const needsCharacterAutoGrouping = prev.characters.groups.length === 0 && prev.characters.ungrouped.length > 0;
      const needsPropAutoGrouping = prev.props.groups.length === 0 && prev.props.ungrouped.length > 0;

      if (!needsCharacterAutoGrouping && !needsPropAutoGrouping) {
        return prev;
      }

      const rebuilt = buildInitialData(data, sceneLocations, scenePropOwnership);
      return {
        ...prev,
        characters: needsCharacterAutoGrouping ? rebuilt.characters : prev.characters,
        props: needsPropAutoGrouping ? rebuilt.props : prev.props,
      };
    });

    hydratedWithSceneContextRef.current = true;
  }, [useManagedCategories, data, sceneLocations, scenePropOwnership]);

  /* Script viewer for scene clicks */
  const { openScriptViewer, setScriptViewerScenes, setScriptViewerLoading } = useScriptViewer();

  /* Build item → scene numbers map */
  const itemSceneMap = useMemo(() => {
    const map = new Map<string, Set<number>>();
    if (!scenePropOwnership) return map;

    const addToMap = (itemName: string, sceneNum: number) => {
      const key = itemName.toLowerCase().trim();
      if (!key) return;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(sceneNum);
    };

    for (const scene of scenePropOwnership) {
      // Props (key_objects)
      for (const obj of scene.key_objects) {
        addToMap(obj, scene.scene_number);
      }
      // Picture vehicles
      if (scene.picture_vehicles) {
        for (const v of scene.picture_vehicles) {
          addToMap(v, scene.scene_number);
        }
      }
      // Wardrobe
      if (scene.wardrobe && Array.isArray(scene.wardrobe)) {
        for (const w of scene.wardrobe) {
          if (typeof w === "string") {
            addToMap(w, scene.scene_number);
          } else if (w && typeof w === "object") {
            // wardrobe can be {item: string, character: string, ...}
            const itemName = w.item || w.clothing_item || w.name || "";
            if (itemName) addToMap(itemName, scene.scene_number);
            // Also add character-prefixed version
            const charName = w.character || "";
            if (charName && itemName) {
              addToMap(`${charName} - ${itemName}`, scene.scene_number);
              addToMap(`${charName}'s ${itemName}`, scene.scene_number);
            }
          }
        }
      }
    }
    return map;
  }, [scenePropOwnership]);

  /** Look up scene numbers for an item (tries exact and fuzzy matching) */
  const getScenesForItem = useCallback((itemName: string): number[] => {
    const key = itemName.toLowerCase().trim();
    const direct = itemSceneMap.get(key);
    if (direct) return [...direct].sort((a, b) => a - b);

    // Fuzzy: strip possessives and prefixes
    const stripped = key.replace(/^[a-z]+(?:'s|s)?\s+/i, "").replace(/^(?:his|her|their|the|a|an)\s+/i, "");
    const fuzzy = itemSceneMap.get(stripped);
    if (fuzzy) return [...fuzzy].sort((a, b) => a - b);

    // Try partial match: any key that contains this item
    const matches = new Set<number>();
    for (const [k, scenes] of itemSceneMap) {
      if (k.includes(key) || key.includes(k)) {
        for (const s of scenes) matches.add(s);
      }
    }
    return [...matches].sort((a, b) => a - b);
  }, [itemSceneMap]);

  /** Open script viewer for a specific scene with item highlighted */
  const handleSceneClick = useCallback(async (sceneNum: number, highlightTerm: string) => {
    if (!filmId) return;

    // Fetch the scene data
    const { data: sceneData } = await supabase
      .from("parsed_scenes")
      .select("heading, raw_text")
      .eq("film_id", filmId)
      .eq("scene_number", sceneNum)
      .single();

    if (!sceneData) return;

    const title = sceneData.heading || `Scene ${sceneNum}`;
    openScriptViewer({
      title,
      description: `Scene ${sceneNum} · "${highlightTerm}" highlighted`,
      highlightTerms: [highlightTerm],
    });

    // Parse the raw text into paragraphs
    const paragraphs = parseSceneFromPlainText(sceneData.raw_text, sceneData.heading);
    setScriptViewerScenes([{
      sceneNum,
      heading: title,
      paragraphs,
    }]);
  }, [filmId, openScriptViewer, setScriptViewerScenes]);

  /* DnD state */
  const [activeDrag, setActiveDrag] = useState<{ item: string; sourceGroupId: string | null; category: CategoryKey } | null>(null);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
      if (useManagedCategories) return;
    }
    if (!analysisId) return;
    const save = async () => {
      const updatedGlobal = {
        ...data,
        _managed: {
          version: MANAGED_SCHEMA_VERSION,
          categories: categoriesRef.current,
          reviewStatus: reviewStatusRef.current,
        },
      };
      await supabase
        .from("script_analyses")
        .update({ global_elements: updatedGlobal as any })
        .eq("id", analysisId);
      pendingSaveRef.current = null;
    };
    pendingSaveRef.current = save;
    const timeout = setTimeout(save, 500);
    return () => clearTimeout(timeout);
  }, [categories, reviewStatus, analysisId, useManagedCategories]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      pendingSaveRef.current?.();
    };
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

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

  /* Click outside any chip to deselect all */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selected.size === 0 && !editingItem) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-chip], button, input, [role='dialog']")) return;
      clearSelection();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selected, editingItem, clearSelection]);

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

  /* DnD handlers */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as { item: string; sourceGroupId: string | null; category: CategoryKey } | undefined;
    if (data) setActiveDrag(data);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over) return;
    const source = active.data.current as { item: string; sourceGroupId: string | null; category: CategoryKey };
    const target = over.data.current as { groupId: string | null; category: CategoryKey } | undefined;
    if (!source || !target) return;
    if (source.category !== target.category) return; // only within same category
    const targetGroupId = target.groupId;
    if (source.sourceGroupId === targetGroupId) return; // same container

    setCategories((prev) => {
      const cat = { ...prev[source.category] };
      // Remove from source
      if (source.sourceGroupId) {
        cat.groups = cat.groups.map((g) =>
          g.id === source.sourceGroupId
            ? { ...g, variants: g.variants.filter((v) => v !== source.item) }
            : g
        ).filter((g) => g.variants.length > 0);
      } else {
        cat.ungrouped = cat.ungrouped.filter((u) => u !== source.item);
      }
      // Add to target
      if (targetGroupId) {
        cat.groups = cat.groups.map((g) =>
          g.id === targetGroupId
            ? { ...g, variants: [...g.variants, source.item] }
            : g
        );
      } else {
        cat.ungrouped = [...cat.ungrouped, source.item];
      }
      return { ...prev, [source.category]: cat };
    });
  }, []);

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
              <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                    <DroppableGroup key={group.id} groupId={group.id} category={key}>
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
                          {[...group.variants].sort((a, b) => a.localeCompare(b)).map((v) => (
                            <DraggableChip
                              key={v}
                              item={v}
                              sourceGroupId={group.id}
                              category={key}
                              isSelected={selected.has(v) && activeCategory === key}
                              isDisabled={activeCategory !== null && activeCategory !== key}
                              isEditing={editingItem === v}
                              editText={editText}
                              editInputRef={editInputRef}
                              onEditChange={setEditText}
                              onRename={(old, newN) => renameItem(old, newN, key)}
                              onEditCancel={() => setEditingItem(null)}
                              onToggleSelect={() => toggleSelect(v, key)}
                              sceneNumbers={(key === "wardrobe" || key === "props") ? getScenesForItem(v) : undefined}
                              onSceneClick={(key === "wardrobe" || key === "props") ? handleSceneClick : undefined}
                            />
                          ))}
                        </div>
                      )}
                    </DroppableGroup>
                  );
                })}

                {/* Ungrouped items – droppable zone */}
                <DroppableGroup groupId={null} category={key} isUngrouped>
                  {[...cat.ungrouped].sort((a, b) => a.localeCompare(b)).map((item) => (
                    <DraggableChip
                      key={item}
                      item={item}
                      sourceGroupId={null}
                      category={key}
                      isSelected={selected.has(item) && activeCategory === key}
                      isDisabled={activeCategory !== null && activeCategory !== key}
                      isEditing={editingItem === item}
                      editText={editText}
                      editInputRef={editInputRef}
                      onEditChange={setEditText}
                      onRename={(old, newN) => renameItem(old, newN, key)}
                      onEditCancel={() => setEditingItem(null)}
                      onToggleSelect={() => toggleSelect(item, key)}
                      onDelete={() => deleteItem(key, item)}
                      sceneNumbers={(key === "wardrobe" || key === "props") ? getScenesForItem(item) : undefined}
                      onSceneClick={(key === "wardrobe" || key === "props") ? handleSceneClick : undefined}
                    />
                  ))}
                </DroppableGroup>

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
                    Drag to reorder · Click to select · Click again to edit name
                  </p>
                )}

                {/* Review status buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-border mt-3">
                  <span className="text-xs text-muted-foreground mr-auto">Review Status:</span>
                  <Button
                    size="sm"
                    variant={reviewStatus[key] === "needs_review" ? "default" : "outline"}
                    className={cn("h-7 text-xs gap-1.5", reviewStatus[key] === "needs_review" ? "bg-amber-500 hover:bg-amber-600 text-white" : "opacity-60")}
                    onClick={() => setReviewStatus(prev => ({ ...prev, [key]: prev[key] === "needs_review" ? "unreviewed" : "needs_review" }))}
                  >
                    <AlertCircle className="h-3 w-3" />
                    Still Needs Review
                  </Button>
                  <Button
                    size="sm"
                    variant={reviewStatus[key] === "completed" ? "success" : "outline"}
                    className={cn("h-7 text-xs gap-1.5", reviewStatus[key] !== "completed" && "opacity-60")}
                    onClick={() => setReviewStatus(prev => ({ ...prev, [key]: prev[key] === "completed" ? "unreviewed" : "completed" }))}
                  >
                    {reviewStatus[key] === "completed" ? <CheckCircle2 className="h-3 w-3" /> : <ThumbsUp className="h-3 w-3" />}
                    {reviewStatus[key] === "completed" ? "Approved" : "Approve"}
                  </Button>
                </div>
              </div>

              {/* Drag overlay */}
              <DragOverlay>
                {activeDrag && (
                  <span className="text-xs rounded-full px-2.5 py-1 border bg-primary text-primary-foreground border-primary shadow-lg cursor-grabbing">
                    <GripVertical className="inline h-3 w-3 mr-0.5 opacity-70" />
                    {activeDrag.item}
                  </span>
                )}
              </DragOverlay>
              </DndContext>
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
                  <span
                    key={item}
                    onClick={() => setMergeParentName(item)}
                    className={cn(
                      "text-xs rounded-full px-2.5 py-0.5 border cursor-pointer transition-colors",
                      mergeParentName === item
                        ? "bg-primary/15 text-primary border-primary/40 ring-1 ring-primary/30"
                        : "bg-secondary text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
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

/* ── Droppable Group Zone ───────────────────────────────── */

function DroppableGroup({
  groupId,
  category,
  isUngrouped,
  children,
}: {
  groupId: string | null;
  category: CategoryKey;
  isUngrouped?: boolean;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: groupId ?? `ungrouped-${category}`,
    data: { groupId, category },
  });

  if (isUngrouped) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-wrap gap-1.5 min-h-[32px] rounded-md p-1 transition-colors",
          isOver && "bg-primary/10 ring-1 ring-primary/30"
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md border border-primary/20 bg-primary/5 overflow-hidden transition-colors",
        isOver && "ring-2 ring-primary/40 bg-primary/10"
      )}
    >
      {children}
    </div>
  );
}

/* ── Draggable Chip ─────────────────────────────────────── */

function DraggableChip({
  item,
  sourceGroupId,
  category,
  isSelected,
  isDisabled,
  isEditing,
  editText,
  editInputRef,
  onEditChange,
  onRename,
  onEditCancel,
  onToggleSelect,
  onDelete,
  sceneNumbers,
  onSceneClick,
}: {
  item: string;
  sourceGroupId: string | null;
  category: CategoryKey;
  isSelected: boolean;
  isDisabled: boolean;
  isEditing: boolean;
  editText: string;
  editInputRef: React.RefObject<HTMLInputElement>;
  onEditChange: (v: string) => void;
  onRename: (old: string, newN: string) => void;
  onEditCancel: () => void;
  onToggleSelect: () => void;
  onDelete?: () => void;
  sceneNumbers?: number[];
  onSceneClick?: (sceneNum: number, highlightTerm: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${category}-${sourceGroupId ?? "ungrouped"}-${item}`,
    data: { item, sourceGroupId, category },
    disabled: isEditing,
  });

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <span
        ref={setNodeRef}
        data-chip
        className={cn(
          "text-xs rounded-full px-2.5 py-1 border transition-all select-none inline-flex items-center gap-1 cursor-pointer",
          isSelected
            ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30 shadow-[0_0_8px_-2px_hsl(var(--primary)/0.4)]"
            : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:bg-accent",
          isDisabled && "opacity-40",
          isEditing && "ring-2 ring-primary/50",
          isDragging && "opacity-30",
        )}
      >
        {/* Drag handle */}
        {!isEditing && (
          <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="h-3 w-3 opacity-40 hover:opacity-100 transition-opacity" />
          </span>
        )}
        {isEditing ? (
          <input
            ref={editInputRef}
            value={editText}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRename(item, editText);
              if (e.key === "Escape") onEditCancel();
            }}
            onBlur={() => onRename(item, editText)}
            className="bg-transparent outline-none text-xs w-auto min-w-[40px] text-inherit"
            style={{ width: `${Math.max(editText.length, 3)}ch` }}
            autoFocus
          />
        ) : (
          <button
            disabled={isDisabled}
            onClick={onToggleSelect}
            className="cursor-pointer"
          >
            {isSelected && <Check className="inline h-3 w-3 mr-0.5" />}
            {item}
          </button>
        )}
        {!isEditing && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="ml-0.5 opacity-50 hover:opacity-100 hover:text-destructive transition-opacity"
            title="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
      {/* Scene number badges */}
      {!isEditing && sceneNumbers && sceneNumbers.length > 0 && onSceneClick && (
        <span className="inline-flex flex-wrap gap-0.5 pl-1">
          {sceneNumbers.map((num) => (
            <button
              key={num}
              onClick={(e) => { e.stopPropagation(); onSceneClick(num, item); }}
              className="text-[9px] font-mono leading-none px-1 py-0.5 rounded bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
              title={`View Scene ${num} with "${item}" highlighted`}
            >
              {num}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
