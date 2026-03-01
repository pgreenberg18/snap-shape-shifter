import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";
import {
  ENTITY_TYPES,
  type EntityType,
  type CanonicalEntity,
  canonicalizeCharacters,
  canonicalizeLocations,
  extractCharacterCues,
  computeDialogueMetrics,
  parseSceneHeading,
  classifyEntity,
  isVehicleEntity,
} from "../_shared/entity-normalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * PHASE 1: Extract Entities
 * 
 * Two-step process:
 * 1. Deterministic extraction: characters from ALL-CAPS cues, locations from headings,
 *    dialogue metrics, scene flags — NO AI.
 * 2. AI-assisted extraction: props, wardrobe, vehicles, weapons, devices, documents,
 *    practical lights, sound events, environmental conditions, animals, food/drink.
 *    NO stylistic interpretation — only "what is explicitly mentioned in the text."
 * 
 * Input: { film_id }
 * Requires all parsed_scenes to exist (from parse-script).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { film_id, scene_id } = await req.json();
    if (!film_id) {
      return new Response(
        JSON.stringify({ error: "film_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If scene_id is provided, extract for a single scene (used in batch processing)
    // If not, do full-film extraction
    if (scene_id) {
      return await extractSingleScene(supabase, lovableApiKey, authResult.userId, film_id, scene_id);
    }

    // ── Full-film extraction ──
    // Step 1: Fetch all parsed scenes
    const { data: scenes, error: scenesErr } = await supabase
      .from("parsed_scenes")
      .select("id, scene_number, heading, raw_text")
      .eq("film_id", film_id)
      .order("scene_number");

    if (scenesErr || !scenes || scenes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No parsed scenes found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 2: Deterministic extraction (no AI)
    console.log(`[Phase1] Starting deterministic extraction for ${scenes.length} scenes`);

    // 2a: Extract characters from ALL-CAPS cues across all scenes
    const allCharacterCues: { name: string; scene: number }[] = [];
    for (const scene of scenes) {
      const cues = extractCharacterCues(scene.raw_text, scene.scene_number);
      allCharacterCues.push(...cues);
    }
    const characterEntities = canonicalizeCharacters(allCharacterCues);
    console.log(`[Phase1] Found ${characterEntities.length} canonical characters`);

    // 2b: Extract locations from scene headings
    const headings = scenes.map((s) => ({ heading: s.heading, scene: s.scene_number }));
    const locationEntities = canonicalizeLocations(headings);
    console.log(`[Phase1] Found ${locationEntities.length} canonical locations`);

    // 2c: Compute dialogue metrics and scene flags for each scene
    for (const scene of scenes) {
      const metrics = computeDialogueMetrics(scene.raw_text);
      const parsed = parseSceneHeading(scene.heading);

      await supabase
        .from("parsed_scenes")
        .update({
          int_ext: parsed.int_ext,
          day_night: parsed.time_of_day,
          location_name: parsed.location,
          sublocation: parsed.sublocation,
          continuity_marker: parsed.continuity_marker,
          is_flashback: parsed.is_flashback,
          is_dream: parsed.is_dream,
          is_montage: parsed.is_montage,
          line_count: metrics.line_count,
          dialogue_line_count: metrics.dialogue_line_count,
          dialogue_word_count: metrics.dialogue_word_count,
          dialogue_density: metrics.dialogue_density,
        })
        .eq("id", scene.id);
    }

    // Step 3: Clear existing entities for this film (re-extraction)
    await supabase.from("scene_entity_links").delete().eq("film_id", film_id);
    await supabase.from("script_entities").delete().eq("film_id", film_id);

    // Step 4: Insert canonical character and location entities
    const entityIdMap = new Map<string, string>(); // key → entity UUID

    for (const entity of [...characterEntities, ...locationEntities]) {
      const { data: inserted, error: insertErr } = await supabase
        .from("script_entities")
        .insert({
          film_id,
          entity_type: entity.entity_type,
          canonical_name: entity.canonical_name,
          aliases: entity.aliases,
          first_appearance_scene: entity.first_appearance_scene,
          confidence: entity.confidence,
          needs_review: entity.needs_review,
          review_note: entity.review_note,
          metadata: entity.metadata,
        })
        .select("id")
        .single();

      if (inserted) {
        const key = `${entity.entity_type}:${entity.canonical_name}`;
        entityIdMap.set(key, inserted.id);
      }
    }

    // Step 5: Create scene-entity links for characters and locations
    for (const scene of scenes) {
      const sceneCues = extractCharacterCues(scene.raw_text, scene.scene_number);
      const sceneCharNames = new Set(sceneCues.map((c) => c.name));

      // Link characters to this scene
      for (const charEntity of characterEntities) {
        const allNames = [charEntity.canonical_name, ...charEntity.aliases];
        const isPresent = allNames.some((name) => sceneCharNames.has(name));
        if (!isPresent) continue;

        const entityId = entityIdMap.get(`CHARACTER:${charEntity.canonical_name}`);
        if (!entityId) continue;

        await supabase.from("scene_entity_links").insert({
          scene_id: scene.id,
          entity_id: entityId,
          film_id,
          context: {},
        }).maybeSingle();
      }

      // Link location to this scene
      const parsed = parseSceneHeading(scene.heading);
      if (parsed.location) {
        for (const locEntity of locationEntities) {
          const allNames = [locEntity.canonical_name, ...locEntity.aliases];
          if (allNames.some((n) => n.toUpperCase() === parsed.location.toUpperCase())) {
            const entityId = entityIdMap.get(`LOCATION:${locEntity.canonical_name}`);
            if (entityId) {
              await supabase.from("scene_entity_links").insert({
                scene_id: scene.id,
                entity_id: entityId,
                film_id,
                context: { sublocation: parsed.sublocation },
              }).maybeSingle();
            }
            break;
          }
        }
      }
    }

    console.log(`[Phase1] Deterministic extraction complete. Starting AI-assisted entity extraction...`);

    // Return scene IDs for the client to batch AI extraction
    return new Response(
      JSON.stringify({
        success: true,
        characters: characterEntities.length,
        locations: locationEntities.length,
        scene_ids: scenes.map((s) => s.id),
        message: "Deterministic extraction complete. Use scene_id param to extract objects per scene.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e) {
    console.error("extract-entities error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Extract entities from a single scene using AI.
 * Phase 1 only — no stylistic interpretation.
 * Classifies into 13 entity categories.
 */
async function extractSingleScene(
  supabase: any,
  lovableApiKey: string,
  userId: string,
  filmId: string,
  sceneId: string,
) {
  // Fetch the scene
  const { data: scene, error: sceneErr } = await supabase
    .from("parsed_scenes")
    .select("*")
    .eq("id", sceneId)
    .single();

  if (sceneErr || !scene) {
    return new Response(
      JSON.stringify({ success: true, skipped: true, reason: "scene_deleted" }),
      { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } },
    );
  }

  // Skip if entity extraction already done for this scene (check for existing entity links)
  const { count: existingLinks } = await supabase
    .from("scene_entity_links")
    .select("id", { count: "exact", head: true })
    .eq("scene_id", sceneId)
    .eq("film_id", filmId);

  // If we already have non-character/location entity links, skip
  // (character/location links are created in full-film step, so check for other types)
  if (existingLinks && existingLinks > 0) {
    // Check if any are from AI extraction (non-CHARACTER, non-LOCATION)
    const { data: aiLinks } = await supabase
      .from("scene_entity_links")
      .select("entity_id")
      .eq("scene_id", sceneId)
      .eq("film_id", filmId)
      .limit(5);

    if (aiLinks && aiLinks.length > 0) {
      // Check entity types
      const entityIds = aiLinks.map((l: any) => l.entity_id);
      const { data: entities } = await supabase
        .from("script_entities")
        .select("entity_type")
        .in("id", entityIds);

      const hasAiEntities = entities?.some((e: any) =>
        !["CHARACTER", "LOCATION"].includes(e.entity_type)
      );

      if (hasAiEntities) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "already_extracted" }),
          { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } },
        );
      }
    }
  }

  const systemPrompt = `You are a professional script breakdown analyst. Extract ONLY what is explicitly written in the screenplay text. Do NOT infer, interpret, or add anything not written. No aesthetic judgments. No style suggestions. Only factual extraction.`;

  const userPrompt = `Extract ALL physical objects, wardrobe, animals, sound events, and environmental conditions from this scene. Classify each item into EXACTLY ONE category.

CATEGORIES (strict — no cross-contamination):
- VEHICLE: Any vehicle (car, truck, boat, helicopter, etc.)
- WEAPON: Any weapon (gun, knife, sword, etc.)
- DEVICE: Any electronic/mechanical device (phone, computer, radio, etc.)
- DOCUMENT: Any document (letter, newspaper, book, photo, etc.)
- PRACTICAL_LIGHT_SOURCE: Any visible light source (lamp, candle, flashlight, neon sign, etc.)
- FOOD_OR_DRINK: Any food or beverage (coffee, sandwich, wine, etc.)
- PROP: Physical objects that don't fit above categories
- WARDROBE: Clothing descriptions attached to specific characters
- ANIMAL: Any animal
- SOUND_EVENT: Explicitly described sounds (gunshot, thunder, music from radio, etc.)
- ENVIRONMENTAL_CONDITION: Weather, temperature, atmospheric conditions described

CRITICAL RULES:
- Vehicles are NEVER props
- Weapons are NEVER props
- Light sources are NEVER props
- Wardrobe is NEVER props
- If an item could be in multiple categories, use the MORE SPECIFIC category

SCENE HEADING: ${scene.heading}

SCENE TEXT:
${scene.raw_text}`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "scene_entities",
            description: "Return all extracted entities from the scene, classified by type.",
            parameters: {
              type: "object",
              properties: {
                entities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "The entity name as written in the script." },
                      category: {
                        type: "string",
                        enum: ["VEHICLE", "WEAPON", "DEVICE", "DOCUMENT", "PRACTICAL_LIGHT_SOURCE", "FOOD_OR_DRINK", "PROP", "ANIMAL", "SOUND_EVENT", "ENVIRONMENTAL_CONDITION"],
                        description: "The entity category. Must be exactly one of the listed values.",
                      },
                      associated_character: { type: "string", description: "Character name who owns/uses this entity, if explicitly clear. Empty string if not applicable." },
                      description: { type: "string", description: "Brief factual description as written in the script. No interpretation." },
                    },
                    required: ["name", "category"],
                  },
                },
                wardrobe: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      character: { type: "string", description: "Character name in UPPERCASE." },
                      description: { type: "string", description: "What they are wearing, as described in the script." },
                      condition: { type: "string", description: "Condition if described (torn, muddy, pristine). 'normal' if not specified." },
                    },
                    required: ["character", "description"],
                  },
                },
                character_actions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      character: { type: "string", description: "Character name in UPPERCASE." },
                      emotional_descriptors: {
                        type: "array",
                        items: { type: "string" },
                        description: "Explicit emotional descriptors from the text (e.g. 'angry', 'nervous'). Empty array if none.",
                      },
                      action_verbs: {
                        type: "array",
                        items: { type: "string" },
                        description: "Key action verbs associated with this character in this scene (e.g. 'runs', 'grabs', 'whispers').",
                      },
                    },
                    required: ["character"],
                  },
                },
                stunt_indicators: {
                  type: "array",
                  items: { type: "string" },
                  description: "Any stunts, fights, falls, chases, or dangerous physical actions described.",
                },
                crowd_indicators: { type: "string", description: "Description of background extras/crowd if mentioned. Empty string if none." },
                blood_injury: {
                  type: "array",
                  items: { type: "string" },
                  description: "Any blood, injuries, wounds described. Empty array if none.",
                },
                fire_smoke: {
                  type: "array",
                  items: { type: "string" },
                  description: "Any fire, smoke, explosions described. Empty array if none.",
                },
              },
              required: ["entities", "wardrobe", "character_actions", "stunt_indicators", "crowd_indicators", "blood_injury", "fire_smoke"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "scene_entities" } },
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI entity extraction error:", aiResponse.status, errText);
    const statusCode = aiResponse.status;
    if (statusCode === 429 || statusCode === 503) {
      return new Response(
        JSON.stringify({ error: "Rate limited", retryable: true }),
        { status: 429, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ error: "AI extraction failed" }),
      { status: 500, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } },
    );
  }

  const aiData = await aiResponse.json();
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    console.error("No tool call in entity extraction response");
    return new Response(
      JSON.stringify({ error: "AI did not return structured data" }),
      { status: 500, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } },
    );
  }

  let result: any;
  try {
    result = JSON.parse(toolCall.function.arguments);
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to parse AI response" }),
      { status: 500, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } },
    );
  }

  // Process extracted entities — enforce cross-category classification
  const entities = result.entities || [];
  for (const entity of entities) {
    // Re-classify using keyword rules (overrides AI if needed)
    const correctedType = classifyEntity(entity.name, entity.category);
    if (correctedType !== entity.category) {
      console.log(`[Phase1] Reclassified "${entity.name}" from ${entity.category} → ${correctedType}`);
      entity.category = correctedType;
    }

    // Upsert entity into registry
    const { data: existing } = await supabase
      .from("script_entities")
      .select("id")
      .eq("film_id", filmId)
      .eq("entity_type", entity.category)
      .eq("canonical_name", entity.name.toUpperCase())
      .maybeSingle();

    let entityId: string;
    if (existing) {
      entityId = existing.id;
    } else {
      const { data: inserted } = await supabase
        .from("script_entities")
        .insert({
          film_id: filmId,
          entity_type: entity.category,
          canonical_name: entity.name.toUpperCase(),
          aliases: [],
          first_appearance_scene: scene.scene_number,
          metadata: {
            associated_character: entity.associated_character || null,
            description: entity.description || null,
          },
        })
        .select("id")
        .single();

      if (!inserted) continue;
      entityId = inserted.id;
    }

    // Create scene-entity link
    await supabase.from("scene_entity_links").upsert({
      scene_id: sceneId,
      entity_id: entityId,
      film_id: filmId,
      context: {
        description: entity.description || null,
        associated_character: entity.associated_character || null,
      },
    }, { onConflict: "scene_id,entity_id" });
  }

  // Process wardrobe as entities
  for (const w of (result.wardrobe || [])) {
    const wardrobeName = `${(w.character || "UNKNOWN").toUpperCase()}: ${w.description || ""}`.trim();
    if (wardrobeName.length < 4) continue;

    const { data: existing } = await supabase
      .from("script_entities")
      .select("id")
      .eq("film_id", filmId)
      .eq("entity_type", "WARDROBE")
      .eq("canonical_name", wardrobeName.toUpperCase())
      .maybeSingle();

    let entityId: string;
    if (existing) {
      entityId = existing.id;
    } else {
      const { data: inserted } = await supabase
        .from("script_entities")
        .insert({
          film_id: filmId,
          entity_type: "WARDROBE",
          canonical_name: wardrobeName.toUpperCase(),
          aliases: [],
          first_appearance_scene: scene.scene_number,
          metadata: {
            character: w.character || null,
            description: w.description || null,
            condition: w.condition || "normal",
          },
        })
        .select("id")
        .single();

      if (!inserted) continue;
      entityId = inserted.id;
    }

    await supabase.from("scene_entity_links").upsert({
      scene_id: sceneId,
      entity_id: entityId,
      film_id: filmId,
      context: { condition: w.condition || "normal" },
    }, { onConflict: "scene_id,entity_id" });
  }

  // Update parsed_scenes with logistics data (non-entity fields)
  const updateData: Record<string, any> = {
    enriched: true,
    stunts: result.stunt_indicators || [],
    extras: result.crowd_indicators || "",
    special_makeup: result.blood_injury || [],
  };

  // Store character actions in character_details (compatible with existing schema)
  if (result.character_actions && result.character_actions.length > 0) {
    updateData.character_details = result.character_actions.map((ca: any) => ({
      name: ca.character || "",
      emotional_tone: (ca.emotional_descriptors || []).join(", ") || "neutral",
      key_expressions: "not specified",
      physical_behavior: (ca.action_verbs || []).join(", ") || "not specified",
    }));
  }

  // Store fire/smoke in sfx
  if (result.fire_smoke && result.fire_smoke.length > 0) {
    updateData.sfx = result.fire_smoke;
  }

  await supabase.from("parsed_scenes").update(updateData).eq("id", sceneId);

  await logCreditUsage({
    userId,
    filmId,
    serviceName: "Gemini Flash",
    serviceCategory: "script-analysis",
    operation: "extract-entities-scene",
    credits: 1,
  });

  return new Response(
    JSON.stringify({ success: true, entities: entities.length, wardrobe: (result.wardrobe || []).length }),
    { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } },
  );
}
