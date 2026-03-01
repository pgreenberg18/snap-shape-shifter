import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFilmId, useFilm } from "@/hooks/useFilm";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BookOpen, ChevronDown, RefreshCw, Loader2, CheckCircle, AlertCircle,
  Camera, Palette, Film, Users, Scissors, Music, Clapperboard, Eye,
  ShieldAlert, Layers, Target, Ban, Lightbulb, Aperture, PaintBucket,
  Download
} from "lucide-react";
import { downloadProductionBiblePdf } from "@/lib/production-bible-pdf";

// ═══════════════════════════════════════════════════════════
// TYPES
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

interface ProductionBibleContent {
  film_id?: string;
  version?: number;
  generated_at?: string;
  data_sources?: any;
  core_identity?: {
    axis_interpretations?: AxisInterpretation[];
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
  };
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

const SectionHeader = ({ icon: Icon, title, children }: { icon: any; title: string; children?: React.ReactNode }) => (
  <CollapsibleTrigger className="w-full">
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/30 transition-colors cursor-pointer">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="font-display text-sm font-bold tracking-wide uppercase">{title}</h4>
      </div>
      <div className="flex items-center gap-2">
        {children}
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  </CollapsibleTrigger>
);

const DoctrineField = ({ label, value }: { label: string; value?: string | boolean | null }) => {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      <span className="text-xs text-foreground">{typeof value === "boolean" ? (value ? "Yes" : "No") : value}</span>
    </div>
  );
};

