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

/** @deprecated Use useFilmId() instead */
export const FILM_ID = "00000000-0000-0000-0000-000000000001";
