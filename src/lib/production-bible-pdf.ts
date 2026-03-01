import jsPDF from "jspdf";

// ═══════════════════════════════════════════════════════════
// Production Bible PDF Generator
// Optimized for US Letter (8.5 × 11 in) printing
// ═══════════════════════════════════════════════════════════

interface AxisInterpretation {
  axis: string;
  score: number;
  interpretation: string;
  department_implications: string[];
}

interface DepartmentDoctrine {
  primary_objective: string;
  governing_constraints: string[];
  motif_alignment: string;
  forbidden_moves: string[];
}

interface CharacterTemp {
  character_name: string;
  emotional_baseline: number;
  emotional_peak: number;
  dialogue_density_contribution: number;
  power_shift_moments: string[];
}

interface EngineCompiler {
  prompt_strategy?: string;
  intensity_multiplier?: number;
  key_translations?: string[];
  strengths?: string[];
  constraints?: string[];
}

interface ProductionBibleContent {
  film_id?: string;
  version?: number;
  generated_at?: string;
  core_identity?: {
    axis_interpretations?: AxisInterpretation[];
    director_match_metadata?: {
      primary_director?: string;
      secondary_director?: string | null;
      cluster?: string;
      quadrant?: string;
      emotional_depth_tier?: string;
    };
    director_summary?: {
      match_reasoning?: string;
      aesthetic_tensions?: string;
      blend_effect_summary?: string;
    };
  };
  visual_mandate?: {
    lighting_doctrine?: {
      key_to_fill_ratio?: string;
      natural_vs_stylized?: string;
      top_light_policy?: string;
      motivated_vs_expressionistic?: string;
    };
    lens_doctrine?: {
      preferred_focal_range?: string;
      movement_policy?: string;
      handheld_allowed?: boolean;
      push_in_frequency?: string;
      shot_duration_expectation?: string;
    };
    color_texture_authority?: {
      base_palette?: string[];
      accent_colors?: string[];
      saturation_policy?: string;
      fabric_classes?: string[];
      surface_finish_guidance?: string;
    };
  };
  story_intelligence?: {
    structure_map?: {
      archetype?: string;
      pacing_curve?: string;
      emotional_escalation_map?: string;
      scene_count?: number;
      turning_points?: string[];
      midpoint_intensity?: number;
      climax_escalation?: string;
    };
    character_temperature_chart?: CharacterTemp[];
  };
  department_doctrines?: Record<string, DepartmentDoctrine>;
  non_negotiables?: string[];
  style_contract_summary?: {
    final_vector?: Record<string, number>;
    primary_director?: string;
    secondary_director?: string | null;
    blend_weight?: number;
    cluster?: string;
    quadrant?: string;
    emotional_depth_tier?: string;
    lighting_snapshot?: string;
    lens_snapshot?: string;
    color_texture_snapshot?: string;
    editing_rhythm_bias?: string;
  };
  cic_configuration?: {
    engine_neutral_payload?: {
      movement_policy?: string;
      color_palette?: string[];
      texture_rules?: string[];
      framing_rules?: string[];
      editing_bias?: string;
      negative_constraints?: string[];
    };
    constraint_enforcement_level?: string;
    prompt_layering_model?: {
      layer_1_scene_intent?: string;
      layer_2_character_location_locks?: string;
      layer_3_style_mandate?: string;
      layer_4_engine_enhancements?: string;
      layer_5_constraint_filters?: string;
    };
    engine_compilers?: Record<string, EngineCompiler>;
    blend_director_logic?: {
      interpolation_method?: string;
      conflict_resolution?: string;
      merge_rules?: string[];
    };
    vice_integration?: {
      color_lut_bias?: string;
      grain_bias?: string;
      lighting_consistency?: string;
      lens_distortion_consistency?: string;
      depth_of_field_consistency?: string;
    };
    character_consistency?: {
      facial_geometry?: string;
      wardrobe_compliance?: string;
      color_compliance?: string;
      silhouette_integrity?: string;
      prohibited_mutations?: string[];
    };
    post_generation_validation?: {
      frame_sampling_strategy?: string;
      compliance_scoring_method?: string;
      deviation_tolerance?: string;
      auto_regeneration_policy?: string;
    };
  };
}

const DEPT_LABELS: Record<string, string> = {
  camera: "Camera Department",
  production_design: "Production Design",
  wardrobe: "Wardrobe",
  props: "Props",
  casting_performance: "Casting & Performance",
  editing: "Editing",
  sound_score: "Sound & Score",
};

