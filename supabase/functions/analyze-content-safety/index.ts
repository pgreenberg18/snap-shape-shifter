import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an MPAA content rating analyst. You will be given scenes from a screenplay with their full text. Analyze each scene HOLISTICALLY for content that affects MPAA ratings.

CRITICAL: Do NOT flag words purely because they appear on a keyword list. Evaluate the INTENT and CONTEXT of the language:
- "intimate" can mean emotionally close, not sexual
- "fight" can be a verbal argument, not physical violence
- "bar" can be a location without substance abuse implications
- "kill" can be metaphorical ("killing time", "dressed to kill")
- "hell" can be an exclamation, not profanity in mild contexts
- Words in non-offensive dialogue or narration should not be flagged

Only flag content that would genuinely affect an MPAA rating. Consider:
1. The surrounding context and scene tone
2. Whether violence/language/nudity is explicit vs implied
3. The intensity and duration of concerning content
4. Whether substance use is glorified vs incidental

Return a JSON array of flags. Each flag should have:
{
  "scene_index": <0-based index>,
  "scene_heading": "<heading>",
  "category": "language" | "violence" | "nudity" | "substance" | "thematic",
  "type": "dialogue" | "description",
  "excerpt": "<the specific offending passage, up to 80 chars>",
  "severity": "G" | "PG" | "PG-13" | "R" | "NC-17",
  "reason": "<brief explanation of WHY this is flagged, considering context>"
}

Also return:
{
  "flags": [...],
  "suggested_rating": "G" | "PG" | "PG-13" | "R" | "NC-17",
  "rating_justification": "<1-2 sentence explanation>"
}

If nothing warrants flagging, return empty flags array with rating "G".
Be precise and avoid false positives. Quality over quantity.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { storage_path, scenes, film_id } = await req.json();

    if (!storage_path && !film_id) {
      return new Response(JSON.stringify({ error: "storage_path or film_id is required" }), {
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

    // Use parsed_scenes from DB as the source of truth (works for all formats including PDF)
    let sceneTexts: { heading: string; text: string; sceneNumber: number }[] = [];

    // Determine which film_id to use
    let resolvedFilmId = film_id;
    if (!resolvedFilmId && scenes?.length > 0 && scenes[0].film_id) {
      resolvedFilmId = scenes[0].film_id;
    }

    if (resolvedFilmId) {
      const { data: dbScenes } = await supabase
        .from("parsed_scenes")
        .select("scene_number, heading, raw_text")
        .eq("film_id", resolvedFilmId)
        .order("scene_number", { ascending: true });

      if (dbScenes && dbScenes.length > 0) {
        sceneTexts = dbScenes.map((s: any) => ({
          heading: s.heading,
          text: s.raw_text,
          sceneNumber: s.scene_number,
        }));
      }
    }

    // Fallback: use scenes array passed from the client
    if (sceneTexts.length === 0 && scenes?.length > 0) {
      sceneTexts = scenes.map((s: any, i: number) => ({
        heading: s.heading || s.scene_heading || `Scene ${i + 1}`,
        text: s.raw_text || s.text || "",
        sceneNumber: s.scene_number ?? i + 1,
      }));
    }

    if (sceneTexts.length === 0) {
      return new Response(JSON.stringify({ error: "No scenes found to analyze" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the prompt with scene texts
    const scenesForAI = sceneTexts.map((s, i) => 
      `--- SCENE ${i + 1}: ${s.heading} ---\n${s.text}`
    ).join("\n\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        max_tokens: 8192,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analyze these ${sceneTexts.length} scenes for MPAA content rating. Remember to evaluate context holistically — do not flag words that are innocuous in context.\n\n${scenesForAI}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errStatus = aiResponse.status;
      let errMsg = "AI analysis failed";
      if (errStatus === 429) errMsg = "Rate limit exceeded. Please try again later.";
      if (errStatus === 402) errMsg = "AI credits exhausted.";

      return new Response(JSON.stringify({ error: errMsg }), {
        status: errStatus,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse JSON - handle truncated/malformed responses
    let parsed: any;
    try {
      parsed = extractJsonFromResponse(content);
    } catch {
      // If parsing fails entirely, try to salvage partial flags
      try {
        parsed = salvageTruncatedResponse(content);
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content.substring(0, 500) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await logCreditUsage({
      userId: authResult.userId,
      serviceName: "Gemini Pro",
      serviceCategory: "script-analysis",
      operation: "analyze-content-safety",
    });

    return new Response(JSON.stringify({
      flags: parsed.flags || [],
      suggested_rating: parsed.suggested_rating || "G",
      rating_justification: parsed.rating_justification || "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-content-safety error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractJsonFromResponse(response: string): any {
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.search(/[\{\[]/);
  if (jsonStart === -1) throw new Error("No JSON found");

  const openChar = cleaned[jsonStart];
  const closeChar = openChar === '[' ? ']' : '}';
  const jsonEnd = cleaned.lastIndexOf(closeChar);

  if (jsonEnd === -1 || jsonEnd <= jsonStart) throw new Error("No closing bracket");

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(cleaned);
  }
}

function salvageTruncatedResponse(response: string): any {
  // Extract whatever complete flag objects exist even if the array/object is truncated
  const flagPattern = /\{[^{}]*"scene_index"\s*:\s*\d+[^{}]*"severity"\s*:\s*"[^"]*"[^{}]*\}/g;
  const matches = response.match(flagPattern) || [];
  const flags: any[] = [];
  for (const m of matches) {
    try { flags.push(JSON.parse(m)); } catch { /* skip malformed */ }
  }

  // Try to extract suggested_rating
  const ratingMatch = response.match(/"suggested_rating"\s*:\s*"([^"]*)"/);
  const justMatch = response.match(/"rating_justification"\s*:\s*"([^"]*)"/);

  // Determine rating from flags if not found
  const severityOrder = ["G", "PG", "PG-13", "R", "NC-17"];
  let maxSeverity = "G";
  for (const f of flags) {
    if (severityOrder.indexOf(f.severity) > severityOrder.indexOf(maxSeverity)) {
      maxSeverity = f.severity;
    }
  }

  return {
    flags,
    suggested_rating: ratingMatch?.[1] || maxSeverity,
    rating_justification: justMatch?.[1] || `Based on ${flags.length} content flags (response was truncated).`,
  };
}

