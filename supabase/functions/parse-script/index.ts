import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Format converters ────────────────────────────────────────────

/** Extract plain text from Final Draft XML (.fdx / .fdr) */
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

/** Extract text from PDF using unpdf (pdfjs-based, Deno-compatible) */
async function parsePdfToPlainText(data: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  const raw = typeof text === "string" ? text : (text as string[]).join("\n");
  console.log("[PDF] Extracted text length:", raw.length);
  console.log("[PDF] First 2000 chars:", raw.slice(0, 2000));
  return raw;
}

/** Strip RTF control codes to extract plain text */
function parseRtfToPlainText(rtf: string): string {
  // Remove RTF header/groups, keep text content
  let text = rtf;
  // Remove {\fonttbl ...}, {\colortbl ...}, {\stylesheet ...}, etc.
  text = text.replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|pict)[^}]*(?:\{[^}]*\}[^}]*)*\}/gi, "");
  // Remove \par and replace with newlines
  text = text.replace(/\\par\b/g, "\n");
  // Remove all \command words (with optional numeric arg)
  text = text.replace(/\\[a-z]+[-]?\d*\s?/gi, "");
  // Remove remaining braces
  text = text.replace(/[{}]/g, "");
  // Clean up whitespace
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return text.trim();
}

/** Extract text from .docx (ZIP containing XML) */
async function parseDocxToPlainText(data: ArrayBuffer): Promise<string> {
  // DOCX is a ZIP file; we need to find word/document.xml
  // Use the built-in DecompressionStream approach or manual ZIP parsing
  const bytes = new Uint8Array(data);

  // Find "word/document.xml" inside the ZIP
  const decoder = new TextDecoder();
  const zipEntries = parseZipEntries(bytes);
  const docEntry = zipEntries.find(e => e.name === "word/document.xml");

  if (!docEntry) {
    throw new Error("Invalid DOCX: word/document.xml not found");
  }

  const xml = decoder.decode(docEntry.data);
  // Extract text from <w:t> tags
  const textParts: string[] = [];
  const wParagraphRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
  let pm: RegExpExecArray | null;

  while ((pm = wParagraphRe.exec(xml)) !== null) {
    const inner = pm[1];
    const wtRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/gi;
    let line = "";
    let tm: RegExpExecArray | null;
    while ((tm = wtRe.exec(inner)) !== null) {
      line += tm[1];
    }
    textParts.push(line);
  }

  return textParts.join("\n").trim();
}

/** Minimal ZIP parser – extracts uncompressed and deflate-compressed entries */
function parseZipEntries(data: Uint8Array): { name: string; data: Uint8Array }[] {
  const entries: { name: string; data: Uint8Array }[] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  while (offset < data.length - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Not a local file header

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameBytes = data.subarray(offset + 30, offset + 30 + nameLen);
    const name = new TextDecoder().decode(nameBytes);

    const dataStart = offset + 30 + nameLen + extraLen;
    const rawData = data.subarray(dataStart, dataStart + compressedSize);

    if (compressionMethod === 0) {
      // Stored (no compression)
      entries.push({ name, data: rawData });
    } else if (compressionMethod === 8) {
      // Deflate – use DecompressionStream
      try {
        const ds = new DecompressionStream("raw");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        writer.write(rawData);
        writer.close();

        const chunks: Uint8Array[] = [];
        let totalLen = 0;
        // We need to handle this synchronously-ish for the ZIP parser
        // but DecompressionStream is async, so we'll collect later
        entries.push({ name, data: rawData }); // placeholder, will decompress below
        // Mark for async decompression
        (entries[entries.length - 1] as any)._needsDecompress = true;
        (entries[entries.length - 1] as any)._reader = reader;
      } catch {
        entries.push({ name, data: rawData });
      }
    } else {
      entries.push({ name, data: rawData });
    }

    offset = dataStart + compressedSize;
  }

  return entries;
}

/** Async decompression for ZIP entries that need it */
async function decompressZipEntries(entries: { name: string; data: Uint8Array }[]): Promise<void> {
  for (const entry of entries) {
    if ((entry as any)._needsDecompress) {
      try {
        const ds = new DecompressionStream("raw");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        writer.write(entry.data).catch(() => {});
        writer.close().catch(() => {});

        const chunks: Uint8Array[] = [];
        let totalLen = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.length;
        }
        const result = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of chunks) {
          result.set(chunk, pos);
          pos += chunk.length;
        }
        entry.data = result;
      } catch {
        // Leave raw data if decompression fails
      }
      delete (entry as any)._needsDecompress;
      delete (entry as any)._reader;
    }
  }
}

