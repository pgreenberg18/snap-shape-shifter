import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FITTING_ANGLES = [
  { index: 0, label: "Front", direction: "facing directly toward the camera", framing: "Full body head to toe" },
  { index: 1, label: "Back", direction: "turned fully away from camera", framing: "Full body head to toe" },
  { index: 2, label: "Left Profile", direction: "turned 90° left", framing: "Full body head to toe" },
  { index: 3, label: "Right Profile", direction: "turned 90° right", framing: "Full body head to toe" },
  { index: 4, label: "3/4 Left", direction: "three-quarter left view", framing: "Full body head to toe" },
  { index: 5, label: "3/4 Right", direction: "three-quarter right view", framing: "Full body head to toe" },
  { index: 6, label: "MCU", direction: "facing camera", framing: "Medium close-up, chest and above" },
  { index: 7, label: "Portrait", direction: "facing camera", framing: "Classic headshot, head and upper shoulders, 85mm lens" },
];

const SYSTEM_PROMPT = `You are a wardrobe fitting visualization engine for film production.
Your job is to generate clean, controlled multi-angle reference images of a character WEARING a specific costume.

ABSOLUTE RULES:
1. IDENTITY CONSISTENCY — same face, features, hair, skin, build as the character reference
2. COSTUME CONSISTENCY — the character must wear the EXACT wardrobe piece shown in the wardrobe reference
3. Studio-flat lighting, neutral gray background, 50mm lens (except Portrait which uses 85mm)
4. Neutral expression, neutral pose
5. The output must look like a professional wardrobe fitting turnaround sheet`;

const GLOBAL_RULES = `CRITICAL TECHNICAL REQUIREMENTS:

💡 LIGHTING: Neutral, studio-flat. Soft key + fill + rim. NO dramatic shadows, NO colored light.
🎨 BACKGROUND: Solid neutral gray (#808080-#999999). NO gradients, NO environment.
🧍 POSE: Neutral stance, arms at sides, feet shoulder-width. NO action poses.
👔 COSTUME: Must EXACTLY match the wardrobe reference image in every view.
🚫 NO emotion variation, NO wind, NO motion blur, NO artistic interpretation.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { character_id, film_id, asset_name } = await req.json();
    if (!character_id || !film_id || !asset_name) {
      throw new Error("character_id, film_id, and asset_name are required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch character
    const { data: character, error: charErr } = await sb
      .from("characters")
      .select("id, name, description, sex, age_min, age_max, image_url, film_id")
      .eq("id", character_id)
      .single();
    if (charErr || !character) throw new Error("Character not found");
    if (!character.image_url) throw new Error("Character has no cast headshot");

    // Fetch locked wardrobe asset
    const { data: wardrobeAsset } = await sb
      .from("film_assets")
      .select("image_url, description")
      .eq("film_id", film_id)
      .eq("asset_type", "wardrobe")
      .eq("asset_name", asset_name)
      .eq("locked", true)
      .maybeSingle();
    if (!wardrobeAsset?.image_url) throw new Error("No locked wardrobe image found");

    // Fetch film context
    const { data: film } = await sb
      .from("films")
      .select("title, time_period, genres")
      .eq("id", film_id)
      .single();

    // Fetch character consistency front view for additional reference
    const { data: frontView } = await sb
      .from("character_consistency_views")
      .select("image_url")
      .eq("character_id", character_id)
      .eq("angle_index", 0)
      .eq("status", "complete")
      .maybeSingle();

    // Upsert pending rows
    for (const angle of FITTING_ANGLES) {
      await sb.from("wardrobe_fitting_views").upsert(
        {
          film_id,
          character_id,
          asset_name,
          angle_index: angle.index,
          angle_label: angle.label,
          status: "generating",
          image_url: null,
        },
        { onConflict: "film_id,character_id,asset_name,angle_index" }
      );
    }

    const sexStr = character.sex && character.sex !== "Unknown" ? character.sex.toLowerCase() : "person";
    const ageStr = character.age_min && character.age_max ? `${character.age_min}-${character.age_max} years old` : "adult";
    const periodStr = film?.time_period ? `Set in the ${film.time_period} era.` : "";

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

    const results: { index: number; success: boolean }[] = [];
    let frontFittingUrl: string | null = null;

    const generateView = async (angle: typeof FITTING_ANGLES[number]) => {
      try {
        const prompt = `Generate a photorealistic WARDROBE FITTING reference photograph.
View ${angle.index + 1} of 8 for a professional wardrobe fitting turnaround sheet.

CHARACTER: "${character.name}" from "${film?.title || "Untitled"}". ${periodStr}
- Gender: ${sexStr}, Age: ${ageStr}
- Description: ${safeDesc || "See reference image."}

