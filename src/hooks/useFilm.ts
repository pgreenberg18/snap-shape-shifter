import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/** Deduplicate vehicle names that clearly refer to the same vehicle */
function deduplicateVehicles(vehicles: string[]): string[] {
  if (vehicles.length <= 1) return vehicles.sort();
  const normalize = (s: string) =>
    s.toLowerCase().replace(/['']s\b/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const groups = new Map<string, string>();
  for (const v of vehicles) {
    const key = normalize(v);
    const existing = groups.get(key);
    if (!existing || v.length > existing.length) groups.set(key, v);
  }
  // Merge entries where one normalized key is a substring of another
  const keys = [...groups.keys()].sort((a, b) => a.length - b.length);
  const merged = new Map<string, string>();
  const consumed = new Set<string>();
  for (const key of keys) {
    if (consumed.has(key)) continue;
    let bestName = groups.get(key)!;
    for (const other of keys) {
      if (other === key || consumed.has(other)) continue;
      if (other.includes(key) || key.includes(other)) {
        consumed.add(other);
        const otherName = groups.get(other)!;
        if (otherName.length > bestName.length) bestName = otherName;
      }
    }
    consumed.add(key);
    merged.set(key, bestName);
  }
  return [...merged.values()].sort();
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

/** Extract unique locations, props, and wardrobe from the latest script breakdown */
export const useBreakdownAssets = () => {
  const filmId = useFilmId();
  return useQuery({
    queryKey: ["breakdown-assets", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("script_analyses")
        .select("scene_breakdown")
        .eq("film_id", filmId!)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.scene_breakdown || !Array.isArray(data.scene_breakdown)) {
        return { locations: [] as string[], props: [] as string[], wardrobe: [] as { character: string; clothing: string }[], vehicles: [] as string[] };
      }
      const scenes = data.scene_breakdown as any[];
      const locationSet = new Set<string>();
      const locationDescMap = new Map<string, string>();
      const propSet = new Set<string>();
      const propContextMap = new Map<string, { scenes: string[]; locations: string[]; characters: Set<string> }>();
      const wardrobeMap = new Map<string, string>();
      const vehicleSet = new Set<string>();
      const vehicleContextMap = new Map<string, { scenes: string[]; locations: string[]; characters: Set<string>; years: Set<string>; moods: Set<string> }>();

      const VEHICLE_KEYWORDS = ["car", "truck", "van", "bus", "suv", "sedan", "taxi", "cab", "limo", "limousine", "motorcycle", "bike", "bicycle", "helicopter", "chopper", "plane", "jet", "boat", "ship", "ambulance", "cruiser", "patrol", "vehicle", "pickup", "jeep", "hummer", "convertible", "coupe", "wagon", "minivan"];
      const NON_PROP_KEYWORDS = ["rain", "snow", "fog", "wind", "lightning", "thunder", "fire", "smoke", "explosion", "flames", "mist", "haze", "storm", "sunlight", "moonlight", "shadow", "shadows", "darkness", "light", "glow", "flicker", "house", "building", "cabin", "mansion", "apartment", "warehouse", "barn", "church", "school", "hospital", "hotel", "motel", "office", "restaurant", "bar", "club", "store", "shop", "beach house", "cottage", "shack", "tower", "castle", "palace", "temple"];

      // First pass: collect all scene data per location (aggregate across scenes)
      type LocMeta = { intExt: string; timesOfDay: Set<string>; envSnippets: string[]; moods: Set<string>; settings: Set<string> };
      const locationMeta = new Map<string, LocMeta>();

      for (const s of scenes) {
        if (s.scene_heading && typeof s.scene_heading === "string" && s.scene_heading !== "N/A") {
          const heading = s.scene_heading.trim();
          const cleanName = heading
            .replace(/^(?:INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|I\/E\.?)\s*[-–—.\s]*/i, "")
            .replace(/\s*[-–—]\s*(?:DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|AFTERNOON|LATER|CONTINUOUS|SAME TIME|MOMENTS?\s+LATER|SUNSET|SUNRISE)$/i, "")
            .trim();
          const locationName = cleanName || heading;
          locationSet.add(locationName);

          const intExt = heading.match(/^(INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|I\/E\.?)/i)?.[0]?.toUpperCase() || "";
          const timeOfDay = s.time_of_day || heading.match(/[-–—]\s*(DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|AFTERNOON|SUNSET|SUNRISE)\s*$/i)?.[1] || "";

          if (!locationMeta.has(locationName)) {
            locationMeta.set(locationName, { intExt, timesOfDay: new Set(), envSnippets: [], moods: new Set(), settings: new Set() });
          }
          const meta = locationMeta.get(locationName)!;
          if (timeOfDay) meta.timesOfDay.add(timeOfDay);
          if (!meta.intExt && intExt) meta.intExt = intExt;
          if (s.setting && s.setting !== "N/A") meta.settings.add(s.setting);
          if (s.environment_details && typeof s.environment_details === "string") meta.envSnippets.push(s.environment_details);
          if (s.mood && typeof s.mood === "string") meta.moods.add(s.mood);
        }

        // Props — collect with scene context
        const sceneLocation = s.scene_heading ? s.scene_heading.trim()
          .replace(/^(?:INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|I\/E\.?)\s*[-–—.\s]*/i, "")
          .replace(/\s*[-–—]\s*(?:DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|AFTERNOON|LATER|CONTINUOUS|SAME TIME|MOMENTS?\s+LATER|SUNSET|SUNRISE)$/i, "")
          .trim() : "";
        const sceneChars: string[] = Array.isArray(s.characters) ? s.characters : [];
        const sceneDesc: string = s.description || "";
        const sceneMood: string = s.mood || "";
        const sceneYear = s.scene_heading?.match(/(\d{4})/)?.[1] || "";

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
        if (Array.isArray(s.picture_vehicles)) {
          for (const v of s.picture_vehicles) {
            if (typeof v === "string" && v.length > 1) { vehicleSet.add(v); addVehicleContext(v); }
          }
        }
        if (Array.isArray(s.vehicles)) {
          for (const v of s.vehicles) {
            if (typeof v === "string" && v.length > 1) { vehicleSet.add(v); addVehicleContext(v); }
          }
        }
        if (Array.isArray(s.wardrobe)) {
          for (const w of s.wardrobe) {
            const char = typeof w === "string" ? "Unknown" : (w?.character || w?.name || "Unknown");
            const clothing = typeof w === "string" ? w : (w?.clothing_style || w?.condition || "");
            if (clothing) {
              const key = `${char}::${clothing}`;
              if (!wardrobeMap.has(key)) wardrobeMap.set(key, key);
            }
          }
        }
      }

      // Second pass: build descriptions, inheriting parent context for sub-locations
      const sortedLocations = [...locationSet].sort();
      for (const loc of sortedLocations) {
        const meta = locationMeta.get(loc);
        const parts: string[] = [];

        if (meta) {
          // INT/EXT + time of day header
          const times = [...meta.timesOfDay].join(", ");
          if (meta.intExt || times) parts.push([meta.intExt, times].filter(Boolean).join(" — "));

          // Best environment snippet (longest = most detailed)
          if (meta.envSnippets.length > 0) {
            const best = meta.envSnippets.sort((a, b) => b.length - a.length)[0];
            parts.push(best);
          } else if (meta.settings.size > 0) {
            parts.push([...meta.settings][0]);
          }

          // Mood
          if (meta.moods.size > 0) {
            parts.push("Mood: " + [...meta.moods].join(", "));
          }
        }

        // If still empty, try to inherit from parent location (e.g., "WELLS HOME" for "WELLS HOME - KITCHEN")
        if (parts.length <= 1 && loc.includes(" - ")) {
          const parentName = loc.split(" - ")[0].trim();
          const parentMeta = locationMeta.get(parentName);
          if (parentMeta) {
            if (parentMeta.envSnippets.length > 0) {
              const best = parentMeta.envSnippets.sort((a, b) => b.length - a.length)[0];
              parts.push("Part of " + parentName + ". " + best);
            } else if (parentMeta.settings.size > 0) {
              parts.push("Part of " + parentName + ". " + [...parentMeta.settings][0]);
            }
            if (parentMeta.moods.size > 0 && !parts.some((p) => p.startsWith("Mood:"))) {
              parts.push("Mood: " + [...parentMeta.moods].join(", "));
            }
          }
        }

        // Final fallback: generate a minimal description from the name itself
        if (parts.length === 0) {
          const nameParts = loc.split(/\s*[-–—]\s*/);
          if (nameParts.length > 1) {
            parts.push(nameParts.join(", ") + ".");
          } else {
            parts.push(loc + ".");
          }
        }

        const desc = parts.join(". ").replace(/\.\./g, ".").replace(/\.\s*\./g, ".");
        locationDescMap.set(loc, desc);
      }

      // Build prop descriptions from scene context
      const propDescMap: Record<string, string> = {};
      for (const prop of propSet) {
        const ctx = propContextMap.get(prop);
        const parts: string[] = [];
        if (ctx) {
          const chars = [...ctx.characters];
          if (chars.length > 0) parts.push("Used by " + chars.slice(0, 3).join(", "));
          const uniqueLocs = [...new Set(ctx.locations)];
          if (uniqueLocs.length > 0) parts.push("Found in " + uniqueLocs.slice(0, 2).join(", "));
          if (ctx.scenes.length > 0) {
            // Pick shortest scene description as a concise context snippet
            const snippet = ctx.scenes.sort((a, b) => a.length - b.length)[0];
            if (snippet.length <= 120) {
              parts.push(snippet);
            } else {
              parts.push(snippet.slice(0, 117) + "…");
            }
          }
        }
        propDescMap[prop] = parts.length > 0 ? parts.join(". ") : prop;
      }

      // Build vehicle descriptions with implied period details
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

        // Implied style from vehicle type
        for (const [keyword, hint] of Object.entries(VEHICLE_STYLE_HINTS)) {
          if (lower.includes(keyword)) { parts.push(hint); break; }
        }

        if (ctx) {
          // Period implication from scene year
          const years = [...ctx.years].sort();
          if (years.length > 0) {
            const earliest = years[0];
            parts.push(`Period: ${earliest}s — expect era-appropriate make, model, and wear`);
          }

          // Who drives / is associated
          const chars = [...ctx.characters];
          if (chars.length > 0) parts.push("Associated with " + chars.slice(0, 3).join(", "));

          // Where it appears
          const uniqueLocs = [...new Set(ctx.locations)];
          if (uniqueLocs.length > 0) parts.push("Seen at " + uniqueLocs.slice(0, 2).join(", "));

          // Mood implication
          const moods = [...ctx.moods];
          if (moods.length > 0) parts.push("Scene tone: " + moods.slice(0, 2).join(", "));
        }

        vehicleDescMap[veh] = parts.length > 0 ? parts.join(". ") : veh;
      }

      return {
        locations: sortedLocations,
        locationDescriptions: Object.fromEntries(locationDescMap),
        props: [...propSet].sort(),
        propDescriptions: propDescMap,
        wardrobe: [...wardrobeMap.keys()].map((k) => {
          const [character, clothing] = k.split("::");
          return { character, clothing };
        }),
        vehicles: deduplicateVehicles([...vehicleSet]),
        vehicleDescriptions: vehicleDescMap,
      };
    },
    enabled: !!filmId,
  });
};

/** @deprecated Use useFilmId() instead */
export const FILM_ID = "00000000-0000-0000-0000-000000000001";
