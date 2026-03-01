import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";
import { extractNormalizedLocations, normalizeLocationKey } from "../_shared/location-normalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // ── Helper: extract characters from raw screenplay text ──
    // Character cues are ALL-CAPS lines (possibly with (V.O.), (O.S.) etc.)
    const extractCharactersFromRawText = (rawText: string): string[] => {
      const chars = new Set<string>();
      const lines = rawText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        // Character cue: all-caps, 2-40 chars, not a scene heading, not a transition
        if (!trimmed || trimmed.length < 2 || trimmed.length > 40) continue;
        // Remove parenthetical extensions like (V.O.), (O.S.), (CONT'D)
        const withoutExt = trimmed.replace(/\s*\(.*?\)\s*/g, "").trim();
        if (!withoutExt || withoutExt.length < 2) continue;
        // Must be all uppercase letters/spaces/hyphens/apostrophes
        if (!/^[A-Z][A-Z\s\-'\.]+$/.test(withoutExt)) continue;
        // Must not contain periods (scene headings, transitions like "FADE TO BLACK.")
        if (withoutExt.includes(".")) continue;
        // Exclude common non-character lines
        const upper = withoutExt.toUpperCase();
        if (upper.startsWith("INT") || upper.startsWith("EXT")) continue;
        const NON_CHARS = new Set([
          "CUT TO", "FADE IN", "FADE OUT", "FADE TO", "FADE TO BLACK",
          "DISSOLVE TO", "SMASH CUT TO", "MATCH CUT TO", "THE END",
          "CONTINUED", "MORE", "END FLASHBACK", "FLASHBACK", "QUICK FLASHES",
          "MONTAGE", "MONTAGE ENDS", "END MONTAGE", "INTERCUT", "BACK TO SCENE",
          "SUPER", "TITLE CARD", "CHYRON", "SERIES OF SHOTS",
        ]);
        if (NON_CHARS.has(upper) || upper.endsWith(":")) continue;
        // Skip single-word all-caps that are likely not names (common screenplay terms)
        if (!withoutExt.includes(" ") && withoutExt.length <= 3) continue;
        chars.add(withoutExt);
      }
      return Array.from(chars);
    };

    // ── Helper: extract location from scene heading ──
    const extractLocationFromHeading = (heading: string): { location: string; intExt: string; dayNight: string } => {
      const match = heading.match(/^(INT\.|EXT\.|INT\/EXT\.?)\s*(.+?)(?:\s*-\s*(DAY|NIGHT|DAWN|DUSK|EVENING|MORNING|CONTINUOUS|LATER|SAME|MOMENTS LATER|SAME TIME|A MOMENT LATER|NEXT MORNING|NEXT DAY).*)?$/i);
      if (!match) return { location: heading, intExt: "", dayNight: "" };
      return {
        location: (match[2] || "").replace(/\s*-\s*$/, "").trim(),
        intExt: (match[1] || "").replace(".", "").trim(),
        dayNight: (match[3] || "").trim(),
      };
    };

    // ── Deterministic aggregation of ALL unique elements from scene data ──
    const allCharacters = new Set<string>();
    const allLocationsByKey = new Map<string, string>();
    const allWardrobe: string[] = [];
    const wardrobeSeen = new Set<string>();
    const allProps = new Set<string>();
    const allMoods = new Set<string>();
    const allLighting = new Set<string>();
    const allEnvironments = new Set<string>();

    // Check if scenes are enriched — if not, extract from raw text
    const anyEnriched = (allScenes as any[]).some((s) => s.enriched === true);

    for (const s of allScenes as any[]) {
      if (anyEnriched) {
        // ── Use enriched data when available ──
        // Characters
        for (const c of (s.characters || [])) {
          if (typeof c === "string" && c.trim()) {
            let name = c.replace(/\s*\(.*?\)\s*/g, "").trim();
            const dashIdx = name.indexOf(" - ");
            if (dashIdx > 0) name = name.substring(0, dashIdx).trim();
            if (name) allCharacters.add(name);
          }
        }

        // Locations
        const pictureVehicles = Array.isArray(s.picture_vehicles)
          ? (s.picture_vehicles as string[]).filter((v) => typeof v === "string" && v.trim())
          : [];
        const normalizedLocations = extractNormalizedLocations(s.location_name, pictureVehicles);
        for (const loc of normalizedLocations) {
          const key = normalizeLocationKey(loc);
          const existing = allLocationsByKey.get(key);
          if (!existing || loc.length > existing.length) {
            allLocationsByKey.set(key, loc);
          }
        }

        // Wardrobe
        for (const w of (s.wardrobe || [])) {
          const key = `${(w.character || "").toUpperCase()}: ${w.clothing_style || w.clothing || ""}`.trim();
          if (key.length > 2 && !wardrobeSeen.has(key)) {
            wardrobeSeen.add(key);
            allWardrobe.push(key);
          }
        }

        // Props (key_objects)
        for (const obj of (s.key_objects || [])) {
          if (typeof obj === "string" && obj.trim()) allProps.add(obj.trim());
        }

        // Mood / atmosphere
        if (s.mood && typeof s.mood === "string" && s.mood.trim()) {
          allMoods.add(s.mood.trim());
        }

        // Day/Night as lighting context
        if (s.day_night && typeof s.day_night === "string" && s.day_night.trim()) {
          allLighting.add(s.day_night.trim());
        }

        // Environment details for atmosphere
        if (s.environment_details && typeof s.environment_details === "string" && s.environment_details.trim()) {
          allEnvironments.add(s.environment_details.trim());
        }

        // Cinematic elements for lighting/camera
        const cin = s.cinematic_elements;
        if (cin && typeof cin === "object") {
          if (cin.camera_feel) allLighting.add(`Camera: ${cin.camera_feel}`);
        }
      } else {
        // ── Fallback: extract from raw text and headings ──
        // Characters from raw text
        const rawChars = extractCharactersFromRawText(s.raw_text || "");
        for (const c of rawChars) allCharacters.add(c);

        // Location from heading
        const { location, intExt, dayNight } = extractLocationFromHeading(s.heading || "");
        if (location) {
          const key = normalizeLocationKey(location);
          const existing = allLocationsByKey.get(key);
          if (!existing || location.length > existing.length) {
            allLocationsByKey.set(key, location);
          }
        }
        if (dayNight) allLighting.add(dayNight);
      }
    }

    // Build a condensed summary for the AI (only for creative analysis, not element lists)
    const sceneSummaries = allScenes.map((s: any) => ({
      scene_number: s.scene_number,
      heading: s.heading,
      description: s.description || "",
      mood: s.mood || "",
      environment_details: s.environment_details || "",
      int_ext: s.int_ext || "",
      day_night: s.day_night || "",
    }));

    const systemPrompt = `You are a professional script analyst and visual development consultant for film production. Given the complete scene-by-scene breakdown of a screenplay, generate high-level creative analysis.`;

    const userPrompt = `Based on this complete scene breakdown of ${allScenes.length} scenes, generate the following creative analysis. Note: Character lists, locations, wardrobe, and props are already aggregated separately — you do NOT need to list those. Focus on the creative/analytical items below:

1. **Visual Summary**: A detailed 3-5 sentence description of the overall visual tone, cinematographic approach, lighting palette, and visual themes.

2. **Signature Style**: A 2-4 sentence description of the film's distinctive visual language — what makes its look unique.

3. **Visual Design** (STRUCTURED — provide items grouped into these 4 categories):
   a. **Color Palette**: Recurring color schemes, dominant hues, palette shifts between scenes/acts, contrast patterns (e.g. "Desaturated blues and grays for present-day", "Warm ambers for flashback sequences").
   b. **Lighting Language**: Key lighting approaches, how light is used narratively, recurring lighting setups (e.g. "Hard overhead fluorescents in institutional scenes", "Golden hour backlighting for intimate moments").
   c. **Atmospheric Motifs**: Recurring environmental/weather/spatial motifs that create mood (e.g. "Rain as emotional punctuation", "Claustrophobic framing in domestic scenes", "Smoke/haze in transitional moments").
   d. **Symbolic Elements**: Visual symbols, recurring objects-as-metaphor, compositional motifs (e.g. "Mirrors and reflections for duality", "Doorways framing characters at decision points").

4. **Genres**: Identify the film's genres from this list ONLY: Action, Comedy, Docu-drama, Drama, Horror, Sci-Fi, Fantasy, Animation, Thriller, Romance, Documentary, Musical, Western, Mystery, Crime, Adventure, War. Pick 1-4 that best fit.

5. **Temporal Analysis**: Analyze the time structure. Identify the primary time period and any secondary time periods (flashbacks, flash-forwards, etc.).

6. **AI Generation Notes**: Practical production notes for AI image/video generation. Structure these as SEPARATE PARAGRAPHS, one per topic. Each paragraph should start with a bold topic header (e.g. "**Character Consistency:**", "**Lighting Rules:**", "**Color Direction:**", "**VFX & Practical Effects:**", "**Set Dressing & Props:**", "**Wardrobe Anchors:**"). Reference your Visual Design analysis where relevant — cite specific color palette items, lighting language, atmospheric motifs, and symbolic elements to connect generation guidance to the visual design framework.

AGGREGATED MOOD/ATMOSPHERE DATA FROM SCENES:
${JSON.stringify(Array.from(allMoods), null, 1)}

AGGREGATED LIGHTING/CAMERA DATA FROM SCENES:
${JSON.stringify(Array.from(allLighting), null, 1)}

COMPLETE SCENE BREAKDOWN:
${JSON.stringify(sceneSummaries, null, 1)}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "script_analysis_summary",
              description: "Return the high-level creative script analysis.",
              parameters: {
                type: "object",
                properties: {
                  visual_summary: {
                    type: "string",
                    description: "3-5 sentence description of visual tone, cinematography, lighting, and themes.",
                  },
                  signature_style: {
                    type: "string",
                    description: "2-4 sentence description of the film's distinctive visual language.",
                  },
                  visual_design: {
                    type: "object",
                    description: "CRITICAL: Only include visual design elements that are EXPLICITLY mentioned in the script text. Do NOT infer, interpret, or create elements. Only extract what the screenwriter actually wrote.",
                    properties: {
                      color_palette: {
                        type: "array",
                        items: { type: "string" },
                        description: "ONLY colors, hues, or palette descriptions explicitly mentioned in the script text (e.g. 'red neon', 'white walls', 'golden light'). Return empty array if none are written in the script.",
                      },
                      lighting_language: {
                        type: "array",
                        items: { type: "string" },
                        description: "ONLY lighting descriptions explicitly written in the script text (e.g. 'fluorescent lights', 'candlelight', 'moonlight'). Return empty array if none are written in the script.",
                      },
                      atmospheric_motifs: {
                        type: "array",
                        items: { type: "string" },
                        description: "ONLY atmospheric or environmental elements explicitly described in the script text (e.g. 'fog rolls in', 'rain pounds the windows', 'smoke-filled room'). Return empty array if none are written in the script.",
                      },
                      symbolic_elements: {
                        type: "array",
                        items: { type: "string" },
                        description: "ONLY visual objects or symbols explicitly mentioned in the script text that recur across scenes (e.g. 'the red scarf', 'a cracked mirror'). Return empty array if none are written in the script.",
                      },
                    },
                    required: ["color_palette", "lighting_language", "atmospheric_motifs", "symbolic_elements"],
                  },
                  genres: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-4 genres from: Action, Comedy, Docu-drama, Drama, Horror, Sci-Fi, Fantasy, Animation, Thriller, Romance, Documentary, Musical, Western, Mystery, Crime, Adventure, War.",
                  },
                  temporal_analysis: {
                    type: "object",
                    properties: {
                      primary_time_period: {
                        type: "object",
                        properties: {
                          estimated_year_or_era: { type: "string" },
                          confidence: { type: "string" },
                          evidence: { type: "array", items: { type: "string" } },
                        },
                        required: ["estimated_year_or_era", "confidence", "evidence"],
                      },
                      secondary_time_periods: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            label: { type: "string" },
                            type: { type: "string" },
                            estimated_year_or_range: { type: "string" },
                            approximate_scene_count: { type: "number" },
                            estimated_percentage_of_script: { type: "string" },
                            evidence: { type: "array", items: { type: "string" } },
                            scene_sluglines: {
                              type: "array",
                              description: "Scene sluglines (headings) that belong to this time period, exactly as they appear in the script.",
                              items: { type: "string" },
                            },
                          },
                          required: ["label", "type", "estimated_year_or_range"],
                        },
                      },
                    },
                    required: ["primary_time_period", "secondary_time_periods"],
                  },
                  ai_generation_notes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic: { type: "string", description: "Bold topic header, e.g. 'Character Consistency', 'Lighting Rules', 'Color Direction'." },
                        body: { type: "string", description: "The paragraph content for this topic. Reference visual design analysis (color palette, lighting language, atmospheric motifs, symbolic elements) where relevant." },
                      },
                      required: ["topic", "body"],
                    },
                    description: "Array of topic paragraphs for AI generation guidance, each referencing visual design analysis.",
                  },
                },
                required: ["visual_summary", "signature_style", "visual_design", "genres", "temporal_analysis", "ai_generation_notes"],
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

    // Build global_elements — deterministic lists + AI creative analysis
    const vd = result.visual_design || {};
    const globalElements: Record<string, any> = {
      recurring_characters: Array.from(allCharacters),
      recurring_locations: Array.from(allLocationsByKey.values()),
      recurring_wardrobe: allWardrobe,
      recurring_props: Array.from(allProps),
      // Keep legacy visual_motifs for backward compat, plus new structured data
      visual_motifs: [
        ...(vd.color_palette || []),
        ...(vd.lighting_language || []),
        ...(vd.atmospheric_motifs || []),
        ...(vd.symbolic_elements || []),
      ],
      visual_design: {
        color_palette: vd.color_palette || [],
        lighting_language: vd.lighting_language || [],
        atmospheric_motifs: vd.atmospheric_motifs || [],
        symbolic_elements: vd.symbolic_elements || [],
      },
      // Deterministic mood/lighting aggregated from scenes
      scene_moods: Array.from(allMoods),
      scene_lighting: Array.from(allLighting),
      scene_environments: Array.from(allEnvironments),
      genres: result.genres || [],
      signature_style: result.signature_style || "",
      temporal_analysis: result.temporal_analysis || null,
    };

    // ── CRITICAL: Preserve user-managed data (review statuses, groupings) ──
    // The GlobalElementsManager saves review/approval state into _managed.
    // We must not overwrite it when finalize-analysis runs again.
    const existingGlobal = analysis.global_elements as Record<string, any> | null;
    if (existingGlobal?._managed) {
      globalElements._managed = existingGlobal._managed;
    }

    // Update analysis with all the generated data
    const { error: updateErr } = await supabase
      .from("script_analyses")
      .update({
        status: "complete",
        visual_summary: result.visual_summary || "",
        global_elements: globalElements,
        ai_generation_notes: result.ai_generation_notes || "",
        error_message: null,
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

    // Auto-save detected genres to the films table (if no genres set yet)
    const detectedGenres = result.genres || [];
    if (detectedGenres.length > 0) {
      const { data: filmData } = await supabase
        .from("films")
        .select("genres")
        .eq("id", analysis.film_id)
        .single();
      if (!filmData?.genres || (filmData.genres as string[]).length === 0) {
        await supabase
          .from("films")
          .update({ genres: detectedGenres })
          .eq("id", analysis.film_id);
      }
    }

    console.log("Finalization complete for analysis:", analysis_id);
    await logCreditUsage({
      userId: authResult.userId,
      filmId: analysis.film_id,
      serviceName: "Gemini Pro",
      serviceCategory: "script-analysis",
      operation: "finalize-analysis",
      credits: 2,
    });

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
