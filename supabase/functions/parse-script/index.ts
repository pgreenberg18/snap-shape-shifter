import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

/** Deterministic scene extraction */
function extractScenes(scriptText: string) {
  const normalized = scriptText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const sceneRegex = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s.+$/gm;
  const matches = [...normalized.matchAll(sceneRegex)];

  const scenes: {
    scene_number: number;
    heading: string;
    text: string;
  }[] = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!;
    const end =
      i + 1 < matches.length
        ? matches[i + 1].index!
        : normalized.length;

    scenes.push({
      scene_number: i + 1,
      heading: matches[i][0].trim(),
      text: normalized.slice(start, end).trim(),
    });
  }

  return scenes;
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    await supabase
      .from("script_analyses")
      .update({ status: "analyzing" })
      .eq("id", analysis_id);

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

    const rawText = await fileData.text();
    const fileName = analysis.file_name.toLowerCase();

    let scriptText: string;

    if (
      fileName.endsWith(".fdx") ||
      rawText.trimStart().startsWith("<?xml") ||
      rawText.includes("<FinalDraft")
    ) {
      scriptText = parseFdxToPlainText(rawText);
    } else {
      scriptText = rawText;
    }

    const scenes = extractScenes(scriptText);

    const { data: job } = await supabase
      .from("parse_jobs")
      .insert({
        film_id: analysis.film_id,
        analysis_id: analysis_id,
        status: "completed",
        scene_count: scenes.length,
      })
      .select()
      .single();

    for (const scene of scenes) {
      await supabase.from("parsed_scenes").insert({
        film_id: analysis.film_id,
        scene_number: scene.scene_number,
        heading: scene.heading,
        raw_text: scene.text,
      });
    }

    // Build scene_breakdown JSON so the UI can render results
    const sceneBreakdown = scenes.map((s) => ({
      scene_number: s.scene_number,
      scene_heading: s.heading,
      description: "",
      characters: [] as string[],
      key_objects: [] as string[],
      wardrobe: [] as string[],
    }));

    // Mark the script_analyses row as complete and populate scene_breakdown
    await supabase
      .from("script_analyses")
      .update({ status: "complete", scene_breakdown: sceneBreakdown })
      .eq("id", analysis_id);

    return new Response(
      JSON.stringify({
        success: true,
        scene_count: scenes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