/** Parse Fountain format to plain text (scene headings already use INT./EXT.) */
function parseFountainToPlainText(text: string): string {
  // Fountain is already plain text with screenplay conventions
  // Strip Fountain-specific metadata (Title:, Credit:, Author:, etc.)
  let result = text;
  // Remove title page (everything before first blank line pair or scene heading)
  const titlePageEnd = result.search(/\n\s*\n\s*(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i);
  if (titlePageEnd > 0 && titlePageEnd < 500) {
    result = result.slice(titlePageEnd);
  }
  // Remove forced scene heading markers (leading .)
  result = result.replace(/^\./gm, "");
  // Remove boneyard markers (/* ... */)
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove section markers (# heading)
  result = result.replace(/^#{1,6}\s+/gm, "");
  // Remove synopses (= text)
  result = result.replace(/^=\s+.+$/gm, "");
  // Remove notes ([[...]])
  result = result.replace(/\[\[[\s\S]*?\]\]/g, "");
  // Remove emphasis markers (* and _)
  result = result.replace(/[*_]/g, "");
  return result.trim();
}

/** Extract text from Celtx (.sexp) – it's XML-based */
function parseSexpToPlainText(text: string): string {
  // Celtx files contain screenplay data in XML format
  // Try to extract text content from <p> or similar tags
  const lines: string[] = [];
  const tagRe = /<(?:p|text|span)[^>]*>([\s\S]*?)<\/(?:p|text|span)>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(text)) !== null) {
    const inner = m[1].replace(/<[^>]+>/g, "").trim();
    if (inner) lines.push(inner);
  }
  // If no XML content found, return as-is (might be plain text)
  return lines.length > 0 ? lines.join("\n") : text;
}

// ─── Scene extraction ─────────────────────────────────────────────

/** Deterministic scene extraction */
function extractScenes(scriptText: string) {
  let normalized = scriptText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // PDF extraction often merges lines. Try to re-split scene headings
  // that are glued to preceding text by inserting newlines before INT./EXT.
  normalized = normalized.replace(/([^\n])((?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s)/g, "$1\n$2");

  const sceneRegex = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s.+$/gm;
  let matches = [...normalized.matchAll(sceneRegex)];

  // If still no matches, try case-insensitive
  if (matches.length === 0) {
    const ciRegex = /^(int\.|ext\.|int\/ext\.|i\/e\.)\s.+$/gim;
    matches = [...normalized.matchAll(ciRegex)];
  }

  console.log(`[extractScenes] Found ${matches.length} scene headings`);
  if (matches.length > 0) {
    console.log("[extractScenes] First heading:", matches[0][0]);
  }

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

// ─── Main handler ─────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

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

    const fileName = analysis.file_name.toLowerCase();
    let scriptText: string;

    try {
      if (fileName.endsWith(".pdf")) {
        // ── PDF ──
        const arrayBuf = await fileData.arrayBuffer();
        scriptText = await parsePdfToPlainText(arrayBuf);
      } else if (fileName.endsWith(".docx")) {
        // ── DOCX ──
        const arrayBuf = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        const entries = parseZipEntries(bytes);
        await decompressZipEntries(entries);
        const docEntry = entries.find(e => e.name === "word/document.xml");
        if (!docEntry) throw new Error("Invalid DOCX: word/document.xml not found");
        const xml = new TextDecoder().decode(docEntry.data);
        const textParts: string[] = [];
        const wParagraphRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
        let pm: RegExpExecArray | null;
        while ((pm = wParagraphRe.exec(xml)) !== null) {
          const inner = pm[1];
          const wtRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/gi;
          let line = "";
          let tm: RegExpExecArray | null;
          while ((tm = wtRe.exec(inner)) !== null) {
            line += tm[1];
          }
          textParts.push(line);
        }
        scriptText = textParts.join("\n").trim();
      } else if (fileName.endsWith(".rtf")) {
        // ── RTF ──
        const rawText = await fileData.text();
        scriptText = parseRtfToPlainText(rawText);
      } else if (fileName.endsWith(".fountain")) {
        // ── Fountain ──
        const rawText = await fileData.text();
        scriptText = parseFountainToPlainText(rawText);
      } else if (fileName.endsWith(".sexp")) {
        // ── Celtx ──
        const rawText = await fileData.text();
        scriptText = parseSexpToPlainText(rawText);
      } else {
        // ── FDX, FDR, MMSW, TXT, or unknown ──
        const rawText = await fileData.text();
        if (
          fileName.endsWith(".fdx") ||
          fileName.endsWith(".fdr") ||
          rawText.trimStart().startsWith("<?xml") ||
          rawText.includes("<FinalDraft")
        ) {
          scriptText = parseFdxToPlainText(rawText);
        } else if (fileName.endsWith(".mmsw") && rawText.includes("<")) {
          // Movie Magic Screenwriter – XML variant
          scriptText = parseSexpToPlainText(rawText);
        } else {
          scriptText = rawText;
        }
      }
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : "Unknown parse error";
      console.error("Format parsing failed:", msg);
      await supabase
        .from("script_analyses")
        .update({ status: "error", error_message: `Failed to parse ${fileName.split(".").pop()?.toUpperCase()} format: ${msg}` })
        .eq("id", analysis_id);

      return new Response(JSON.stringify({ error: `Format parse error: ${msg}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scenes = extractScenes(scriptText);

    if (scenes.length === 0) {
      await supabase
        .from("script_analyses")
        .update({
          status: "error",
          error_message: "No scenes found. The parser could not detect any scene headings (INT./EXT.). Please ensure the file is a properly formatted screenplay.",
        })
        .eq("id", analysis_id);

      return new Response(
        JSON.stringify({ error: "No scenes detected", scene_count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean up old parsed_scenes for this film before inserting new ones
    await supabase
      .from("parsed_scenes")
      .delete()
      .eq("film_id", analysis.film_id);

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

    const sceneIds: string[] = [];
    for (const scene of scenes) {
      const { data: insertedScene } = await supabase.from("parsed_scenes").insert({
        film_id: analysis.film_id,
        scene_number: scene.scene_number,
        heading: scene.heading,
        raw_text: scene.text,
      }).select("id").single();
      if (insertedScene) sceneIds.push(insertedScene.id);
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

    // Mark as "enriching" — the enrich-scene function will set "complete"
    // after all scenes have been processed by Gemini.
    await supabase
      .from("script_analyses")
      .update({ status: "enriching", scene_breakdown: sceneBreakdown })
      .eq("id", analysis_id);

    await logCreditUsage({
      userId: authResult.userId,
      filmId: analysis.film_id,
      serviceName: "Script Parser",
      serviceCategory: "script-analysis",
      operation: "parse-script",
    });

    return new Response(
      JSON.stringify({
        success: true,
        scene_count: scenes.length,
        scene_ids: sceneIds,
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
