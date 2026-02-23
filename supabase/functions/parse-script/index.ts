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
      "page": "12",
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
    "recurring_locations": ["Location Name – sub-location or descriptor"],
    "recurring_characters": ["CHARACTER NAME (age/variant if applicable)"],
    "recurring_props": ["prop description"],
    "recurring_wardrobe": ["CHARACTER – outfit/look description"],
    "visual_motifs": ["motif or recurring visual theme"],
    "signature_style": "A detailed paragraph describing the film's overall visual signature: dominant color grading, lens choices (anamorphic, vintage, etc.), texture (grain, halation, etc.), lighting philosophy, compositional style, and any recurring visual motifs that define the film's unique look. MUST be a substantive description, never empty."
  },
  
  "ai_generation_notes": "A detailed paragraph covering: consistency rules across scenes, character appearance anchors, environment continuity requirements, lighting/color grading notes, any special VFX or practical effects considerations, and style references for AI generation. MUST be substantive and specific to this script, never empty or generic."
}

RULES:
- Never invent story events not implied by the script
- If something is unclear, mark as "Ambiguous / Open Interpretation"
- Focus on visual interpretation, not logistics
- Prioritize cinematic language
- Think like a director + cinematographer + production designer
- Maintain consistency across scenes
- Every scene MUST have an image_prompt and video_prompt
- Prompts must combine: Subject + Environment + Lighting + Mood + Style + Camera Language + Detail Richness
- signature_style and ai_generation_notes MUST be fully written out with substantive, script-specific content — never leave them empty or generic`;

/** Extract plain text from Final Draft XML (.fdx) */
function parseFdxToPlainText(xml: string): string {
  const lines: string[] = [];
  const paragraphRe = /<Paragraph[^>]*Type="([^"]*)"[^>]*>([\s\S]*?)<\/Paragraph>/gi;
  let pm: RegExpExecArray | null;

  while ((pm = paragraphRe.exec(xml)) !== null) {
    const pType = pm[1];
    const inner = pm[2];
    const textRe = /<Text[^>]*>([\s\S]*?)<\/Text>/gi;
    let combined = "";
    let tm: RegExpExecArray | null;
    while ((tm = textRe.exec(inner)) !== null) {
      combined += tm[1];
    }
    const trimmed = combined.trim();
    if (!trimmed) continue;

    switch (pType) {
      case "Scene Heading":
        lines.push("", trimmed.toUpperCase(), "");
        break;
      case "Character":
        lines.push("", "    " + trimmed.toUpperCase());
        break;
      case "Parenthetical":
        lines.push("    " + trimmed);
        break;
      case "Dialogue":
        lines.push("  " + trimmed);
        break;
      case "Transition":
        lines.push("", trimmed.toUpperCase(), "");
        break;
      default:
        lines.push(trimmed);
        break;
    }
  }

  return lines.join("\n").trim();
}

/** Fix unescaped quotes inside JSON string values */
function fixUnescapedQuotes(json: string): string {
  const result: string[] = [];
  let i = 0;
  while (i < json.length) {
    if (json[i] === '"') {
      result.push('"');
      i++;
      while (i < json.length) {
        if (json[i] === '\\') { result.push(json[i], json[i + 1] || ''); i += 2; continue; }
        if (json[i] === '"') {
          let la = i + 1;
          while (la < json.length && ' \n\r\t'.includes(json[la])) la++;
          const nc = json[la];
          if (nc === undefined || ':,}]"'.includes(nc)) { result.push('"'); i++; break; }
          else { result.push('\\"'); i++; continue; }
        }
        result.push(json[i]);
        i++;
      }
    } else { result.push(json[i]); i++; }
  }
  return result.join('');
}

/** Attempt to close unclosed braces/brackets in truncated JSON */
function repairTruncatedJson(json: string): string {
  let s = json.replace(/,\s*"[^"]*$/, "");
  s = s.replace(/:\s*"[^"]*$/, ': ""');
  s = s.replace(/,\s*$/, "");
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inString) s += '"';
  while (stack.length > 0) s += stack.pop();
  return s;
}

/** Robustly extract JSON from an AI response */
function extractJsonFromResponse(response: string): any {
  let cleaned = response.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonStart = cleaned.indexOf("{");
  if (jsonStart === -1) throw new Error("No JSON object found");
  let jsonEnd = cleaned.lastIndexOf("}");
  if (jsonEnd === -1 || jsonEnd <= jsonStart) {
    cleaned = repairTruncatedJson(cleaned.substring(jsonStart));
  } else {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }
  // Fix missing opening quotes on property names
  cleaned = cleaned.replace(/([,{\[\n]\s*)([a-zA-Z_][a-zA-Z0-9_]*)"(\s*:)/g, '$1"$2"$3');
  cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")
    .replace(/[\x00-\x1F\x7F]/g, (ch) => (ch === "\n" || ch === "\r" || ch === "\t" ? ch : ""));
  try { return JSON.parse(cleaned); } catch {
    cleaned = fixUnescapedQuotes(cleaned);
    cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    try { return JSON.parse(cleaned); } catch {
      cleaned = repairTruncatedJson(cleaned);
      cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      return JSON.parse(cleaned);
    }
  }
}

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
    const rawText = await fileData.text();

    if (fileName.endsWith(".fdx") || rawText.trimStart().startsWith("<?xml") || rawText.includes("<FinalDraft")) {
      // Parse FDX (Final Draft XML) to extract plain-text screenplay
      scriptText = parseFdxToPlainText(rawText);
    } else {
      scriptText = rawText;
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
            max_tokens: 131072,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `Analyze this screenplay and produce the Visual Generation Breakdown as specified. You MUST include EVERY scene in the screenplay — do not skip, summarize, or truncate any scenes. There are likely 80-150+ scenes. If the output is long, that is expected and required. The file is named "${analysis.file_name}".\n\nSCRIPT CONTENT:\n\n${scriptText}`,
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
        const finishReason = aiResult.choices?.[0]?.finish_reason;

        // Log if the response was truncated
        if (finishReason && finishReason !== "stop") {
          console.warn(`AI response finish_reason: ${finishReason} — output may be truncated`);
        }

        if (!content) {
          await supabase
            .from("script_analyses")
            .update({ status: "error", error_message: "No response from AI" })
            .eq("id", analysis_id);
          return;
        }

        // Parse JSON from AI response (may have markdown code fences or be truncated)
        let parsed: any;
        try {
          parsed = extractJsonFromResponse(content);
        } catch {
          // If we still can't parse, store as raw text fallback
          await supabase
            .from("script_analyses")
            .update({
              status: "error",
              error_message: "AI returned malformed JSON. Please re-analyze the script.",
              visual_summary: null,
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
