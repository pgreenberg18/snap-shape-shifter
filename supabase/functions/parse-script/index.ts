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

/** Extract scenes from screenplay text using regex on scene headings */
function extractScenes(scriptText: string): Array<{ heading: string; raw_text: string }> {
  const sceneHeadingRegex = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s.+$/gm;
  const matches: Array<{ heading: string; index: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = sceneHeadingRegex.exec(scriptText)) !== null) {
    matches.push({ heading: match[0].trim(), index: match.index });
  }

  if (matches.length === 0) {
    return [];
  }

  const scenes: Array<{ heading: string; raw_text: string }> = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : scriptText.length;
    const raw_text = scriptText.substring(start, end).trim();
    scenes.push({ heading: matches[i].heading, raw_text });
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

    const filmId = analysis.film_id;

    // Create a parse_jobs row
    const { data: job, error: jobErr } = await supabase
      .from("parse_jobs")
      .insert({
        film_id: filmId,
        analysis_id: analysis_id,
        status: "processing",
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Failed to create parse job" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobId = job.id;

    // Mark analysis as analyzing
    await supabase
      .from("script_analyses")
      .update({ status: "analyzing" })
      .eq("id", analysis_id);

    // Download the script file from storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("scripts")
      .download(analysis.storage_path);

    if (downloadErr || !fileData) {
      const errMsg = "Failed to download script file";
      await supabase.from("parse_jobs").update({ status: "error", error_message: errMsg, updated_at: new Date().toISOString() }).eq("id", jobId);
      await supabase.from("script_analyses").update({ status: "error", error_message: errMsg }).eq("id", analysis_id);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract text content from the file
    let scriptText: string;
    const fileName = analysis.file_name.toLowerCase();
    const rawText = await fileData.text();

    if (fileName.endsWith(".fdx") || rawText.trimStart().startsWith("<?xml") || rawText.includes("<FinalDraft")) {
      scriptText = parseFdxToPlainText(rawText);
    } else {
      scriptText = rawText;
    }

    // Extract scenes deterministically via regex
    const scenes = extractScenes(scriptText);

    if (scenes.length === 0) {
      const errMsg = "No scenes found in script. Expected headings like INT./EXT.";
      await supabase.from("parse_jobs").update({ status: "error", error_message: errMsg, updated_at: new Date().toISOString() }).eq("id", jobId);
      await supabase.from("script_analyses").update({ status: "error", error_message: errMsg }).eq("id", analysis_id);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete any existing parsed_scenes for this film to allow re-parse
    await supabase.from("parsed_scenes").delete().eq("film_id", filmId);

    // Insert each scene into parsed_scenes
    const sceneRows = scenes.map((scene, index) => ({
      film_id: filmId,
      scene_number: index + 1,
      heading: scene.heading,
      raw_text: scene.raw_text,
    }));

    const { error: insertErr } = await supabase.from("parsed_scenes").insert(sceneRows);

    if (insertErr) {
      const errMsg = `Failed to insert scenes: ${insertErr.message}`;
      await supabase.from("parse_jobs").update({ status: "error", error_message: errMsg, updated_at: new Date().toISOString() }).eq("id", jobId);
      await supabase.from("script_analyses").update({ status: "error", error_message: errMsg }).eq("id", analysis_id);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update parse_jobs to completed
    await supabase
      .from("parse_jobs")
      .update({
        status: "completed",
        scene_count: scenes.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // Update script_analyses status to complete
    await supabase
      .from("script_analyses")
      .update({ status: "complete" })
      .eq("id", analysis_id);

    return new Response(
      JSON.stringify({ success: true, scene_count: scenes.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parse-script error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
