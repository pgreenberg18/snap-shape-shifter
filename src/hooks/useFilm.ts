import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Smart deduplication: merges items that refer to the same thing by understanding
 * ownership (possessives), synonym families, case, plurals, and compound words.
 */
function smartMergeItems(
  items: Set<string>,
  ctxMap: Map<string, any>,
  options: { families?: string[][] } = {}
): { items: Set<string>; ctxMap: Map<string, any> } {
  if (items.size <= 1) return { items: new Set(items), ctxMap: new Map(ctxMap) };

  const allFamilyMembers = new Set<string>();
  (options.families || []).forEach(fam => fam.forEach(f => allFamilyMembers.add(f.toLowerCase())));

  const parseOwnership = (s: string): { owner: string; noun: string } => {
    const lower = s.toLowerCase().replace(/['']/g, "'").replace(/\s+/g, " ").trim();
    if (allFamilyMembers.has(lower)) return { owner: "", noun: lower };
    const possMatch = lower.match(/^(.+?)'s?\s+(.+)$/);
    if (possMatch) return { owner: possMatch[1].trim(), noun: possMatch[2].trim() };
    const parenMatch = lower.match(/^(.+?)\s*\((.+?)'s?\)$/);
    if (parenMatch) return { owner: parenMatch[2].trim(), noun: parenMatch[1].trim() };
    return { owner: "", noun: lower };
  };

  const familyOf = new Map<string, number>();
  (options.families || []).forEach((fam, i) => {
    for (const noun of fam) familyOf.set(noun.toLowerCase(), i);
  });

  const getFamilyId = (noun: string): string => {
    const lower = noun.toLowerCase().replace(/\s+/g, " ").trim();
    const fid = familyOf.get(lower);
    if (fid !== undefined) return `F${fid}`;
    if (lower.endsWith("s") && lower.length > 3) {
      const fid2 = familyOf.get(lower.slice(0, -1));
      if (fid2 !== undefined) return `F${fid2}`;
    }
    const spaceless = lower.replace(/\s/g, "");
    const fid3 = familyOf.get(spaceless);
    if (fid3 !== undefined) return `F${fid3}`;
    const normalized = spaceless.endsWith("s") && spaceless.length > 3 ? spaceless.slice(0, -1) : spaceless;
    return `N_${normalized}`;
  };

  type Parsed = { owner: string; noun: string; familyId: string; original: string };
  const parsed: Parsed[] = [...items].map(s => {
    const { owner, noun } = parseOwnership(s);
    return { owner, noun, familyId: getFamilyId(noun), original: s };
  });

  const groups = new Map<string, Parsed[]>();
  for (const p of parsed) {
    const key = `${p.owner}|||${p.familyId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  // Cross-merge: ownerless → owned if exactly 1 owned match in same family
  const groupKeys = [...groups.keys()];
  for (const key of groupKeys) {
    if (!key.startsWith("|||")) continue;
    if (!groups.has(key)) continue;
    const familyId = key.slice(3);
    const ownedMatches = groupKeys.filter(k => k !== key && groups.has(k) && k.endsWith(`|||${familyId}`) && !k.startsWith("|||"));
    if (ownedMatches.length === 1) {
      groups.get(ownedMatches[0])!.push(...groups.get(key)!);
      groups.delete(key);
    }
  }

  const newItems = new Set<string>();
  const newCtxMap = new Map<string, any>();

  for (const [, group] of groups) {
    group.sort((a, b) => {
      if (a.owner && !b.owner) return -1;
      if (!a.owner && b.owner) return 1;
      if (a.noun.length !== b.noun.length) return b.noun.length - a.noun.length;
      const aUpper = a.original === a.original.toUpperCase();
      const bUpper = b.original === b.original.toUpperCase();
      if (!aUpper && bUpper) return -1;
      if (aUpper && !bUpper) return 1;
      return b.original.length - a.original.length;
    });
    const canonical = group[0].original;
    newItems.add(canonical);

    let merged: any = null;
    for (const p of group) {
      const ctx = ctxMap.get(p.original);
      if (!ctx) continue;
      if (!merged) {
        merged = { ...ctx, scenes: [...(ctx.scenes || [])], locations: [...(ctx.locations || [])], characters: new Set(ctx.characters || []) };
        for (const k of Object.keys(ctx)) {
          if (!["scenes", "locations", "characters"].includes(k)) {
            const v = ctx[k];
            if (v instanceof Set) merged[k] = new Set(v);
            else if (Array.isArray(v)) merged[k] = [...v];
          }
        }
      } else {
        if (ctx.scenes) merged.scenes.push(...ctx.scenes);
        if (ctx.locations) merged.locations.push(...ctx.locations);
        if (ctx.characters) for (const c of ctx.characters) merged.characters.add(c);
        for (const k of Object.keys(ctx)) {
          if (!["scenes", "locations", "characters"].includes(k)) {
            const v = ctx[k];
            if (v instanceof Set && merged[k] instanceof Set) for (const x of v) merged[k].add(x);
            else if (Array.isArray(v) && Array.isArray(merged[k])) merged[k].push(...v);
          }
        }
      }
    }
    if (merged) newCtxMap.set(canonical, merged);
  }

  return { items: newItems, ctxMap: newCtxMap };
}
/** Returns the current film (version) ID from the URL */
export const useFilmId = (): string | undefined => {
  const { versionId } = useParams<{ versionId: string }>();
  return versionId;
};

export const useFilm = () => {
  const filmId = useFilmId();
  return useQuery({
    queryKey: ["film", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("films")
        .select("*")
        .eq("id", filmId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });
};

export const useCharacters = () => {
  const filmId = useFilmId();
  return useQuery({
    queryKey: ["characters", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .eq("film_id", filmId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });
};

export const useShots = () => {
  const filmId = useFilmId();
  return useQuery({
    queryKey: ["shots", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shots")
        .select("*")
        .eq("film_id", filmId!)
        .order("scene_number");
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });
};

/** Fetch all parsed scenes for the current film (single source of truth for scene data) */
export const useParsedScenes = () => {
  const filmId = useFilmId();
  return useQuery({
    queryKey: ["parsed-scenes", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parsed_scenes")
        .select("*")
        .eq("film_id", filmId!)
        .order("scene_number");
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });
};
export const useTimelineClips = () => {
  const filmId = useFilmId();
  return useQuery({
    queryKey: ["timeline-clips", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_production_clips")
        .select("*")
        .eq("film_id", filmId!)
        .order("left_pos");
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });
};

export const useContentSafety = () => {
  const filmId = useFilmId();
  return useQuery({
    queryKey: ["content-safety", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_safety")
        .select("*")
        .eq("film_id", filmId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });
};

export const useIntegrations = () =>
  useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .order("section_id");
      if (error) throw error;
      return data;
    },
  });

/** Extract unique locations, props, and wardrobe from parsed_scenes (live enriched data) */
export const useBreakdownAssets = () => {
  const filmId = useFilmId();
  return useQuery({
    queryKey: ["breakdown-assets", filmId],
    queryFn: async () => {
      const { data: scenes, error } = await supabase
        .from("parsed_scenes")
        .select("*")
        .eq("film_id", filmId!)
        .order("scene_number");
      if (error) throw error;
      if (!scenes || scenes.length === 0) {
        return { locations: [] as string[], props: [] as string[], wardrobe: [] as { character: string; clothing: string }[], vehicles: [] as string[] };
      }

      const locationSet = new Set<string>();
      const locationDescMap = new Map<string, string>();
      const locationSceneCount = new Map<string, number>(); // count how many scenes each location appears in
      const propSet = new Set<string>();
      const propContextMap = new Map<string, { scenes: string[]; locations: string[]; characters: Set<string> }>();
      const wardrobeMap = new Map<string, string>();
      const vehicleSet = new Set<string>();
      const vehicleContextMap = new Map<string, { scenes: string[]; locations: string[]; characters: Set<string>; years: Set<string>; moods: Set<string> }>();

      const VEHICLE_KEYWORDS = ["car", "truck", "van", "bus", "suv", "sedan", "taxi", "cab", "limo", "limousine", "motorcycle", "bike", "bicycle", "helicopter", "chopper", "plane", "jet", "boat", "ship", "ambulance", "cruiser", "patrol", "vehicle", "pickup", "jeep", "hummer", "convertible", "coupe", "wagon", "minivan", "corvette", "mustang", "camaro", "tesla", "porsche", "ferrari", "bmw", "mercedes", "audi", "honda", "toyota", "ford", "chevy", "chevrolet", "dodge", "nissan", "subaru", "lexus", "cadillac", "lincoln", "buick", "pontiac", "oldsmobile"];
      const NON_PROP_KEYWORDS = ["rain", "snow", "fog", "wind", "lightning", "thunder", "fire", "smoke", "explosion", "flames", "mist", "haze", "storm", "sunlight", "moonlight", "shadow", "shadows", "darkness", "light", "glow", "flicker", "house", "building", "cabin", "mansion", "apartment", "warehouse", "barn", "church", "school", "hospital", "hotel", "motel", "office", "restaurant", "bar", "club", "store", "shop", "beach house", "cottage", "shack", "tower", "castle", "palace", "temple"];

      // First pass: collect all scene data per location (aggregate across scenes)
      type LocMeta = { intExt: string; timesOfDay: Set<string>; envSnippets: string[]; moods: Set<string>; settings: Set<string> };
      const locationMeta = new Map<string, LocMeta>();

      for (const s of scenes) {
        // Location from parsed_scenes uses location_name, heading, int_ext, day_night directly
        const locationName = s.location_name?.trim() || (() => {
          if (!s.heading || s.heading === "N/A") return "";
          return s.heading
            .replace(/^(?:INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|I\/E\.?)\s*[-–—.\s]*/i, "")
            .replace(/\s*[-–—]\s*(?:DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|AFTERNOON|LATER|CONTINUOUS|SAME TIME|MOMENTS?\s+LATER|SUNSET|SUNRISE)$/i, "")
            .trim();
        })();

        if (locationName) {
          // Filter out vehicle-based scene headings (e.g. "HOWARD'S CAR", "CORVETTE")
          const locLower = locationName.toLowerCase().trim();
          // Check if the entire location IS a vehicle keyword (exact match)
          const isExactVehicle = VEHICLE_KEYWORDS.includes(locLower);
          // Check if the location contains a vehicle keyword as a word
          const containsVehicleWord = VEHICLE_KEYWORDS.some((v) => {
            const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new RegExp(`(?:^|[\\s\\-–—/.,;:'"()])${escaped}(?:$|[\\s\\-–—/.,;:'"()])`, "i").test(` ${locLower} `);
          });
          // Also detect possessive vehicle patterns: "HOWARD'S CAR", "RACHEL'S CAR"
          const isPossessiveVehicle = /^[a-z]+'s\s+/i.test(locLower) && VEHICLE_KEYWORDS.some((v) => locLower.replace(/^[a-z]+'s\s+/i, "").trim() === v);
          const isVehicleLocation = isExactVehicle || containsVehicleWord || isPossessiveVehicle;
          if (isVehicleLocation) {
            vehicleSet.add(locationName);
            // Don't add to locationSet — skip to next scene
          } else {
          locationSet.add(locationName);
          locationSceneCount.set(locationName, (locationSceneCount.get(locationName) || 0) + 1);
          const intExt = s.int_ext || s.heading?.match(/^(INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|I\/E\.?)/i)?.[0]?.toUpperCase() || "";
          const timeOfDay = s.day_night || "";

          if (!locationMeta.has(locationName)) {
            locationMeta.set(locationName, { intExt, timesOfDay: new Set(), envSnippets: [], moods: new Set(), settings: new Set() });
          }
          const meta = locationMeta.get(locationName)!;
          if (timeOfDay) meta.timesOfDay.add(timeOfDay);
          if (!meta.intExt && intExt) meta.intExt = intExt;
          if (s.environment_details && typeof s.environment_details === "string") meta.envSnippets.push(s.environment_details);
          if (s.mood && typeof s.mood === "string") meta.moods.add(s.mood);
          }
        }

        // Scene context for props/vehicles
        const sceneLocation = locationName;
        const sceneChars: string[] = Array.isArray(s.characters) ? s.characters : [];
        const sceneDesc: string = s.description || "";
        const sceneMood: string = s.mood || "";
        const sceneYear = s.heading?.match(/(\d{4})/)?.[1] || "";

        const addVehicleContext = (v: string) => {
          if (!vehicleContextMap.has(v)) {
            vehicleContextMap.set(v, { scenes: [], locations: [], characters: new Set(), years: new Set(), moods: new Set() });
          }
          const ctx = vehicleContextMap.get(v)!;
          if (sceneDesc) ctx.scenes.push(sceneDesc);
          if (sceneLocation) ctx.locations.push(sceneLocation);
          for (const c of sceneChars) ctx.characters.add(c);
          if (sceneYear) ctx.years.add(sceneYear);
          if (sceneMood) ctx.moods.add(sceneMood);
        };

        // Props from key_objects
        if (Array.isArray(s.key_objects)) {
          for (const p of s.key_objects) {
            if (typeof p === "string" && p.length > 1) {
              const lower = p.toLowerCase();
              if (VEHICLE_KEYWORDS.some((v) => lower.includes(v))) {
                vehicleSet.add(p);
                addVehicleContext(p);
              } else if (NON_PROP_KEYWORDS.some((np) => lower === np || lower === np + "s")) {
                // skip
              } else {
                propSet.add(p);
                if (!propContextMap.has(p)) {
                  propContextMap.set(p, { scenes: [], locations: [], characters: new Set() });
                }
                const pctx = propContextMap.get(p)!;
                if (sceneDesc) pctx.scenes.push(sceneDesc);
                if (sceneLocation) pctx.locations.push(sceneLocation);
                for (const c of sceneChars) pctx.characters.add(c);
              }
            }
          }
        }
        // Picture vehicles from dedicated column
        if (Array.isArray(s.picture_vehicles)) {
          for (const v of s.picture_vehicles) {
            if (typeof v === "string" && v.length > 1) { vehicleSet.add(v); addVehicleContext(v); }
          }
        }
        // Wardrobe from dedicated column
        if (Array.isArray(s.wardrobe)) {
          for (const w of s.wardrobe as any[]) {
            const char = typeof w === "string" ? "Unknown" : (w?.character || w?.name || "Unknown");
            const clothing = typeof w === "string" ? w : (w?.clothing_style || w?.condition || "");
            if (clothing) {
              const key = `${char}::${clothing}`;
              if (!wardrobeMap.has(key)) wardrobeMap.set(key, key);
            }
          }
        }
      }

      // ── Smart deduplication: merge items that refer to the same thing ──
      const VEHICLE_FAMILIES: string[][] = [
        ["car", "sedan", "coupe", "vehicle", "auto", "automobile", "corvette", "classic corvette", "tesla", "mustang", "camaro"],
        ["cop car", "police car", "cop's car", "cruiser", "patrol car", "patrol"],
        ["surveillance car"],
        ["van", "cargo van", "passenger van", "cargo van with no windows", "white van", "minivan"],
        ["truck", "pickup"],
        ["bus", "school bus"],
        ["ambulance"],
        ["motorcycle", "bike", "bicycle"],
        ["helicopter", "chopper"],
        ["limo", "limousine"],
        ["on-coming vehicle"],
      ];
      const PROP_FAMILIES: string[][] = [
        ["chalkboard", "chalk board", "blackboard"],
        ["phone", "cell phone", "mobile phone", "cellphone", "telephone"],
        ["gun", "handgun", "pistol", "firearm"],
        ["notebook", "notepad"],
        ["heart monitor", "heart beat monitor"],
        ["collider", "collider chamber", "collision chamber", "collision chamber (tube)"],
        ["electron gun"],
        ["coffee cup", "coffee mug"],
        ["display screen", "display screens"],
        ["computer screen", "computer monitor", "computer monitors"],
        ["framed photo", "double photo frame", "photo frame"],
      ];

      // Deduplicate vehicles
      const vehMerged = smartMergeItems(vehicleSet, vehicleContextMap, { families: VEHICLE_FAMILIES });
      vehicleSet.clear(); for (const v of vehMerged.items) vehicleSet.add(v);
      vehicleContextMap.clear(); for (const [k, v] of vehMerged.ctxMap) vehicleContextMap.set(k, v);

      // Deduplicate props
      const propMerged = smartMergeItems(propSet, propContextMap, { families: PROP_FAMILIES });
      propSet.clear(); for (const p of propMerged.items) propSet.add(p);
      propContextMap.clear(); for (const [k, v] of propMerged.ctxMap) propContextMap.set(k, v);

      // Second pass: build descriptions — enriched with raw script prose
      const sortedLocations = [...locationSet].sort((a, b) => (locationSceneCount.get(b) || 0) - (locationSceneCount.get(a) || 0));
      for (const loc of sortedLocations) {
        const meta = locationMeta.get(loc);
        const parts: string[] = [];

        if (meta) {
          const times = [...meta.timesOfDay].join(", ");
          if (meta.intExt || times) parts.push([meta.intExt, times].filter(Boolean).join(" — "));
          if (meta.envSnippets.length > 0) {
            const best = meta.envSnippets.sort((a, b) => b.length - a.length)[0];
            parts.push(best);
          }
          if (meta.moods.size > 0) {
            parts.push("Mood: " + [...meta.moods].join(", "));
          }
        }

        // Extract introductory prose from raw_text of the first scene at this location
        // Screenplays describe locations in the action lines immediately after the scene heading
        if (parts.length <= 2) {
          for (const s of scenes) {
            const sLocName = s.location_name?.trim() || "";
            if (sLocName !== loc) continue;
            const rawText = s.raw_text || "";
            // Skip the heading line(s) and grab the first action paragraph
            const lines = rawText.split("\n");
            let foundHeading = false;
            const proseLines: string[] = [];
            for (const line of lines) {
              const trimmed = line.trim();
              if (!foundHeading) {
                // Skip until we pass the scene heading
                if (/^(?:INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|I\/E\.?)\s/i.test(trimmed)) {
                  foundHeading = true;
                }
                continue;
              }
              // Stop at blank lines after collecting prose, character cues, or next heading
              if (!trimmed && proseLines.length > 0) break;
              if (!trimmed) continue;
              // Character cues are ALL CAPS short lines
              if (/^[A-Z][A-Z\s.'-]{1,30}$/.test(trimmed) && trimmed.length < 35) break;
              // Parentheticals in dialogue
              if (/^\(/.test(trimmed)) break;
              proseLines.push(trimmed);
              if (proseLines.join(" ").length > 250) break;
            }
            if (proseLines.length > 0) {
              const prose = proseLines.join(" ").replace(/\s+/g, " ").trim();
              // Truncate to ~2 sentences
              const sentences = prose.match(/[^.!?]+[.!?]+/g);
              const snippet = sentences && sentences.length > 2
                ? sentences.slice(0, 2).join("").trim()
                : prose;
              if (snippet.length > 15) {
                parts.push(snippet);
                break; // Only need the first scene's intro
              }
            }
          }
        }

        if (parts.length <= 1 && loc.includes(" - ")) {
          const parentName = loc.split(" - ")[0].trim();
          const parentMeta = locationMeta.get(parentName);
          if (parentMeta) {
            if (parentMeta.envSnippets.length > 0) {
              const best = parentMeta.envSnippets.sort((a, b) => b.length - a.length)[0];
              parts.push("Part of " + parentName + ". " + best);
            }
            if (parentMeta.moods.size > 0 && !parts.some((p) => p.startsWith("Mood:"))) {
              parts.push("Mood: " + [...parentMeta.moods].join(", "));
            }
          }
        }

        if (parts.length === 0) {
          const nameParts = loc.split(/\s*[-–—]\s*/);
          if (nameParts.length > 1) parts.push(nameParts.join(", ") + ".");
          else parts.push(loc + ".");
        }

        const desc = parts.join(". ").replace(/\.\./g, ".").replace(/\.\s*\./g, ".");
        locationDescMap.set(loc, desc);
      }

      // Build prop descriptions + rename props with character ownership + build groups
      const propDescMap: Record<string, string> = {};
      const renamedProps: string[] = [];
      const propGroupsByChar = new Map<string, string[]>();
      const propGroupsByLoc = new Map<string, string[]>();

      // Helper: capitalize first letter of each word
      const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

      // Helper: check if already has possessive
      const hasPossessive = (s: string) => /\b[A-Za-z]+'s\b/i.test(s) || /\([A-Za-z]+'s\)/i.test(s);

      // Helper: format character name for possessive
      const possessive = (name: string) => {
        const formatted = titleCase(name.toLowerCase());
        return formatted.endsWith("s") ? `${formatted}'` : `${formatted}'s`;
      };

      for (const prop of propSet) {
        const ctx = propContextMap.get(prop);
        const parts: string[] = [];
        let displayName = prop;
        let primaryChar = "";
        let primaryLoc = "";

        if (ctx) {
          const chars = [...ctx.characters];
          const uniqueLocs = [...new Set(ctx.locations)];

          // Determine primary owner: if used by exactly 1 character, that's the owner
          // If used by 2-3 characters, pick the first (most relevant from script order)
          if (chars.length === 1) {
            primaryChar = chars[0];
          } else if (chars.length >= 2) {
            // If used in only 1 scene, the character list is specific enough
            if (ctx.scenes.length <= 2) primaryChar = chars[0];
          }

          // Rename: add character possessive if not already present
          if (primaryChar && !hasPossessive(prop)) {
            const propLower = prop.toLowerCase();
            // Don't add possessive to generic/shared items
            const isGeneric = /^(door|wall|window|floor|ceiling|table|chair|desk|bed|light|lamp|sign|screen|monitor)$/i.test(propLower);
            if (!isGeneric) {
              displayName = `${possessive(primaryChar)} ${titleCase(prop)}`;
            }
          } else {
            displayName = titleCase(prop);
          }

          // If no clear character owner, check for a primary location
          if (!primaryChar && uniqueLocs.length === 1) {
            primaryLoc = uniqueLocs[0];
          }

          if (chars.length > 0) parts.push("Used by " + chars.slice(0, 3).join(", "));
          if (uniqueLocs.length > 0) parts.push("Found in " + uniqueLocs.slice(0, 2).join(", "));
          if (ctx.scenes.length > 0) {
            const snippet = ctx.scenes.sort((a, b) => a.length - b.length)[0];
            parts.push(snippet.length <= 120 ? snippet : snippet.slice(0, 117) + "…");
          }
        } else {
          displayName = titleCase(prop);
        }

        renamedProps.push(displayName);
        propDescMap[displayName] = parts.length > 0 ? parts.join(". ") : displayName;

        // Group by character
        if (primaryChar) {
          const charKey = titleCase(primaryChar.toLowerCase());
          if (!propGroupsByChar.has(charKey)) propGroupsByChar.set(charKey, []);
          propGroupsByChar.get(charKey)!.push(displayName);
        } else if (primaryLoc) {
          // Group by location (use shorter name)
          const locKey = primaryLoc.split(" - ")[0].trim();
          const locDisplay = titleCase(locKey.toLowerCase());
          if (!propGroupsByLoc.has(locDisplay)) propGroupsByLoc.set(locDisplay, []);
          propGroupsByLoc.get(locDisplay)!.push(displayName);
        }
      }

      // Build initialGroups for props
      const propInitialGroups: Array<{ id: string; name: string; children: string[] }> = [];
      for (const [charName, items] of propGroupsByChar) {
        if (items.length >= 1) {
          propInitialGroups.push({
            id: `prop-char-${charName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
            name: charName,
            children: items,
          });
        }
      }
      for (const [locName, items] of propGroupsByLoc) {
        if (items.length >= 2) {
          propInitialGroups.push({
            id: `prop-loc-${locName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
            name: locName,
            children: items,
          });
        }
      }
      // Sort groups by number of children (most props first)
      propInitialGroups.sort((a, b) => b.children.length - a.children.length);

      // Build vehicle descriptions
      const vehicleDescMap: Record<string, string> = {};
      const VEHICLE_STYLE_HINTS: Record<string, string> = {
        "car": "Likely a practical sedan or coupe typical of the era",
        "truck": "Rugged work truck, probably well-worn from daily use",
        "van": "Full-size van, utilitarian with minimal amenities",
        "suv": "Sport utility vehicle, reflecting the owner's status",
        "sedan": "Four-door sedan, understated and reliable",
        "taxi": "Licensed taxi cab with meter and roof light",
        "cab": "City cab, well-used interior with vinyl seats",
        "ambulance": "Emergency medical vehicle with full markings and lights",
        "cruiser": "Law enforcement cruiser with standard police livery",
        "patrol": "Patrol vehicle with department markings and spotlight",
        "motorcycle": "Two-wheel motorcycle, chrome and leather detailing",
        "helicopter": "Rotary-wing aircraft, likely civilian or law enforcement",
        "pickup": "Pickup truck with open bed, working-class vehicle",
        "limo": "Stretch limousine, polished exterior with tinted windows",
        "limousine": "Full-length limousine, chauffeur-driven luxury",
        "convertible": "Open-top convertible, sporty and attention-grabbing",
        "bus": "Transit or school bus, institutional and utilitarian",
        "boat": "Watercraft suited to the scene's waterway setting",
        "jeep": "Rugged off-road vehicle, military or civilian style",
      };

      for (const veh of vehicleSet) {
        const ctx = vehicleContextMap.get(veh);
        const parts: string[] = [];
        const lower = veh.toLowerCase();
        for (const [keyword, hint] of Object.entries(VEHICLE_STYLE_HINTS)) {
          if (lower.includes(keyword)) { parts.push(hint); break; }
        }
        if (ctx) {
          const years = [...ctx.years].sort();
          if (years.length > 0) parts.push(`Period: ${years[0]}s — expect era-appropriate make, model, and wear`);
          const chars = [...ctx.characters];
          if (chars.length > 0) parts.push("Associated with " + chars.slice(0, 3).join(", "));
          const uniqueLocs = [...new Set(ctx.locations)];
          if (uniqueLocs.length > 0) parts.push("Seen at " + uniqueLocs.slice(0, 2).join(", "));
          const moods = [...ctx.moods];
          if (moods.length > 0) parts.push("Scene tone: " + moods.slice(0, 2).join(", "));
        }
        vehicleDescMap[veh] = parts.length > 0 ? parts.join(". ") : veh;
      }

      return {
        locations: sortedLocations,
        locationDescriptions: Object.fromEntries(locationDescMap),
        locationSceneCounts: Object.fromEntries(locationSceneCount),
        props: renamedProps.sort(),
        propDescriptions: propDescMap,
        propInitialGroups,
        wardrobe: [...wardrobeMap.keys()].map((k) => {
          const [character, clothing] = k.split("::");
          return { character, clothing };
        }),
        vehicles: [...vehicleSet].sort(),
        vehicleDescriptions: vehicleDescMap,
      };
    },
    enabled: !!filmId,
  });
};

/** @deprecated Use useFilmId() instead */
export const FILM_ID = "00000000-0000-0000-0000-000000000001";
