import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIntegrations } from "@/hooks/useFilm";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Plug, ScrollText, Image, AudioLines, Camera, Clapperboard, Check, Plus, X, ArrowLeft, Pencil,
  Gauge, Zap, Save, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useCreditUsage, useCreditSettings } from "@/hooks/useCreditUsage";
import { useAuth } from "@/hooks/useAuth";

/* ── Service catalogs per section ── */
type ServiceDef = { id: string; name: string; placeholder: string; variants?: { id: string; label: string }[] };

const SERVICE_CATALOGS: Record<string, ServiceDef[]> = {
  "script-analysis": [
    { id: "openai-chat", name: "ChatGPT (OpenAI)", placeholder: "Enter OpenAI API key…", variants: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ]},
    { id: "gemini", name: "Gemini (Google)", placeholder: "Enter Gemini API key…", variants: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
      { id: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
    ]},
    { id: "claude", name: "Claude (Anthropic)", placeholder: "Enter Anthropic API key…", variants: [
      { id: "claude-4-opus", label: "Claude 4 Opus" },
      { id: "claude-4-sonnet", label: "Claude 4 Sonnet" },
      { id: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
    ]},
    { id: "mistral", name: "Mistral AI", placeholder: "Enter Mistral API key…" },
    { id: "llama", name: "Llama (Meta)", placeholder: "Enter API key…" },
  ],
  "image-generation": [
    { id: "midjourney", name: "Midjourney", placeholder: "Enter Midjourney API key…" },
    { id: "dall-e", name: "DALL·E 3 (OpenAI)", placeholder: "Enter OpenAI API key…" },
    { id: "flux-pro", name: "Flux Pro (Black Forest Labs)", placeholder: "Enter BFL API key…" },
    { id: "stable-diffusion", name: "Stable Diffusion (Stability AI)", placeholder: "Enter Stability API key…" },
    { id: "ideogram", name: "Ideogram", placeholder: "Enter Ideogram API key…" },
    { id: "leonardo", name: "Leonardo AI", placeholder: "Enter Leonardo API key…" },
    { id: "recraft", name: "Recraft V3", placeholder: "Enter Recraft API key…" },
    { id: "nana-banana", name: "Nana Banana Pro", placeholder: "Enter API key…" },
    { id: "imagen-4", name: "Imagen 4 (Google)", placeholder: "Enter Google API key…" },
  ],
  "sound-stage": [
    { id: "elevenlabs", name: "ElevenLabs", placeholder: "Enter ElevenLabs API key…", variants: [
      { id: "eleven-multilingual-v2", label: "Multilingual V2" },
      { id: "eleven-turbo-v2.5", label: "Turbo V2.5" },
    ]},
    { id: "playht", name: "Play.ht", placeholder: "Enter Play.ht API key…" },
    { id: "murf", name: "Murf AI", placeholder: "Enter Murf API key…" },
    { id: "wellsaid", name: "WellSaid Labs", placeholder: "Enter WellSaid API key…" },
    { id: "resemble", name: "Resemble AI", placeholder: "Enter Resemble API key…" },
  ],
  "camera-cart": [
    { id: "seedance", name: "Seedance (ByteDance)", placeholder: "Enter Seedance API key…" },
    { id: "kling", name: "Kling AI", placeholder: "Enter Kling API key…", variants: [
      { id: "kling-1.5", label: "Kling 1.5" },
      { id: "kling-2.0", label: "Kling 2.0" },
    ]},
    { id: "veo", name: "Veo (Google)", placeholder: "Enter Google API key…", variants: [
      { id: "veo-2", label: "Veo 2" },
      { id: "veo-3", label: "Veo 3" },
    ]},
    { id: "sora", name: "Sora (OpenAI)", placeholder: "Enter Sora API key…" },
    { id: "runway", name: "Runway Gen-3", placeholder: "Enter Runway API key…" },
    { id: "pika", name: "Pika Labs", placeholder: "Enter Pika API key…" },
    { id: "luma", name: "Luma Dream Machine", placeholder: "Enter Luma API key…" },
  ],
  "post-house": [
    { id: "synclabs", name: "SyncLabs", placeholder: "Enter SyncLabs API key…" },
    { id: "topaz", name: "Topaz AI", placeholder: "Enter Topaz API key…" },
    { id: "descript", name: "Descript", placeholder: "Enter Descript API key…" },
    { id: "kapwing", name: "Kapwing", placeholder: "Enter Kapwing API key…" },
  ],
};

