import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { requireAuth, isResponse } from "../_shared/auth.ts";

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

    const { storage_path, scenes } = await req.json();

    if (!storage_path) {
      return new Response(JSON.stringify({ error: "storage_path is required" }), {
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

    // Download script
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("scripts")
      .download(storage_path);

    if (downloadErr || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download script" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullText = await fileData.text();

    // Extract scene texts
    const sceneTexts = extractSceneTexts(fullText, scenes || []);

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
        model: "google/gemini-3-pro-preview",
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

function extractSceneTexts(fullText: string, scenes: any[]): { heading: string; text: string; sceneNumber: number }[] {
  const isFdx = fullText.trimStart().startsWith("<?xml") || fullText.includes("<FinalDraft");
  if (isFdx) {
    const paragraphRegex = /<Paragraph[^>]*Type="([^"]*)"[^>]*>([\s\S]*?)<\/Paragraph>/gi;
    const paragraphs: { type: string; texts: string }[] = [];
    let match;
    while ((match = paragraphRegex.exec(fullText)) !== null) {
      const type = match[1];
      const inner = match[2];
      const texts: string[] = [];
      let tm;
      const localTextRegex = /<Text[^>]*>([\s\S]*?)<\/Text>/gi;
      while ((tm = localTextRegex.exec(inner)) !== null) {
        texts.push(tm[1].replace(/<[^>]*>/g, ""));
      }
      paragraphs.push({ type, texts: texts.join("") });
    }

    const result: { heading: string; text: string; sceneNumber: number }[] = [];
    const headingIndices: number[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].type === "Scene Heading") headingIndices.push(i);
    }
    for (let h = 0; h < headingIndices.length; h++) {
      const startIdx = headingIndices[h];
      const endIdx = h + 1 < headingIndices.length ? headingIndices[h + 1] : paragraphs.length;
      const headingText = paragraphs[startIdx].texts.trim();
      const sceneText: string[] = [];
      for (let i = startIdx; i < endIdx; i++) {
        if (paragraphs[i].texts.trim()) sceneText.push(paragraphs[i].texts);
      }
      const matchedScene = scenes.find((s: any) => s.scene_heading && headingText.toUpperCase().includes(s.scene_heading.toUpperCase()));
      result.push({ heading: headingText, text: sceneText.join("\n"), sceneNumber: matchedScene?.scene_number ?? h + 1 });
    }
    return result;
  }
  const scenePattern = /^((?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.).+)$/gim;
  const matches = [...fullText.matchAll(scenePattern)];
  const result: { heading: string; text: string; sceneNumber: number }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : fullText.length;
    const heading = matches[i][1].trim();
    const text = fullText.substring(start, end);
    const matchedScene = scenes.find((s: any) => s.scene_heading && heading.toUpperCase().includes(s.scene_heading.toUpperCase()));
    result.push({ heading, text, sceneNumber: matchedScene?.scene_number ?? i + 1 });
  }
  return result;
}