const ENGINE_LABELS: Record<string, string> = {
  veo: "Veo Compiler",
  sora: "Sora Compiler",
  seedance: "Seedance Compiler",
};

// ── Layout constants (US Letter in mm) ──
const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN_L = 20;
const MARGIN_R = 20;
const MARGIN_T = 25;
const MARGIN_B = 20;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const FOOTER_Y = PAGE_H - 12;

// ── Colors ──
const C_BG = [10, 15, 28] as const;
const C_CARD = [16, 22, 38] as const;
const C_PRIMARY = [47, 125, 255] as const;
const C_TEXT = [230, 235, 245] as const;
const C_MUTED = [140, 150, 170] as const;
const C_BORDER = [35, 42, 58] as const;
const C_DANGER = [255, 70, 100] as const;
const C_SUCCESS = [34, 197, 94] as const;

class BiblePdfBuilder {
  private doc: jsPDF;
  private y = MARGIN_T;
  private pageNum = 1;
  private filmTitle: string;

  constructor(filmTitle: string) {
    this.filmTitle = filmTitle;
    this.doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    this.setBackground();
  }

  // ── Page management ──

  private setBackground() {
    this.doc.setFillColor(...C_BG);
    this.doc.rect(0, 0, PAGE_W, PAGE_H, "F");
    this.drawFooter();
  }

