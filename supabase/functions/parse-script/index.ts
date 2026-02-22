import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a Visual Intelligence Parser for screenplays. Your job is to analyze a screenplay and convert it into a structured VISUAL GENERATION BREAKDOWN optimized for AI image and video creation.

This breakdown is NOT for real-world production scheduling. Ignore budgeting, labor rules, permits, holding days, turnaround, or physical constraints.

GOAL: Transform the screenplay into visual intelligence that can drive AI image generation, AI video generation, previsualization, storyboards, scene visualization, and asset creation.

You MUST return your response as a JSON object with exactly these four keys:

{
  "visual_summary": "A paragraph describing: Genre, Tone/mood, Visual style, Cinematic feel, Scale (intimate/epic/surreal/grounded/stylized)",
  
  "scene_breakdown": [
    {
      "scene_number": 1,
      "scene_heading": "INT. OFFICE - NIGHT",
      "setting": "Corporate office",
      "int_ext": "INT",
      "time_of_day": "Night",
      "description": "1-2 line scene description",
      "visual_design": {
        "atmosphere": "moody, neon-lit",
        "lighting_style": "harsh fluorescent with noir shadows",
        "color_palette": "desaturated blues, warm amber accents",
        "visual_references": "Blade Runner office scenes"
      },
      "characters": [
        {
          "name": "JOHN",
          "emotional_tone": "anxious",
          "physical_behavior": "pacing, fidgeting",
          "key_expressions": "furrowed brow, darting eyes"
        }
      ],
      "wardrobe": [
        {
          "character": "JOHN",
          "clothing_style": "rumpled suit, loose tie",
          "condition": "sweat-stained, wrinkled",
          "hair_makeup": "disheveled hair, 5 o'clock shadow"
        }
      ],
      "key_objects": ["crumpled letter", "whiskey glass"],
      "environment_details": "cluttered desk, venetian blinds casting shadows, buzzing fluorescent light",
      "cinematic_elements": {
        "camera_feel": "intimate handheld",
        "shot_suggestions": ["close-up on hands", "wide establishing shot", "POV of letter"],
        "motion_cues": "slow drift, restless energy"
      },
      "effects": {
        "practical": ["cigarette smoke", "rain on windows"],
        "vfx": []
      },
      "sound_mood": "tense silence, distant thunder",
      "continuity_flags": ["same suit as Scene 3", "injury on left hand from Scene 5"],
      "image_prompt": "A disheveled man in a rumpled suit stands in a dimly lit corporate office at night. Harsh fluorescent lighting casts noir shadows through venetian blinds. Desaturated blue tones with warm amber accents. Rain streaks the windows. Intimate handheld camera feel, close-up framing. Cinematic, moody atmosphere.",
      "video_prompt": "Slow handheld drift around a man pacing anxiously in a dark office. He fidgets with a crumpled letter. Rain patters against windows, casting moving light patterns. Fluorescent lights buzz overhead. Camera slowly pushes in on his face. Cinematic noir lighting, desaturated palette."
    }
  ],
  
  "global_elements": {
    "recurring_locations": [],
    "recurring_props": [],
    "recurring_wardrobe": [],
    "visual_motifs": [],
    "signature_style": ""
  },
  
  "ai_generation_notes": "Any additional notes about overall visual approach, consistency requirements, or special considerations for AI generation."
}

