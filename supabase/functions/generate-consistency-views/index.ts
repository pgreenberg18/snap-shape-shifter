import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/*
 * Industry-standard 8-view turnaround structure optimized for AI character consistency.
 *
 * Core Goals:
 *  - Lock facial geometry, body proportions, costume structure, silhouette
 *  - Provide depth + 3D structure cues
 *  - Minimize distortion
 *
 * Global rules enforced in every prompt:
 *  📷 Lens: 50mm equivalent (full-frame), no wide distortion, no telephoto compression
 *  💡 Lighting: Neutral studio-flat — soft key, soft fill, light rim, no dramatic shadows, no colored light
 *  🎨 Background: Solid neutral gray, no gradients, no environment
 *  🧍 Pose: Neutral stance, arms relaxed at sides, no contrapposto, no weight shift,
 *           feet shoulder width, hands visible, no overlap blocking torso shape
 */

const ANGLE_VIEWS = [
  {
    index: 0,
    label: "Front Full",
    framing: "Full body, head to toe",
    direction: "facing directly toward the camera, straight-on front view",
    purpose: "Primary identity anchor — the base mesh reference",
    camera: "Eye level, no tilt",
    expression: "Neutral — no smile, no emotion",
  },
  {
    index: 1,
    label: "Back Full",
    framing: "Full body, HEAD TO TOE — the entire figure must be visible from top of head to bottom of feet, with small margin above and below. Do NOT crop at the knees or waist",
    direction: "turned fully away from camera, back-of-head view",
    purpose: "Hair shape, coat drape, silhouette consistency",
    camera: "Same height as front, pulled back enough to show full body head to toe",
    expression: "N/A — back view, posture identical to front",
  },
  {
    index: 2,
    label: "Left Profile",
    framing: "Full body, HEAD TO TOE — the entire figure must be visible from top of head to bottom of feet, with small margin above and below. Do NOT crop at the knees or waist",
    direction: "turned exactly 90 degrees to camera-left, true left profile view",
    purpose: "Nose projection, jaw depth, shoulder width",
    camera: "Eye level, true 90° — no three-quarter rotation, pulled back enough to show full body head to toe",
    expression: "Neutral",
  },
  {
    index: 3,
    label: "Right Profile",
    framing: "Full body, HEAD TO TOE — the entire figure must be visible from top of head to bottom of feet, with small margin above and below. Do NOT crop at the knees or waist",
    direction: "turned exactly 90 degrees to camera-right, true right profile view, mirror of left profile",
    purpose: "Asymmetrical face/hair detection — mirror of left profile",
    camera: "Eye level, true 90°, pulled back enough to show full body head to toe",
    expression: "Neutral",
  },
  {
    index: 4,
    label: "3/4 Left",
    framing: "Full body, head to toe",
    direction: "rotated 45 degrees so their RIGHT cheek faces the camera and their LEFT cheek faces away. The character's body and nose point to the LEFT side of the frame. This is a three-quarter left view — the viewer sees mostly the right side of the face",
    purpose: "Most cinematic angle — AI learns depth + cheekbone structure",
    camera: "Eye level",
    expression: "Neutral",
  },
  {
    index: 5,
    label: "3/4 Right",
    framing: "Full body, head to toe",
    direction: "rotated 45 degrees so their LEFT cheek faces the camera and their RIGHT cheek faces away. The character's body and nose point to the RIGHT side of the frame. This is a three-quarter right view — the viewer sees mostly the left side of the face. Mirror of 3/4 left",
    purpose: "Mirror of 3/4 left — cinematic depth from opposite side",
    camera: "Eye level",
    expression: "Neutral",
  },
  {
    index: 6,
    label: "MCU Front",
    framing: "Medium close-up — chest up",
    direction: "facing directly toward the camera, straight-on front view",
    purpose: "Facial detail capture — eyes, skin texture, brow, mouth",
    camera: "Eye level, same lighting as body shots",
    expression: "Neutral",
  },
  {
    index: 7,
    label: "ECU Face",
    framing: "Extreme close-up — top of head to chin only",
    direction: "facing directly toward the camera, straight-on front view",
    purpose: "Micro features — iris color, lip shape, skin pores, wrinkles",
    camera: "Eye level, no beauty lighting, no filters, no depth blur",
    expression: "Neutral",
  },
];

