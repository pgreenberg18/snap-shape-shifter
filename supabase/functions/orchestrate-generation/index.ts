import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";
import { fetchWithRetry } from "../_shared/fetch-retry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/* ═══════════════════════════════════════════════════════════════
   VideoEngineAdapter — abstraction for swappable generation backends
   ═══════════════════════════════════════════════════════════════ */

interface EngineResult {
  output_urls: string[];
  seed: number;
  engine: string;
  scores?: { identity?: number; style?: number; overall?: number }[];
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

/* ── Google Imagen + Veo adapter ── */

function buildGoogleAdapter(apiKey: string): VideoEngineAdapter {
  const seed = () => Math.floor(Math.random() * 9_000_000) + 1_000_000;

  return {
    name: "google_veo",

    async generateAnchor(p: AnchorPayload): Promise<EngineResult> {
      const resolvedPrompt = p.prompt_pack?.resolved_text_prompt ?? p.prompt_pack?.raw_script_action ?? "";
      const aspectRatio = p.prompt_pack?.cinematography_metadata?.framing?.aspect_ratio === "2.39:1" ? "16:9" : "16:9";

      const requestBody = {
        instances: [{ prompt: resolvedPrompt }],
        parameters: {
          sampleCount: Math.min(p.count, 4),
          aspectRatio,
          personGeneration: "allow_all",
          safetyFilterLevel: "block_only_high",
        },
      };

      console.log(`[Imagen] Generating ${p.count} anchor frames...`);
      const res = await fetchWithRetry(
        `${GEMINI_BASE}/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
        { maxRetries: 3, baseDelayMs: 2_000 },
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Imagen] Error ${res.status}:`, errText);
        throw new Error(`Imagen API error ${res.status}: ${errText.slice(0, 500)}`);
      }

      const data = await res.json();
      const predictions = data.predictions ?? [];

      if (predictions.length === 0) {
        // Check for filtered content
        const filterReasons = (data.predictions ?? [])
          .map((p: any) => p.raiFilteredReason)
          .filter(Boolean);
        if (filterReasons.length > 0) {
          throw new Error(`Content filtered by safety: ${filterReasons.join(", ")}`);
        }
        throw new Error("Imagen returned no images. The prompt may have been filtered.");
      }

      // Upload base64 images to Supabase storage and return URLs
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const generationSeed = p.seed ?? seed();
      const urls: string[] = [];

      for (let i = 0; i < predictions.length; i++) {
        const pred = predictions[i];
        if (!pred.bytesBase64Encoded) continue;

        const bytes = Uint8Array.from(atob(pred.bytesBase64Encoded), (c) => c.charCodeAt(0));
        const path = `generations/anchors/${generationSeed}-${i}.png`;

        const { error: uploadErr } = await supabase.storage
          .from("generation-outputs")
          .upload(path, bytes, {
            contentType: pred.mimeType || "image/png",
            upsert: true,
          });

        if (uploadErr) {
          console.error(`[Imagen] Upload error for frame ${i}:`, uploadErr);
          // Fall back to data URI
          urls.push(`data:${pred.mimeType || "image/png"};base64,${pred.bytesBase64Encoded.slice(0, 100)}...`);
          continue;
        }

        const { data: publicUrl } = supabase.storage
          .from("generation-outputs")
          .getPublicUrl(path);
        urls.push(publicUrl.publicUrl);
      }

      return {
        output_urls: urls,
        seed: generationSeed,
        engine: "imagen_3",
      };
    },

    async animateFromAnchor(p: AnimatePayload): Promise<EngineResult> {
      const resolvedPrompt = p.prompt_pack?.resolved_text_prompt ?? p.prompt_pack?.raw_script_action ?? "";
      const generationSeed = p.seed ?? seed();

      // Fetch anchor image as base64 if it's a URL
      let imageBase64: string | undefined;
      if (p.anchor_url && p.anchor_url.startsWith("http")) {
        try {
          const imgRes = await fetch(p.anchor_url);
          if (imgRes.ok) {
            const imgBuffer = new Uint8Array(await imgRes.arrayBuffer());
            // Chunk the conversion to avoid stack overflow
            let binary = "";
            const chunkSize = 8192;
            for (let i = 0; i < imgBuffer.length; i += chunkSize) {
              binary += String.fromCharCode(...imgBuffer.subarray(i, i + chunkSize));
            }
            imageBase64 = btoa(binary);
          }
        } catch (e) {
          console.warn("[Veo] Failed to fetch anchor image, falling back to text-only:", e);
        }
      }

      const instance: any = { prompt: resolvedPrompt };
      if (imageBase64) {
        instance.image = { bytesBase64Encoded: imageBase64, mimeType: "image/png" };
      }

      const requestBody = {
        instances: [instance],
        parameters: {
          aspectRatio: "16:9",
          durationSeconds: Math.min(p.duration_seconds, 8),
          enhancePrompt: false,
        },
      };

      console.log(`[Veo] Starting video generation (${p.duration_seconds}s)...`);
      const res = await fetchWithRetry(
        `${GEMINI_BASE}/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
        { maxRetries: 2, baseDelayMs: 3_000 },
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Veo] Error ${res.status}:`, errText);
        throw new Error(`Veo API error ${res.status}: ${errText.slice(0, 500)}`);
      }

      const opData = await res.json();
      const operationName = opData.name;

      if (!operationName) {
        throw new Error("Veo did not return an operation name");
      }

      // Poll for completion (max ~3 minutes)
      const maxPolls = 36;
      const pollIntervalMs = 5_000;
      let result: any = null;

      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));

        const pollRes = await fetchWithRetry(
          `${GEMINI_BASE}/${operationName}?key=${apiKey}`,
          { method: "GET", headers: { "Content-Type": "application/json" } },
          { maxRetries: 2, baseDelayMs: 1_000 },
        );

        if (!pollRes.ok) {
          console.warn(`[Veo] Poll ${i + 1} failed: ${pollRes.status}`);
          continue;
        }

        const pollData = await pollRes.json();

        if (pollData.done) {
          result = pollData;
          break;
        }

        console.log(`[Veo] Poll ${i + 1}/${maxPolls}: still processing...`);
      }

      if (!result?.done) {
        throw new Error("Veo generation timed out after 3 minutes");
      }

      if (result.error) {
        throw new Error(`Veo generation failed: ${JSON.stringify(result.error)}`);
      }

      // Extract video URLs from response
      const videos = result.response?.generateVideoResponse?.generatedSamples ?? [];
      if (videos.length === 0) {
        const filterReasons = result.response?.generateVideoResponse?.raiMediaFilteredReasons ?? [];
        if (filterReasons.length > 0) {
          throw new Error(`Video filtered by safety: ${filterReasons.join(", ")}`);
        }
        throw new Error("Veo returned no videos");
      }

      // Upload videos to storage
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const urls: string[] = [];
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i].video;
        if (!video) continue;

        // Video might be a URI or base64
        if (video.uri) {
          urls.push(video.uri);
        } else if (video.bytesBase64Encoded) {
          const bytes = Uint8Array.from(atob(video.bytesBase64Encoded), (c) => c.charCodeAt(0));
          const path = `generations/clips/${generationSeed}-${i}.mp4`;

          const { error: uploadErr } = await supabase.storage
            .from("generation-outputs")
            .upload(path, bytes, {
              contentType: "video/mp4",
              upsert: true,
            });

          if (uploadErr) {
            console.error(`[Veo] Upload error for clip ${i}:`, uploadErr);
            continue;
          }

          const { data: publicUrl } = supabase.storage
            .from("generation-outputs")
            .getPublicUrl(path);
          urls.push(publicUrl.publicUrl);
        }
      }

      if (urls.length === 0) {
        throw new Error("Failed to extract video URLs from Veo response");
      }

      return {
        output_urls: urls,
        seed: generationSeed,
        engine: "veo_2",
      };
    },

    async targetedEdit(p: EditPayload): Promise<EngineResult> {
      // Targeted edit: re-generate anchor with modified prompt emphasizing the fix region
      const editPrompt = `${p.prompt_delta}. Focus on correcting the ${p.target_spec.region} (${p.target_spec.asset_type}).`;

      const requestBody = {
        instances: [{ prompt: editPrompt }],
        parameters: {
          sampleCount: 4,
          aspectRatio: "16:9",
          personGeneration: "allow_all",
          safetyFilterLevel: "block_only_high",
        },
      };

      // If we have a reference URL, fetch it for img2img (future: use edit endpoint when available)
      if (p.target_spec.ref_url) {
        // For now, include ref in prompt context
        requestBody.instances[0].prompt += ` Reference image style should match the original.`;
      }

      console.log(`[Imagen/Edit] Targeted repair for ${p.target_spec.asset_type}...`);
      const res = await fetchWithRetry(
        `${GEMINI_BASE}/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
        { maxRetries: 3, baseDelayMs: 2_000 },
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Imagen edit error ${res.status}: ${errText.slice(0, 500)}`);
      }

      const data = await res.json();
      const predictions = data.predictions ?? [];

      if (predictions.length === 0) {
        throw new Error("Targeted edit returned no images");
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const generationSeed = p.seed ?? seed();
      const urls: string[] = [];

      for (let i = 0; i < predictions.length; i++) {
        const pred = predictions[i];
        if (!pred.bytesBase64Encoded) continue;

        const bytes = Uint8Array.from(atob(pred.bytesBase64Encoded), (c) => c.charCodeAt(0));
        const path = `generations/repairs/${generationSeed}-${i}.png`;

        const { error: uploadErr } = await supabase.storage
          .from("generation-outputs")
          .upload(path, bytes, {
            contentType: pred.mimeType || "image/png",
            upsert: true,
          });

        if (!uploadErr) {
          const { data: publicUrl } = supabase.storage
            .from("generation-outputs")
            .getPublicUrl(path);
          urls.push(publicUrl.publicUrl);
        }
      }

      return {
        output_urls: urls,
        seed: generationSeed,
        engine: "imagen_3_edit",
      };
    },
  };
}

