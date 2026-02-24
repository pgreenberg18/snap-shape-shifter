import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { characterName, description, sex, ageMin, ageMax, isChild, filmTitle, timePeriod, genre, cardIndex } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build age string carefully to avoid contradictions
    let ageStr = "adult";
    if (ageMin && ageMax && ageMin > 0 && ageMax > 0) {
      ageStr = ageMin === ageMax ? `${ageMin} years old` : `${ageMin}-${ageMax} years old`;
    } else if (isChild) {
      ageStr = "young person";
    }

    const sexStr = sex && sex !== "Unknown" ? sex.toLowerCase() : "person";
    const periodStr = timePeriod ? `, ${timePeriod} era` : "";

    // Variation seed for different looks
    const variations = [
      "warm studio lighting",
      "dramatic side lighting",
      "soft natural light",
      "high contrast lighting",
      "golden hour light",
      "cool-toned studio light",
      "rim lighting with fill",
      "overcast natural light",
      "warm backlit portrait",
      "cinematic moody lighting",
    ];
    const variation = variations[cardIndex % variations.length] || "studio lighting";

    // Strip potentially problematic details from description (parentheticals about injuries, violence, etc.)
    const safeDesc = (description || "")
      .replace(/injur\w*/gi, "rugged")
      .replace(/wound\w*/gi, "weathered")
      .replace(/blood\w*/gi, "intense")
      .replace(/scar\w*/gi, "distinctive features")
      .replace(/hospital\s*gown/gi, "casual attire")
      .replace(/hit\s*man/gi, "mysterious person")
      .trim();

    const prompt = `Professional casting headshot photograph: a ${sexStr}, ${ageStr}${periodStr}. ${variation}. ${safeDesc ? `Appearance notes: ${safeDesc}.` : ""} Photorealistic, shallow depth of field, 85mm lens, natural skin texture. For a film titled "${filmTitle}".`;

    // Try with pro model first, fall back to flash
    const models = ["google/gemini-3-pro-image-preview", "google/gemini-2.5-flash-image"];
    let imageBytes: Uint8Array | null = null;

    for (const model of models) {
      console.log(`Trying model: ${model}`);
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error(`AI gateway error (${model}):`, response.status, t);
        continue; // try next model
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      const images = message?.images;

      if (Array.isArray(images) && images.length > 0) {
        const imgUrl = images[0]?.image_url?.url;
        if (imgUrl && imgUrl.startsWith("data:")) {
          const base64 = imgUrl.split(",")[1];
          imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        } else if (imgUrl) {
          const imgResp = await fetch(imgUrl);
          if (imgResp.ok) imageBytes = new Uint8Array(await imgResp.arrayBuffer());
        }
      }

      if (imageBytes) {
        console.log(`Image generated successfully with ${model}`);
        break;
      }

      // Model refused or returned no image - log and try next
      const content = message?.content || "";
      console.warn(`Model ${model} did not return an image. Response: ${content.substring(0, 200)}`);
    }

    if (!imageBytes) {
      throw new Error("AI could not generate this headshot. Try adjusting the character description.");
    }

    // Upload to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fileName = `headshots/${characterName.toLowerCase().replace(/\s+/g, "-")}-${cardIndex}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("character-assets")
      .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload generated image");
    }

    const { data: urlData } = supabase.storage
      .from("character-assets")
      .getPublicUrl(fileName);

    return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-headshot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
