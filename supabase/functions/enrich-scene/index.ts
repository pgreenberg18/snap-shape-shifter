import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * enrich-scene – processes ONE parsed scene via Gemini and writes
 * enrichment data back to `parsed_scenes`. Also updates progress
 * on `parse_jobs` and, when all scenes are enriched, finalises
 * `script_analyses` with full scene_breakdown + visual_summary.
 *
 * Body: { scene_id: string, analysis_id: string }
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
        JSON.stringify({ error: "Scene not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Skip if already enriched
    if (scene.enriched) {
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Call Gemini via Lovable AI gateway using tool calling for structured output
    const systemPrompt = `You are a professional script breakdown analyst for film production. Given a screenplay scene, extract structured production data. Be thorough and precise. Only include items that are explicitly mentioned or strongly implied in the scene text.`;

    const userPrompt = `Analyze this screenplay scene and extract production breakdown data.

SCENE HEADING: ${scene.heading}

SCENE TEXT:
${scene.raw_text}`;

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
              name: "scene_breakdown",
              description: "Return structured breakdown data for a screenplay scene.",
              parameters: {
                type: "object",
                properties: {
                  description: {
                    type: "string",
                    description: "A concise 1-3 sentence description of what happens in this scene.",
                  },
                  characters: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of character names who appear or speak in this scene. Use UPPERCASE names as written in the script.",
                  },
                  key_objects: {
                    type: "array",
                    items: { type: "string" },
                    description: "Notable props and objects mentioned (exclude locations, weather, lighting effects).",
                  },
                  wardrobe: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        character: { type: "string", description: "Character name in UPPERCASE." },
                        clothing: { type: "string", description: "Description of what they are wearing." },
                      },
                      required: ["character", "clothing"],
                    },
                    description: "Wardrobe details for characters whose clothing is described.",
                  },
                  picture_vehicles: {
                    type: "array",
                    items: { type: "string" },
                    description: "Any vehicles that appear on screen in this scene.",
                  },
                },
                required: ["description", "characters", "key_objects", "wardrobe", "picture_vehicles"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "scene_breakdown" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      const statusCode = aiResponse.status;
      // Surface rate limit / payment errors
      if (statusCode === 429 || statusCode === 402) {
        return new Response(
          JSON.stringify({ error: statusCode === 429 ? "Rate limit exceeded. Please try again shortly." : "Payment required. Please add credits." }),
          { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    let breakdown: {
      description: string;
      characters: string[];
      key_objects: string[];
      wardrobe: { character: string; clothing: string }[];
      picture_vehicles: string[];
    };

    try {
      breakdown = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("Failed to parse tool call arguments:", toolCall.function.arguments);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Write enrichment data back to parsed_scenes
    const { error: updateErr } = await supabase
      .from("parsed_scenes")
      .update({
        description: breakdown.description || "",
        characters: breakdown.characters || [],
        key_objects: breakdown.key_objects || [],
        wardrobe: breakdown.wardrobe || [],
        picture_vehicles: breakdown.picture_vehicles || [],
        enriched: true,
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

    // Check if all scenes for this analysis are now enriched
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
        // All scenes enriched — build full scene_breakdown and finalise
        const { data: allScenes } = await supabase
          .from("parsed_scenes")
          .select("*")
          .eq("film_id", analysis.film_id)
          .order("scene_number");

        const sceneBreakdown = (allScenes || []).map((s: any) => ({
          scene_number: s.scene_number,
          scene_heading: s.heading,
          description: s.description || "",
          characters: s.characters || [],
          key_objects: s.key_objects || [],
          wardrobe: s.wardrobe || [],
          picture_vehicles: s.picture_vehicles || [],
        }));

        await supabase
          .from("script_analyses")
          .update({
            status: "complete",
            scene_breakdown: sceneBreakdown,
            updated_at: new Date().toISOString(),
          })
          .eq("id", analysis_id);
      }
    }

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
