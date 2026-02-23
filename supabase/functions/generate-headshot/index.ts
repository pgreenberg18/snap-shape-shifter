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

    // Build a rich context-aware prompt
    const ageStr = ageMin && ageMax
      ? (ageMin === ageMax ? `${ageMin} years old` : `${ageMin}-${ageMax} years old`)
      : isChild ? "child" : "adult";

    const sexStr = sex && sex !== "Unknown" ? sex.toLowerCase() : "";
    const periodStr = timePeriod ? ` set in ${timePeriod}` : "";
    const genreStr = genre ? ` (${genre} genre)` : "";

    // Variation seed for different looks
    const variations = [
      "classic Hollywood look, warm lighting",
      "dramatic side lighting, intense expression",
      "soft natural light, subtle expression",
      "high contrast, powerful gaze",
      "warm golden hour light, approachable",
      "unexpected casting choice, unique features",
      "unconventional look, striking appearance",
      "character actor type, memorable face",
      "fresh face, distinctive features",
      "artistic portrait, cinematic quality",
    ];
    const variation = variations[cardIndex % variations.length] || "cinematic portrait";

    const prompt = `Generate a hyper-realistic professional headshot photograph of a ${sexStr} ${ageStr} person for the character "${characterName}" in a film called "${filmTitle}"${periodStr}${genreStr}.

Character description: ${description || "No specific description provided."}

Style: ${variation}. 

This must look like a real photograph of a real person - not AI-generated, not cartoon, not illustration. Professional casting headshot quality with shallow depth of field, shot on 85mm lens. The person should look like they belong in this type of film${periodStr}. Natural skin texture, realistic hair, authentic expression.

CRITICAL: This must be photorealistic. No anime, no cartoon, no illustration, no fantasy elements. A real human being photographed with a real camera.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
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
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      throw new Error("No image returned from AI");
    }

    // Upload the base64 image to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Convert base64 to Uint8Array
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `headshots/${characterName.toLowerCase().replace(/\s+/g, "-")}-${cardIndex}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("character-assets")
      .upload(fileName, bytes, { contentType: "image/png", upsert: true });

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
