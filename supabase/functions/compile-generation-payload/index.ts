import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Derive MPAA-style content safety level from flags */
function deriveSafetyLevel(safety: {
  violence: boolean;
  nudity: boolean;
  language: boolean;
} | null): string {
  if (!safety) return "PG";
  const count = [safety.violence, safety.nudity, safety.language].filter(Boolean).length;
  if (count >= 2) return "R";
  if (safety.violence || safety.nudity) return "PG-13";
  if (safety.language) return "PG-13";
  return "PG";
}

/** Build the temporal anachronism blacklist from a time period string */
function buildAnachronismBlacklist(period: string | null): string[] {
  if (!period) return [];
  const lower = (period ?? "").toLowerCase();

  const modernTech = [
    "smartphones", "flatscreen tvs", "led lighting", "modern electric cars",
    "wireless earbuds", "tablets", "drones", "selfie sticks",
  ];

  if (
    lower.includes("1800") || lower.includes("18th") || lower.includes("victorian") ||
    lower.includes("19th") || lower.includes("1900") || lower.includes("medieval") ||
    lower.includes("ancient")
  ) {
    return [...modernTech, "automobiles", "electric lights", "telephones", "radios", "plastic", "nylon"];
  }

  if (lower.includes("1920") || lower.includes("1930") || lower.includes("1940") || lower.includes("1950")) {
    return [...modernTech, "color television", "personal computers", "microwave ovens"];
  }

  if (lower.includes("1960") || lower.includes("1970")) {
    return [...modernTech, "personal computers", "compact discs", "vcr"];
  }

  if (lower.includes("1980") || lower.includes("1990")) {
    return ["smartphones", "flatscreen tvs", "led lighting", "wireless earbuds", "drones", "selfie sticks"];
  }

  return [];
}

/** Extract {{REF_CODES}} from prompt text */
function extractRefCodes(text: string | null): string[] {
  if (!text) return [];
  const matches = text.match(/\{\{([A-Z0-9_]+)\}\}/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/[{}]/g, ""));
}

