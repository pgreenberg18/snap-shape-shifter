import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Analyzes a reference image and returns a structured description
 * focused on the relevant aspect for the given section context.
 *
 * Body: { imageUrl: string, context: "casting" | "location" | "prop" | "wardrobe" | "vehicle", characterName?: string }
 * Returns: { description: string }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl, context, characterName } = await req.json();

    if (!imageUrl) throw new Error("imageUrl is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Context-aware system prompts that focus analysis on the relevant subject
    const systemPrompts: Record<string, string> = {
      casting: `You are a professional casting director analyzing a reference photo for a character${characterName ? ` named "${characterName}"` : ""}.
Describe ONLY the person in the image. Focus on:
- Physical build (height impression, body type, frame)
- Face shape, distinctive facial features
- Hair color, texture, length, style
- Skin tone and complexion
- Approximate age range
- Ethnicity/heritage impression
- Overall presence and energy they project

DO NOT describe clothing, accessories, background, or setting. ONLY the person's physical appearance and build.
Write in a concise, professional casting-description style. 2-4 sentences max.`,

      location: `You are a film location scout analyzing a reference photo.
Describe ONLY the physical space/environment shown. Focus on:
- Type of space (interior/exterior, urban/rural/industrial/residential)
- Architectural style, materials, condition
- Scale and spatial feel (intimate, vast, cramped, open)
- Natural/artificial lighting qualities
- Atmosphere and mood the space conveys
- Key structural features

DO NOT describe people, temporary objects, or staging. Focus on the permanent environment.
Write concisely in a professional location scout style. 2-4 sentences max.`,

      prop: `You are a film prop master analyzing a reference photo.
Describe ONLY the key object/prop shown. Focus on:
- What the object is and its specific type/variant
- Material, finish, color, condition (new/worn/aged)
- Size and scale
- Era/period the design suggests
- Any distinctive markings or features
- Functional state (working, decorative, damaged)

Focus on the single most prominent object. DO NOT describe background or setting.
Write concisely in a professional prop description style. 2-3 sentences max.`,

      wardrobe: `You are a film costume designer analyzing a reference photo.
Describe ONLY the clothing and accessories shown. Focus on:
- Garment types and specific styles
- Fabrics, textures, colors, patterns
- Fit and silhouette
- Era/period the style suggests
- Condition (pristine, worn, distressed)
- Accessories (jewelry, hats, bags, shoes if visible)

DO NOT describe the person's physical features or the background. ONLY the wardrobe.
Write concisely in a professional costume description style. 2-3 sentences max.`,

      vehicle: `You are a film picture vehicle coordinator analyzing a reference photo.
Describe ONLY the vehicle shown. Focus on:
- Make, model, year (or estimated era)
- Body style, color, finish
- Condition (showroom, daily driver, weathered, damaged)
- Any distinctive modifications or features
- Interior details if visible
- Period-appropriateness

DO NOT describe people, surroundings, or non-vehicle elements.
Write concisely in a professional vehicle description style. 2-3 sentences max.`,
    };

    const systemPrompt = systemPrompts[context] || systemPrompts.casting;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this reference image and provide a focused description." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
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
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content?.trim();

    if (!description) throw new Error("No description returned from AI");

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-reference-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
