import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════════
// STYLE AXIS LABELS & INTERPRETATION ENGINE
// ═══════════════════════════════════════════════════════════════════

const AXIS_LABELS: Record<string, string> = {
  scale: "Scale",
  structure: "Structure Complexity",
  visual: "Visual Control",
  darkness: "Darkness",
  dialogue: "Dialogue Density",
  spectacle: "Spectacle Dependency",
  genreFluidity: "Genre Fluidity",
  emotion: "Emotional Temperature",
};

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { film_id } = await req.json();
    if (!film_id) {
      return new Response(
        JSON.stringify({ error: "film_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mark as generating
    const { data: existingBible } = await supabase
      .from("production_bibles")
      .select("id")
      .eq("film_id", film_id)
      .maybeSingle();

    if (existingBible) {
      await supabase.from("production_bibles").update({
        status: "generating",
        error_message: null,
        updated_at: new Date().toISOString(),
      }).eq("id", existingBible.id);
    } else {
      await supabase.from("production_bibles").insert({
        film_id,
        status: "generating",
        content: {},
      });
    }

    // ── Parallel fetches ──
    const [filmRes, safetyRes, analysisRes, scenesRes, charsRes, directorRes, contractRes] = await Promise.all([
      supabase.from("films").select("*").eq("id", film_id).single(),
      supabase.from("content_safety").select("*").eq("film_id", film_id).maybeSingle(),
      supabase.from("script_analyses").select("*").eq("film_id", film_id).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("parsed_scenes").select("*").eq("film_id", film_id).order("scene_number"),
      supabase.from("characters").select("*").eq("film_id", film_id),
      supabase.from("film_director_profiles").select("*").eq("film_id", film_id).maybeSingle(),
      supabase.from("film_style_contracts").select("*").eq("film_id", film_id).maybeSingle(),
    ]);

    const film = filmRes.data;
    if (!film) {
      await supabase.from("production_bibles").update({ status: "error", error_message: "Film not found" }).eq("film_id", film_id);
      return new Response(JSON.stringify({ error: "Film not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const scenes = scenesRes.data || [];
    const characters = charsRes.data || [];
    const director = directorRes.data;
    const contract = contractRes.data;
    const analysis = analysisRes.data;
    const safety = safetyRes.data;
    const genres = (film.genres || []) as string[];
    const globalElements: any = analysis?.global_elements || {};

    // ── Compute style vector (from director profile) ──
    const computedVector = (director?.computed_vector || {}) as Record<string, number>;
    const visualMandate = (director?.visual_mandate || {}) as Record<string, string>;

    // ── Build comprehensive context for AI ──
    const contextPayload = {
      film: {
        title: film.title,
        version_name: film.version_name || null,
        version_number: film.version_number,
        script_file_name: analysis?.file_name || null,
        genres,
        format_type: film.format_type,
        time_period: film.time_period,
        frame_width: film.frame_width,
        frame_height: film.frame_height,
        frame_rate: film.frame_rate,
      },
      style_vector: computedVector,
      axis_labels: AXIS_LABELS,
      director_match: director ? {
        primary_director: director.primary_director_name,
        secondary_director: director.secondary_director_name || null,
        blend_weight: director.blend_weight,
        cluster: director.cluster,
        quadrant: director.quadrant,
        emotional_depth: director.emotional_depth,
        visual_mandate: visualMandate,
        match_distance: director.match_distance,
        auto_matched: director.auto_matched,
      } : null,
      style_contract: contract ? {
        visual_dna: contract.visual_dna,
        color_mandate: contract.color_mandate,
        lighting_doctrine: contract.lighting_doctrine,
        lens_philosophy: contract.lens_philosophy,
        texture_mandate: contract.texture_mandate,
        content_guardrails: contract.content_guardrails,
        genre_visual_profile: contract.genre_visual_profile,
        negative_prompt_base: contract.negative_prompt_base,
        character_directives: contract.character_directives,
        world_rules: contract.world_rules,
        version: contract.version,
      } : null,
      content_safety: safety ? {
        mode: safety.mode,
        violence: safety.violence,
        nudity: safety.nudity,
        language: safety.language,
        suggested_rating: (safety as any).suggested_rating,
      } : null,
      scene_summary: {
        total_scenes: scenes.length,
        int_ext_breakdown: {
          interior: scenes.filter((s: any) => (s.int_ext || "").toLowerCase().includes("int")).length,
          exterior: scenes.filter((s: any) => (s.int_ext || "").toLowerCase().includes("ext")).length,
        },
        day_night_breakdown: {
          day: scenes.filter((s: any) => (s.day_night || "").toLowerCase().includes("day")).length,
          night: scenes.filter((s: any) => (s.day_night || "").toLowerCase().includes("night")).length,
        },
        unique_locations: [...new Set(scenes.map((s: any) => s.location_name).filter(Boolean))],
        moods: [...new Set(scenes.map((s: any) => s.mood).filter(Boolean))],
        total_page_count: scenes.reduce((sum: number, s: any) => sum + (s.estimated_page_count || 0), 0),
      },
      characters: characters.map((c: any) => ({
        name: c.name,
        description: c.description,
        sex: c.sex,
        age_range: c.age_min && c.age_max ? `${c.age_min}-${c.age_max}` : null,
        is_child: c.is_child,
      })),
      scenes_detail: scenes.slice(0, 30).map((s: any) => ({
        scene_number: s.scene_number,
        heading: s.heading,
        characters: s.characters,
        mood: s.mood,
        description: s.description?.substring(0, 200),
        stunts: s.stunts,
        vfx: s.vfx,
        sfx: s.sfx,
      })),
      visual_summary: analysis?.visual_summary || "",
      ai_generation_notes: analysis?.ai_generation_notes || [],
      global_elements: {
        signature_style: globalElements.signature_style || "",
        visual_design: globalElements.visual_design || null,
      },
    };

    // ── Call Lovable AI to generate the Production Bible ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      await supabase.from("production_bibles").update({ status: "error", error_message: "AI key not configured" }).eq("film_id", film_id);
      return new Response(JSON.stringify({ error: "AI key not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are a world-class film production consultant generating a Production Bible — the governing aesthetic contract for all departments on a film production.

You will receive comprehensive data about a film project including its style vector (8 axes scored 0-10), director matching output, visual mandate, style contract, parsed scenes, and character data.

Your job is to generate a structured Production Bible JSON that transforms this data into human-readable, department-enforceable creative doctrine.

CRITICAL RULES:
- Every statement must be derived from the provided data, not invented
- Use authoritative, specific, rule-based language — no ambiguity
- When axis scores are extreme (≥9 or ≤2), generate absolute rules (non-negotiables)
- Department doctrines must have concrete, actionable constraints
- The document must feel like it was written by a veteran production designer
- CRITICAL AUDIO RULE: All audio generated for scenes must be PRODUCTION SOUND ONLY — meaning only sounds that would be physically recorded on set by a production sound mixer. This means: dialogue, ambient environment sounds, practical sound effects from on-screen actions, and room tone. NO musical score, NO non-diegetic music, NO synthesized sound design, NO sounds from sources not physically present in the scene. This rule must be reflected in the Sound & Score department doctrine and in the CIC engine compiler instructions for all engines.

VISUAL CONSISTENCY PIPELINE — MULTI-VIEW GENERATION SYSTEM:
The production pipeline generates multi-view reference sheets to ensure visual consistency across all AI-generated scenes. This must be documented in the Character Consistency and CIC sections:

1. CHARACTER TURNAROUND (8 Views): For each cast character, 8 identity reference views are generated — Front, Back, Left Profile, Right Profile, Left 3/4, Right 3/4, Medium Close-Up, and Portrait 8×10 (85mm equivalent, classic headshot framing). These serve as the Visual Continuity Anchor for all downstream generation.

2. WARDROBE FITTING TURNAROUND (8 Views per Costume): For each character in each locked wardrobe item, a separate 8-view turnaround grid is generated using the character's cast headshot and the selected garment as references. This ensures costume continuity across scenes.

3. ASSET AUDITION SYSTEM (5 Variations per Asset): For non-character assets, 5 visual variations are generated for selection:
   - LOCATIONS: 5 cinematic 16:9 wide-angle environment reference images per location
   - PROPS: 5 cinematic 16:9 product-style reference images per prop, grouped by character or location ownership
   - PICTURE VEHICLES: 5 cinematic 16:9 reference images per vehicle
   - WARDROBE OPTIONS: 5 portrait-framed (8:10) images on headless mannequins with flat studio lighting per wardrobe item

Once an asset variation is locked/selected, it becomes the canonical visual reference injected into the prompt compiler for all scene generation involving that asset.

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "core_identity": {
    "axis_interpretations": [
      {
        "axis": "Scale",
        "score": 8,
        "interpretation": "2-3 sentence explanation of what this score means visually and structurally",
        "department_implications": ["Camera: ...", "Production Design: ...", "Editing: ..."]
      }
    ],
    "director_match_metadata": {
      "primary_director": "director name",
      "secondary_director": "director name or null",
      "cluster": "e.g. Operatic Mythmakers",
      "quadrant": "e.g. Epic × Classical",
      "emotional_depth_tier": "cool/warm/operatic"
    },
    "director_summary": {
      "match_reasoning": "Why this director matched the script",
      "aesthetic_tensions": "What tensions exist between script and director style",
      "blend_effect_summary": "What the blend produces (if blended)"
    }
  },
  "visual_mandate": {
    "lighting_doctrine": {
      "key_to_fill_ratio": "e.g. 1:4",
      "natural_vs_stylized": "description",
      "top_light_policy": "allowed/banned + reason",
      "motivated_vs_expressionistic": "description"
    },
    "lens_doctrine": {
      "preferred_focal_range": "e.g. 27-50mm",
      "movement_policy": "description of camera movement rules",
      "handheld_allowed": true,
      "push_in_frequency": "description",
      "shot_duration_expectation": "description"
    },
    "color_texture_authority": {
      "base_palette": ["color1", "color2"],
      "accent_colors": ["color1"],
      "saturation_policy": "description",
      "fabric_classes": ["class1"],
      "surface_finish_guidance": "description"
    }
  },
  "story_intelligence": {
    "structure_map": {
      "archetype": "e.g. Three-Act Hero's Journey",
      "pacing_curve": "description",
      "emotional_escalation_map": "description",
      "scene_count": 45,
      "turning_points": ["Scene 12: inciting incident", "Scene 30: midpoint"],
      "midpoint_intensity": 7,
      "climax_escalation": "description"
    },
    "character_temperature_chart": [
      {
        "character_name": "name",
        "emotional_baseline": 5,
        "emotional_peak": 9,
        "dialogue_density_contribution": 0.3,
        "power_shift_moments": ["Scene 5: confrontation", "Scene 12: revelation"]
      }
    ]
  },
  "department_doctrines": {
    "camera": {
      "primary_objective": "...",
      "governing_constraints": ["constraint1", "constraint2"],
      "motif_alignment": "...",
      "forbidden_moves": ["move1"]
    },
    "production_design": { "primary_objective": "...", "governing_constraints": [], "motif_alignment": "...", "forbidden_moves": [] },
    "wardrobe": { "primary_objective": "...", "governing_constraints": [], "motif_alignment": "...", "forbidden_moves": [] },
    "props": { "primary_objective": "...", "governing_constraints": [], "motif_alignment": "...", "forbidden_moves": [] },
    "casting_performance": { "primary_objective": "...", "governing_constraints": [], "motif_alignment": "...", "forbidden_moves": [] },
    "editing": { "primary_objective": "...", "governing_constraints": [], "motif_alignment": "...", "forbidden_moves": [] },
    "sound_score": { "primary_objective": "Production sound only — capture what exists on set", "governing_constraints": ["All audio must be diegetic production sound only", "No musical score or non-diegetic music permitted", "No synthesized or non-present sound sources"], "motif_alignment": "...", "forbidden_moves": ["Adding musical score", "Non-diegetic sound effects", "Sounds from sources not physically present in scene"] }
  },
  "non_negotiables": [
    "ALL AUDIO MUST BE PRODUCTION SOUND ONLY — no score, no music, no non-diegetic sound. Only sounds physically present in the scene are permitted.",
    "Absolute rule derived from extreme axis scores"
  ],
  "style_contract_summary": {
    "final_vector": { "scale": 8, "structure": 6, "visual": 7, "darkness": 5, "dialogue": 4, "spectacle": 8, "genreFluidity": 3, "emotion": 7 },
    "primary_director": "name",
    "secondary_director": "name or null",
    "blend_weight": 0.7,
    "cluster": "cluster name",
    "quadrant": "quadrant name",
    "emotional_depth_tier": "cool/warm/operatic",
    "lighting_snapshot": "1-line summary",
    "lens_snapshot": "1-line summary",
    "color_texture_snapshot": "1-line summary",
    "editing_rhythm_bias": "description"
  },
  "cic_configuration": {
    "engine_neutral_payload": {
      "movement_policy": "...",
      "color_palette": ["color1"],
      "texture_rules": ["rule1"],
      "framing_rules": ["rule1"],
      "editing_bias": "...",
      "negative_constraints": ["constraint1"]
    },
    "constraint_enforcement_level": "strict",
    "prompt_layering_model": {
      "layer_1_scene_intent": "description of how scene metadata drives prompt foundation",
      "layer_2_character_location_locks": "description of how locked assets inject into prompts",
      "layer_3_style_mandate": "description of how style contract governs aesthetic",
      "layer_4_engine_enhancements": "description of engine-specific optimizations",
      "layer_5_constraint_filters": "description of final constraint validation pass"
    },
    "engine_compilers": {
      "veo": {
        "prompt_strategy": "description of how Veo prompts are structured (natural language cinematic descriptions, camera movement instructions, environmental continuity). AUDIO CONSTRAINT: Any audio generation must produce ONLY production sound — dialogue, ambient environment, practical on-screen effects. No score or music.",
        "intensity_multiplier": 1.0,
        "key_translations": ["visual_control → camera movement limits", "darkness → lighting description phrasing", "scale → environmental scale", "lens_doctrine → focal length language"],
        "strengths": ["natural language cinema", "camera movement", "realistic lighting"],
        "constraints": ["Audio limited to production sound only — no score, no music, no non-present sounds"]
      },
      "sora": {
        "prompt_strategy": "description of Sora prompt approach (rich environmental detail, temporal continuity, physical realism, motion continuity). AUDIO CONSTRAINT: Only diegetic production sound permitted.",
        "intensity_multiplier": 1.3,
        "key_translations": ["scale → environmental extension", "spectacle → kinetic choreography", "structure → temporal continuity"],
        "strengths": ["spatial coherence", "scene duration continuity", "object physics"],
        "constraints": ["Audio limited to production sound only — no score, no music, no non-present sounds"]
      },
      "seedance": {
        "prompt_strategy": "description of Seedance prompt approach (stylization descriptors, visual motif reinforcement, texture layering). AUDIO CONSTRAINT: Only diegetic production sound permitted.",
        "intensity_multiplier": 0.9,
        "key_translations": ["genre_fluidity → stylistic blending", "emotional_temperature → color/emotional intensity"],
        "strengths": ["stylization", "motif reinforcement", "aesthetic layering"],
        "constraints": ["Audio limited to production sound only — no score, no music, no non-present sounds"]
      }
    },
    "blend_director_logic": {
      "interpolation_method": "weighted linear interpolation of 8-axis vectors",
      "conflict_resolution": "conservative enforcement — strictest rule wins",
      "merge_rules": [
        "Lighting philosophies blended proportionally by weight",
        "Lens ranges blended proportionally by weight",
        "Texture rules merged with strictest enforcement",
        "Negative constraints: union of both sets, strictest rule wins"
      ]
    },
    "vice_integration": {
      "color_lut_bias": "description of how VICE applies color LUT corrections",
      "grain_bias": "description of film grain consistency enforcement",
      "lighting_consistency": "description of how lighting is kept uniform across shots",
      "lens_distortion_consistency": "description of lens aberration consistency",
      "depth_of_field_consistency": "description of DoF uniformity enforcement"
    },
    "character_consistency": {
      "facial_geometry": "description of how facial embeddings maintain consistency",
      "wardrobe_compliance": "description of how wardrobe locks enforce across shots",
      "color_compliance": "description of how character color palettes are maintained",
      "silhouette_integrity": "description of character silhouette preservation",
      "prohibited_mutations": ["list of prohibited character appearance changes"]
    },
    "post_generation_validation": {
      "frame_sampling_strategy": "description of how generated frames are sampled for analysis",
      "compliance_scoring_method": "description of how style contract compliance is scored",
      "deviation_tolerance": "description of acceptable deviation thresholds",
      "auto_regeneration_policy": "description of when and how auto-regeneration triggers"
    }
  }
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate the complete Production Bible for this film project:\n\n${JSON.stringify(contextPayload, null, 2)}` },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      const errorMsg = response.status === 429 ? "Rate limit exceeded, please try again" : response.status === 402 ? "Credits exhausted" : "AI generation failed";
      await supabase.from("production_bibles").update({ status: "error", error_message: errorMsg }).eq("film_id", film_id);
      return new Response(JSON.stringify({ error: errorMsg }), { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    // Parse the JSON from AI response (strip markdown fences if present)
    let bibleContent: any;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      bibleContent = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", parseErr, rawContent.substring(0, 500));
      await supabase.from("production_bibles").update({ status: "error", error_message: "Failed to parse AI response" }).eq("film_id", film_id);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Enrich with deterministic data ──
    const fullBible = {
      film_id,
      version: contract?.version || 1,
      generated_at: new Date().toISOString(),
      data_sources: {
        script_parse: {
          primary_genre: genres[0] || "Drama",
          secondary_genre: genres[1] || null,
          format_type: film.format_type,
          time_period: film.time_period,
          scene_count: scenes.length,
          total_page_count: contextPayload.scene_summary.total_page_count,
        },
        style_vector: computedVector,
        director_match: contextPayload.director_match,
      },
      ...bibleContent,
    };

    // ── Save to DB ──
    const { data: currentBible } = await supabase
      .from("production_bibles")
      .select("id, version")
      .eq("film_id", film_id)
      .maybeSingle();

    const newVersion = currentBible ? (currentBible.version || 0) + 1 : 1;

    await supabase.from("production_bibles").update({
      content: fullBible,
      version: newVersion,
      status: "complete",
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("film_id", film_id);

    await logCreditUsage({
      userId: authResult.userId,
      filmId: film_id,
      serviceName: "Lovable AI",
      serviceCategory: "script-analysis",
      operation: "generate-production-bible",
    });

    console.log(`Production Bible generated for film ${film_id}: v${newVersion}`);

    return new Response(
      JSON.stringify({ success: true, version: newVersion, content: fullBible }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("generate-production-bible error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate production bible", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});