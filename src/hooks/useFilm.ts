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
        .single();
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
      const wardrobeMap = new Map<string, string>();
      const vehicleSet = new Set<string>();

      const VEHICLE_KEYWORDS = ["car", "truck", "van", "bus", "suv", "sedan", "taxi", "cab", "limo", "limousine", "motorcycle", "bike", "bicycle", "helicopter", "chopper", "plane", "jet", "boat", "ship", "ambulance", "cruiser", "patrol", "vehicle", "pickup", "jeep", "hummer", "convertible", "coupe", "wagon", "minivan"];
      // Filter out things that aren't actual props (effects, locations, weather, etc.)
      const NON_PROP_KEYWORDS = ["rain", "snow", "fog", "wind", "lightning", "thunder", "fire", "smoke", "explosion", "flames", "mist", "haze", "storm", "sunlight", "moonlight", "shadow", "shadows", "darkness", "light", "glow", "flicker", "house", "building", "cabin", "mansion", "apartment", "warehouse", "barn", "church", "school", "hospital", "hotel", "motel", "office", "restaurant", "bar", "club", "store", "shop", "beach house", "cottage", "shack", "tower", "castle", "palace", "temple"];

      for (const s of scenes) {
        if (s.scene_heading && typeof s.scene_heading === "string" && s.scene_heading !== "N/A") {
          // Strip INT./EXT./INT./EXT. prefix and time-of-day suffix to get clean location name
          let heading = s.scene_heading.trim();
          const cleanName = heading
            .replace(/^(?:INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|I\/E\.?)\s*[-–—.\s]*/i, "")
            .replace(/\s*[-–—]\s*(?:DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|AFTERNOON|LATER|CONTINUOUS|SAME TIME|MOMENTS?\s+LATER|SUNSET|SUNRISE)$/i, "")
            .trim();
          const locationName = cleanName || heading;
          if (!locationSet.has(locationName)) {
            locationSet.add(locationName);
            const intExt = heading.match(/^(INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|I\/E\.?)/i)?.[0] || "";
            const timeOfDay = s.time_of_day || heading.match(/[-–—]\s*(DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|AFTERNOON|SUNSET|SUNRISE)\s*$/i)?.[1] || "";
            const parts: string[] = [];
            if (intExt || timeOfDay) parts.push([intExt.toUpperCase(), timeOfDay].filter(Boolean).join(" — "));
            if (s.setting && s.setting !== "N/A") parts.push(s.setting);
            if (s.description) parts.push(s.description);
            if (s.environment_details) parts.push(s.environment_details);
            const desc = parts.join(". ").replace(/\.\./g, ".");
            if (desc) locationDescMap.set(locationName, desc);
          }
        }
        if (Array.isArray(s.key_objects)) {
          for (const p of s.key_objects) {
            if (typeof p === "string" && p.length > 1) {
              const lower = p.toLowerCase();
              if (VEHICLE_KEYWORDS.some((v) => lower.includes(v))) {
                vehicleSet.add(p);
              } else if (NON_PROP_KEYWORDS.some((np) => lower === np || lower === np + "s")) {
                // Skip non-props (effects, locations masquerading as props)
              } else {
                propSet.add(p);
              }
            }
          }
        }
        // Picture vehicles from dedicated field
        if (Array.isArray(s.picture_vehicles)) {
          for (const v of s.picture_vehicles) {
            if (typeof v === "string" && v.length > 1) vehicleSet.add(v);
          }
        }
        // Legacy vehicles field
        if (Array.isArray(s.vehicles)) {
          for (const v of s.vehicles) {
            if (typeof v === "string" && v.length > 1) vehicleSet.add(v);
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

      return {
        locations: [...locationSet].sort(),
        locationDescriptions: Object.fromEntries(locationDescMap),
        props: [...propSet].sort(),
        wardrobe: [...wardrobeMap.keys()].map((k) => {
          const [character, clothing] = k.split("::");
          return { character, clothing };
        }),
        vehicles: deduplicateVehicles([...vehicleSet]),
      };
    },
    enabled: !!filmId,
  });
};

/** @deprecated Use useFilmId() instead */
export const FILM_ID = "00000000-0000-0000-0000-000000000001";
