import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Expression assignments per card index (2 each across 10 cards)
const EXPRESSION_MAP: Record<number, string> = {
  0: "neutral intense — eyes locked, still energy, no smile",
  1: "neutral intense — quiet power, direct unblinking gaze",
  2: "warm approachable — subtle warmth in eyes, hint of openness",
  3: "warm approachable — gentle ease, slight softness in expression",
  4: "guarded/complex — layered stillness, something withheld behind the eyes",
  5: "guarded/complex — measured calm, calculating but not cold",
  6: "subtly confident — quiet self-assurance, grounded presence",
  7: "subtly confident — understated strength, comfortable in silence",
  8: "emotionally layered — hint of internal story, depth behind a calm surface",
  9: "emotionally layered — complex vulnerability masked by composure",
};

const FACE_VARIATIONS: Record<number, string> = {
  0: "square jaw, strong bone structure",
  1: "oval face, high cheekbones",
  2: "narrow face, angular features",
  3: "softer jaw, round cheekbones",
  4: "strong brow, defined jawline",
  5: "heart-shaped face, delicate bone structure",
  6: "broad face, prominent cheekbones",
  7: "long face, sharp features",
  8: "diamond face shape, wide-set eyes",
  9: "rectangular face, balanced proportions",
};

const HAIR_VARIATIONS: Record<number, string> = {
  0: "dark brown, short and neatly styled",
  1: "warm blonde, medium length with natural wave",
  2: "black, thick and textured",
  3: "auburn red, shoulder length",
  4: "light brown, cropped and clean",
  5: "platinum blonde, tousled and relaxed",
  6: "deep chestnut, wavy and full",
  7: "strawberry blonde, layered",
  8: "jet black, slicked back",
  9: "copper red, natural curls",
};

const WARDROBE_PALETTE: Record<number, string> = {
  0: "charcoal crew neck",
  1: "navy henley",
  2: "muted olive tee",
  3: "warm sand button-down",
  4: "slate gray v-neck",
  5: "deep burgundy top",
  6: "faded denim chambray",
  7: "dark forest green pullover",
  8: "warm taupe knit",
  9: "muted steel blue shirt",
};