/* ── Section metadata ── */
const sectionOrder = [
  "script-analysis",
  "image-generation",
  "sound-stage",
  "camera-cart",
  "post-house",
] as const;

const sectionMeta: Record<string, { title: string; description: string; icon: React.ReactNode; addLabel: string }> = {
  "script-analysis": {
    title: "Script Analysis (ChatGPT, Gemini)",
    description: "LLM providers for script parsing and scene breakdown",
    icon: <ScrollText className="h-4 w-4" />,
    addLabel: "Add LLM Provider",
  },
  "image-generation": {
    title: "Image Generation",
    description: "AI image generators for character headshots, storyboards & concept art",
    icon: <Image className="h-4 w-4" />,
    addLabel: "Add Image Generator",
  },
  "sound-stage": {
    title: "Voice & Audio (ElevenLabs)",
    description: "Voice synthesis and audio generation",
    icon: <AudioLines className="h-4 w-4" />,
    addLabel: "Add Voice Provider",
  },
  "camera-cart": {
    title: "Video Generation (Seedance, Kling, Veo, Sora)",
    description: "AI video generation for shot previsualization",
    icon: <Camera className="h-4 w-4" />,
    addLabel: "Add Video Generator",
  },
  "post-house": {
    title: "Post-Production (SyncLabs, Topaz AI)",
    description: "Lip-sync, upscaling and post-processing tools",
    icon: <Clapperboard className="h-4 w-4" />,
    addLabel: "Add Post Tool",
  },
};

const LEGACY_SECTION_MAP: Record<string, string> = {
  "writers-room": "script-analysis",
};