const GLOBAL_RULES = `CRITICAL TECHNICAL REQUIREMENTS — APPLY TO ALL VIEWS:

📷 LENS:
- 50mm equivalent (full-frame sensor)
- NO wide-angle distortion (no 24mm)
- NO telephoto compression (no 85mm+)
- NO stylized lens effects

💡 LIGHTING:
- Neutral, studio-flat lighting
- Soft key light + soft fill light + light rim light
- NO dramatic shadows
- NO colored light
- NO mood lighting
- Goal: AI sees geometry, not mood

🎨 BACKGROUND:
- Solid neutral gray (#808080 to #999999)
- NO gradients
- NO environment
- NO props in background

🧍 POSE (for full body views):
- Neutral stance
- Arms relaxed at sides
- NO contrapposto
- NO weight shift
- Feet shoulder width apart
- Hands visible
- NO overlap blocking torso shape

🚫 DO NOT INCLUDE:
- NO emotion or expression variation
- NO action poses
- NO wind effects
- NO motion blur
- NO stylized lighting
- NO environment elements
- NO camera tilt
- NO artistic interpretation

This is DATA CAPTURE, not art. Accuracy and consistency are paramount.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { character_id } = await req.json();
    if (!character_id) throw new Error("character_id is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch character with its cast headshot
    const { data: character, error: charError } = await sb
      .from("characters")
      .select("id, name, description, sex, age_min, age_max, image_url, film_id")
      .eq("id", character_id)
      .single();

    if (charError || !character) throw new Error("Character not found");
    if (!character.image_url) throw new Error("Character has no cast headshot");

    // Fetch film for context
    const { data: film } = await sb
      .from("films")
      .select("title, time_period, genres")
      .eq("id", character.film_id)
      .single();

    // Upsert pending rows for all 8 views
    for (const angle of ANGLE_VIEWS) {
      await sb.from("character_consistency_views").upsert(
        {
          character_id,
          angle_index: angle.index,
          angle_label: angle.label,
          status: "generating",
          image_url: null,
        },
        { onConflict: "character_id,angle_index" }
      );
    }

    // Build identity strings
    const sexStr = character.sex && character.sex !== "Unknown" ? character.sex.toLowerCase() : "person";
    const ageStr = character.age_min && character.age_max
      ? `${character.age_min}-${character.age_max} years old`
      : "adult";
    const periodStr = film?.time_period ? `Set in the ${film.time_period} era.` : "";
    const genreStr = film?.genres?.length ? `Genre: ${film.genres.join(", ")}.` : "";

    const safeDesc = (character.description || "")
      .replace(/injur\w*/gi, "rugged")
      .replace(/wound\w*/gi, "weathered")
      .replace(/blood\w*/gi, "intense")
      .replace(/scar\w*/gi, "distinctive features")
      .replace(/hit\s*man/gi, "specialist")
      .replace(/gun\w*/gi, "device")
      .replace(/weapon\w*/gi, "prop")
      .replace(/kill\w*/gi, "confront")
      .trim();

    // Generate all 8 views
    const results: { index: number; success: boolean }[] = [];

    for (const angle of ANGLE_VIEWS) {
      try {
        const prompt = `Generate a photorealistic CHARACTER TURNAROUND REFERENCE photograph.
This is view ${angle.index + 1} of 8 for a professional character consistency/turnaround sheet.

CHARACTER: "${character.name}" from the film "${film?.title || "Untitled"}". ${periodStr} ${genreStr}

CHARACTER IDENTITY (MUST EXACTLY MATCH THE REFERENCE IMAGE):
- Gender: ${sexStr}
- Age: ${ageStr}
- Description: ${safeDesc || "See reference image — match exactly."}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIEW: ${angle.label}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FRAMING: ${angle.framing}
ANGLE: The character is ${angle.direction}.
PURPOSE: ${angle.purpose}
CAMERA: ${angle.camera}
EXPRESSION: ${angle.expression}