const LIGHTING_VARIATIONS: Record<number, string> = {
  0: "key light at 45° camera-left, subtle fill camera-right",
  1: "key light at 40° camera-right, minimal fill",
  2: "key light at 50° camera-left, warm fill bounce",
  3: "key light at 45° camera-right, soft fill from below",
  4: "key light at 35° camera-left, cool-toned fill",
  5: "key light at 45° camera-left, gentle rim separation",
  6: "key light at 50° camera-right, natural fill",
  7: "key light at 40° camera-left, slight backlight",
  8: "key light at 45° camera-right, warm key tone",
  9: "key light at 45° camera-left, even fill ratio",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { characterName, description, sex, ageMin, ageMax, isChild, filmTitle, timePeriod, genre, cardIndex, referenceImageUrl, modifyInstructions, film_id } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── Fetch the Style Contract for genre-aware generation ──
    let styleContract: any = null;
    if (film_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sbRead = createClient(supabaseUrl, supabaseKey);
      const { data: contract } = await sbRead
        .from("film_style_contracts")
        .select("*")
        .eq("film_id", film_id)
        .maybeSingle();
      styleContract = contract;
    }

    // Build age string
    let ageStr = "adult";
    if (ageMin && ageMax && ageMin > 0 && ageMax > 0) {
      ageStr = ageMin === ageMax ? `${ageMin} years old` : `${ageMin}-${ageMax} years old`;
    } else if (isChild) {
      ageStr = "young person";
    }

    const sexStr = sex && sex !== "Unknown" ? sex.toLowerCase() : "person";
    const periodStr = timePeriod ? `Set in the ${timePeriod} era.` : "";
    const genreStr = genre ? `Tone: ${genre}.` : "";
    const idx = cardIndex % 10;

    // Strip problematic content from description
    const safeDesc = (description || "")
      .replace(/injur\w*/gi, "rugged")
      .replace(/wound\w*/gi, "weathered")
      .replace(/blood\w*/gi, "intense")
      .replace(/scar\w*/gi, "distinctive features")
      .replace(/hospital\s*gown/gi, "casual attire")
      .replace(/hit\s*man/gi, "mysterious person")
      .trim();

    const expression = EXPRESSION_MAP[idx] || EXPRESSION_MAP[0];
    const faceShape = FACE_VARIATIONS[idx] || FACE_VARIATIONS[0];
    const wardrobe = WARDROBE_PALETTE[idx] || WARDROBE_PALETTE[0];
    const lighting = LIGHTING_VARIATIONS[idx] || LIGHTING_VARIATIONS[0];
    const hair = HAIR_VARIATIONS[idx] || HAIR_VARIATIONS[0];

    // Detect attractiveness cues in description
    const attractiveMatch = /\b(attractive|handsome|beautiful|good.looking|gorgeous|striking|pretty|stunning)\b/i.test(description || "");
    const attractivenessLine = attractiveMatch
      ? "- Physical appeal: This actor is notably attractive — symmetrical features, clear skin, photogenic bone structure, naturally good-looking"
      : "";

    // ═══ STYLE CONTRACT INJECTION ═══
    // If a compiled style contract exists, inject genre-specific direction
    let genreVisualDirection = "";
    let contractNegative = "";
    let characterDirective = "";
    let contractLighting = "";
    let contractTexture = "";

    if (styleContract) {
      // Character-specific directive (genre × sex × archetype)
      const charDirectives = styleContract.character_directives || {};
      characterDirective = charDirectives[characterName] || "";

      // Genre visual profile
      const gvp = styleContract.genre_visual_profile || {};
      const blended = gvp.blended_profile || {};

      // Genre-aware lighting override
      if (blended.lighting) {
        contractLighting = `Genre lighting direction: ${blended.lighting.default}. Color temperature: ${blended.lighting.color_temp}. Fill ratio: ${blended.lighting.fill_ratio}.`;
      }

      // Genre-aware texture/skin
      if (blended.texture) {
        contractTexture = `Texture direction: ${blended.texture.grain}. Skin rendering: ${blended.texture.skin}.`;
      }

      // Genre portrait style as primary visual direction
      if (characterDirective) {
        genreVisualDirection = `GENRE-SPECIFIC CHARACTER DIRECTION:\n${characterDirective}`;
      } else if (blended.framing) {
        genreVisualDirection = `GENRE PORTRAIT STYLE: ${blended.framing.portrait_style}`;
      }

      // Contract's compiled negative prompt
      contractNegative = styleContract.negative_prompt_base || "";

      // Visual DNA context
      if (styleContract.visual_dna) {
        genreVisualDirection = `FILM VISUAL IDENTITY: ${styleContract.visual_dna}\n\n${genreVisualDirection}`;
      }
    }

    const prompt = `Generate a single photorealistic casting headshot photograph. This is Actor ${idx + 1} of 10 for the role of "${characterName}" in the film "${filmTitle}". ${periodStr} ${genreStr}

${genreVisualDirection ? `${genreVisualDirection}\n` : ""}
CHARACTER BRIEF:
- Gender: ${sexStr}
- Age: ${ageStr}
- Description: ${safeDesc || "No additional description provided."}
${attractivenessLine}

THIS SPECIFIC ACTOR (Actor ${idx + 1}):
- Face structure: ${faceShape}
- Hair: ${hair}
- Expression: ${expression}
- Wardrobe: ${wardrobe}, solid color, no logos, no patterns
- Lighting setup: Large soft ${lighting}
${contractLighting ? `- ${contractLighting}` : ""}
${contractTexture ? `- ${contractTexture}` : ""}

PHOTOGRAPHIC REQUIREMENTS — MANDATORY:
- Vertical 8×10 portrait orientation (4:5 aspect ratio)
- Head and upper chest crop, eyes positioned at the upper third
- Shot on 85mm–135mm equivalent lens
- f/2.8–f/4 depth of field — both eyes tack sharp, background softly blurred
- Clean neutral backdrop: light gray, muted beige, or soft slate
- Natural skin tones, matte finish, no over-retouching
- Subtle downward key light angle, minimal rim separation
- No harsh shadows, no glamour styling, no editorial filters
- Hair and makeup: natural, character-aligned, no distracting flyaways
- The result must look like a real photograph from a professional casting session

This actor must be a completely unique individual — distinct ethnicity, bone structure, hair color/texture, skin tone, and eye color from any other actor in this casting set. They must believably fit the character description while looking like their own person.${contractNegative ? `\n\nNEGATIVE (avoid): ${contractNegative}` : ""}`;

    const models = ["google/gemini-3-pro-image-preview", "google/gemini-2.5-flash-image"];
    let imageBytes: Uint8Array | null = null;

    for (const model of models) {
      console.log(`Trying model: ${model} for Actor ${idx + 1}`);
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
              content: referenceImageUrl
                ? "You are a cinematic headshot modification engine. You will receive a reference headshot photo and instructions for modifications. Generate a new headshot that looks like the SAME PERSON from the reference but with the requested changes applied. Maintain the same face, bone structure, ethnicity, and core identity — only apply the specific modifications requested."
                : "You are a cinematic headshot generation engine for casting development. Generate photorealistic vertical 8×10 actor headshots that look like they came from a real casting session. Every image must be production-quality, naturally lit, and character-authentic."
            },
            referenceImageUrl
              ? {
                  role: "user",
                  content: [
                    { type: "image_url", image_url: { url: referenceImageUrl } },
                    { type: "text", text: modifyInstructions
                      ? `This is the reference headshot. Generate a new variation of this SAME PERSON with these modifications: ${modifyInstructions}\n\nKeep the same person's face, ethnicity, bone structure, and core identity. Only change what is specifically requested. Output a vertical 8×10 portrait (4:5 aspect ratio), photorealistic casting headshot style, neutral backdrop, natural lighting.`
                      : prompt
                    },
                  ],
                }
              : { role: "user", content: prompt }
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
          imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        } else if (imgUrl) {
          const imgResp = await fetch(imgUrl);
          if (imgResp.ok) imageBytes = new Uint8Array(await imgResp.arrayBuffer());
        }
      }

      if (imageBytes) {
        console.log(`Actor ${idx + 1} headshot generated successfully with ${model}`);
        break;
      }

      const content = message?.content || "";
      console.warn(`Model ${model} did not return an image. Response: ${content.substring(0, 200)}`);
    }

    if (!imageBytes) {
      throw new Error("AI could not generate this headshot. Try adjusting the character description.");
    }

    // Upload to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const fileName = `headshots/${characterName.toLowerCase().replace(/\s+/g, "-")}-actor${idx + 1}-${Date.now()}.png`;

    const { error: uploadError } = await sb.storage
      .from("character-assets")
      .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload generated image");
    }

    const { data: urlData } = sb.storage
      .from("character-assets")
      .getPublicUrl(fileName);

    await logCreditUsage({
      userId: authResult.userId,
      filmId: film_id || null,
      serviceName: "Gemini Image",
      serviceCategory: "image-generation",
      operation: "generate-headshot",
      credits: 2,
    });

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
