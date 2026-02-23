import { useEffect, useState, useRef, useCallback } from "react";
import {
  Upload, Type, CheckCircle, FileText, Sparkles, Loader2, Film, Eye,
  Camera, Palette, MapPin, Users, ChevronDown, ChevronUp, ThumbsUp,
  AlertTriangle, ScrollText, X, Plus, LocateFixed,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
                <SceneBreakdownSection scenes={analysis.scene_breakdown as any[]} storagePath={analysis.storage_path} />
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
const SceneBreakdownSection = ({ scenes, storagePath }: { scenes: any[]; storagePath: string }) => {
  const [approvedSet, setApprovedSet] = useState<Set<number>>(new Set());
  const allApproved = approvedSet.size === scenes.length;

  const toggleApprove = (i: number) => {
    setApprovedSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (allApproved) {
      setApprovedSet(new Set());
    } else {
      setApprovedSet(new Set(scenes.map((_, i) => i)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-bold">Scene-by-Scene Breakdown</h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {scenes.length} scenes
          </span>
        </div>
        <Button variant={allApproved ? "secondary" : "default"} size="sm" className="gap-1.5" onClick={toggleAll}>
          <ThumbsUp className="h-3.5 w-3.5" />
          {allApproved ? "Unapprove All" : "Approve All"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Expand each scene to review the AI-generated visual intelligence. Approve scenes to lock them in for production.
      </p>
      {scenes.map((scene: any, i: number) => (
        <SceneReviewCard key={i} scene={scene} index={i} storagePath={storagePath} approved={approvedSet.has(i)} onToggleApproved={() => toggleApprove(i)} />
      ))}
    </div>
  );
};

const SceneReviewCard = ({ scene, index, storagePath, approved, onToggleApproved }: { scene: any; index: number; storagePath: string; approved: boolean; onToggleApproved: () => void }) => {
  const [expanded, setExpanded] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptParagraphs, setScriptParagraphs] = useState<{ type: string; text: string }[] | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);

  const parseFdxScene = (xml: string): { type: string; text: string }[] => {
    const heading = scene.scene_heading?.trim();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const paragraphs = Array.from(doc.querySelectorAll("Paragraph"));

    // Find the paragraph containing this scene's heading
    let startIdx = -1;
    let endIdx = paragraphs.length;

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const type = p.getAttribute("Type") || "";
      const texts = Array.from(p.querySelectorAll("Text"));
      const content = texts.map((t) => t.textContent || "").join("").trim();

      if (type === "Scene Heading") {
        if (startIdx === -1 && heading && content.toUpperCase().includes(heading.toUpperCase())) {
          startIdx = i;
        } else if (startIdx !== -1) {
          endIdx = i;
          break;
        }
      }
    }

    if (startIdx === -1) startIdx = 0;

    const result: { type: string; text: string }[] = [];
    for (let i = startIdx; i < endIdx; i++) {
      const p = paragraphs[i];
      const type = p.getAttribute("Type") || "Action";
      const texts = Array.from(p.querySelectorAll("Text"));
      const content = texts.map((t) => t.textContent || "").join("");
      if (content.trim()) {
        result.push({ type, text: content });
      }
    }
    return result;
  };

  const parsePlainTextScene = (fullText: string): { type: string; text: string }[] => {
    const heading = scene.scene_heading?.trim();
    if (!heading) return [{ type: "Action", text: fullText }];

    const headingPattern = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const startMatch = fullText.match(new RegExp(`^(.*${headingPattern}.*)$`, "mi"));
    if (!startMatch || startMatch.index === undefined) return [{ type: "Action", text: fullText }];

    const startIdx = startMatch.index;
    const afterHeading = fullText.substring(startIdx + startMatch[0].length);
    const nextScene = afterHeading.match(/\n\s*((?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.).+)/i);
    const endIdx = nextScene?.index !== undefined
      ? startIdx + startMatch[0].length + nextScene.index
      : fullText.length;

    const sceneText = fullText.substring(startIdx, endIdx).trim();
    // Simple heuristic: lines in ALL CAPS with no period at end are likely characters
    return sceneText.split("\n").filter((l) => l.trim()).map((line) => {
      const trimmed = line.trim();
      if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/.test(trimmed)) return { type: "Scene Heading", text: trimmed };
      if (/^[A-Z][A-Z\s'.()-]+$/.test(trimmed) && trimmed.length < 40) return { type: "Character", text: trimmed };
      return { type: "Action", text: trimmed };
    });
  };

  const loadScript = async () => {
    if (scriptParagraphs !== null) {
      setScriptOpen(true);
      return;
    }
    setScriptLoading(true);
    setScriptOpen(true);
    try {
      const { data, error } = await supabase.storage.from("scripts").download(storagePath);
      if (error || !data) throw error || new Error("Download failed");
      const full = await data.text();

      // Detect FDX (XML) vs plain text
      const isFdx = full.trimStart().startsWith("<?xml") || full.includes("<FinalDraft");
      const parsed = isFdx ? parseFdxScene(full) : parsePlainTextScene(full);
      setScriptParagraphs(parsed);
    } catch {
      setScriptParagraphs([{ type: "Action", text: "[Could not load script file]" }]);
    } finally {
      setScriptLoading(false);
    }
  };

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
            <p className="text-xs text-muted-foreground">
              {scene.int_ext} · {scene.time_of_day}
              {scene.page && <span className="ml-2 text-primary/60">p. {scene.page}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            role="checkbox"
            aria-checked={approved}
            onClick={(e) => { e.stopPropagation(); onToggleApproved(); }}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer ${approved ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary"}`}
          >
            {approved && <CheckCircle className="h-3.5 w-3.5" />}
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <EditableSceneContent
          scene={scene}
          index={index}
          storagePath={storagePath}
          approved={approved}
          onToggleApproved={onToggleApproved}
          onLoadScript={loadScript}
        />
      )}

      {/* Script Dialog — printed page appearance */}
      <Dialog open={scriptOpen} onOpenChange={setScriptOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" />
              {scene.scene_heading || `Scene ${scene.scene_number ?? index + 1}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Original screenplay formatting
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 pb-6">
            {scriptLoading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-20">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading script…
              </div>
            ) : (
              <div
                className="mx-auto bg-white text-black shadow-lg"
                style={{
                  fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
                  fontSize: "12px",
                  lineHeight: "1.0",
                  padding: "72px 60px 72px 90px",
                  maxWidth: "612px",
                  minHeight: "792px",
                }}
              >
                {scriptParagraphs?.map((p, i) => {
                  switch (p.type) {
                    case "Scene Heading":
                      return (
                        <p key={i} style={{ textTransform: "uppercase", fontWeight: "bold", marginTop: i === 0 ? 0 : 24, marginBottom: 12 }}>
                          <span>{scene.scene_number ?? index + 1}</span>
                          <span style={{ marginLeft: 24 }}>{p.text}</span>
                        </p>
                      );
                    case "Character":
                      return (
                        <p key={i} style={{ textTransform: "uppercase", textAlign: "left", paddingLeft: "37%", marginTop: 18, marginBottom: 0 }}>
                          {p.text}
                        </p>
                      );
                    case "Parenthetical":
                      return (
                        <p key={i} style={{ paddingLeft: "28%", fontStyle: "italic", marginTop: 0, marginBottom: 0 }}>
                          {p.text}
                        </p>
                      );
                    case "Dialogue":
                      return (
                        <p key={i} style={{ paddingLeft: "17%", paddingRight: "17%", marginTop: 0, marginBottom: 0 }}>
                          {p.text}
                        </p>
                      );
                    case "Transition":
                      return (
                        <p key={i} style={{ textAlign: "right", textTransform: "uppercase", marginTop: 18, marginBottom: 12 }}>
                          {p.text}
                        </p>
                      );
                    default: // Action
                      return (
                        <p key={i} style={{ marginTop: 12, marginBottom: 0 }}>
                          {p.text}
                        </p>
                      );
                  }
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ── Editable Scene Content ── */
const EditableSceneContent = ({
  scene, index, storagePath, approved, onToggleApproved, onLoadScript,
}: {
  scene: any; index: number; storagePath: string; approved: boolean;
  onToggleApproved: () => void; onLoadScript: () => void;
}) => {
  const [desc, setDesc] = useState<string>(scene.description || "");
  const [atmosphere, setAtmosphere] = useState<string>(scene.visual_design?.atmosphere || "");
  const [lighting, setLighting] = useState<string>(scene.visual_design?.lighting_style || "");
  const [palette, setPalette] = useState<string>(scene.visual_design?.color_palette || "");
  const [references, setReferences] = useState<string>(scene.visual_design?.visual_references || "");
  const [location, setLocation] = useState<string>(scene.setting || scene.scene_heading || "");
  const [characters, setCharacters] = useState<{ name: string; emotional_tone: string; key_expressions: string; physical_behavior: string }[]>(
    (scene.characters || []).map((c: any) => ({
      name: c.name || "",
      emotional_tone: c.emotional_tone || "",
      key_expressions: c.key_expressions || "",
      physical_behavior: c.physical_behavior || "",
    }))
  );
  const [wardrobe, setWardrobe] = useState<{ character: string; clothing_style: string; condition: string; hair_makeup: string }[]>(
    (scene.wardrobe || []).map((w: any) => ({
      character: w.character || "",
      clothing_style: w.clothing_style || "",
      condition: w.condition || "",
      hair_makeup: w.hair_makeup || "",
    }))
  );
  const [cameraFeel, setCameraFeel] = useState<string>(scene.cinematic_elements?.camera_feel || "");
  const [motionCues, setMotionCues] = useState<string>(scene.cinematic_elements?.motion_cues || "");
  const [shotSuggestions, setShotSuggestions] = useState<string>(
    (scene.cinematic_elements?.shot_suggestions || []).join(" · ")
  );
  const [envDetails, setEnvDetails] = useState<string>(scene.environment_details || "");
  const [keyObjects, setKeyObjects] = useState<string[]>(scene.key_objects || []);
  const [imagePrompt, setImagePrompt] = useState<string>(scene.image_prompt || "");
  const [videoPrompt, setVideoPrompt] = useState<string>(scene.video_prompt || "");

  const [newItem, setNewItem] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; idx: number; kind?: string } | null>(null);

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "character") {
      setCharacters((prev) => prev.filter((_, i) => i !== deleteTarget.idx));
    } else if (deleteTarget.kind === "wardrobe") {
      setWardrobe((prev) => prev.filter((_, i) => i !== deleteTarget.idx));
    } else {
      setKeyObjects((prev) => prev.filter((_, i) => i !== deleteTarget.idx));
    }
    setDeleteTarget(null);
  };

  const addObject = () => {
    const val = newItem.trim();
    if (!val) return;
    setKeyObjects((prev) => [...prev, val]);
    setNewItem("");
  };

  return (
    <>
      <div className="border-t border-border p-5 space-y-5 text-sm">
        {/* Description */}
        <Section icon={FileText} label="Description">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="text-xs min-h-[60px] bg-secondary border-border" />
        </Section>

        {/* Location */}
        <Section icon={LocateFixed} label="Location">
          <Textarea value={location} onChange={(e) => setLocation(e.target.value)} className="text-xs min-h-[40px] bg-secondary border-border" />
        </Section>

        {/* Visual Design */}
        <Section icon={Palette} label="Visual Design">
          <div className="grid grid-cols-2 gap-2">
            <EditableTag label="Atmosphere" value={atmosphere} onChange={setAtmosphere} />
            <EditableTag label="Lighting" value={lighting} onChange={setLighting} />
            <EditableTag label="Palette" value={palette} onChange={setPalette} />
            <EditableTag label="References" value={references} onChange={setReferences} />
          </div>
        </Section>

        {/* Characters */}
        <Section icon={Users} label="Characters">
          <div className="space-y-3">
            {characters.map((c, ci) => (
              <div key={ci} className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Input
                    value={c.name}
                    onChange={(e) => {
                      const next = [...characters];
                      next[ci] = { ...next[ci], name: e.target.value };
                      setCharacters(next);
                    }}
                    className="text-xs font-bold h-7 w-40 bg-background border-border uppercase"
                    placeholder="Character name"
                  />
                  <button
                    onClick={() => setDeleteTarget({ label: c.name || "this character", idx: ci, kind: "character" } as any)}
                    className="rounded-full p-1 hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Emotion</p>
                    <Input value={c.emotional_tone} onChange={(e) => { const n = [...characters]; n[ci] = { ...n[ci], emotional_tone: e.target.value }; setCharacters(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Expressions</p>
                    <Input value={c.key_expressions} onChange={(e) => { const n = [...characters]; n[ci] = { ...n[ci], key_expressions: e.target.value }; setCharacters(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Behavior</p>
                    <Input value={c.physical_behavior} onChange={(e) => { const n = [...characters]; n[ci] = { ...n[ci], physical_behavior: e.target.value }; setCharacters(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCharacters([...characters, { name: "", emotional_tone: "", key_expressions: "", physical_behavior: "" }])}>
              <Plus className="h-3 w-3" /> Add Character
            </Button>
          </div>
        </Section>

        {/* Wardrobe */}
        <Section icon={Users} label="Wardrobe">
          <div className="space-y-3">
            {wardrobe.map((w, wi) => (
              <div key={wi} className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-foreground">{w.character || "—"}</span>
                  <button
                    onClick={() => setDeleteTarget({ label: `${w.character}'s wardrobe`, idx: wi, kind: "wardrobe" } as any)}
                    className="rounded-full p-1 hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Outfit</p>
                    <Input value={w.clothing_style} onChange={(e) => { const n = [...wardrobe]; n[wi] = { ...n[wi], clothing_style: e.target.value }; setWardrobe(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Condition</p>
                    <Input value={w.condition} onChange={(e) => { const n = [...wardrobe]; n[wi] = { ...n[wi], condition: e.target.value }; setWardrobe(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                  <div>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Hair / Makeup</p>
                    <Input value={w.hair_makeup} onChange={(e) => { const n = [...wardrobe]; n[wi] = { ...n[wi], hair_makeup: e.target.value }; setWardrobe(n); }} className="text-xs h-7 bg-background border-border" />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setWardrobe([...wardrobe, { character: "", clothing_style: "", condition: "", hair_makeup: "" }])}>
              <Plus className="h-3 w-3" /> Add Wardrobe Entry
            </Button>
          </div>
        </Section>

        {/* Cinematic Elements */}
        <Section icon={Camera} label="Cinematic Elements">
          <div className="grid grid-cols-2 gap-2">
            <EditableTag label="Camera" value={cameraFeel} onChange={setCameraFeel} />
            <EditableTag label="Motion" value={motionCues} onChange={setMotionCues} />
          </div>
          <div className="mt-2">
            <EditableTag label="Shot Suggestions" value={shotSuggestions} onChange={setShotSuggestions} />
          </div>
        </Section>

        {/* Environment & Props */}
        <Section icon={MapPin} label="Environment & Props">
          <Textarea value={envDetails} onChange={(e) => setEnvDetails(e.target.value)} className="text-xs min-h-[40px] bg-secondary border-border" placeholder="Environment description…" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {keyObjects.map((obj, i) => (
              <span
                key={i}
                className="text-xs bg-secondary text-muted-foreground rounded-full pl-2.5 pr-1 py-0.5 border border-border flex items-center gap-1 group"
              >
                {obj}
                <button
                  onClick={() => setDeleteTarget({ label: obj, idx: i })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-destructive/20 p-0.5"
                >
                  <X className="h-3 w-3 text-destructive" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addObject())}
                placeholder="Add item…"
                className="h-6 text-xs w-28 bg-secondary border-border"
              />
              <button onClick={addObject} className="rounded-full p-0.5 hover:bg-primary/10 transition-colors">
                <Plus className="h-3.5 w-3.5 text-primary" />
              </button>
            </div>
          </div>
        </Section>

        {/* AI Generation Prompts */}
        <Section icon={Sparkles} label="AI Generation Prompts">
          <p className="text-xs font-mono text-primary/70 mb-1">IMAGE PROMPT</p>
          <Textarea value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} className="text-xs min-h-[80px] bg-secondary border-border font-mono" />
          <p className="text-xs font-mono text-primary/70 mb-1 mt-3">VIDEO PROMPT</p>
          <Textarea value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} className="text-xs min-h-[80px] bg-secondary border-border font-mono" />
        </Section>

        {/* Continuity Flags */}
        {scene.continuity_flags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {scene.continuity_flags.map((flag: string, i: number) => (
              <span key={i} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-0.5">{flag}</span>
            ))}
          </div>
        )}

        {/* Actions row */}
        <div className="pt-2 flex justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onLoadScript}>
            <ScrollText className="h-3.5 w-3.5" />
            View Script Page
          </Button>
          <Button
            variant={approved ? "secondary" : "default"}
            size="sm"
            className="gap-1.5"
            onClick={onToggleApproved}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {approved ? "Approved ✓" : "Approve Scene"}
          </Button>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteTarget?.label}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/* ── Editable Tag ── */
const EditableTag = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="bg-secondary rounded-lg px-3 py-2">
    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-1">{label}</p>
    <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="text-xs min-h-[32px] p-1.5 bg-background border-border resize-none" />
  </div>
);

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
