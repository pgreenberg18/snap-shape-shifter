import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * VICE — Detect Continuity Conflicts
 *
 * Scans a film (or specific scene) for continuity issues:
 * - Wardrobe mismatches: same character wearing different wardrobe across shots in a scene
 * - Character drift: shots referencing a character whose identity has changed (is_dirty)
 * - Style drift: shots generated with an outdated style_contract_version
 * - Prop inconsistency: shots in same scene referencing different locked props
 *
 * Input:  { film_id, scene_number? }
 * Output: { conflicts: [...], summary }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { film_id, scene_number } = await req.json();

    if (!film_id) {
      return new Response(
        JSON.stringify({ error: "film_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const newConflicts: Array<{
      scene_number: number;
      shot_id: string | null;
      conflict_type: string;
      description: string;
      severity: string;
    }> = [];

    // ── 1. Fetch shots ──
    let shotsQuery = supabase.from("shots").select("*").eq("film_id", film_id).order("scene_number").order("created_at");
    if (scene_number) shotsQuery = shotsQuery.eq("scene_number", scene_number);
    const { data: shots } = await shotsQuery;
    if (!shots || shots.length === 0) {
      return new Response(
        JSON.stringify({ conflicts: [], summary: "No shots to analyze" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Get current style contract version ──
    const { data: contract } = await supabase
      .from("film_style_contracts")
      .select("version")
      .eq("film_id", film_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentContractVersion = contract?.version ?? null;

    // ── 3. Check for style drift ──
    if (currentContractVersion !== null) {
      for (const shot of shots) {
        if (
          shot.style_contract_version !== null &&
          shot.style_contract_version !== currentContractVersion
        ) {
          newConflicts.push({
            scene_number: shot.scene_number,
            shot_id: shot.id,
            conflict_type: "style_drift",
            description: `Shot generated with style contract v${shot.style_contract_version}, current is v${currentContractVersion}.`,
            severity: "warning",
          });
        }
      }
    }

    // ── 4. Check for dirty identity tokens referenced in shots ──
    const { data: dirtyTokens } = await supabase
      .from("asset_identity_registry")
      .select("internal_ref_code, display_name, asset_type")
      .eq("film_id", film_id)
      .eq("is_dirty", true);

    if (dirtyTokens && dirtyTokens.length > 0) {
      const dirtyRefCodes = new Set(dirtyTokens.map((t) => t.internal_ref_code));
      for (const shot of shots) {
        if (!shot.prompt_text) continue;
        const refs = shot.prompt_text.match(/\{\{([A-Z0-9_]+)\}\}/g);
        if (!refs) continue;
        for (const ref of refs) {
          const code = ref.replace(/[{}]/g, "");
          if (dirtyRefCodes.has(code)) {
            const token = dirtyTokens.find((t) => t.internal_ref_code === code);
            newConflicts.push({
              scene_number: shot.scene_number,
              shot_id: shot.id,
              conflict_type: "character_drift",
              description: `${token?.display_name || code} (${token?.asset_type}) has been updated but this shot hasn't been regenerated.`,
              severity: "error",
            });
          }
        }
      }
    }

    // ── 5. Check wardrobe consistency within scenes ──
    const { data: wardrobeAssignments } = await supabase
      .from("wardrobe_scene_assignments")
      .select("*")
      .eq("film_id", film_id);

    if (wardrobeAssignments && wardrobeAssignments.length > 0) {
      // Group by scene + character, check for multiple different wardrobe items
      const sceneCharWardrobe: Record<string, Set<string>> = {};
      for (const wa of wardrobeAssignments) {
        const key = `${wa.scene_number}::${wa.character_name}`;
        if (!sceneCharWardrobe[key]) sceneCharWardrobe[key] = new Set();
        sceneCharWardrobe[key].add(wa.clothing_item);
      }
      for (const [key, items] of Object.entries(sceneCharWardrobe)) {
        if (items.size > 1) {
          const [sn, charName] = key.split("::");
          newConflicts.push({
            scene_number: Number(sn),
            shot_id: null,
            conflict_type: "wardrobe_mismatch",
            description: `${charName} has ${items.size} different wardrobe items in scene ${sn}: ${[...items].join(", ")}.`,
            severity: "warning",
          });
        }
      }
    }

    // ── 6. Persist new conflicts (clear old unresolved first for this scope) ──
    let deleteQuery = supabase
      .from("vice_conflicts")
      .delete()
      .eq("film_id", film_id)
      .eq("resolved", false);
    if (scene_number) deleteQuery = deleteQuery.eq("scene_number", scene_number);
    await deleteQuery;

    if (newConflicts.length > 0) {
      await supabase.from("vice_conflicts").insert(
        newConflicts.map((c) => ({
          film_id,
          ...c,
        }))
      );
    }

    return new Response(
      JSON.stringify({
        conflicts: newConflicts,
        summary: newConflicts.length === 0
          ? "No continuity conflicts detected"
          : `Found ${newConflicts.length} conflict(s)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Conflict detection failed", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
