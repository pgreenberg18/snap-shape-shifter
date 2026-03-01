import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * PHASE 2: Style Enrichment (Post-Vision Lock)
 * 
 * This function ONLY runs after Vision Lock. It applies the Style Contract,
 * Production Bible, and Director DNA to each scene to produce:
 * - Scene description (narrative summary)
 * - Mood/atmosphere
 * - Cinematic elements (camera feel, motion cues, shot suggestions)
 * - Visual design (color palette, lighting style, atmosphere)
 * - Environment details
 * - Estimated page count
 * 
 * It does NOT re-extract Phase 1 data (characters, locations, objects, etc.)
 * Those are immutable after Phase 1 lock.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { scene_id, analysis_id } = await req.json();
    if (!scene_id || !analysis_id) {
      return new Response(
        JSON.stringify({ error: "scene_id and analysis_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the scene
    const { data: scene, error: sceneErr } = await supabase
      .from("parsed_scenes")
      .select("*")
      .eq("id", scene_id)
      .single();

    if (sceneErr || !scene) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "scene_deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Skip if already enriched (Phase 2 done)
    if (scene.enriched) {
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Fetch Style Contract + Production Bible for Phase 2 context ──
    const { data: styleContract } = await supabase
      .from("film_style_contracts")
      .select("*")
      .eq("film_id", scene.film_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: productionBible } = await supabase
      .from("production_bibles")
      .select("content")
      .eq("film_id", scene.film_id)
      .maybeSingle();

    const { data: directorProfile } = await supabase
      .from("film_director_profiles")
      .select("primary_director_name, secondary_director_name, quadrant, cluster, visual_mandate, blend_weight")
      .eq("film_id", scene.film_id)
      .maybeSingle();

    // Build style context for the AI prompt
    const styleContext = buildStyleContext(styleContract, productionBible?.content, directorProfile);

    // ── Phase 2 AI enrichment — stylistic interpretation ──
    const systemPrompt = `You are a cinematic style interpreter for film production. You have been given the Director's Style Contract, Production Bible mandates, and Director DNA. Your job is to apply these stylistic rules to each scene to produce a cinematic interpretation.

STYLE CONTRACT:
${styleContext}

IMPORTANT: Apply the style rules to your interpretation. Your output should reflect the director's vision, not generic defaults.`;

    const userPrompt = `Apply the director's style contract to this scene and produce a cinematic interpretation.

SCENE HEADING: ${scene.heading}
INT/EXT: ${scene.int_ext || ""}
TIME OF DAY: ${scene.day_night || ""}
LOCATION: ${scene.location_name || ""}

SCENE TEXT:
${scene.raw_text}

Produce a style-informed breakdown including mood, cinematic direction, visual design, and environment details. The description should be a narrative summary. Estimate the page count (1 page ≈ 55 lines).`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "scene_style_enrichment",
              description: "Return the style-informed cinematic interpretation for this scene.",
              parameters: {
                type: "object",
                properties: {
                  description: {
                    type: "string",
                    description: "A concise 1-3 sentence narrative description of what happens in this scene.",
                  },
                  mood: {
                    type: "string",
                    description: "Overall mood/tone informed by the style contract (e.g. 'tense noir', 'warm pastoral', 'chaotic frenetic').",
                  },
                  environment_details: {
                    type: "string",
                    description: "Environment description applying the style contract's lighting doctrine, color mandate, and temporal rules.",
                  },
                  estimated_page_count: {
                    type: "number",
                    description: "Estimated page count. 1 page ≈ 55 lines. Use fractions like 0.125 for 1/8 page.",
                  },
                  cinematic_elements: {
                    type: "object",
                    properties: {
                      camera_feel: {
                        type: "string",
                        description: "Camera style/feel informed by the style contract's lens philosophy and director's quadrant.",
                      },
                      motion_cues: {
                        type: "string",
                        description: "Camera motion suggestions informed by the director's visual mandate.",
                      },
                      shot_suggestions: {
                        type: "array",
                        items: { type: "string" },
                        description: "2-4 specific shot type suggestions applying the director's style.",
                      },
                    },
                    required: ["camera_feel", "motion_cues", "shot_suggestions"],
                  },
                  visual_design: {
                    type: "object",
                    properties: {
                      color_palette: {
                        type: "string",
                        description: "Color palette applying the style contract's color mandate to this scene's context.",
                      },
                      lighting_style: {
                        type: "string",
                        description: "Lighting approach applying the style contract's lighting doctrine to this scene.",
                      },
                      visual_references: {
                        type: "string",
                        description: "Visual references informed by the director DNA and style contract.",
                      },
                      atmosphere: {
                        type: "string",
                        description: "Atmospheric description applying the style contract's texture mandate.",
                      },
                    },
                    required: ["color_palette", "lighting_style", "visual_references", "atmosphere"],
                  },
                },
                required: ["description", "mood", "environment_details", "estimated_page_count", "cinematic_elements", "visual_design"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "scene_style_enrichment" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      const statusCode = aiResponse.status;
      if (statusCode === 429 || statusCode === 402 || statusCode === 503) {
        return new Response(
          JSON.stringify({ error: "Rate limited", retryable: true }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "AI enrichment failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ error: "AI did not return structured data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let enrichment: any;
    try {
      enrichment = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Phase 2 update — ONLY stylistic fields, never overwrite Phase 1 data
    const { error: updateErr } = await supabase
      .from("parsed_scenes")
      .update({
        description: enrichment.description || "",
        mood: enrichment.mood || "",
        environment_details: enrichment.environment_details || "",
        estimated_page_count: enrichment.estimated_page_count || 0,
        cinematic_elements: enrichment.cinematic_elements || {},
        visual_design: enrichment.visual_design || {},
        enriched: true,
        // Phase 1 fields are NOT touched:
        // int_ext, day_night, location_name, sublocation, continuity_marker,
        // is_flashback, is_dream, is_montage, line_count, dialogue_*,
        // characters, phase1_locked — all remain as-is
      })
      .eq("id", scene_id);

    if (updateErr) {
      console.error("Failed to update parsed_scenes:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to save enrichment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update enrichment progress on parse_jobs
    await supabase.rpc("increment_scenes_enriched" as any, { p_analysis_id: analysis_id });

    // Check if all scenes are now enriched
    const { data: analysis } = await supabase
      .from("script_analyses")
      .select("film_id")
      .eq("id", analysis_id)
      .single();

    if (analysis) {
      const { count: totalCount } = await supabase
        .from("parsed_scenes")
        .select("id", { count: "exact", head: true })
        .eq("film_id", analysis.film_id);

      const { count: enrichedCount } = await supabase
        .from("parsed_scenes")
        .select("id", { count: "exact", head: true })
        .eq("film_id", analysis.film_id)
        .eq("enriched", true);

      if (totalCount && enrichedCount && enrichedCount >= totalCount) {
        await supabase
          .from("script_analyses")
          .update({
            status: "complete",
            updated_at: new Date().toISOString(),
          })
          .eq("id", analysis_id);
      }
    }

    await logCreditUsage({
      userId: authResult.userId,
      serviceName: "Gemini Flash",
      serviceCategory: "script-analysis",
      operation: "enrich-scene-phase2",
    });

    return new Response(
      JSON.stringify({ success: true, scene_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("enrich-scene error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Build a concise style context string from the Style Contract, Production Bible, and Director Profile.
 */
function buildStyleContext(
  styleContract: any | null,
  bibleContent: any | null,
  directorProfile: any | null,
): string {
  const parts: string[] = [];

  if (directorProfile) {
    parts.push(`DIRECTOR DNA:`);
    parts.push(`  Primary: ${directorProfile.primary_director_name || "unset"}`);
    if (directorProfile.secondary_director_name) {
      parts.push(`  Secondary: ${directorProfile.secondary_director_name} (blend: ${directorProfile.blend_weight || 1.0})`);
    }
    if (directorProfile.quadrant) parts.push(`  Quadrant: ${directorProfile.quadrant}`);
    if (directorProfile.cluster) parts.push(`  Cluster: ${directorProfile.cluster}`);
    if (directorProfile.visual_mandate) {
      const vm = directorProfile.visual_mandate;
      if (typeof vm === "object") {
        parts.push(`  Visual Mandate: ${JSON.stringify(vm)}`);
      }
    }
  }

  if (styleContract) {
    parts.push(`\nSTYLE CONTRACT (v${styleContract.version || 1}):`);
    if (styleContract.visual_dna) parts.push(`  Visual DNA: ${styleContract.visual_dna}`);
    if (styleContract.world_rules) parts.push(`  World Rules: ${styleContract.world_rules}`);
    if (styleContract.negative_prompt_base) parts.push(`  Negative: ${styleContract.negative_prompt_base}`);
    
    const jsonFields = [
      ["Color Mandate", styleContract.color_mandate],
      ["Lighting Doctrine", styleContract.lighting_doctrine],
      ["Lens Philosophy", styleContract.lens_philosophy],
      ["Texture Mandate", styleContract.texture_mandate],
      ["Temporal Rules", styleContract.temporal_rules],
      ["Genre Visual Profile", styleContract.genre_visual_profile],
      ["Content Guardrails", styleContract.content_guardrails],
    ];
    for (const [label, val] of jsonFields) {
      if (val && typeof val === "object" && Object.keys(val).length > 0) {
        parts.push(`  ${label}: ${JSON.stringify(val)}`);
      }
    }
  }

  if (bibleContent && typeof bibleContent === "object") {
    const bible = bibleContent as Record<string, any>;
    // Extract key mandates from the production bible
    const mandateKeys = ["sound_design", "lighting_rules", "color_rules", "camera_rules", "world_building", "tone"];
    const mandates: string[] = [];
    for (const key of mandateKeys) {
      if (bible[key]) mandates.push(`  ${key}: ${typeof bible[key] === "string" ? bible[key] : JSON.stringify(bible[key])}`);
    }
    if (mandates.length > 0) {
      parts.push(`\nPRODUCTION BIBLE MANDATES:`);
      parts.push(...mandates);
    }
  }

  return parts.length > 0 ? parts.join("\n") : "No style contract available. Use professional defaults.";
}
