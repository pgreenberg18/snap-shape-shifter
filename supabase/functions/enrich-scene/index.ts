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
      // Scene was deleted (e.g. by a re-analysis) — return success so the caller moves on
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "scene_deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    const userPrompt = `Analyze this screenplay scene and extract a COMPLETE production breakdown. Be thorough — extract ALL characters, props, wardrobe details, vehicles, environmental details, stunts, effects, sound cues, animals, extras, makeup notes, and mood.

Also parse the scene heading to extract: INT/EXT, DAY/NIGHT, and the cleaned location name. Estimate the page count based on the text length (1 page ≈ 55 lines of screenplay text).

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
                    description: "List of ALL character names who appear, speak, or are referenced in this scene. Use UPPERCASE names as written in the script.",
                  },
                  key_objects: {
                    type: "array",
                    items: { type: "string" },
                    description: "Notable props and objects mentioned or used in the scene (exclude locations, weather, lighting). Include items characters interact with.",
                  },
                  wardrobe: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        character: { type: "string", description: "Character name in UPPERCASE." },
                        clothing_style: { type: "string", description: "Description of what they are wearing — outfit, style, colours." },
                        condition: { type: "string", description: "Condition of the clothing — e.g. pristine, muddy, torn, blood-stained, wet. Use 'normal' if not specified." },
                        hair_makeup: { type: "string", description: "Hair and makeup details if described. Use 'not specified' if not mentioned." },
                      },
                      required: ["character", "clothing_style", "condition", "hair_makeup"],
                    },
                    description: "Wardrobe details for characters whose clothing, appearance, or condition is described or implied.",
                  },
                  picture_vehicles: {
                    type: "array",
                    items: { type: "string" },
                    description: "Any vehicles that appear on screen in this scene.",
                  },
                  environment_details: {
                    type: "string",
                    description: "Describe the environment: weather, time of day, lighting, atmosphere, set dressing details. Be specific.",
                  },
                  stunts: {
                    type: "array",
                    items: { type: "string" },
                    description: "Any stunts, action sequences, or physical feats in this scene. Empty array if none.",
                  },
                  sfx: {
                    type: "array",
                    items: { type: "string" },
                    description: "Practical special effects needed (explosions, rain, fire, smoke, breakaway glass, etc). Empty array if none.",
                  },
                  vfx: {
                    type: "array",
                    items: { type: "string" },
                    description: "Visual effects needed (green screen, CGI, compositing, digital set extensions, etc). Empty array if none.",
                  },
                  sound_cues: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific sound effects, music cues, or audio requirements mentioned or implied. Empty array if none.",
                  },
                  animals: {
                    type: "array",
                    items: { type: "string" },
                    description: "Any animals that appear on screen. Empty array if none.",
                  },
                  extras: {
                    type: "string",
                    description: "Description of background extras/crowd needed (e.g. '20 bar patrons', 'busy street crowd'). Empty string if none.",
                  },
                  special_makeup: {
                    type: "array",
                    items: { type: "string" },
                    description: "Special makeup, prosthetics, or body effects (scars, wounds, aging, tattoos, etc). Empty array if none.",
                  },
                  mood: {
                    type: "string",
                    description: "Overall mood/tone of the scene (e.g. 'tense', 'romantic', 'chaotic', 'melancholic'). One or two words.",
                  },
                  int_ext: {
                    type: "string",
                    description: "Whether the scene is INT, EXT, or INT/EXT. Parsed from the heading.",
                  },
                  day_night: {
                    type: "string",
                    description: "Time of day from the heading: DAY, NIGHT, DAWN, DUSK, MORNING, EVENING, CONTINUOUS, etc.",
                  },
                  location_name: {
                    type: "string",
                    description: "The cleaned location name extracted from the heading (e.g. 'JOHN'S APARTMENT - KITCHEN').",
                  },
                  estimated_page_count: {
                    type: "number",
                    description: "Estimated page count for this scene. 1 page ≈ 55 lines. Use fractions like 0.125 for 1/8 page.",
                  },
                },
                required: ["description", "characters", "key_objects", "wardrobe", "picture_vehicles", "environment_details", "stunts", "sfx", "vfx", "sound_cues", "animals", "extras", "special_makeup", "mood", "int_ext", "day_night", "location_name", "estimated_page_count"],
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
      // Surface rate limit / payment / capacity errors as retryable
      if (statusCode === 429 || statusCode === 402 || statusCode === 503) {
        const msg = statusCode === 429
          ? "Rate limit exceeded. Please try again shortly."
          : statusCode === 402
          ? "Payment required. Please add credits."
          : "AI model temporarily unavailable. Retrying...";
        return new Response(
          JSON.stringify({ error: msg, retryable: true }),
          { status: statusCode === 402 ? 402 : 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      wardrobe: { character: string; clothing_style: string; condition: string; hair_makeup: string }[];
      picture_vehicles: string[];
      environment_details: string;
      stunts: string[];
      sfx: string[];
      vfx: string[];
      sound_cues: string[];
      animals: string[];
      extras: string;
      special_makeup: string[];
      mood: string;
      int_ext: string;
      day_night: string;
      location_name: string;
      estimated_page_count: number;
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

    // Normalize wardrobe entries — handle both old "clothing" key and new "clothing_style" key
    const normalizedWardrobe = (breakdown.wardrobe || []).map((w: any) => ({
      character: w.character || "",
      clothing_style: w.clothing_style || w.clothing || "",
      condition: w.condition || "normal",
      hair_makeup: w.hair_makeup || "not specified",
    }));

    // Write enrichment data back to parsed_scenes
    const { error: updateErr } = await supabase
      .from("parsed_scenes")
      .update({
        description: breakdown.description || "",
        characters: breakdown.characters || [],
        key_objects: breakdown.key_objects || [],
        wardrobe: normalizedWardrobe,
        picture_vehicles: breakdown.picture_vehicles || [],
        environment_details: breakdown.environment_details || "",
        stunts: breakdown.stunts || [],
        sfx: breakdown.sfx || [],
        vfx: breakdown.vfx || [],
        sound_cues: breakdown.sound_cues || [],
        animals: breakdown.animals || [],
        extras: breakdown.extras || "",
        special_makeup: breakdown.special_makeup || [],
        mood: breakdown.mood || "",
        int_ext: breakdown.int_ext || "",
        day_night: breakdown.day_night || "",
        location_name: breakdown.location_name || "",
        estimated_page_count: breakdown.estimated_page_count || 0,
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
          environment_details: s.environment_details || "",
          stunts: s.stunts || [],
          sfx: s.sfx || [],
          vfx: s.vfx || [],
          sound_cues: s.sound_cues || [],
          animals: s.animals || [],
          extras: s.extras || "",
          special_makeup: s.special_makeup || [],
          mood: s.mood || "",
          int_ext: s.int_ext || "",
          day_night: s.day_night || "",
          location_name: s.location_name || "",
          estimated_page_count: s.estimated_page_count || 0,
        }));

        // Auto-detect primary time period from scene headings
        const yearCounts: Record<string, number> = {};
        for (const s of (allScenes || [])) {
          const heading = s.heading || "";
          // Match explicit years like 1991, 2024, etc.
          const yearMatch = heading.match(/\b(1[0-9]{3}|2[0-9]{3})\b/);
          if (yearMatch) {
            yearCounts[yearMatch[1]] = (yearCounts[yearMatch[1]] || 0) + 1;
          } else if (/present\s*day/i.test(heading)) {
            const currentYear = String(new Date().getFullYear());
            yearCounts[currentYear] = (yearCounts[currentYear] || 0) + 1;
          } else {
            // Scenes without explicit time markers default to "present"
            const currentYear = String(new Date().getFullYear());
            yearCounts[currentYear] = (yearCounts[currentYear] || 0) + 1;
          }
        }

        // Find the year with the most scenes
        let primaryYear = "";
        let maxCount = 0;
        for (const [year, count] of Object.entries(yearCounts)) {
          if (count > maxCount) {
            maxCount = count;
            primaryYear = year;
          }
        }

        // Update film's time_period if not already set
        if (primaryYear) {
          const { data: film } = await supabase
            .from("films")
            .select("time_period")
            .eq("id", analysis.film_id)
            .single();

          if (film && !film.time_period) {
            await supabase
              .from("films")
              .update({ time_period: primaryYear })
              .eq("id", analysis.film_id);
          }
        }

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