/* ── Component ── */
const SettingsIntegrations = () => {
  const navigate = useNavigate();
  const { data: integrations, isLoading } = useIntegrations();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  // Per-section add state
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [addedServices] = useState<Record<string, Array<{ id: string; name: string }>>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Credit usage
  const [creditPeriod, setCreditPeriod] = useState<"week" | "month" | "year">("month");
  const { data: creditUsage } = useCreditUsage(creditPeriod);
  const { data: creditSettings } = useCreditSettings();
  const [warningInput, setWarningInput] = useState("");
  const [cutoffInput, setCutoffInput] = useState("");
  const [periodInput, setPeriodInput] = useState("month");
  const [savingCredits, setSavingCredits] = useState(false);
  const [creditSettingsLoaded, setCreditSettingsLoaded] = useState(false);

  // Sync inputs from DB
  if (creditSettings && !creditSettingsLoaded) {
    setWarningInput(creditSettings.warning_threshold?.toString() || "");
    setCutoffInput(creditSettings.cutoff_threshold?.toString() || "");
    setPeriodInput(creditSettings.warning_period || "month");
    setCreditSettingsLoaded(true);
  }

  const handleConnect = async (id: string) => {
    const key = keys[id];
    if (!key) return;
    await supabase.from("integrations").update({ api_key_encrypted: key, is_verified: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["integrations"] });
    setKeys((p) => { const n = { ...p }; delete n[id]; return n; });
    setEditingId(null);
    toast({ title: "Connected", description: "API key saved and verified." });
  };

  const handleAddService = async (sectionId: string) => {
    if (!selectedService || !serviceKey) return;
    setSaving(true);
    const catalog = SERVICE_CATALOGS[sectionId] || [];
    const svc = catalog.find((s) => s.id === selectedService);
      const providerName = selectedVariant
        ? `${svc?.name} (${svc?.variants?.find(v => v.id === selectedVariant)?.label || selectedVariant})`
        : svc?.name || selectedService;
      try {
      const { error } = await supabase.from("integrations").insert({
        section_id: sectionId,
        provider_name: providerName,
        api_key_encrypted: serviceKey,
        is_verified: true,
        user_id: user?.id,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      setSelectedService("");
      setSelectedVariant("");
      setServiceKey("");
      setAddingSection(null);
      toast({ title: "Service added", description: `${svc?.name} connected and saved.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save service.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openAdd = (sectionId: string) => {
    setAddingSection(sectionId);
    setSelectedService("");
    setSelectedVariant("");
    setServiceKey("");
  };

  const handleSaveCreditSettings = async () => {
    if (!user) return;
    setSavingCredits(true);
    const payload = {
      user_id: user.id,
      warning_threshold: warningInput ? parseFloat(warningInput) : null,
      cutoff_threshold: cutoffInput ? parseFloat(cutoffInput) : null,
      warning_period: periodInput,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("credit_usage_settings")
      .upsert(payload, { onConflict: "user_id" });
    setSavingCredits(false);
    if (error) {
      toast({ title: "Error", description: "Failed to save credit settings.", variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["credit-settings"] });
    toast({ title: "Saved", description: "Credit usage thresholds updated." });
  };

  if (isLoading) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>;

  const grouped = integrations?.reduce((acc, int) => {
    const mappedSection = LEGACY_SECTION_MAP[int.section_id] || int.section_id;
    (acc[mappedSection] ??= []).push(int);
    return acc;
  }, {} as Record<string, typeof integrations>) ?? {};

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <button
          onClick={() => navigate("/projects")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Film Projects
        </button>
        <div className="flex items-center gap-2 mb-2">
          <Plug className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Global Settings — API Keys</h2>
        </div>
        <p className="text-xs text-muted-foreground">Bring Your Own Keys — connect your AI service providers. These are shared across all projects. Each version can choose which provider to use.</p>
      </div>

      <Accordion type="multiple" className="space-y-3">
        {sectionOrder.map((sectionId) => {
          const meta = sectionMeta[sectionId];
          if (!meta) return null;
          const providers = grouped[sectionId];
          const catalog = SERVICE_CATALOGS[sectionId] || [];
          const added = addedServices[sectionId] || [];
          const addedIds = new Set(added.map((s) => s.id));
          const available = catalog.filter((s) => !addedIds.has(s.id));
          const isAdding = addingSection === sectionId;

          return (
            <AccordionItem key={sectionId} value={sectionId} className="rounded-xl border border-border bg-card px-4 cinema-inset">
              <AccordionTrigger className="text-[11px] font-display font-semibold hover:no-underline">
                <span className="flex items-center gap-2">{meta.icon}{meta.title}</span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-muted-foreground mb-3">{meta.description}</p>
                <div className="space-y-3 pb-2">
                  {/* Existing DB-backed providers */}
                  {providers?.filter((p) => p.is_verified).map((provider) => {
                    const isEditing = editingId === provider.id;

                    return (
                      <div key={provider.id} className="rounded-lg border border-border bg-secondary p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-medium">{provider.provider_name}</p>
                          {!isEditing && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="h-3.5 w-3.5 text-green-500" /> Connected & Verified
                            </span>
                          )}
                        </div>

                        {!isEditing ? (
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-muted-foreground tracking-widest">••••••••••••••••</span>
                            <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => { setEditingId(provider.id); setKeys((p) => ({ ...p, [provider.id]: "" })); }}>
                              <Pencil className="h-3 w-3" /> Change
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Input
                              type="password"
                              placeholder="Enter new API key…"
                              value={keys[provider.id] ?? ""}
                              onChange={(e) => setKeys((p) => ({ ...p, [provider.id]: e.target.value }))}
                              className="font-mono text-xs bg-background border-border"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleConnect(provider.id)}>
                                <Plug className="h-3.5 w-3.5" />
                                Connect & Verify
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setKeys((p) => { const n = { ...p }; delete n[provider.id]; return n; }); }}>
                                Cancel
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* Locally added services */}
                  {added.map((svc) => (
                    <div key={svc.id} className="rounded-lg border border-border bg-secondary p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium">{svc.name}</p>
                        <Check className="h-4 w-4 text-green-400" />
                      </div>
                    </div>
                  ))}

                  {/* Add new service form */}
                  {isAdding ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold">{meta.addLabel}</p>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setAddingSection(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Service</Label>
                        <Select value={selectedService} onValueChange={(val) => { setSelectedService(val); setSelectedVariant(""); }}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select a service…" />
                          </SelectTrigger>
                          <SelectContent>
                            {available.map((svc) => (
                              <SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedService && (() => {
                        const svcDef = catalog.find((s) => s.id === selectedService);
                        return (
                          <>
                            {svcDef?.variants && svcDef.variants.length > 0 && (
                              <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Model Version</Label>
                                <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                                  <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Select version…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {svcDef.variants.map((v) => (
                                      <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <Label className="text-xs uppercase tracking-wider text-muted-foreground">API Key</Label>
                              <Input
                                type="password"
                                placeholder={svcDef?.placeholder || "Enter API key…"}
                                value={serviceKey}
                                onChange={(e) => setServiceKey(e.target.value)}
                                className="font-mono text-xs bg-background border-border"
                              />
                            </div>
                          </>
                        );
                      })()}
                      <Button
                        size="sm"
                        className="gap-1.5 w-full"
                        disabled={!selectedService || !serviceKey || saving || !!(catalog.find(s => s.id === selectedService)?.variants?.length && !selectedVariant)}
                        onClick={() => handleAddService(sectionId)}
                      >
                        <Plug className="h-3.5 w-3.5" />
                        Connect & Verify
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 w-full border-dashed"
                      onClick={() => openAdd(sectionId)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {meta.addLabel}
                    </Button>
                  )}

                  {/* Empty hint when nothing configured */}
                  {(!providers || providers.length === 0) && added.length === 0 && !isAdding && (
                    <p className="text-xs text-muted-foreground italic">No providers configured yet.</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* ── Credit Usage & Thresholds ── */}
      <div className="mt-10 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Gauge className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Credit Usage</h2>
        </div>
        <p className="text-xs text-muted-foreground">Monitor AI credit consumption and set warning or cutoff thresholds.</p>

        {/* Usage breakdown */}
        <div className="rounded-xl border border-border bg-card p-5 cinema-inset space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider">Usage Summary</h3>
            </div>
            <div className="flex gap-1">
              {(["week", "month", "year"] as const).map((p) => (
                <Button key={p} variant={creditPeriod === p ? "default" : "ghost"} size="sm" className="h-7 px-3 text-xs" onClick={() => setCreditPeriod(p)}>
                  {p === "week" ? "Last Week" : p === "month" ? "This Month" : "This Year"}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-foreground">{(creditUsage?.total ?? 0).toFixed(0)}</span>
            <span className="text-xs text-muted-foreground mb-1">credits used</span>
          </div>

          {creditUsage && Object.keys(creditUsage.byService).length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              {Object.entries(creditUsage.byService).sort(([,a],[,b]) => b - a).map(([svc, credits]) => (
                <div key={svc} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{svc}</span>
                  <span className="text-[11px] font-mono font-medium tabular-nums">{credits.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Threshold settings */}
        <div className="rounded-xl border border-border bg-card p-5 cinema-inset space-y-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider">Usage Thresholds</h3>
          </div>
          <p className="text-xs text-muted-foreground">Set optional limits. A warning notifies you; a cutoff shows an alert when exceeded.</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Warning Threshold</Label>
              <Input type="number" placeholder="e.g. 500" value={warningInput} onChange={(e) => setWarningInput(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cutoff Limit</Label>
              <Input type="number" placeholder="e.g. 1000" value={cutoffInput} onChange={(e) => setCutoffInput(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Monitoring Period</Label>
            <Select value={periodInput} onValueChange={setPeriodInput}>
              <SelectTrigger className="bg-secondary w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Per Week</SelectItem>
                <SelectItem value="month">Per Month</SelectItem>
                <SelectItem value="year">Per Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSaveCreditSettings} disabled={savingCredits} className="gap-2">
            {savingCredits ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Thresholds</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsIntegrations;