/* ── Stub fallback (when no API key configured) ── */
const stubAdapter: VideoEngineAdapter = {
  name: "stub",
  async generateAnchor(p) {
    const s = p.seed ?? Math.floor(Math.random() * 9_000_000) + 1_000_000;
    return {
      output_urls: Array.from({ length: p.count }, (_, i) =>
        `https://placeholder.generation/anchor-${s}-${i}.png`
      ),
      seed: s,
      engine: "stub_anchor",
    };
  },
  async animateFromAnchor(p) {
    const s = p.seed ?? Math.floor(Math.random() * 9_000_000) + 1_000_000;
    return {
      output_urls: [`https://placeholder.generation/clip-${s}.mp4`],
      seed: s,
      engine: "stub_animate",
    };
  },
  async targetedEdit(p) {
    const s = p.seed ?? Math.floor(Math.random() * 9_000_000) + 1_000_000;
    return {
      output_urls: [`https://placeholder.generation/edit-${s}.mp4`],
      seed: s,
      engine: "stub_edit",
    };
  },
};

function getAdapter(_engineHint: string): VideoEngineAdapter {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (apiKey) {
    console.log("[Engine] Using Google Imagen + Veo adapter");
    return buildGoogleAdapter(apiKey);
  }
  console.warn("[Engine] No GEMINI_API_KEY — falling back to stub adapter");
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
    const {
      shot_id,
      mode = "anchor",
      parent_generation_id,
      anchor_url,
      target_spec,
      prompt_delta,
      anchor_count = 4,
      repair_target,
    } = body;

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
    const engineHint = compilePayload.routing_metadata?.preferred_engine ?? "veo_2";
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
          repair_target: repair_target ?? undefined,
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
          continuity_profile: compilePayload.temporal_guardrails,
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
        // Build prompt delta from repair target context
        const resolvedPrompt = compilePayload.generation_payload?.resolved_text_prompt ?? shot.prompt_text ?? "";
        const repairHint = repair_target
          ? `Regenerate this shot, focusing on fixing the ${repair_target}.`
          : prompt_delta ?? "";

        result = await adapter.targetedEdit({
          source_url: anchor_url ?? "",
          target_spec: target_spec ?? {
            region: repair_target ?? "general",
            asset_type: repair_target ?? "general",
          },
          prompt_delta: `${resolvedPrompt} ${repairHint}`,
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
        scores_json: result.scores ?? null,
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
        scores: result.scores,
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
