import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

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
        model: "google/gemini-2.5-flash",
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

    // Parse JSON
    let parsed: any;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

function extractSceneTexts(fullText: string, scenes: any[]): { heading: string; text: string; sceneNumber: number }[] {
  const isFdx = fullText.trimStart().startsWith("<?xml") || fullText.includes("<FinalDraft");
  if (isFdx) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(fullText, "text/xml");
    const paragraphs = Array.from(doc.querySelectorAll("Paragraph"));
    const result: { heading: string; text: string; sceneNumber: number }[] = [];
    const headingIndices: number[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].getAttribute("Type") === "Scene Heading") headingIndices.push(i);
    }
    for (let h = 0; h < headingIndices.length; h++) {
      const startIdx = headingIndices[h];
      const endIdx = h + 1 < headingIndices.length ? headingIndices[h + 1] : paragraphs.length;
      const headingText = Array.from(paragraphs[startIdx].querySelectorAll("Text")).map((t) => t.textContent || "").join("").trim();
      const sceneText: string[] = [];
      for (let i = startIdx; i < endIdx; i++) {
        const texts = Array.from(paragraphs[i].querySelectorAll("Text")).map((t) => t.textContent || "").join("");
        if (texts.trim()) sceneText.push(texts);
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