  private drawFooter() {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...C_MUTED);
    this.doc.text(`${this.filmTitle} — Production Bible`, MARGIN_L, FOOTER_Y);
    this.doc.text(`Page ${this.pageNum}`, PAGE_W - MARGIN_R, FOOTER_Y, { align: "right" });
    this.doc.setDrawColor(...C_BORDER);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGIN_L, FOOTER_Y - 4, PAGE_W - MARGIN_R, FOOTER_Y - 4);
  }

  private checkPage(needed: number) {
    if (this.y + needed > PAGE_H - MARGIN_B - 10) {
      this.newPage();
    }
  }

  private newPage() {
    this.doc.addPage("letter", "portrait");
    this.pageNum++;
    this.y = MARGIN_T;
    this.setBackground();
  }

  // ── Drawing primitives ──

  private sectionTitle(title: string) {
    this.checkPage(16);
    this.doc.setFillColor(...C_PRIMARY);
    this.doc.rect(MARGIN_L, this.y, 3, 8, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(13);
    this.doc.setTextColor(...C_TEXT);
    this.doc.text(title.toUpperCase(), MARGIN_L + 7, this.y + 6);
    this.y += 14;
  }

  private subHeading(text: string) {
    this.checkPage(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...C_PRIMARY);
    this.doc.text(text.toUpperCase(), MARGIN_L + 2, this.y + 4);
    this.y += 8;
  }

  private label(text: string) {
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...C_MUTED);
    this.doc.text(text.toUpperCase(), MARGIN_L + 4, this.y);
  }

  private value(text: string, x?: number) {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...C_TEXT);
    const lines = this.doc.splitTextToSize(text, CONTENT_W - 8);
    this.doc.text(lines, x ?? MARGIN_L + 4, this.y);
    this.y += lines.length * 4;
  }

  private fieldRow(lbl: string, val: string | boolean | number | null | undefined) {
    if (val === undefined || val === null || val === "") return;
    this.checkPage(10);
    this.label(lbl);
    this.y += 4;
    this.value(typeof val === "boolean" ? (val ? "Yes" : "No") : String(val));
    this.y += 2;
  }

  private bulletList(items: string[], color: readonly [number, number, number] = C_TEXT) {
    for (const item of items) {
      this.checkPage(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...color);
      const lines = this.doc.splitTextToSize(`• ${item}`, CONTENT_W - 10);
      this.doc.text(lines, MARGIN_L + 6, this.y);
      this.y += lines.length * 3.8 + 1.5;
    }
  }

  private separator() {
    this.y += 2;
    this.doc.setDrawColor(...C_BORDER);
    this.doc.setLineWidth(0.2);
    this.doc.line(MARGIN_L + 4, this.y, PAGE_W - MARGIN_R - 4, this.y);
    this.y += 4;
  }

  // ── Cover page ──

  private renderCover(bible: ProductionBibleContent) {
    this.y = 80;
    this.doc.setFillColor(...C_PRIMARY);
    this.doc.rect(PAGE_W / 2 - 30, this.y, 60, 1.5, "F");
    this.y += 12;

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(28);
    this.doc.setTextColor(...C_TEXT);
    this.doc.text("PRODUCTION BIBLE", PAGE_W / 2, this.y, { align: "center" });
    this.y += 14;

    this.doc.setFontSize(16);
    this.doc.setTextColor(...C_PRIMARY);
    this.doc.text(this.filmTitle.toUpperCase(), PAGE_W / 2, this.y, { align: "center" });
    this.y += 20;

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...C_MUTED);

    if (bible.version) {
      this.doc.text(`Version ${bible.version}`, PAGE_W / 2, this.y, { align: "center" });
      this.y += 6;
    }
    if (bible.generated_at) {
      this.doc.text(
        `Generated ${new Date(bible.generated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        PAGE_W / 2, this.y, { align: "center" }
      );
      this.y += 6;
    }

    this.y += 20;
    this.doc.setFillColor(...C_PRIMARY);
    this.doc.rect(PAGE_W / 2 - 30, this.y, 60, 1.5, "F");

    this.y = PAGE_H - 45;
    this.doc.setFontSize(7);
    this.doc.setTextColor(...C_MUTED);
    this.doc.text("CONFIDENTIAL — FOR PRODUCTION USE ONLY", PAGE_W / 2, this.y, { align: "center" });
  }

  // ── Section renderers ──

  private renderCoreIdentity(ci: NonNullable<ProductionBibleContent["core_identity"]>) {
    this.sectionTitle("Core Cinematic Identity");

    // Director Match Metadata
    if (ci.director_match_metadata) {
      this.checkPage(20);
      this.subHeading("Director Match");
      this.fieldRow("Primary Director", ci.director_match_metadata.primary_director);
      this.fieldRow("Secondary Director", ci.director_match_metadata.secondary_director);
      this.fieldRow("Cluster", ci.director_match_metadata.cluster);
      this.fieldRow("Quadrant", ci.director_match_metadata.quadrant);
      this.fieldRow("Emotional Depth Tier", ci.director_match_metadata.emotional_depth_tier);
      this.y += 2;
    }

    // Axis interpretations
    if (ci.axis_interpretations?.length) {
      for (const axis of ci.axis_interpretations) {
        this.checkPage(25);
        this.subHeading(axis.axis);

        // Score bar
        this.doc.setFillColor(30, 35, 50);
        this.doc.roundedRect(MARGIN_L + 4, this.y, 60, 4, 1, 1, "F");
        this.doc.setFillColor(...C_PRIMARY);
        this.doc.roundedRect(MARGIN_L + 4, this.y, (axis.score / 10) * 60, 4, 1, 1, "F");
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...C_TEXT);
        this.doc.text(`${axis.score}/10`, MARGIN_L + 68, this.y + 3);
        this.y += 8;

        this.value(axis.interpretation);
        this.y += 2;

        if (axis.department_implications?.length) {
          this.doc.setFont("helvetica", "italic");
          this.doc.setFontSize(7);
          this.doc.setTextColor(...C_MUTED);
          const implText = axis.department_implications.join("  ·  ");
          const lines = this.doc.splitTextToSize(implText, CONTENT_W - 8);
          this.doc.text(lines, MARGIN_L + 4, this.y);
          this.y += lines.length * 3.5 + 3;
        }
        this.y += 2;
      }
    }

    // Director summary
    if (ci.director_summary) {
      this.checkPage(20);
      this.subHeading("Director Match Analysis");
      if (ci.director_summary.match_reasoning) {
        this.fieldRow("Match Reasoning", ci.director_summary.match_reasoning);
      }
      if (ci.director_summary.aesthetic_tensions) {
        this.fieldRow("Aesthetic Tensions", ci.director_summary.aesthetic_tensions);
      }
      if (ci.director_summary.blend_effect_summary) {
        this.fieldRow("Blend Effect", ci.director_summary.blend_effect_summary);
      }
    }
    this.y += 4;
  }

  private renderVisualMandate(vm: NonNullable<ProductionBibleContent["visual_mandate"]>) {
    this.sectionTitle("Visual Mandate");

    if (vm.lighting_doctrine) {
      this.subHeading("Lighting Doctrine");
      this.fieldRow("Key-to-Fill Ratio", vm.lighting_doctrine.key_to_fill_ratio);
      this.fieldRow("Natural vs Stylized", vm.lighting_doctrine.natural_vs_stylized);
      this.fieldRow("Top Light Policy", vm.lighting_doctrine.top_light_policy);
      this.fieldRow("Motivated vs Expressionistic", vm.lighting_doctrine.motivated_vs_expressionistic);
      this.y += 2;
    }

    if (vm.lens_doctrine) {
      this.subHeading("Lens & Camera Philosophy");
      this.fieldRow("Preferred Focal Range", vm.lens_doctrine.preferred_focal_range);
      this.fieldRow("Movement Policy", vm.lens_doctrine.movement_policy);
      this.fieldRow("Handheld Allowed", vm.lens_doctrine.handheld_allowed);
      this.fieldRow("Push-In Frequency", vm.lens_doctrine.push_in_frequency);
      this.fieldRow("Shot Duration", vm.lens_doctrine.shot_duration_expectation);
      this.y += 2;
    }

    if (vm.color_texture_authority) {
      const cta = vm.color_texture_authority;
      this.subHeading("Color & Texture Authority");
      if (cta.base_palette?.length) {
        this.fieldRow("Base Palette", cta.base_palette.join(", "));
      }
      if (cta.accent_colors?.length) {
        this.fieldRow("Accent Colors", cta.accent_colors.join(", "));
      }
      this.fieldRow("Saturation Policy", cta.saturation_policy);
      if (cta.fabric_classes?.length) {
        this.fieldRow("Fabric Classes", cta.fabric_classes.join(", "));
      }
      this.fieldRow("Surface Finish", cta.surface_finish_guidance);
    }
    this.y += 4;
  }

  private renderStoryIntelligence(si: NonNullable<ProductionBibleContent["story_intelligence"]>) {
    this.sectionTitle("Story Structure Intelligence");

    if (si.structure_map) {
      this.subHeading("Structural Map");
      this.fieldRow("Archetype", si.structure_map.archetype);
      this.fieldRow("Pacing Curve", si.structure_map.pacing_curve);
      this.fieldRow("Emotional Escalation", si.structure_map.emotional_escalation_map);
      this.fieldRow("Scene Count", si.structure_map.scene_count);
      this.fieldRow("Midpoint Intensity", si.structure_map.midpoint_intensity != null ? `${si.structure_map.midpoint_intensity}/10` : undefined);
      this.fieldRow("Climax Escalation", si.structure_map.climax_escalation);
      if (si.structure_map.turning_points?.length) {
        this.label("Turning Points");
        this.y += 4;
        this.bulletList(si.structure_map.turning_points, C_TEXT);
      }
      this.y += 2;
    }

    if (si.character_temperature_chart?.length) {
      this.subHeading("Character Emotional Temperature");
      for (const ct of si.character_temperature_chart) {
        this.checkPage(18);

        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(9);
        this.doc.setTextColor(...C_TEXT);
        this.doc.text(ct.character_name, MARGIN_L + 4, this.y);
        this.y += 5;

        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(7.5);
        this.doc.setTextColor(...C_MUTED);
        const stats = `Baseline: ${ct.emotional_baseline}/10  |  Peak: ${ct.emotional_peak}/10  |  Dialogue: ${Math.round(ct.dialogue_density_contribution * 100)}%`;
        this.doc.text(stats, MARGIN_L + 4, this.y);
        this.y += 4;

        if (ct.power_shift_moments?.length) {
          this.doc.setFontSize(7);
          this.doc.text(`Key Moments: ${ct.power_shift_moments.join(", ")}`, MARGIN_L + 4, this.y);
          this.y += 4;
        }
        this.y += 3;
      }
    }
    this.y += 4;
  }

  private renderDepartments(dd: Record<string, DepartmentDoctrine>) {
    this.sectionTitle("Department Doctrines");

    for (const [key, doctrine] of Object.entries(dd)) {
      const name = DEPT_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      this.checkPage(20);
      this.subHeading(name);

      this.fieldRow("Primary Objective", doctrine.primary_objective);

      if (doctrine.governing_constraints?.length) {
        this.label("Governing Constraints");
        this.y += 4;
        this.bulletList(doctrine.governing_constraints, C_TEXT);
      }

      if (doctrine.motif_alignment) {
        this.fieldRow("Motif Alignment", doctrine.motif_alignment);
      }

      if (doctrine.forbidden_moves?.length) {
        this.label("Forbidden Moves");
        this.y += 4;
        this.bulletList(doctrine.forbidden_moves, C_DANGER);
      }
      this.separator();
    }
    this.y += 2;
  }

  private renderNonNegotiables(nn: string[]) {
    this.sectionTitle("Non-Negotiables");
    this.bulletList(nn, C_DANGER);
    this.y += 4;
  }

  private renderStyleContract(scs: NonNullable<ProductionBibleContent["style_contract_summary"]>, cic?: ProductionBibleContent["cic_configuration"]) {
    this.sectionTitle("Style Contract & CIC Configuration");

    // 6.1 Aesthetic Fingerprint
    this.subHeading("Aesthetic Fingerprint");
    this.fieldRow("Primary Director", scs.primary_director);
    this.fieldRow("Secondary Director", scs.secondary_director);
    this.fieldRow("Cluster", scs.cluster);
    this.fieldRow("Quadrant", scs.quadrant);
    this.fieldRow("Emotional Depth", scs.emotional_depth_tier);
    if (scs.blend_weight != null) {
      this.fieldRow("Blend Weight", `${scs.blend_weight}%`);
    }
    this.fieldRow("Lighting Snapshot", scs.lighting_snapshot);
    this.fieldRow("Lens Snapshot", scs.lens_snapshot);
    this.fieldRow("Color & Texture", scs.color_texture_snapshot);
    this.fieldRow("Editing Rhythm", scs.editing_rhythm_bias);
    this.y += 2;

    // Final vector
    if (scs.final_vector) {
      this.checkPage(20);
      this.subHeading("Final Computed Vector");
      const entries = Object.entries(scs.final_vector);
      for (let i = 0; i < entries.length; i += 4) {
        const row = entries.slice(i, i + 4);
        this.checkPage(10);
        let x = MARGIN_L + 4;
        for (const [axis, score] of row) {
          const label = axis.replace(/([A-Z])/g, " $1").trim();
          this.doc.setFont("helvetica", "normal");
          this.doc.setFontSize(7);
          this.doc.setTextColor(...C_MUTED);
          this.doc.text(label.toUpperCase(), x, this.y);
          this.doc.setFont("helvetica", "bold");
          this.doc.setFontSize(10);
          this.doc.setTextColor(...C_PRIMARY);
          this.doc.text(`${score}`, x, this.y + 5);
          x += 40;
        }
        this.y += 12;
      }
    }

    // CIC Core
    if (cic) {
      this.checkPage(15);
      this.subHeading("Cinematic Intent Compiler");
      this.fieldRow("Enforcement Level", cic.constraint_enforcement_level);
      if (cic.engine_neutral_payload?.negative_constraints?.length) {
        this.label("Negative Constraints");
        this.y += 4;
        this.bulletList(cic.engine_neutral_payload.negative_constraints, C_DANGER);
      }
      if (cic.engine_neutral_payload?.framing_rules?.length) {
        this.label("Framing Rules");
        this.y += 4;
        this.bulletList(cic.engine_neutral_payload.framing_rules, C_TEXT);
      }
      this.fieldRow("Movement Policy", cic.engine_neutral_payload?.movement_policy);
      this.fieldRow("Editing Bias", cic.engine_neutral_payload?.editing_bias);
      this.y += 4;

      // 6.5 Engine Compilers
      if (cic.engine_compilers && Object.keys(cic.engine_compilers).length > 0) {
        this.subHeading("Engine-Specific Compilers");
        for (const [key, compiler] of Object.entries(cic.engine_compilers)) {
          this.checkPage(25);
          const name = ENGINE_LABELS[key] || key.toUpperCase();
          this.doc.setFont("helvetica", "bold");
          this.doc.setFontSize(8);
          this.doc.setTextColor(...C_TEXT);
          this.doc.text(name, MARGIN_L + 4, this.y);
          if (compiler.intensity_multiplier != null) {
            this.doc.setTextColor(...C_PRIMARY);
            this.doc.text(`${compiler.intensity_multiplier}×`, MARGIN_L + 70, this.y);
          }
          this.y += 5;

          if (compiler.prompt_strategy) {
            this.value(compiler.prompt_strategy);
            this.y += 1;
          }
          if (compiler.key_translations?.length) {
            this.label("Key Translations");
            this.y += 4;
            this.bulletList(compiler.key_translations, C_MUTED);
          }
          if (compiler.strengths?.length) {
            this.fieldRow("Strengths", compiler.strengths.join(", "));
          }
          if (compiler.constraints?.length) {
            this.label("Constraints");
            this.y += 4;
            this.bulletList(compiler.constraints, C_DANGER);
          }
          this.separator();
        }
      }

      // 6.7 Prompt Layering
      if (cic.prompt_layering_model) {
        this.subHeading("Prompt Layering Model");
        this.fieldRow("Layer 1 — Scene Intent", cic.prompt_layering_model.layer_1_scene_intent);
        this.fieldRow("Layer 2 — Character/Location Locks", cic.prompt_layering_model.layer_2_character_location_locks);
        this.fieldRow("Layer 3 — Style Mandate", cic.prompt_layering_model.layer_3_style_mandate);
        this.fieldRow("Layer 4 — Engine Enhancements", cic.prompt_layering_model.layer_4_engine_enhancements);
        this.fieldRow("Layer 5 — Constraint Filters", cic.prompt_layering_model.layer_5_constraint_filters);
        this.y += 2;
      }

      // 6.8 Blend Director Logic
      if (cic.blend_director_logic) {
        this.subHeading("Blend Director Logic");
        this.fieldRow("Interpolation Method", cic.blend_director_logic.interpolation_method);
        this.fieldRow("Conflict Resolution", cic.blend_director_logic.conflict_resolution);
        if (cic.blend_director_logic.merge_rules?.length) {
          this.label("Merge Rules");
          this.y += 4;
          this.bulletList(cic.blend_director_logic.merge_rules, C_TEXT);
        }
        this.y += 2;
      }

      // 6.9 VICE Integration
      if (cic.vice_integration) {
        this.subHeading("VICE Integration");
        this.fieldRow("Color LUT Bias", cic.vice_integration.color_lut_bias);
        this.fieldRow("Grain Bias", cic.vice_integration.grain_bias);
        this.fieldRow("Lighting Consistency", cic.vice_integration.lighting_consistency);
        this.fieldRow("Lens Distortion Consistency", cic.vice_integration.lens_distortion_consistency);
        this.fieldRow("Depth of Field Consistency", cic.vice_integration.depth_of_field_consistency);
        this.y += 2;
      }

      // 6.10 Character Consistency
      if (cic.character_consistency) {
        this.subHeading("Character Consistency Integration");
        this.fieldRow("Facial Geometry", cic.character_consistency.facial_geometry);
        this.fieldRow("Wardrobe Compliance", cic.character_consistency.wardrobe_compliance);
        this.fieldRow("Color Compliance", cic.character_consistency.color_compliance);
        this.fieldRow("Silhouette Integrity", cic.character_consistency.silhouette_integrity);
        if (cic.character_consistency.prohibited_mutations?.length) {
          this.label("Prohibited Mutations");
          this.y += 4;
          this.bulletList(cic.character_consistency.prohibited_mutations, C_DANGER);
        }
        this.y += 2;
      }

      // 6.11 Post-Generation Validation
      if (cic.post_generation_validation) {
        this.subHeading("Post-Generation Validation");
        this.fieldRow("Frame Sampling Strategy", cic.post_generation_validation.frame_sampling_strategy);
        this.fieldRow("Compliance Scoring", cic.post_generation_validation.compliance_scoring_method);
        this.fieldRow("Deviation Tolerance", cic.post_generation_validation.deviation_tolerance);
        this.fieldRow("Auto-Regeneration Policy", cic.post_generation_validation.auto_regeneration_policy);
      }
    }
  }

  // ── Public API ──

  generate(bible: ProductionBibleContent): jsPDF {
    this.renderCover(bible);
    this.newPage();

    if (bible.core_identity) {
      this.renderCoreIdentity(bible.core_identity);
    }
    if (bible.visual_mandate) {
      this.renderVisualMandate(bible.visual_mandate);
    }
    if (bible.story_intelligence) {
      this.renderStoryIntelligence(bible.story_intelligence);
    }
    if (bible.department_doctrines && Object.keys(bible.department_doctrines).length > 0) {
      this.renderDepartments(bible.department_doctrines);
    }
    if (bible.non_negotiables?.length) {
      this.renderNonNegotiables(bible.non_negotiables);
    }
    if (bible.style_contract_summary) {
      this.renderStyleContract(bible.style_contract_summary, bible.cic_configuration);
    }

    return this.doc;
  }
}

export function downloadProductionBiblePdf(bible: ProductionBibleContent, filmTitle: string) {
  const builder = new BiblePdfBuilder(filmTitle || "Untitled Film");
  const doc = builder.generate(bible);
  const safeName = filmTitle.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  doc.save(`${safeName}_production_bible_v${bible.version || 1}.pdf`);
}