const DepartmentCard = ({ name, doctrine, icon: Icon }: { name: string; doctrine: DepartmentDoctrine; icon: any }) => (
  <Collapsible>
    <CollapsibleTrigger className="w-full">
      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/20 transition-colors cursor-pointer">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-display text-xs font-bold uppercase tracking-wide">{name}</span>
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="px-3 pb-3 pt-2 space-y-3 border border-t-0 border-border rounded-b-lg">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Primary Objective</span>
          <p className="text-xs text-foreground mt-0.5">{doctrine.primary_objective}</p>
        </div>
        {doctrine.governing_constraints?.length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Governing Constraints</span>
            <ul className="mt-1 space-y-1">
              {doctrine.governing_constraints.map((c, i) => (
                <li key={i} className="text-xs text-foreground flex gap-1.5">
                  <span className="text-primary mt-0.5">•</span> {c}
                </li>
              ))}
            </ul>
          </div>
        )}
        {doctrine.motif_alignment && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Motif Alignment</span>
            <p className="text-xs text-foreground mt-0.5">{doctrine.motif_alignment}</p>
          </div>
        )}
        {doctrine.forbidden_moves?.length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-destructive font-bold">Forbidden Moves</span>
            <ul className="mt-1 space-y-1">
              {doctrine.forbidden_moves.map((m, i) => (
                <li key={i} className="text-xs text-destructive/80 flex gap-1.5">
                  <Ban className="h-3 w-3 mt-0.5 shrink-0" /> {m}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CollapsibleContent>
  </Collapsible>
);

const DEPT_ICONS: Record<string, any> = {
  camera: Camera,
  production_design: Palette,
  wardrobe: Users,
  props: Layers,
  casting_performance: Users,
  editing: Scissors,
  sound_score: Music,
};

const DEPT_LABELS: Record<string, string> = {
  camera: "Camera Department",
  production_design: "Production Design",
  wardrobe: "Wardrobe",
  props: "Props",
  casting_performance: "Casting & Performance",
  editing: "Editing",
  sound_score: "Sound & Score",
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

const ProductionBiblePanel = () => {
  const filmId = useFilmId();
  const { data: film } = useFilm();
  const { toast } = useToast();
  const [bible, setBible] = useState<ProductionBibleContent | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [loading, setLoading] = useState(false);

  // Load existing bible from DB
  useEffect(() => {
    if (!filmId) return;
    (async () => {
      const { data } = await supabase
        .from("production_bibles")
        .select("*")
        .eq("film_id", filmId)
        .maybeSingle() as any;
      if (data) {
        setStatus(data.status);
        if (data.status === "complete" && data.content) {
          setBible(data.content as any);
        }
      }
    })();
  }, [filmId]);

  const generateBible = useCallback(async () => {
    if (!filmId || loading) return;
    setLoading(true);
    setStatus("generating");
    try {
      const { data, error } = await supabase.functions.invoke("generate-production-bible", {
        body: { film_id: filmId },
      });
      if (error) throw error;
      if (data?.content) {
        setBible(data.content);
        setStatus("complete");
        toast({ title: "Production Bible generated", description: `Version ${data.version}` });
      }
    } catch (e: any) {
      console.error("Bible generation failed:", e);
      setStatus("error");
      toast({ title: "Generation failed", description: e?.message || "Could not generate Production Bible", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filmId, loading, toast]);

  // ── Empty state ──
  if (!bible && status !== "generating") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-7 w-7 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-display text-base font-bold">Production Bible</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Generate the governing aesthetic contract for all departments. Aggregates your style vector, director match, visual mandate, and script analysis into enforceable production doctrine.
          </p>
        </div>
        <Button onClick={generateBible} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
          Generate Production Bible
        </Button>
      </div>
    );
  }

  if (status === "generating" && !bible) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating Production Bible…</p>
        <p className="text-[10px] text-muted-foreground">Analyzing style vectors, director mandates, and script structure</p>
      </div>
    );
  }

  if (!bible) return null;

  const ci = bible.core_identity;
  const vm = bible.visual_mandate;
  const si = bible.story_intelligence;
  const dd = bible.department_doctrines || {};
  const nn = bible.non_negotiables || [];
  const scs = bible.style_contract_summary;
  const cic = bible.cic_configuration;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-medium">v{bible.version || 1}</span>
          {bible.generated_at && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(bible.generated_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadProductionBiblePdf(bible, film?.title || "Untitled Film")}
            className="gap-1.5 h-7 text-xs"
          >
            <Download className="h-3 w-3" />
            Download PDF
          </Button>
          <Button size="sm" variant="outline" onClick={generateBible} disabled={loading} className="gap-1.5 h-7 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerate
          </Button>
        </div>
      </div>

      {/* ═══ SECTION 1: CORE CINEMATIC IDENTITY ═══ */}
      <Collapsible defaultOpen>
        <SectionHeader icon={Eye} title="Core Cinematic Identity">
          <Badge variant="outline" className="text-[10px]">{ci?.axis_interpretations?.length || 0} Axes</Badge>
        </SectionHeader>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-4">
            {/* Axis Interpretations */}
            {ci?.axis_interpretations?.map((axis, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-bold">{axis.axis}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(axis.score / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-primary">{axis.score}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{axis.interpretation}</p>
                {axis.department_implications?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {axis.department_implications.map((imp, j) => (
                      <span key={j} className="text-[10px] bg-accent/50 text-accent-foreground px-2 py-0.5 rounded-md">{imp}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Director Summary */}
            {ci?.director_summary && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Director Match Analysis</span>
                {ci.director_summary.match_reasoning && (
                  <div>
                    <span className="text-[10px] text-muted-foreground font-medium">Match Reasoning</span>
                    <p className="text-xs text-foreground">{ci.director_summary.match_reasoning}</p>
                  </div>
                )}
                {ci.director_summary.aesthetic_tensions && (
                  <div>
                    <span className="text-[10px] text-muted-foreground font-medium">Aesthetic Tensions</span>
                    <p className="text-xs text-foreground">{ci.director_summary.aesthetic_tensions}</p>
                  </div>
                )}
                {ci.director_summary.blend_effect_summary && (
                  <div>
                    <span className="text-[10px] text-muted-foreground font-medium">Blend Effect</span>
                    <p className="text-xs text-foreground">{ci.director_summary.blend_effect_summary}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ═══ SECTION 2: VISUAL MANDATE TRANSLATION ═══ */}
      {vm && (
        <Collapsible>
          <SectionHeader icon={Lightbulb} title="Visual Mandate" />
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-3">
              {/* Lighting */}
              {vm.lighting_doctrine && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="h-3 w-3 text-yellow-500" />
                    <span className="text-[10px] uppercase tracking-wider font-bold">Lighting Doctrine</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <DoctrineField label="Key-to-Fill Ratio" value={vm.lighting_doctrine.key_to_fill_ratio} />
                    <DoctrineField label="Natural vs Stylized" value={vm.lighting_doctrine.natural_vs_stylized} />
                    <DoctrineField label="Top Light Policy" value={vm.lighting_doctrine.top_light_policy} />
                    <DoctrineField label="Motivated vs Expressionistic" value={vm.lighting_doctrine.motivated_vs_expressionistic} />
                  </div>
                </div>
              )}

              {/* Lens */}
              {vm.lens_doctrine && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Aperture className="h-3 w-3 text-blue-500" />
                    <span className="text-[10px] uppercase tracking-wider font-bold">Lens & Camera Philosophy</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <DoctrineField label="Preferred Focal Range" value={vm.lens_doctrine.preferred_focal_range} />
                    <DoctrineField label="Movement Policy" value={vm.lens_doctrine.movement_policy} />
                    <DoctrineField label="Handheld Allowed" value={vm.lens_doctrine.handheld_allowed} />
                    <DoctrineField label="Push-In Frequency" value={vm.lens_doctrine.push_in_frequency} />
                    <DoctrineField label="Shot Duration" value={vm.lens_doctrine.shot_duration_expectation} />
                  </div>
                </div>
              )}

              {/* Color & Texture */}
              {vm.color_texture_authority && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <PaintBucket className="h-3 w-3 text-purple-500" />
                    <span className="text-[10px] uppercase tracking-wider font-bold">Color & Texture Authority</span>
                  </div>
                  {vm.color_texture_authority.base_palette?.length > 0 && (
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium">Base Palette</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {vm.color_texture_authority.base_palette.map((c, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {vm.color_texture_authority.accent_colors?.length > 0 && (
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium">Accent Colors</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {vm.color_texture_authority.accent_colors.map((c, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <DoctrineField label="Saturation Policy" value={vm.color_texture_authority.saturation_policy} />
                  {vm.color_texture_authority.fabric_classes?.length > 0 && (
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium">Fabric Classes</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {vm.color_texture_authority.fabric_classes.map((f, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <DoctrineField label="Surface Finish" value={vm.color_texture_authority.surface_finish_guidance} />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ═══ SECTION 3: STORY STRUCTURE INTELLIGENCE ═══ */}
      {si && (
        <Collapsible>
          <SectionHeader icon={Film} title="Story Intelligence" />
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-3">
              {si.structure_map && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold">Structural Map</span>
                  <DoctrineField label="Archetype" value={si.structure_map.archetype} />
                  <DoctrineField label="Pacing Curve" value={si.structure_map.pacing_curve} />
                  <DoctrineField label="Emotional Escalation" value={si.structure_map.emotional_escalation_map} />
                </div>
              )}

              {si.character_temperature_chart && si.character_temperature_chart.length > 0 && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold">Character Emotional Temperature</span>
                  <div className="space-y-3">
                    {si.character_temperature_chart.map((ct, i) => (
                      <div key={i} className="border border-border/50 rounded-md p-2 space-y-1.5">
                        <span className="text-xs font-bold text-foreground">{ct.character_name}</span>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] text-muted-foreground">Baseline</span>
                            <div className="flex items-center gap-1">
                              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(ct.emotional_baseline / 10) * 100}%` }} />
                              </div>
                              <span className="text-[10px] font-mono">{ct.emotional_baseline}</span>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">Peak</span>
                            <div className="flex items-center gap-1">
                              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${(ct.emotional_peak / 10) * 100}%` }} />
                              </div>
                              <span className="text-[10px] font-mono">{ct.emotional_peak}</span>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">Dialogue</span>
                            <span className="text-[10px] font-mono block">{Math.round(ct.dialogue_density_contribution * 100)}%</span>
                          </div>
                        </div>
                        {ct.power_shift_moments?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {ct.power_shift_moments.map((m, j) => (
                              <span key={j} className="text-[10px] bg-accent/50 px-1.5 py-0.5 rounded">{m}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ═══ SECTION 4: DEPARTMENT DOCTRINES ═══ */}
      {Object.keys(dd).length > 0 && (
        <Collapsible>
          <SectionHeader icon={Target} title="Department Doctrines">
            <Badge variant="outline" className="text-[10px]">{Object.keys(dd).length} Departments</Badge>
          </SectionHeader>
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-2">
              {Object.entries(dd).map(([key, doctrine]) => (
                <DepartmentCard
                  key={key}
                  name={DEPT_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  doctrine={doctrine}
                  icon={DEPT_ICONS[key] || Target}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ═══ SECTION 5: NON-NEGOTIABLES ═══ */}
      {nn.length > 0 && (
        <Collapsible>
          <SectionHeader icon={ShieldAlert} title="Non-Negotiables">
            <Badge variant="destructive" className="text-[10px]">{nn.length}</Badge>
          </SectionHeader>
          <CollapsibleContent>
            <div className="px-3 pb-3">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                {nn.map((rule, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <ShieldAlert className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                    <span className="text-xs text-foreground">{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ═══ SECTION 6: STYLE CONTRACT SUMMARY ═══ */}
      {scs && (
        <Collapsible>
          <SectionHeader icon={Clapperboard} title="Style Contract & CIC Configuration" />
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-3">
              {/* Summary */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-bold">Aesthetic Fingerprint</span>
                <div className="grid grid-cols-2 gap-3">
                  <DoctrineField label="Primary Director" value={scs.primary_director} />
                  <DoctrineField label="Secondary Director" value={scs.secondary_director} />
                  <DoctrineField label="Cluster" value={scs.cluster} />
                  <DoctrineField label="Quadrant" value={scs.quadrant} />
                  <DoctrineField label="Emotional Depth" value={scs.emotional_depth_tier} />
                  <DoctrineField label="Blend Weight" value={scs.blend_weight != null ? `${scs.blend_weight}%` : null} />
                </div>
                <DoctrineField label="Lighting Snapshot" value={scs.lighting_snapshot} />
                <DoctrineField label="Lens Snapshot" value={scs.lens_snapshot} />
                <DoctrineField label="Color & Texture" value={scs.color_texture_snapshot} />
                <DoctrineField label="Editing Rhythm" value={scs.editing_rhythm_bias} />
              </div>

              {/* Final Vector */}
              {scs.final_vector && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold">Final Computed Vector</span>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(scs.final_vector).map(([axis, score]) => (
                      <div key={axis} className="text-center">
                        <span className="text-[9px] text-muted-foreground uppercase block">{axis.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span className="text-sm font-mono font-bold text-primary">{score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CIC */}
              {cic && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Cinematic Intent Compiler</span>
                  <DoctrineField label="Enforcement Level" value={cic.constraint_enforcement_level} />
                  {cic.engine_neutral_payload?.negative_constraints?.length > 0 && (
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium">Negative Constraints</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {cic.engine_neutral_payload.negative_constraints.map((c, i) => (
                          <Badge key={i} variant="destructive" className="text-[10px]">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {cic.engine_neutral_payload?.framing_rules?.length > 0 && (
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium">Framing Rules</span>
                      <ul className="mt-0.5 space-y-0.5">
                        {cic.engine_neutral_payload.framing_rules.map((r, i) => (
                          <li key={i} className="text-[10px] text-foreground">• {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <DoctrineField label="Movement Policy" value={cic.engine_neutral_payload?.movement_policy} />
                  <DoctrineField label="Editing Bias" value={cic.engine_neutral_payload?.editing_bias} />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default ProductionBiblePanel;
