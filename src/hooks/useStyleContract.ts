import { useQuery } from "@tanstack/react-query";
import { useFilmId } from "@/hooks/useFilm";
import { supabase } from "@/integrations/supabase/client";

export const useStyleContract = () => {
  const filmId = useFilmId();
  return useQuery({
    queryKey: ["style-contract", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("film_style_contracts")
        .select("*")
        .eq("film_id", filmId!)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });
};
