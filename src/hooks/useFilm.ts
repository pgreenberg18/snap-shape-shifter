import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
      const propSet = new Set<string>();
      const wardrobeMap = new Map<string, string>();
      const vehicleSet = new Set<string>();

      const VEHICLE_KEYWORDS = ["car", "truck", "van", "bus", "suv", "sedan", "taxi", "cab", "limo", "limousine", "motorcycle", "bike", "bicycle", "helicopter", "chopper", "plane", "jet", "boat", "ship", "ambulance", "cruiser", "patrol", "vehicle", "pickup", "jeep", "hummer", "convertible", "coupe", "wagon", "minivan"];

      for (const s of scenes) {
        if (s.setting && typeof s.setting === "string" && s.setting !== "N/A") {
          locationSet.add(s.setting);
        }
        if (Array.isArray(s.key_objects)) {
          for (const p of s.key_objects) {
            if (typeof p === "string" && p.length > 1) {
              const lower = p.toLowerCase();
              if (VEHICLE_KEYWORDS.some((v) => lower.includes(v))) {
                vehicleSet.add(p);
              } else {
                propSet.add(p);
              }
            }
          }
        }
        // Vehicles field (if AI provides it)
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
        props: [...propSet].sort(),
        wardrobe: [...wardrobeMap.keys()].map((k) => {
          const [character, clothing] = k.split("::");
          return { character, clothing };
        }),
        vehicles: [...vehicleSet].sort(),
      };
    },
    enabled: !!filmId,
  });
};

/** @deprecated Use useFilmId() instead */
export const FILM_ID = "00000000-0000-0000-0000-000000000001";
