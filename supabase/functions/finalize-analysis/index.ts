import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * finalize-analysis – called after all scenes are enriched.
 * Generates visual_summary, global_elements (characters, locations, wardrobe,
 * props, visual_design, signature_style, temporal_analysis), and ai_generation_notes
 * via a single AI call using the full scene breakdown data.
 *
 * Body: { analysis_id: string }
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
    const { analysis_id } = await req.json();
    if (!analysis_id) {
      return new Response(
        JSON.stringify({ error: "analysis_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch analysis
    const { data: analysis, error: analysisErr } = await supabase
      .from("script_analyses")
      .select("*")
      .eq("id", analysis_id)
      .single();

    if (analysisErr || !analysis) {
      return new Response(
        JSON.stringify({ error: "Analysis not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch all enriched scenes
    const { data: allScenes } = await supabase
      .from("parsed_scenes")
      .select("*")
      .eq("film_id", analysis.film_id)
      .order("scene_number");

    if (!allScenes || allScenes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No scenes found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build a condensed summary of all scenes for the AI
    const sceneSummaries = allScenes.map((s: any) => ({
      scene_number: s.scene_number,
      heading: s.heading,
      description: s.description || "",
      characters: s.characters || [],
      key_objects: s.key_objects || [],
      wardrobe: s.wardrobe || [],
      environment_details: s.environment_details || "",
      mood: s.mood || "",
      int_ext: s.int_ext || "",
      day_night: s.day_night || "",
      location_name: s.location_name || "",
      stunts: s.stunts || [],
      sfx: s.sfx || [],
      vfx: s.vfx || [],
      picture_vehicles: s.picture_vehicles || [],
      animals: s.animals || [],
      extras: s.extras || "",
      special_makeup: s.special_makeup || [],
    }));

    const systemPrompt = `You are a professional script analyst and visual development consultant for film production. Given the complete scene-by-scene breakdown of a screenplay, generate high-level analysis including visual summary, global elements, and production notes.`;

    const userPrompt = `Based on this complete scene breakdown of ${allScenes.length} scenes, generate the following high-level analysis:

1. **Visual Summary**: A detailed 3-5 sentence description of the overall visual tone, cinematographic approach, lighting palette, and visual themes of this film.

2. **Signature Style**: A 2-4 sentence description of the film's distinctive visual language — what makes its look unique. Think about camera work, color grading, texture, transitions, and compositional patterns.

3. **Recurring Characters**: List ALL character names that appear across multiple scenes. Use UPPERCASE. Only include actual named characters, not generic references.

4. **Recurring Locations**: List the main recurring locations (cleaned slugline names without INT/EXT or time of day). Only locations that appear in 2+ scenes.

5. **Recurring Wardrobe**: List distinctive wardrobe elements that recur or define characters throughout the film.

6. **Recurring Props**: List significant props that appear across multiple scenes or are plot-important.

7. **Visual Motifs**: List recurring visual motifs, design elements, color themes, or symbolic imagery.

8. **Temporal Analysis**: Analyze the time structure of the script. Identify the primary time period and any secondary time periods (flashbacks, flash-forwards, etc.).

9. **AI Generation Notes**: A concise paragraph of practical production notes for AI image/video generation — focus on consistency requirements, character appearance anchors, key visual design elements that must remain recognizable, practical vs CGI effects guidance, and lighting continuity rules.

COMPLETE SCENE BREAKDOWN:
${JSON.stringify(sceneSummaries, null, 1)}`;

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
              name: "script_analysis_summary",
              description: "Return the high-level script analysis including visual summary, global elements, and AI generation notes.",
              parameters: {
                type: "object",
                properties: {
                  visual_summary: {
                    type: "string",
                    description: "3-5 sentence description of the overall visual tone, cinematography, lighting, and visual themes.",
                  },
                  signature_style: {
                    type: "string",
                    description: "2-4 sentence description of the film's distinctive visual language and what makes its look unique.",
                  },
                  recurring_characters: {
                    type: "array",
                    items: { type: "string" },
                    description: "All character names in UPPERCASE that appear across multiple scenes.",
                  },
                  recurring_locations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Main recurring location names (clean slugline names, no INT/EXT or time of day).",
                  },
                  recurring_wardrobe: {
                    type: "array",
                    items: { type: "string" },
                    description: "Distinctive recurring wardrobe elements that define characters.",
                  },
                  recurring_props: {
                    type: "array",
                    items: { type: "string" },
                    description: "Significant props that appear across multiple scenes or are plot-important.",
                  },
                  visual_motifs: {
                    type: "array",
                    items: { type: "string" },
                    description: "Recurring visual motifs, design elements, color themes, or symbolic imagery.",
                  },
                  temporal_analysis: {
                    type: "object",
                    properties: {
                      primary_time_period: {
                        type: "object",
                        properties: {
                          estimated_year_or_era: { type: "string", description: "The primary time period (e.g. '2024', '1970s', 'Near-future')." },
                          confidence: { type: "string", description: "High, Medium, or Low." },
                          evidence: { type: "array", items: { type: "string" }, description: "Brief evidence points." },
                        },
                        required: ["estimated_year_or_era", "confidence", "evidence"],
                      },
                      secondary_time_periods: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            label: { type: "string", description: "Name for this time period segment." },
                            type: { type: "string", description: "Flashback, Flash Forward, Dream, Prologue, Epilogue, etc." },
                            estimated_year_or_range: { type: "string", description: "Year or range." },
                            approximate_scene_count: { type: "number", description: "How many scenes." },
                            estimated_percentage_of_script: { type: "string", description: "e.g. '15%'." },
                            evidence: { type: "array", items: { type: "string" }, description: "Brief evidence." },
                          },
                          required: ["label", "type", "estimated_year_or_range"],
                        },
                        description: "Secondary time periods like flashbacks, flash-forwards, etc. Empty array if none.",
                      },
                    },
                    required: ["primary_time_period", "secondary_time_periods"],
                  },
                  ai_generation_notes: {
                    type: "string",
                    description: "Practical production notes for AI generation — consistency, character anchors, design elements, effects guidance, lighting rules.",
                  },
                },
                required: [
                  "visual_summary", "signature_style", "recurring_characters", "recurring_locations",
                  "recurring_wardrobe", "recurring_props", "visual_motifs", "temporal_analysis",
                  "ai_generation_notes",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "script_analysis_summary" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      // Don't fail the whole analysis — just log and mark complete without these fields
      console.error("Finalization AI call failed, completing without summary data");
      return new Response(
        JSON.stringify({ success: true, warning: "AI summary generation failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in finalization AI response:", JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ success: true, warning: "AI did not return structured data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let result: any;
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("Failed to parse finalization tool call:", toolCall.function.arguments);
      return new Response(
        JSON.stringify({ success: true, warning: "Failed to parse AI response" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build global_elements object
    const globalElements = {
      recurring_characters: result.recurring_characters || [],
      recurring_locations: result.recurring_locations || [],
      recurring_wardrobe: result.recurring_wardrobe || [],
      recurring_props: result.recurring_props || [],
      visual_motifs: result.visual_motifs || [],
      signature_style: result.signature_style || "",
      temporal_analysis: result.temporal_analysis || null,
    };

    // Update analysis with all the generated data
    const { error: updateErr } = await supabase
      .from("script_analyses")
      .update({
        visual_summary: result.visual_summary || "",
        global_elements: globalElements,
        ai_generation_notes: result.ai_generation_notes || "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysis_id);

    if (updateErr) {
      console.error("Failed to update analysis with finalization data:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to save finalization data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Finalization complete for analysis:", analysis_id);
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("finalize-analysis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
