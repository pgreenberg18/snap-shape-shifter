import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VARIATION_PROFILES: Record<string, string[]> = {
  location: [
    "Grounded realism",
    "Heightened cinematic",
    "Stylized production design",
    "Low-key dramatic",
    "High-contrast atmospheric",
  ],
  prop: [
    "Clean baseline",
    "Worn and aged",
    "Period-authentic detailed",
    "Hero close-up optimized",
    "Alternate material finish",
  ],
  wardrobe: [
    "Script-literal baseline",
    "Darker tonal version",
    "Textured material emphasis",
    "Heightened cinematic version",
    "Stylized statement look",
  ],
  vehicle: [
    "Factory original",
    "Weathered version",
    "Period-detailed restoration",
    "Cinematic hero vehicle",
    "Alternate trim variation",
  ],
};

const ASPECT_RATIOS: Record<string, string> = {
  location: "16:9 wide cinematic",
  prop: "1:1 square centered",
  wardrobe: "4:5 vertical portrait",
  vehicle: "16:9 wide cinematic",
};

/** Sanitize description for AI safety */
function safeDesc(text: string): string {
  return (text || "")
    .replace(/injur\w*/gi, "rugged")
    .replace(/wound\w*/gi, "weathered")
    .replace(/blood\w*/gi, "intense")
    .replace(/scar\w*/gi, "distinctive features")
    .replace(/hit\s*man/gi, "specialist")
    .trim();
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { film_id, asset_type, asset_name, character_id } = await req.json();

    if (!film_id || !asset_type || !asset_name) {
      return new Response(JSON.stringify({ error: "film_id, asset_type, and asset_name are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch script context
    const { data: scriptData } = await sb
      .from("script_analyses")
      .select("visual_summary, scene_breakdown")
      .eq("film_id", film_id)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch film for time_period
    const { data: film } = await sb.from("films").select("title, time_period").eq("id", film_id).single();

    // Fetch character info if wardrobe
    let characterContext = "";
    if (character_id && asset_type === "wardrobe") {
      const { data: char } = await sb.from("characters").select("name, sex, description").eq("id", character_id).single();
      if (char) {
        characterContext = `Character: ${char.name}. Sex: ${char.sex || "Unknown"}. ${safeDesc(char.description || "")}`;
      }
    }

    const visualSummary = scriptData?.visual_summary || "";
    const timePeriod = film?.time_period || "";
    const filmTitle = film?.title || "";
    const variations = VARIATION_PROFILES[asset_type] || VARIATION_PROFILES.prop;
    const aspect = ASPECT_RATIOS[asset_type] || "1:1 square";
    const slug = slugify(asset_name);

    const results: Array<{
      id: string;
      name: string;
      description: string;
      image_url: string;
      option_index: number;
    }> = [];

    const models = ["google/gemini-3-pro-image-preview", "google/gemini-2.5-flash-image"];

    for (let index = 0; index < 5; index++) {
      const variationStyle = variations[index];

      let prompt = "";
      if (asset_type === "location") {
        prompt = `Generate a single photorealistic cinematic production design photograph of the location "${asset_name}" for the film "${filmTitle}".

VISUAL CONTEXT:
${visualSummary ? `Film visual summary: ${safeDesc(visualSummary)}` : ""}
${timePeriod ? `Time period: ${timePeriod}` : ""}

VARIATION STYLE: ${variationStyle}
This is option ${index + 1} of 5. Apply the "${variationStyle}" aesthetic approach to this location.

REQUIREMENTS:
- ${aspect} composition
- Cinematic production design quality — looks like a real film set or location scout photograph
- Period-accurate for ${timePeriod || "contemporary"} setting
- Rich environmental detail: lighting, atmosphere, texture
- No people visible
- No text. No watermark.`;
      } else if (asset_type === "prop") {
        prompt = `Generate a single photorealistic product photograph of the prop "${asset_name}" for the film "${filmTitle}".

VISUAL CONTEXT:
${visualSummary ? `Film visual summary: ${safeDesc(visualSummary)}` : ""}
${timePeriod ? `Time period: ${timePeriod}` : ""}

VARIATION STYLE: ${variationStyle}
This is option ${index + 1} of 5. Apply the "${variationStyle}" treatment to this prop.

REQUIREMENTS:
- ${aspect} composition, centered on neutral surface
- Hero product photography quality — clean, detailed, well-lit
- Period-accurate for ${timePeriod || "contemporary"} setting
- Show material detail, wear patterns, and craftsmanship
- No hands or people visible
- No text. No watermark.`;
      } else if (asset_type === "wardrobe") {
        prompt = `Generate a single photorealistic wardrobe photograph showing the costume piece "${asset_name}" for the film "${filmTitle}".

${characterContext ? `CHARACTER CONTEXT: ${characterContext}` : ""}

VISUAL CONTEXT:
${visualSummary ? `Film visual summary: ${safeDesc(visualSummary)}` : ""}
${timePeriod ? `Time period: ${timePeriod}` : ""}

VARIATION STYLE: ${variationStyle}
This is option ${index + 1} of 5. Apply the "${variationStyle}" approach to this wardrobe piece.

REQUIREMENTS:
- ${aspect} composition — garment displayed on mannequin or flat lay
- Costume department photography quality
- Period-accurate for ${timePeriod || "contemporary"} setting
- Show fabric texture, construction detail, and color accuracy
- No people visible (mannequin form only if needed)
- No text. No watermark.`;
      } else {
        // vehicle
        prompt = `Generate a single photorealistic cinematic photograph of the vehicle "${asset_name}" for the film "${filmTitle}".

VISUAL CONTEXT:
${visualSummary ? `Film visual summary: ${safeDesc(visualSummary)}` : ""}
${timePeriod ? `Time period: ${timePeriod}` : ""}

VARIATION STYLE: ${variationStyle}
This is option ${index + 1} of 5. Apply the "${variationStyle}" treatment to this vehicle.

REQUIREMENTS:
- ${aspect} composition — 3/4 front angle automotive photography
- Cinematic automotive photography quality
- Period-accurate for ${timePeriod || "contemporary"} setting
- Show paint condition, detail work, and character
- No people visible
- No text. No watermark.`;
      }

      let imageBytes: Uint8Array | null = null;

      for (const model of models) {
        console.log(`Asset option ${index + 1}/5 (${asset_type}): trying ${model}`);
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
                content: `You are a cinematic production design visualization engine. Generate photorealistic ${asset_type} reference images for film pre-production.`,
              },
              { role: "user", content: prompt },
            ],
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

        if (imageBytes) {
          console.log(`Asset option ${index + 1} generated with ${model}`);
          break;
        }

        console.warn(`Model ${model} did not return image for option ${index + 1}`);
      }

      if (!imageBytes) {
        console.error(`Failed to generate option ${index + 1} for ${asset_name}`);
        continue;
      }

      // Upload to storage
      const fileName = `${film_id}/${asset_type}/${slug}/option-${index}.png`;
      const { error: uploadError } = await sb.storage
        .from("film-assets")
        .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      const { data: urlData } = sb.storage.from("film-assets").getPublicUrl(fileName);

      results.push({
        id: crypto.randomUUID(),
        name: asset_name,
        description: variationStyle,
        image_url: urlData.publicUrl,
        option_index: index,
      });
    }

    if (results.length === 0) {
      throw new Error("Failed to generate any asset options. Try adjusting the asset name or try again.");
    }

    return new Response(JSON.stringify({ options: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-asset-options error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