IDENTITY LOCK:
- This MUST be the EXACT SAME PERSON as the reference headshot
- Same face, bone structure, skin tone, hair color/style, ethnicity, build
- Same clothing/costume as in the reference
- Proportionally consistent with all other views in this turnaround set

${GLOBAL_RULES}`;

        const models = ["google/gemini-3-pro-image-preview", "google/gemini-2.5-flash-image"];
        let imageBytes: Uint8Array | null = null;

        for (const model of models) {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "system",
                  content: `You are a character turnaround reference generator for film production.

Your ONLY job is to produce clean, controlled, multi-angle reference images of a character for AI consistency purposes.

You receive a reference headshot of a cast actor and must generate the SAME person from a specified angle.

ABSOLUTE RULES:
1. IDENTITY CONSISTENCY is paramount — same face, features, hair, skin, build, clothing
2. This is DATA CAPTURE, not art — no creative interpretation
3. Studio-flat lighting, neutral gray background, 50mm lens equivalent
4. Neutral expression, neutral pose (unless close-up views)
5. The output must look like it belongs on a professional character turnaround sheet

Think of this as generating a 3D model reference — geometry preservation is everything.`,
                },
                {
                  role: "user",
                  content: [
                    { type: "image_url", image_url: { url: character.image_url } },
                    { type: "text", text: prompt },
                  ],
                },
              ],
              modalities: ["image", "text"],
            }),
          });

          if (!response.ok) {
            if (response.status === 429) {
              return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
                status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            if (response.status === 402) {
              return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
                status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            console.error(`AI error (${model}) for angle ${angle.label}:`, response.status);
            continue;
          }

          const data = await response.json();
          const message = data.choices?.[0]?.message;
          const images = message?.images;

          if (Array.isArray(images) && images.length > 0) {
            const imgUrl = images[0]?.image_url?.url;
            if (imgUrl && imgUrl.startsWith("data:")) {
              const base64 = imgUrl.split(",")[1];
              imageBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            } else if (imgUrl) {
              const imgResp = await fetch(imgUrl);
              if (imgResp.ok) imageBytes = new Uint8Array(await imgResp.arrayBuffer());
            }
          }

          if (imageBytes) break;
        }

        if (imageBytes) {
          // Deterministic file naming for AI ingestion
          const slug = character.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const viewSlug = angle.label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const padIndex = String(angle.index + 1).padStart(2, "0");
          const fileName = `consistency/character_${slug}_${padIndex}_${viewSlug}_${Date.now()}.png`;

          const { error: uploadError } = await sb.storage
            .from("character-assets")
            .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

          if (uploadError) {
            console.error(`Upload error for ${angle.label}:`, uploadError);
            await sb.from("character_consistency_views")
              .update({ status: "failed" })
              .eq("character_id", character_id)
              .eq("angle_index", angle.index);
            results.push({ index: angle.index, success: false });
            continue;
          }

          const { data: urlData } = sb.storage.from("character-assets").getPublicUrl(fileName);

          await sb.from("character_consistency_views")
            .update({ image_url: urlData.publicUrl, status: "complete" })
            .eq("character_id", character_id)
            .eq("angle_index", angle.index);

          results.push({ index: angle.index, success: true });
        } else {
          await sb.from("character_consistency_views")
            .update({ status: "failed" })
            .eq("character_id", character_id)
            .eq("angle_index", angle.index);
          results.push({ index: angle.index, success: false });
        }
      } catch (viewError) {
        console.error(`Error generating ${angle.label}:`, viewError);
        await sb.from("character_consistency_views")
          .update({ status: "failed" })
          .eq("character_id", character_id)
          .eq("angle_index", angle.index);
        results.push({ index: angle.index, success: false });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    if (successCount > 0) {
      await logCreditUsage({
        userId: authResult.userId,
        filmId: character.film_id,
        serviceName: "Gemini Image",
        serviceCategory: "image-generation",
        operation: "generate-consistency-views",
        credits: successCount * 2,
      });
    }

    return new Response(
      JSON.stringify({ success: true, generated: successCount, total: 8 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-consistency-views error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
