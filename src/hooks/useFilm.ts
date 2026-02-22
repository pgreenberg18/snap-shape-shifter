import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FILM_ID = "00000000-0000-0000-0000-000000000001";

export const useFilm = () =>
  useQuery({
    queryKey: ["film"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("films")
        .select("*")
        .eq("id", FILM_ID)
        .single();
      if (error) throw error;
      return data;
    },
  });

export const useCharacters = () =>
  useQuery({
    queryKey: ["characters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .eq("film_id", FILM_ID)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

export const useShots = () =>
  useQuery({
    queryKey: ["shots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shots")
        .select("*")
        .eq("film_id", FILM_ID)
        .order("scene_number");
      if (error) throw error;
      return data;
    },
  });

export const useTimelineClips = () =>
  useQuery({
    queryKey: ["timeline-clips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_production_clips")
        .select("*")
        .eq("film_id", FILM_ID)
        .order("left_pos");
      if (error) throw error;
      return data;
    },
  });

export const useContentSafety = () =>
  useQuery({
    queryKey: ["content-safety"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_safety")
        .select("*")
        .eq("film_id", FILM_ID)
        .single();
      if (error) throw error;
      return data;
    },
  });

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

export { FILM_ID };