/** Parse camera_language from ai_generation_templates into structured metadata */
function parseCinematography(
  template: { camera_language: string | null; image_prompt_base: string | null } | null,
  contract: any | null,
) {
  // Start with contract defaults (genre-informed) or hardcoded defaults
  const contractProfile = contract?.genre_visual_profile?.blended_profile || {};
  const contractLighting = contract?.lighting_doctrine || {};
  const contractLens = contract?.lens_philosophy || {};
  const contractTexture = contract?.texture_mandate || {};

  const meta = {
    framing: {
      shot_size: "MS",
      angle: "Eye level",
      aspect_ratio: "2.39:1",
    },
    optics: {
      sensor_profile: "ARRI Alexa 35",
      lens_type: "Spherical prime",
      focal_length: contractLens.genre_default_lens || "35mm",
      depth_of_field: "f/2.8",
    },
    dynamics: {
      rigging: "Tripod",
      movement: "Static",
      motion_blur: "180° standard",
    },
    lighting_and_grade: {
      setup: contractLighting.genre_default || "Natural",
      color_temp: contractLighting.genre_color_temp || "Daylight 5600K",
      film_texture: contractTexture.genre_grain || "Clean digital",
    },
  };

  if (!template?.camera_language) return meta;
  const cl = template.camera_language.toLowerCase();

  // Shot size detection
  if (cl.includes("extreme close") || cl.includes("ecu")) meta.framing.shot_size = "ECU";
  else if (cl.includes("close up") || cl.includes(" cu")) meta.framing.shot_size = "CU";
  else if (cl.includes("medium close") || cl.includes("mcu")) meta.framing.shot_size = "MCU";
  else if (cl.includes("medium shot") || cl.includes(" ms")) meta.framing.shot_size = "MS";
  else if (cl.includes("wide") || cl.includes(" ws")) meta.framing.shot_size = "WS";
  else if (cl.includes("extreme wide") || cl.includes("ews")) meta.framing.shot_size = "EWS";

  // Angle
  if (cl.includes("low angle")) meta.framing.angle = "Low angle";
  else if (cl.includes("high angle")) meta.framing.angle = "High angle";
  else if (cl.includes("dutch") || cl.includes("canted")) meta.framing.angle = "Dutch angle";
  else if (cl.includes("bird")) meta.framing.angle = "Bird's eye";
  else if (cl.includes("worm")) meta.framing.angle = "Worm's eye";

  // Movement
  if (cl.includes("push in") || cl.includes("push-in")) meta.dynamics.movement = "Slow push-in";
  else if (cl.includes("pull out") || cl.includes("pull-out")) meta.dynamics.movement = "Pull out";
  else if (cl.includes("pan left")) meta.dynamics.movement = "Pan left";
  else if (cl.includes("pan right")) meta.dynamics.movement = "Pan right";
  else if (cl.includes("tracking")) meta.dynamics.movement = "Tracking";
  else if (cl.includes("crane")) meta.dynamics.movement = "Crane";
  else if (cl.includes("handheld")) meta.dynamics.movement = "Handheld";

  // Rigging
  if (cl.includes("steadicam")) meta.dynamics.rigging = "Steadicam";
  else if (cl.includes("handheld")) meta.dynamics.rigging = "Handheld";
  else if (cl.includes("crane") || cl.includes("jib")) meta.dynamics.rigging = "Crane / Jib";
  else if (cl.includes("dolly")) meta.dynamics.rigging = "Dolly";

  // Lighting (shot-level overrides genre default)
  if (cl.includes("low-key") || cl.includes("low key")) meta.lighting_and_grade.setup = "Low-key";
  else if (cl.includes("high-key") || cl.includes("high key")) meta.lighting_and_grade.setup = "High-key";
  else if (cl.includes("silhouette")) meta.lighting_and_grade.setup = "Silhouette";
  else if (cl.includes("practical")) meta.lighting_and_grade.setup = "Practical";

  // Lens
  if (cl.includes("anamorphic")) meta.optics.lens_type = "Anamorphic prime";
  if (cl.includes("50mm")) meta.optics.focal_length = "50mm";
  else if (cl.includes("85mm")) meta.optics.focal_length = "85mm";
  else if (cl.includes("24mm")) meta.optics.focal_length = "24mm";
  else if (cl.includes("100mm")) meta.optics.focal_length = "100mm";

  // Texture
  if (cl.includes("35mm grain") || cl.includes("film grain")) {
    meta.lighting_and_grade.film_texture = "35mm grain, halation";
  } else if (cl.includes("16mm")) {
    meta.lighting_and_grade.film_texture = "16mm grain, heavy halation";
  }

  return meta;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { shot_id } = await req.json();
    if (!shot_id) {
      return new Response(
        JSON.stringify({ error: "shot_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 1. Fetch the shot ──
    const { data: shot, error: shotErr } = await supabase
      .from("shots")
      .select("*")
      .eq("id", shot_id)
      .single();

    if (shotErr || !shot) {
      return new Response(
        JSON.stringify({ error: "Shot not found", details: shotErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Parallel fetches: film, content_safety, template, style_contract, scene_override ──
    const [filmRes, safetyRes, templateRes, contractRes, sceneOverrideRes] = await Promise.all([
      supabase.from("films").select("*").eq("id", shot.film_id).single(),
      supabase.from("content_safety").select("*").eq("film_id", shot.film_id).maybeSingle(),
      supabase.from("ai_generation_templates").select("*").eq("shot_id", shot_id).maybeSingle(),
      supabase.from("film_style_contracts").select("*").eq("film_id", shot.film_id).maybeSingle(),
      supabase.from("scene_style_overrides").select("*").eq("film_id", shot.film_id).eq("scene_number", shot.scene_number).maybeSingle(),
    ]);

    const film = filmRes.data;
    const safety = safetyRes.data;
    const template = templateRes.data;
    const contract = contractRes.data;
    const sceneOverride = sceneOverrideRes.data;

    // ── 2b. Fetch locked film assets ──
    const { data: lockedAssets } = await supabase
      .from("film_assets")
      .select("*")
      .eq("film_id", shot.film_id)
      .eq("locked", true);

    // ── 3. Resolve identity tokens from asset_identity_registry ──
    const refCodes = extractRefCodes(shot.prompt_text);
    let identityTokens: any[] = [];
    let characterConsistencyViews: any[] = [];

    if (refCodes.length > 0) {
      const { data: assets } = await supabase
        .from("asset_identity_registry")
        .select("*")
        .eq("film_id", shot.film_id)
        .in("internal_ref_code", refCodes);

      if (assets) {
        identityTokens = assets.map((a) => ({
          token: `{{${a.internal_ref_code}}}`,
          entity_type: a.asset_type,
          display_name: a.display_name,
          locked_image_url: a.reference_image_url,
          is_dirty: a.is_dirty,
          weight: a.asset_type === "character" ? 0.85 : undefined,
        }));

        // Fetch consistency views for referenced characters
        const charAssets = assets.filter((a) => a.asset_type === "character");
        if (charAssets.length > 0) {
          // Find character IDs by matching display_name to characters table
          const charNames = charAssets.map((a) => a.display_name);
          const { data: chars } = await supabase
            .from("characters")
            .select("id, name")
            .eq("film_id", shot.film_id)
            .in("name", charNames);

          if (chars?.length) {
            const charIds = chars.map((c) => c.id);
            const { data: views } = await supabase
              .from("character_consistency_views")
              .select("character_id, angle_index, angle_label, image_url, status")
              .in("character_id", charIds)
              .eq("status", "complete")
              .order("angle_index");

            if (views?.length) {
              // Group views by character
              const viewMap = new Map<string, any[]>();
              for (const v of views) {
                if (!v.image_url) continue;
                if (!viewMap.has(v.character_id)) viewMap.set(v.character_id, []);
                viewMap.get(v.character_id)!.push({
                  angle_label: v.angle_label,
                  image_url: v.image_url,
                });
              }
              // Map back to character names
              for (const char of chars) {
                const charViews = viewMap.get(char.id);
                if (charViews?.length) {
                  characterConsistencyViews.push({
                    character_name: char.name,
                    character_id: char.id,
                    views: charViews,
                  });
                }
              }
            }
          }
        }
      }
    }

    // ── 4. Build temporal guardrails ──
    const anchorPeriod = film?.time_period ?? null;
    const blacklist = buildAnachronismBlacklist(anchorPeriod);

    // Use contract's negative prompt base if available (genre + rating aware)
    const contractNegative = contract?.negative_prompt_base || "";
    const negativeBase = contractNegative || "morphed faces, low quality, watermark, text, 3d render, plastic";
    const negativePrompt = blacklist.length
      ? `${negativeBase}, ${blacklist.join(", ")}`
      : negativeBase;

    // Add scene-specific negative if present
    const finalNegative = sceneOverride?.custom_negative
      ? `${negativePrompt}, ${sceneOverride.custom_negative}`
      : negativePrompt;

    // ── 5. Build cinematography metadata (genre-informed defaults from contract) ──
    const cinematography = parseCinematography(template, contract);

    // ── 5b. Apply scene override to cinematography ──
    if (sceneOverride) {
      // Scene mood can shift lighting
      if (sceneOverride.lighting_override && !template?.camera_language) {
        cinematography.lighting_and_grade.setup = sceneOverride.lighting_override;
      }
      // Time of day grade
      if (sceneOverride.time_of_day_grade) {
        cinematography.lighting_and_grade.color_temp = sceneOverride.time_of_day_grade;
      }
    }

    // ── 6. Derive content safety level ──
    const safetyLevel = deriveSafetyLevel(safety);

    // ── 7. Assemble the VFS Prompt Compiler Payload ──
    const compilationId = `vfs-comp-${crypto.randomUUID().slice(0, 6)}`;

    const payload = {
      compilation_id: compilationId,
      film_id: shot.film_id,
      shot_id: shot.id,

      // Style contract version for provenance tracking
      style_contract_version: contract?.version || null,

      routing_metadata: {
        target_tier: "commercial_heavyweight",
        preferred_engine: "veo_3.1",
        fallback_engine: "kling_3",
        content_safety_level: safetyLevel,
      },

      temporal_guardrails: {
        anchor_period: anchorPeriod,
        anachronism_blacklist: blacklist,
        negative_prompt_injection: finalNegative,
      },

      // Genre-informed visual context from the Director's Bible
      style_context: contract ? {
        visual_dna: contract.visual_dna || "",
        genre_profile: contract.genre_visual_profile || {},
        color_mandate: contract.color_mandate || {},
        lighting_doctrine: contract.lighting_doctrine || {},
        texture_mandate: contract.texture_mandate || {},
      } : null,

      // Scene-specific mood/atmosphere override
      scene_context: sceneOverride ? {
        mood: sceneOverride.mood_override,
        lighting: sceneOverride.lighting_override,
        color_shift: sceneOverride.color_shift,
        environment_texture: sceneOverride.environment_texture,
        time_of_day_grade: sceneOverride.time_of_day_grade,
        camera_feel: sceneOverride.camera_feel,
      } : null,

      generation_payload: {
        raw_script_action: shot.prompt_text ?? "",

        resolved_text_prompt: buildResolvedPrompt(shot, template, cinematography, lockedAssets || [], contract, sceneOverride),

        identity_tokens: identityTokens,

        // Character consistency turnaround views for identity anchoring
        character_consistency_views: characterConsistencyViews,

        locked_assets: {
          locations: (lockedAssets || []).filter((a: any) => a.asset_type === "location").map((a: any) => ({
            name: a.asset_name, description: a.description, image_url: a.image_url,
          })),
          props: (lockedAssets || []).filter((a: any) => a.asset_type === "prop").map((a: any) => ({
            name: a.asset_name, description: a.description, image_url: a.image_url,
          })),
          vehicles: (lockedAssets || []).filter((a: any) => a.asset_type === "vehicle").map((a: any) => ({
            name: a.asset_name, description: a.description, image_url: a.image_url,
          })),
          wardrobe: (lockedAssets || []).filter((a: any) => a.asset_type === "wardrobe").map((a: any) => ({
            name: a.asset_name, description: a.description, image_url: a.image_url, character_id: a.character_id,
          })),
        },

        cinematography_metadata: cinematography,

        execution_params: {
          duration_seconds: 5,
          fps: film?.frame_rate || 24,
          resolution: film?.frame_width && film?.frame_height
            ? `${film.frame_width}x${film.frame_height}`
            : "4K",
          format_type: film?.format_type || null,
          seed: shot.video_url ? null : Math.floor(Math.random() * 9_000_000) + 1_000_000,
        },
      },
    };

    await logCreditUsage({
      userId: authResult.userId,
      filmId: shot.film_id,
      serviceName: "Payload Compiler",
      serviceCategory: "script-analysis",
      operation: "compile-generation-payload",
    });

    return new Response(JSON.stringify(payload, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal compiler error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Build the resolved text prompt from shot + template + cinematography + locked assets + contract + scene override */
function buildResolvedPrompt(
  shot: any,
  template: any,
  cine: ReturnType<typeof parseCinematography>,
  lockedAssets: any[],
  contract: any | null,
  sceneOverride: any | null,
): string {
  const parts: string[] = [];

  // Film visual DNA (genre-informed identity)
  if (contract?.visual_dna) {
    parts.push(`VISUAL IDENTITY: ${contract.visual_dna}`);
  }

  // Genre color direction
  if (contract?.color_mandate?.genre_palette) {
    parts.push(`COLOR: ${contract.color_mandate.genre_palette}.`);
  }

  // Scene mood override
  if (sceneOverride?.mood_override) {
    parts.push(`MOOD: ${sceneOverride.mood_override}.`);
  }

  // Scene environment texture
  if (sceneOverride?.environment_texture) {
    parts.push(`ENVIRONMENT: ${sceneOverride.environment_texture}.`);
  }

  // Shot size + angle
  parts.push(
    `${cine.framing.shot_size} shot, ${cine.framing.angle.toLowerCase()} angle.`
  );

  // Script action
  if (shot.prompt_text) {
    parts.push(shot.prompt_text);
  }

  // Camera movement
  if (cine.dynamics.movement !== "Static") {
    parts.push(`${cine.dynamics.movement}.`);
  }

  // Lighting (genre-informed or scene-overridden)
  parts.push(`${cine.lighting_and_grade.setup} lighting, ${cine.lighting_and_grade.color_temp}.`);

  // Sensor + texture (genre-informed)
  parts.push(
    `Cinematic, ${cine.optics.sensor_profile}, ${cine.lighting_and_grade.film_texture}.`
  );

  // Inject locked asset descriptions
  const locLocked = lockedAssets.filter((a) => a.asset_type === "location");
  if (locLocked.length > 0) {
    parts.push(`LOCATION: ${locLocked.map((a: any) => `${a.asset_name} (${a.description})`).join("; ")}.`);
  }
  const propLocked = lockedAssets.filter((a) => a.asset_type === "prop");
  if (propLocked.length > 0) {
    parts.push(`PROPS: ${propLocked.map((a: any) => `${a.asset_name} (${a.description})`).join("; ")}.`);
  }
  const vehLocked = lockedAssets.filter((a) => a.asset_type === "vehicle");
  if (vehLocked.length > 0) {
    parts.push(`VEHICLES: ${vehLocked.map((a: any) => `${a.asset_name} (${a.description})`).join("; ")}.`);
  }
  const wardLocked = lockedAssets.filter((a) => a.asset_type === "wardrobe");
  if (wardLocked.length > 0) {
    parts.push(`WARDROBE: ${wardLocked.map((a: any) => `${a.asset_name} (${a.description})`).join("; ")}.`);
  }

  // Video prompt base override from template
  if (template?.video_prompt_base) {
    parts.push(template.video_prompt_base);
  }

  return parts.join(" ");
}
