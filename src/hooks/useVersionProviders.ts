import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilmId, useIntegrations } from "@/hooks/useFilm";

/** Fetches the provider selection for a specific version */
export const useVersionProviderSelections = (filmId?: string) => {
  const id = filmId ?? useFilmId();
  return useQuery({
    queryKey: ["version-provider-selections", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("version_provider_selections")
        .select("*")
        .eq("film_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

/** Upsert a provider selection for a version + section */
export const useSetVersionProvider = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      filmId,
      sectionId,
      providerServiceId,
    }: {
      filmId: string;
      sectionId: string;
      providerServiceId: string;
    }) => {
      const { error } = await supabase
        .from("version_provider_selections")
        .upsert(
          { film_id: filmId, section_id: sectionId, provider_service_id: providerServiceId },
          { onConflict: "film_id,section_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["version-provider-selections", vars.filmId] });
    },
  });
};

/**
 * Returns sections that have multiple verified global integrations
 * but no version-level selection yet → conflicts that need resolution.
 */
export const useProviderConflicts = (filmId?: string) => {
  const { data: integrations } = useIntegrations();
  const { data: selections } = useVersionProviderSelections(filmId);

  if (!integrations || !selections) return [];

  // Group verified integrations by section
  const LEGACY_MAP: Record<string, string> = { "writers-room": "script-analysis" };
  const bySection: Record<string, typeof integrations> = {};
  for (const int of integrations) {
    if (!int.is_verified) continue;
    const section = LEGACY_MAP[int.section_id] || int.section_id;
    (bySection[section] ??= []).push(int);
  }

  // Find sections with >1 verified provider AND no version selection
  const selectedSections = new Set(selections.map((s) => s.section_id));
  return Object.entries(bySection)
    .filter(([section, providers]) => providers.length > 1 && !selectedSections.has(section))
    .map(([section, providers]) => ({ section, providers }));
};
