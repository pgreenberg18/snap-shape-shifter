import { supabase } from "@/integrations/supabase/client";
import { mapLegacySection } from "@/lib/map-legacy-section";

/**
 * Seeds version_provider_selections for a new film from the user's
 * global integrations. For each section with verified providers,
 * picks the first verified one as the default.
 */
export async function seedVersionProviders(filmId: string) {
  const { data: integrations } = await supabase
    .from("integrations")
    .select("id, section_id, is_verified, provider_name")
    .eq("is_verified", true);

  if (!integrations?.length) return;

  // Group by section, pick first verified per section
  const bySection: Record<string, string> = {};
  for (const int of integrations) {
    const section = mapLegacySection(int.section_id, (int as any).provider_name ?? "");
    if (!bySection[section]) {
      bySection[section] = int.id;
    }
  }

  const rows = Object.entries(bySection).map(([section_id, provider_service_id]) => ({
    film_id: filmId,
    section_id,
    provider_service_id,
  }));

  if (rows.length > 0) {
    await supabase.from("version_provider_selections").insert(rows);
  }
}

/**
 * Copies version_provider_selections from a source film to a new film.
 */
export async function copyVersionProviders(sourceFilmId: string, targetFilmId: string) {
  const { data: selections } = await supabase
    .from("version_provider_selections")
    .select("section_id, provider_service_id")
    .eq("film_id", sourceFilmId);

  if (selections?.length) {
    await supabase.from("version_provider_selections").insert(
      selections.map((s) => ({
        film_id: targetFilmId,
        section_id: s.section_id,
        provider_service_id: s.provider_service_id,
      }))
    );
  } else {
    // No selections on source — fall back to global defaults
    await seedVersionProviders(targetFilmId);
  }
}
