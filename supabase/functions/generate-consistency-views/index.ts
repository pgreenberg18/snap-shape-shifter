import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANGLE_VIEWS = [
  { index: 0, label: "Front", direction: "facing directly toward the camera, straight-on front view" },
  { index: 1, label: "¾ Left", direction: "turned approximately 45 degrees to camera-left, three-quarter left view" },
  { index: 2, label: "Profile Left", direction: "turned 90 degrees to camera-left, full left profile view" },
  { index: 3, label: "¾ Back Left", direction: "turned approximately 135 degrees to camera-left, three-quarter back-left view showing back of head and partial profile" },
  { index: 4, label: "Back", direction: "turned fully away from camera, back-of-head view" },
  { index: 5, label: "¾ Back Right", direction: "turned approximately 135 degrees to camera-right, three-quarter back-right view showing back of head and partial profile" },
  { index: 6, label: "Profile Right", direction: "turned 90 degrees to camera-right, full right profile view" },
  { index: 7, label: "¾ Right", direction: "turned approximately 45 degrees to camera-right, three-quarter right view" },
];

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

    // Generate all 8 views
    const results: { index: number; success: boolean }[] = [];
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
      .trim();

    for (const angle of ANGLE_VIEWS) {
      try {
        const prompt = `Generate a photorealistic character turnaround reference photograph. This is a consistency sheet view for the character "${character.name}" from the film "${film?.title || "Untitled"}". ${periodStr} ${genreStr}

CHARACTER IDENTITY (MUST MATCH THE REFERENCE):
- Gender: ${sexStr}
- Age: ${ageStr}
- Description: ${safeDesc || "See reference image."}

VIEW ANGLE: ${angle.label} — The character is ${angle.direction}.

CRITICAL REQUIREMENTS:
- This MUST be the EXACT SAME PERSON as the reference headshot — same face, bone structure, skin tone, hair color/style, ethnicity, and build
- The character should be wearing the same clothing as in the reference
- Same lighting setup: soft studio lighting, neutral background
- Full head and upper body visible
- Clean neutral backdrop (light gray or soft slate)
- Photorealistic, production-quality
- This is for a character consistency/turnaround sheet — accuracy to the reference is paramount`;

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
                  content: "You are a character consistency reference generator. You receive a reference headshot of an actor and must generate the SAME person from a different angle. Maintain absolute identity consistency — same face, features, hair, skin, build, and clothing. This is for a production character turnaround sheet."
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
          const slug = character.name.toLowerCase().replace(/\s+/g, "-");
          const fileName = `consistency/${slug}-${angle.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}.png`;

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