RULES:
- Never invent story events not implied by the script
- If something is unclear, mark as "Ambiguous / Open Interpretation"
- Focus on visual interpretation, not logistics
- Prioritize cinematic language
- Think like a director + cinematographer + production designer
- Maintain consistency across scenes
- Every scene MUST have an image_prompt and video_prompt
- Prompts must combine: Subject + Environment + Lighting + Mood + Style + Camera Language + Detail Richness`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysis_id } = await req.json();
    if (!analysis_id) {
      return new Response(JSON.stringify({ error: "analysis_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the analysis record
    const { data: analysis, error: fetchErr } = await supabase
      .from("script_analyses")
      .select("*")
      .eq("id", analysis_id)
      .single();

    if (fetchErr || !analysis) {
      return new Response(JSON.stringify({ error: "Analysis not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as analyzing
    await supabase
      .from("script_analyses")
      .update({ status: "analyzing" })
      .eq("id", analysis_id);

    // Download the script file from storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("scripts")
      .download(analysis.storage_path);

    if (downloadErr || !fileData) {
      await supabase
        .from("script_analyses")
        .update({ status: "error", error_message: "Failed to download script file" })
        .eq("id", analysis_id);
      return new Response(JSON.stringify({ error: "Failed to download script" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract text content from the file
    let scriptText: string;
    const fileName = analysis.file_name.toLowerCase();

    if (fileName.endsWith(".fountain") || fileName.endsWith(".txt")) {
      scriptText = await fileData.text();
    } else {
      try {
        scriptText = await fileData.text();
      } catch {
        scriptText = "Unable to extract text from binary file format.";
      }
    }

    // Truncate if too long
    const maxChars = 200000;
    if (scriptText.length > maxChars) {
      scriptText = scriptText.substring(0, maxChars) + "\n\n[TRUNCATED - script exceeds maximum length]";
    }

    // Return early to the client so the request doesn't timeout
    // Process the AI call in the background using waitUntil-style approach
    const responsePromise = (async () => {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `Analyze this screenplay and produce the Visual Generation Breakdown as specified. The file is named "${analysis.file_name}".\n\nSCRIPT CONTENT:\n\n${scriptText}`,
              },
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errStatus = aiResponse.status;
          let errMsg = "AI analysis failed";
          if (errStatus === 429) errMsg = "Rate limit exceeded. Please try again later.";
          if (errStatus === 402) errMsg = "AI credits exhausted. Please add credits.";

          await supabase
            .from("script_analyses")
            .update({ status: "error", error_message: errMsg })
            .eq("id", analysis_id);
          return;
        }

        const aiResult = await aiResponse.json();
        const content = aiResult.choices?.[0]?.message?.content;

        if (!content) {
          await supabase
            .from("script_analyses")
            .update({ status: "error", error_message: "No response from AI" })
            .eq("id", analysis_id);
          return;
        }

        // Parse JSON from AI response (may have markdown code fences)
        let parsed: any;
        try {
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
          parsed = JSON.parse(jsonStr);
        } catch {
          await supabase
            .from("script_analyses")
            .update({
              status: "complete",
              visual_summary: content,
              scene_breakdown: null,
              global_elements: null,
              ai_generation_notes: null,
            })
            .eq("id", analysis_id);
          return;
        }

        // Store structured result
        await supabase
          .from("script_analyses")
          .update({
            status: "complete",
            visual_summary: parsed.visual_summary || null,
            scene_breakdown: parsed.scene_breakdown || null,
            global_elements: parsed.global_elements || null,
            ai_generation_notes: parsed.ai_generation_notes || null,
          })
          .eq("id", analysis_id);
      } catch (e) {
        console.error("Background AI processing error:", e);
        await supabase
          .from("script_analyses")
          .update({
            status: "error",
            error_message: e instanceof Error ? e.message : "Unknown processing error",
          })
          .eq("id", analysis_id);
      }
    })();

    // Use EdgeRuntime.waitUntil if available (Supabase supports this)
    // This lets us return immediately while background work continues
    if (typeof (globalThis as any).EdgeRuntime !== "undefined" && (globalThis as any).EdgeRuntime.waitUntil) {
      (globalThis as any).EdgeRuntime.waitUntil(responsePromise);
    } else {
      // Fallback: just don't await it — Deno will keep the isolate alive for active promises
      responsePromise.catch((e) => console.error("Background task failed:", e));
    }

    return new Response(JSON.stringify({ success: true, message: "Analysis started" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-script error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
