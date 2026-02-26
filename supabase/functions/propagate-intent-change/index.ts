import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * VICE — Propagate Intent Change
 *
 * When an identity token (character, location, prop, etc.) is updated,
 * this function traverses the dependency graph and flags all dependent
 * shots as dirty for regeneration.
 *
 * Input:  { film_id, source_token, trigger_type? }
 * Output: { dirty_count, flagged_shots }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { film_id, source_token, trigger_type } = await req.json();

    if (!film_id || !source_token) {
      return new Response(
        JSON.stringify({ error: "film_id and source_token are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Find all shots that depend on this token
    const { data: deps, error: depsErr } = await supabase
      .from("vice_dependencies")
      .select("shot_id")
      .eq("film_id", film_id)
      .eq("source_token", source_token);

    if (depsErr) {
      return new Response(
        JSON.stringify({ error: "Failed to query dependencies", details: depsErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!deps || deps.length === 0) {
      return new Response(
        JSON.stringify({ dirty_count: 0, flagged_shots: [], message: "No dependencies found for this token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Flag each dependent shot as dirty (upsert to avoid duplicates)
    const effectiveTriggerType = trigger_type || "identity_swap";
    const flaggedShotIds: string[] = [];

    for (const dep of deps) {
      const { error: insertErr } = await supabase
        .from("vice_dirty_queue")
        .upsert(
          {
            film_id,
            shot_id: dep.shot_id,
            triggered_by: source_token,
            trigger_type: effectiveTriggerType,
            status: "pending",
          },
          { onConflict: "shot_id,triggered_by,status" }
        );

      if (!insertErr) {
        flaggedShotIds.push(dep.shot_id);
      }
    }

    // 3. Also mark the identity registry entry as dirty
    await supabase
      .from("asset_identity_registry")
      .update({ is_dirty: true })
      .eq("film_id", film_id)
      .eq("internal_ref_code", source_token);

    return new Response(
      JSON.stringify({
        dirty_count: flaggedShotIds.length,
        flagged_shots: flaggedShotIds,
        source_token,
        trigger_type: effectiveTriggerType,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Propagation failed", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
