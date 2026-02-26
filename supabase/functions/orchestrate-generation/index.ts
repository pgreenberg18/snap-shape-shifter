import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ═══════════════════════════════════════════════════════════════
   VideoEngineAdapter — abstraction for swappable generation backends
   ═══════════════════════════════════════════════════════════════ */

interface EngineResult {
  output_urls: string[];
  seed: number;
  engine: string;
}

interface VideoEngineAdapter {
  name: string;
  generateAnchor(payload: AnchorPayload): Promise<EngineResult>;
  animateFromAnchor(payload: AnimatePayload): Promise<EngineResult>;
  targetedEdit(payload: EditPayload): Promise<EngineResult>;
}

interface AnchorPayload {
  prompt_pack: any;
  reference_bundle: any;
  continuity_profile: any;
  count: number;
  seed?: number;
}

interface AnimatePayload {
  anchor_url: string;
  prompt_pack: any;
  reference_bundle: any;
  continuity_profile: any;
  duration_seconds: number;
  seed?: number;
}

interface EditPayload {
  source_url: string;
  target_spec: { region: string; asset_type: string; ref_url?: string };
  prompt_delta: string;
  seed?: number;
}

/* ── Stub adapters (replaced with real vendor calls later) ── */

const stubAdapter: VideoEngineAdapter = {
  name: "stub",
  async generateAnchor(p) {
    // In production: call Veo / Seedance / Higgsfield image API
    const seed = p.seed ?? Math.floor(Math.random() * 9_000_000) + 1_000_000;
    return {
      output_urls: Array.from({ length: p.count }, (_, i) =>
        `https://placeholder.generation/anchor-${seed}-${i}.png`
      ),
      seed,
      engine: "stub_anchor",
    };
  },
  async animateFromAnchor(p) {
    const seed = p.seed ?? Math.floor(Math.random() * 9_000_000) + 1_000_000;
    return {
      output_urls: [`https://placeholder.generation/clip-${seed}.mp4`],
      seed,
      engine: "stub_animate",
    };
  },
  async targetedEdit(p) {
    const seed = p.seed ?? Math.floor(Math.random() * 9_000_000) + 1_000_000;
    return {
      output_urls: [`https://placeholder.generation/edit-${seed}.mp4`],
      seed,
      engine: "stub_edit",
    };
  },
};

function getAdapter(_engineHint: string): VideoEngineAdapter {
  // Future: switch on engineHint to return real adapters
  return stubAdapter;
}

/* ═══════════════════════════════════════════════════════════════
   Main handler
   ═══════════════════════════════════════════════════════════════ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const body = await req.json();
    const { shot_id, mode = "anchor", parent_generation_id, anchor_url, target_spec, prompt_delta, anchor_count = 4 } = body;

    if (!shot_id) {
      return new Response(
        JSON.stringify({ error: "shot_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 1. Fetch shot + film ──
    const { data: shot, error: shotErr } = await supabase
      .from("shots")
      .select("*")
      .eq("id", shot_id)
      .single();

    if (shotErr || !shot) {
      return new Response(
        JSON.stringify({ error: "Shot not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Get compile payload (call our existing compiler) ──
    const compileRes = await fetch(`${supabaseUrl}/functions/v1/compile-generation-payload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.get("Authorization") ?? "",
        apikey: supabaseKey,
      },
      body: JSON.stringify({ shot_id }),
    });

    if (!compileRes.ok) {
      const errText = await compileRes.text();
      return new Response(
        JSON.stringify({ error: "Compile failed", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const compilePayload = await compileRes.json();

    // ── 3. Build compile hash for dedup ──
    const payloadStr = JSON.stringify(compilePayload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payloadStr));
    const compileHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // ── 4. Determine generation plan ──
    const engineHint = compilePayload.routing_metadata?.preferred_engine ?? "veo_3.1";
    const adapter = getAdapter(engineHint);

    const statusForMode = { anchor: "anchoring", animate: "animating", targeted_edit: "repairing" } as const;
    const genStatus = statusForMode[mode as keyof typeof statusForMode] ?? "anchoring";

    // ── 5. Insert generation record (status = in-progress) ──
    const { data: generation, error: genInsertErr } = await supabase
      .from("generations")
      .insert({
        shot_id,
        film_id: shot.film_id,
        engine: adapter.name,
        mode,
        status: genStatus,
        compile_hash: compileHash,
        reference_bundle_json: compilePayload.generation_payload?.identity_tokens ?? {},
        prompt_pack_json: {
          resolved_prompt: compilePayload.generation_payload?.resolved_text_prompt,
          negative: compilePayload.temporal_guardrails?.negative_prompt_injection,
          cinematography: compilePayload.generation_payload?.cinematography_metadata,
        },
        generation_plan_json: {
          engine_hint: engineHint,
          fallback: compilePayload.routing_metadata?.fallback_engine,
          mode,
          anchor_count: mode === "anchor" ? anchor_count : undefined,
        },
        parent_generation_id: parent_generation_id ?? null,
        style_contract_version: compilePayload.style_contract_version ?? null,
        seed: null,
      })
      .select()
      .single();

    if (genInsertErr || !generation) {
      return new Response(
        JSON.stringify({ error: "Failed to create generation record", details: genInsertErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 6. Execute generation via adapter ──
    let result: EngineResult;

    try {
      if (mode === "anchor") {
        result = await adapter.generateAnchor({
          prompt_pack: compilePayload.generation_payload,
          reference_bundle: compilePayload.generation_payload?.identity_tokens,
          continuity_profile: compilePayload.style_context,
          count: anchor_count,
        });
      } else if (mode === "animate") {
        if (!anchor_url) {
          throw new Error("anchor_url required for animate mode");
        }
        result = await adapter.animateFromAnchor({
          anchor_url,
          prompt_pack: compilePayload.generation_payload,
          reference_bundle: compilePayload.generation_payload?.identity_tokens,
          continuity_profile: compilePayload.style_context,
          duration_seconds: compilePayload.generation_payload?.execution_params?.duration_seconds ?? 5,
        });
      } else if (mode === "targeted_edit") {
        if (!anchor_url || !target_spec) {
          throw new Error("anchor_url and target_spec required for targeted_edit mode");
        }
        result = await adapter.targetedEdit({
          source_url: anchor_url,
          target_spec,
          prompt_delta: prompt_delta ?? "",
        });
      } else {
        throw new Error(`Unknown mode: ${mode}`);
      }
    } catch (execErr) {
      // Mark generation as failed
      await supabase
        .from("generations")
        .update({ status: "failed", last_error: String(execErr) })
        .eq("id", generation.id);

      return new Response(
        JSON.stringify({ error: "Generation execution failed", details: String(execErr), generation_id: generation.id }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 7. Update generation record with results ──
    await supabase
      .from("generations")
      .update({
        status: "complete",
        output_urls: result.output_urls,
        seed: result.seed,
        engine: result.engine,
      })
      .eq("id", generation.id);

    // ── 8. Log credit usage ──
    const creditCost = mode === "anchor" ? 1 : mode === "animate" ? 5 : 2;
    await logCreditUsage({
      userId: authResult.userId,
      filmId: shot.film_id,
      serviceName: `Generation (${mode})`,
      serviceCategory: "generation",
      operation: `orchestrate-generation-${mode}`,
      credits: creditCost,
    });

    return new Response(
      JSON.stringify({
        generation_id: generation.id,
        mode,
        status: "complete",
        output_urls: result.output_urls,
        seed: result.seed,
        engine: result.engine,
        compile_hash: compileHash,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
