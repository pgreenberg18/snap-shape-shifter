import { useEffect, useState, useRef, useCallback } from "react";
import {
  Upload, Type, CheckCircle, FileText, Sparkles, Loader2, Film, Eye,
  Camera, Palette, MapPin, Users, ChevronDown, ChevronUp, ThumbsUp,
  AlertTriangle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useContentSafety, FILM_ID } from "@/hooks/useFilm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/* ── Constants ── */
const ACCEPTED_EXTENSIONS = [".fdx", ".fountain", ".rtf", ".pdf", ".docx", ".sexp", ".mmsw", ".fdr", ".txt"];
const ACCEPTED_LABEL = ".fdx, .fountain, .rtf, .pdf, .docx, .sexp, .mmsw, .fdr";

/* ── Hooks ── */
const useLatestAnalysis = () =>
  useQuery({
    queryKey: ["script-analysis", FILM_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("script_analyses")
        .select("*")
        .eq("film_id", FILM_ID)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d && (d.status === "pending" || d.status === "analyzing")) return 3000;
      return false;
    },
  });

/* ── Main Page ── */
const Development = () => {
  const { data: safety } = useContentSafety();
  const { data: analysis, isLoading: analysisLoading } = useLatestAnalysis();
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState(false);
  const [nudity, setNudity] = useState(false);
  const [violence, setViolence] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadFile = useCallback(async (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast({ title: "Unsupported format", description: `Supported: ${ACCEPTED_LABEL}`, variant: "destructive" });
      return;
    }
    setUploading(true);
    const path = `${FILM_ID}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("scripts").upload(path, file);
    setUploading(false);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      setUploadedFile(file.name);
      setUploadedPath(path);
      toast({ title: "Script uploaded", description: file.name });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleAnalyze = async () => {
    if (!uploadedFile || !uploadedPath) return;
    setAnalyzing(true);

    const { data: record, error: insertErr } = await supabase
      .from("script_analyses")
      .insert({ film_id: FILM_ID, file_name: uploadedFile, storage_path: uploadedPath, status: "pending" })
      .select()
      .single();

    if (insertErr || !record) {
      toast({ title: "Failed to start analysis", description: insertErr?.message, variant: "destructive" });
      setAnalyzing(false);
      return;
    }

    const { error: invokeErr } = await supabase.functions.invoke("parse-script", {
      body: { analysis_id: record.id },
    });

    setAnalyzing(false);

    if (invokeErr) {
      toast({ title: "Analysis request failed", description: invokeErr.message, variant: "destructive" });
    } else {
      toast({ title: "Analysis started", description: "Your script is being analyzed — results will appear below." });
      queryClient.invalidateQueries({ queryKey: ["script-analysis"] });
    }
  };

  useEffect(() => {
    if (safety) {
      setLanguage(safety.language);
      setNudity(safety.nudity);
      setViolence(safety.violence);
    }
  }, [safety]);

  const updateSafety = async (field: string, value: boolean) => {
    if (!safety) return;
    await supabase.from("content_safety").update({ [field]: value }).eq("id", safety.id);
  };

  const handleToggle = (field: string, setter: (v: boolean) => void) => (val: boolean) => {
    setter(val);
    updateSafety(field, val);
  };

  const isAnalyzing = analyzing || analysis?.status === "pending" || analysis?.status === "analyzing";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">
      {/* ── Step 1: Script Upload ── */}
      <section>
        <h2 className="font-display text-2xl font-bold mb-4">1 · Upload Script</h2>
        <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS.join(",")} className="hidden" onChange={handleFileChange} />
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-16 transition-colors cursor-pointer backdrop-blur-md bg-card/50 ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          {uploadedFile ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-display font-semibold text-foreground flex items-center gap-2 justify-center">
                  <FileText className="h-5 w-5" /> {uploadedFile}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Click or drop to replace</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <Type className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-display font-semibold text-foreground">
                  {uploading ? "Uploading…" : "Drop your screenplay here"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{ACCEPTED_LABEL} — or click to browse</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-xs text-muted-foreground">
                <Upload className="h-3.5 w-3.5" />
                Upload Script
              </div>
            </>
          )}
        </div>

        {uploadedFile && (
          <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full mt-4 gap-2" size="lg">
            {isAnalyzing ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Analyzing Script…</>
            ) : (
              <><Sparkles className="h-4 w-4" />Analyze Script — Visual Breakdown</>
            )}
          </Button>
        )}
      </section>

      {/* ── Step 2: Analysis Results / Review Section ── */}
      {(isAnalyzing || analysis?.status === "complete" || analysis?.status === "error") && (
        <section>
          <h2 className="font-display text-2xl font-bold mb-4">2 · Review Visual Breakdown</h2>

          {/* Loading state */}
          {isAnalyzing && (
            <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-display font-semibold text-lg">AI is analyzing your screenplay…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This may take 1-3 minutes depending on script length. Results will appear here automatically.
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {analysis?.status === "error" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="font-display font-semibold text-sm">Analysis Failed</p>
                <p className="text-sm text-muted-foreground">{analysis.error_message || "Unknown error"}</p>
              </div>
            </div>
          )}

          {/* Complete results */}
          {analysis?.status === "complete" && (
            <div className="space-y-6">
              {/* Visual Summary */}
              {analysis.visual_summary && (
                <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Film className="h-5 w-5 text-primary" />
                    <h3 className="font-display text-lg font-bold">Visual Story Summary</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{analysis.visual_summary}</p>
                </div>
              )}

              {/* Scene-by-Scene Breakdown */}
              {analysis.scene_breakdown && Array.isArray(analysis.scene_breakdown) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-primary" />
                      <h3 className="font-display text-lg font-bold">Scene-by-Scene Breakdown</h3>
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                        {(analysis.scene_breakdown as any[]).length} scenes
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Expand each scene to review the AI-generated visual intelligence. Approve scenes to lock them in for production.
                  </p>
                  {(analysis.scene_breakdown as any[]).map((scene: any, i: number) => (
                    <SceneReviewCard key={i} scene={scene} index={i} />
                  ))}
                </div>
              )}

              {/* Global Elements */}
              {analysis.global_elements && (
                <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <h3 className="font-display text-lg font-bold">Global Visual Elements</h3>
                  </div>
                  <GlobalElements data={analysis.global_elements as any} />
                </div>
              )}

              {/* AI Generation Notes */}
              {analysis.ai_generation_notes && typeof analysis.ai_generation_notes === "string" && (
                <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="font-display text-lg font-bold">AI Generation Notes</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{analysis.ai_generation_notes as string}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Step 3: Content Safety Matrix ── */}
      <section>
        <h2 className="font-display text-2xl font-bold mb-4">3 · Content Safety Matrix</h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <Tabs defaultValue="auto" className="w-full">
            <TabsList className="w-full bg-secondary mb-6">
              <TabsTrigger value="auto" className="flex-1">Auto</TabsTrigger>
              <TabsTrigger value="templates" className="flex-1">Templates</TabsTrigger>
              <TabsTrigger value="custom" className="flex-1">Custom</TabsTrigger>
            </TabsList>
            <TabsContent value="auto">
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <span className="text-2xl">🤖</span>
                </div>
                <p className="font-display font-semibold text-lg">AI Auto-Detection</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Content safety ratings will be automatically classified by AI based on your uploaded script.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="templates">
              <div className="grid grid-cols-3 gap-3">
                {["PG — Family Friendly", "PG-13 — Teen Audiences", "R — Mature Content"].map((t) => (
                  <button key={t} className="rounded-lg border border-border bg-secondary p-4 text-sm font-medium text-foreground hover:border-primary/50 transition-colors text-center">
                    {t}
                  </button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="custom">
              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                  <Label htmlFor="language" className="text-sm font-medium cursor-pointer">Language</Label>
                  <Switch id="language" checked={language} onCheckedChange={handleToggle("language", setLanguage)} />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                  <Label htmlFor="nudity" className="text-sm font-medium cursor-pointer">Nudity</Label>
                  <Switch id="nudity" checked={nudity} onCheckedChange={handleToggle("nudity", setNudity)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                    <Label htmlFor="violence" className="text-sm font-medium cursor-pointer">Violence</Label>
                    <Switch id="violence" checked={violence} onCheckedChange={handleToggle("violence", setViolence)} />
                  </div>
                  {violence && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-amber-400 text-sm animate-fade-in">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Violence flag enabled — content may be restricted on some platforms.</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
};

/* ══════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════ */

const SceneReviewCard = ({ scene, index }: { scene: any; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const [approved, setApproved] = useState(false);

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${approved ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold font-mono">
            {scene.scene_number ?? index + 1}
          </span>
          <div>
            <p className="font-display font-semibold text-sm">{scene.scene_heading || "Untitled Scene"}</p>
            <p className="text-xs text-muted-foreground">{scene.int_ext} · {scene.time_of_day}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {approved && (
            <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5 font-medium">Approved</span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border p-5 space-y-5 text-sm">
          {scene.description && <p className="text-muted-foreground">{scene.description}</p>}

          {/* Visual Design */}
          {scene.visual_design && (
            <Section icon={Palette} label="Visual Design">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {scene.visual_design.atmosphere && <Tag label="Atmosphere" value={scene.visual_design.atmosphere} />}
                {scene.visual_design.lighting_style && <Tag label="Lighting" value={scene.visual_design.lighting_style} />}
                {scene.visual_design.color_palette && <Tag label="Palette" value={scene.visual_design.color_palette} />}
                {scene.visual_design.visual_references && <Tag label="References" value={scene.visual_design.visual_references} />}
              </div>
            </Section>
          )}

          {/* Characters */}
          {scene.characters?.length > 0 && (
            <Section icon={Users} label="Characters">
              <div className="space-y-1">
                {scene.characters.map((c: any, i: number) => (
                  <p key={i} className="text-muted-foreground">
                    <span className="text-foreground font-medium">{c.name}</span> — {c.emotional_tone}
                    {c.key_expressions ? ` · ${c.key_expressions}` : ""}
                  </p>
                ))}
              </div>
            </Section>
          )}

          {/* Wardrobe */}
          {scene.wardrobe?.length > 0 && (
            <Section icon={Users} label="Wardrobe">
              <div className="space-y-1 text-xs">
                {scene.wardrobe.map((w: any, i: number) => (
                  <p key={i} className="text-muted-foreground">
                    <span className="text-foreground font-medium">{w.character}</span>: {w.clothing_style}
                    {w.condition ? ` (${w.condition})` : ""}
                    {w.hair_makeup ? ` — ${w.hair_makeup}` : ""}
                  </p>
                ))}
              </div>
            </Section>
          )}

          {/* Cinematic Elements */}
          {scene.cinematic_elements && (
            <Section icon={Camera} label="Cinematic Elements">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {scene.cinematic_elements.camera_feel && <Tag label="Camera" value={scene.cinematic_elements.camera_feel} />}
                {scene.cinematic_elements.motion_cues && <Tag label="Motion" value={scene.cinematic_elements.motion_cues} />}
              </div>
              {scene.cinematic_elements.shot_suggestions?.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="text-foreground">Shots:</span> {scene.cinematic_elements.shot_suggestions.join(" · ")}
                </p>
              )}
            </Section>
          )}

          {/* Environment & Props */}
          {(scene.environment_details || scene.key_objects?.length > 0) && (
            <Section icon={MapPin} label="Environment & Props">
              {scene.environment_details && <p className="text-xs text-muted-foreground">{scene.environment_details}</p>}
              {scene.key_objects?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {scene.key_objects.map((obj: string, i: number) => (
                    <span key={i} className="text-xs bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 border border-border">{obj}</span>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* AI Generation Prompts */}
          {(scene.image_prompt || scene.video_prompt) && (
            <Section icon={Sparkles} label="AI Generation Prompts">
              {scene.image_prompt && (
                <div className="space-y-1">
                  <p className="text-xs font-mono text-primary/70">IMAGE PROMPT</p>
                  <pre className="text-xs text-muted-foreground bg-secondary rounded-lg p-3 whitespace-pre-wrap font-mono">{scene.image_prompt}</pre>
                </div>
              )}
              {scene.video_prompt && (
                <div className="space-y-1 mt-2">
                  <p className="text-xs font-mono text-primary/70">VIDEO PROMPT</p>
                  <pre className="text-xs text-muted-foreground bg-secondary rounded-lg p-3 whitespace-pre-wrap font-mono">{scene.video_prompt}</pre>
                </div>
              )}
            </Section>
          )}

          {/* Continuity Flags */}
          {scene.continuity_flags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {scene.continuity_flags.map((flag: string, i: number) => (
                <span key={i} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-0.5">{flag}</span>
              ))}
            </div>
          )}

          {/* Approve button */}
          <div className="pt-2 flex justify-end">
            <Button
              variant={approved ? "secondary" : "default"}
              size="sm"
              className="gap-1.5"
              onClick={() => setApproved(!approved)}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              {approved ? "Approved ✓" : "Approve Scene"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const Section = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-1.5 text-primary">
      <Icon className="h-3.5 w-3.5" />
      <span className="font-semibold text-xs uppercase tracking-wider">{label}</span>
    </div>
    {children}
  </div>
);

const Tag = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-secondary rounded-lg px-3 py-2">
    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-foreground">{value}</p>
  </div>
);

const GlobalElements = ({ data }: { data: any }) => {
  const sections = [
    { key: "recurring_locations", label: "Recurring Locations" },
    { key: "recurring_props", label: "Recurring Props" },
    { key: "recurring_wardrobe", label: "Recurring Wardrobe" },
    { key: "visual_motifs", label: "Visual Motifs" },
  ];

  return (
    <div className="space-y-3">
      {sections.map(({ key, label }) => {
        const items = data[key];
        if (!items || !Array.isArray(items) || items.length === 0) return null;
        return (
          <div key={key}>
            <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item: string, i: number) => (
                <span key={i} className="text-xs bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 border border-border">{item}</span>
              ))}
            </div>
          </div>
        );
      })}
      {data.signature_style && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">Signature Style</p>
          <p className="text-sm text-muted-foreground">{data.signature_style}</p>
        </div>
      )}
    </div>
  );
};

export default Development;