WARDROBE PIECE: "${asset_name}"
${wardrobeAsset.description ? `Wardrobe description: ${wardrobeAsset.description}` : ""}

VIEW: ${angle.label}
FRAMING: ${angle.framing}
ANGLE: Character is ${angle.direction}
${angle.index <= 5 ? "CAMERA: Eye level, no tilt, pulled back for full body" : angle.index === 6 ? "CAMERA: Eye level, medium close-up" : "CAMERA: 85mm, classic headshot framing"}

CRITICAL:
- Character MUST match the character reference exactly (face, build, hair, skin)
- Character MUST be wearing the EXACT costume from the wardrobe reference image
- Same fabric, color, fit, accessories as the wardrobe reference
${frontFittingUrl ? `- Match clothing appearance exactly from the Front Fitting view (IMAGE 3)` : ""}

${GLOBAL_RULES}`;

        const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
          { type: "image_url", image_url: { url: character.image_url } },
          { type: "image_url", image_url: { url: wardrobeAsset.image_url } },
        ];
        if (frontView?.image_url) {
          userContent.push({ type: "image_url", image_url: { url: frontView.image_url } });
        }
        if (frontFittingUrl) {
          userContent.push({ type: "image_url", image_url: { url: frontFittingUrl } });
        }
        userContent.push({ type: "text", text: prompt });

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
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userContent },
              ],
              modalities: ["image", "text"],
            }),
          });

          if (!response.ok) {
            console.error(`AI error (${model}) for ${angle.label}: ${response.status}`);
            continue;
          }

          const data = await response.json();
          const images = data.choices?.[0]?.message?.images;

          if (Array.isArray(images) && images.length > 0) {
            const imgUrl = images[0]?.image_url?.url;
            if (imgUrl?.startsWith("data:")) {
              const base64 = imgUrl.split(",")[1];
              imageBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            } else if (imgUrl) {
              const resp = await fetch(imgUrl);
              if (resp.ok) imageBytes = new Uint8Array(await resp.arrayBuffer());
            }
          }
          if (imageBytes) break;
        }

        if (imageBytes) {
          const charSlug = character.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const assetSlug = asset_name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const viewSlug = angle.label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const fileName = `wardrobe-fitting/${charSlug}_${assetSlug}_${String(angle.index).padStart(2, "0")}_${viewSlug}_${Date.now()}.png`;

          const { error: upErr } = await sb.storage
            .from("film-assets")
            .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

          if (upErr) {
            console.error(`Upload error for ${angle.label}:`, upErr);
            await sb.from("wardrobe_fitting_views").update({ status: "failed" })
              .eq("film_id", film_id).eq("character_id", character_id)
              .eq("asset_name", asset_name).eq("angle_index", angle.index);
            return { index: angle.index, success: false };
          }

          const { data: urlData } = sb.storage.from("film-assets").getPublicUrl(fileName);

          await sb.from("wardrobe_fitting_views").update({ image_url: urlData.publicUrl, status: "complete" })
            .eq("film_id", film_id).eq("character_id", character_id)
            .eq("asset_name", asset_name).eq("angle_index", angle.index);

          return { index: angle.index, success: true, publicUrl: urlData.publicUrl };
        } else {
          await sb.from("wardrobe_fitting_views").update({ status: "failed" })
            .eq("film_id", film_id).eq("character_id", character_id)
            .eq("asset_name", asset_name).eq("angle_index", angle.index);
          return { index: angle.index, success: false };
        }
      } catch (e) {
        console.error(`Error generating ${angle.label}:`, e);
        await sb.from("wardrobe_fitting_views").update({ status: "failed" })
          .eq("film_id", film_id).eq("character_id", character_id)
          .eq("asset_name", asset_name).eq("angle_index", angle.index);
        return { index: angle.index, success: false };
      }
    };

    // Step 1: Front first as anchor
    const frontResult = await generateView(FITTING_ANGLES[0]);
    results.push(frontResult);
    if (frontResult.success && (frontResult as any).publicUrl) {
      frontFittingUrl = (frontResult as any).publicUrl;
    }

    // Step 2: Remaining in 2 batches
    const remaining = FITTING_ANGLES.slice(1);
    const b1 = await Promise.all(remaining.slice(0, 4).map(generateView));
    results.push(...b1);
    const b2 = await Promise.all(remaining.slice(4).map(generateView));
    results.push(...b2);

    const successCount = results.filter((r) => r.success).length;

    if (successCount > 0) {
      await logCreditUsage({
        userId: authResult.userId,
        filmId: film_id,
        serviceName: "Gemini Image",
        serviceCategory: "image-generation",
        operation: "generate-wardrobe-fitting",
        credits: successCount * 2,
      });
    }

    return new Response(
      JSON.stringify({ success: true, generated: successCount, total: 8 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-wardrobe-fitting error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
