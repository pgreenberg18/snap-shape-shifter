import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIntegrations } from "@/hooks/useFilm";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      { id: "gpt-5", label: "GPT-5" },
      { id: "gpt-5-mini", label: "GPT-5 Mini" },
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
    { id: "mistral", name: "Mistral AI", placeholder: "Enter Mistral API key…", variants: [
      { id: "mistral-large", label: "Mistral Large" },
      { id: "mistral-medium", label: "Mistral Medium" },
      { id: "mistral-small", label: "Mistral Small" },
    ]},
    { id: "llama", name: "Llama (Meta)", placeholder: "Enter API key…", variants: [
      { id: "llama-3.1-405b", label: "Llama 3.1 405B" },
      { id: "llama-3.1-70b", label: "Llama 3.1 70B" },
      { id: "llama-3.1-8b", label: "Llama 3.1 8B" },
    ]},
  ],
  "image-generation": [
    { id: "midjourney", name: "Midjourney", placeholder: "Enter Midjourney API key…", variants: [
      { id: "mj-v6.1", label: "V6.1" },
      { id: "mj-v6", label: "V6" },
      { id: "mj-v5.2", label: "V5.2" },
    ]},
    { id: "dall-e", name: "DALL·E 3 (OpenAI)", placeholder: "Enter OpenAI API key…", variants: [
      { id: "dall-e-3", label: "DALL·E 3" },
      { id: "dall-e-2", label: "DALL·E 2" },
    ]},
    { id: "flux-pro", name: "Flux Pro (Black Forest Labs)", placeholder: "Enter BFL API key…", variants: [
      { id: "flux-1.1-pro", label: "Flux 1.1 Pro" },
      { id: "flux-1-pro", label: "Flux 1 Pro" },
      { id: "flux-1-dev", label: "Flux 1 Dev" },
    ]},
    { id: "stable-diffusion", name: "Stable Diffusion (Stability AI)", placeholder: "Enter Stability API key…", variants: [
      { id: "sd-3.5", label: "SD 3.5" },
      { id: "sd-3", label: "SD 3" },
      { id: "sdxl-1.0", label: "SDXL 1.0" },
    ]},
    { id: "ideogram", name: "Ideogram", placeholder: "Enter Ideogram API key…", variants: [
      { id: "ideogram-v2", label: "V2" },
      { id: "ideogram-v1", label: "V1" },
    ]},
    { id: "leonardo", name: "Leonardo AI", placeholder: "Enter Leonardo API key…", variants: [
      { id: "leonardo-phoenix", label: "Phoenix" },
      { id: "leonardo-kino-xl", label: "Kino XL" },
    ]},
    { id: "recraft", name: "Recraft V3", placeholder: "Enter Recraft API key…", variants: [
      { id: "recraft-v3", label: "V3" },
      { id: "recraft-v2", label: "V2" },
    ]},
    { id: "nana-banana", name: "Nana Banana Pro", placeholder: "Enter API key…", variants: [
      { id: "nana-pro", label: "Pro" },
      { id: "nana-standard", label: "Standard" },
    ]},
    { id: "imagen-4", name: "Imagen 4 (Google)", placeholder: "Enter Google API key…", variants: [
      { id: "imagen-4", label: "Imagen 4" },
      { id: "imagen-3", label: "Imagen 3" },
    ]},
  ],
  "sound-stage": [
    { id: "elevenlabs", name: "ElevenLabs", placeholder: "Enter ElevenLabs API key…", variants: [
      { id: "eleven-multilingual-v2", label: "Multilingual V2" },
      { id: "eleven-turbo-v2.5", label: "Turbo V2.5" },
    ]},
    { id: "playht", name: "Play.ht", placeholder: "Enter Play.ht API key…", variants: [
      { id: "playht-3.0", label: "PlayHT 3.0" },
      { id: "playht-2.0", label: "PlayHT 2.0" },
    ]},
    { id: "murf", name: "Murf AI", placeholder: "Enter Murf API key…", variants: [
      { id: "murf-studio", label: "Studio" },
      { id: "murf-enterprise", label: "Enterprise" },
    ]},
    { id: "wellsaid", name: "WellSaid Labs", placeholder: "Enter WellSaid API key…", variants: [
      { id: "wellsaid-studio", label: "Studio" },
    ]},
    { id: "resemble", name: "Resemble AI", placeholder: "Enter Resemble API key…", variants: [
      { id: "resemble-v2", label: "V2" },
      { id: "resemble-v1", label: "V1" },
    ]},
  ],
  "camera-cart": [
    { id: "seedance", name: "Seedance (ByteDance)", placeholder: "Enter Seedance API key…", variants: [
      { id: "seedance-1.0", label: "Seedance 1.0" },
    ]},
    { id: "kling", name: "Kling AI", placeholder: "Enter Kling API key…", variants: [
      { id: "kling-1.5", label: "Kling 1.5" },
      { id: "kling-2.0", label: "Kling 2.0" },
    ]},
    { id: "veo", name: "Veo (Google)", placeholder: "Enter Google API key…", variants: [
      { id: "veo-2", label: "Veo 2" },
      { id: "veo-3", label: "Veo 3" },
    ]},
    { id: "sora", name: "Sora (OpenAI)", placeholder: "Enter Sora API key…", variants: [
      { id: "sora-1.0", label: "Sora 1.0" },
    ]},
    { id: "runway", name: "Runway Gen-3", placeholder: "Enter Runway API key…", variants: [
      { id: "runway-gen3-alpha", label: "Gen-3 Alpha" },
      { id: "runway-gen3", label: "Gen-3" },
      { id: "runway-gen2", label: "Gen-2" },
    ]},
    { id: "pika", name: "Pika Labs", placeholder: "Enter Pika API key…", variants: [
      { id: "pika-2.0", label: "Pika 2.0" },
      { id: "pika-1.5", label: "Pika 1.5" },
    ]},
    { id: "luma", name: "Luma Dream Machine", placeholder: "Enter Luma API key…", variants: [
      { id: "luma-1.5", label: "Dream Machine 1.5" },
      { id: "luma-1.0", label: "Dream Machine 1.0" },
    ]},
  ],
  "post-house": [
    { id: "synclabs", name: "SyncLabs", placeholder: "Enter SyncLabs API key…", variants: [
      { id: "synclabs-v2", label: "SyncLabs V2" },
      { id: "synclabs-v1", label: "SyncLabs V1" },
    ]},
    { id: "topaz", name: "Topaz AI", placeholder: "Enter Topaz API key…", variants: [
      { id: "topaz-video-4", label: "Video AI 4" },
      { id: "topaz-video-3", label: "Video AI 3" },
    ]},
    { id: "descript", name: "Descript", placeholder: "Enter Descript API key…", variants: [
      { id: "descript-studio", label: "Studio" },
    ]},
    { id: "kapwing", name: "Kapwing", placeholder: "Enter Kapwing API key…", variants: [
      { id: "kapwing-pro", label: "Pro" },
    ]},
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

const PROVIDER_GROUPS: Record<string, string[]> = {
  google: ["gemini", "veo", "imagen-4"],
  openai: ["openai-chat", "dall-e", "sora"],
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
    <ScrollArea className="h-full">
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </button>
        <div className="flex items-center gap-2 mb-2">
          <Plug className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Global Settings — API Keys</h2>
        </div>
        <p className="text-xs text-muted-foreground">Bring Your Own Keys — connect your AI service providers. All projects have access to these but you can manually change the service or model for each version.</p>
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
              <AccordionTrigger className="text-sm font-display font-semibold hover:no-underline">
                <span className="flex items-center gap-2 flex-1">{meta.icon}{meta.title}
                  {!isAdding && available.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto gap-1 text-[10px] h-6 px-2 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); openAdd(sectionId); }}
                    >
                      <Plus className="h-3 w-3" />
                      {meta.addLabel}
                    </Button>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-muted-foreground mb-3">{meta.description}</p>
                <div className="space-y-3 pb-2">
                  {/* Existing DB-backed providers */}
                  {providers?.filter((p) => p.is_verified).map((provider) => {
                    const isEditing = editingId === provider.id;

                    // Find matching catalog entry & current variant
                    const matchedSvc = catalog.find((s) => provider.provider_name.startsWith(s.name));
                    // Extract variant from parenthesized suffix after service name, e.g. "Nana Banana Pro (Standard)" → "Standard"
                    const variantSuffix = matchedSvc
                      ? provider.provider_name.slice(matchedSvc.name.length).match(/\(([^)]+)\)/)?.[1]
                      : undefined;
                    const currentVariantMatch = variantSuffix
                      ? matchedSvc?.variants?.find((v) => v.label === variantSuffix)
                      : undefined;

                    return (
                      <div key={provider.id} className="rounded-lg border border-border/60 bg-secondary p-3 space-y-2 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                        <div className="flex items-center justify-between">
                          <p className="text-base font-medium">{provider.provider_name}</p>
                          {!isEditing && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="h-3.5 w-3.5 text-green-500" /> Connected & Verified
                            </span>
                          )}
                        </div>

                        {!isEditing ? (
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-muted-foreground tracking-wider">{provider.api_key_encrypted || "—"}</span>
                            <div className="flex items-center gap-2">
                              {matchedSvc?.variants && matchedSvc.variants.length > 0 && (
                                <Select
                                  value={currentVariantMatch?.id || ""}
                                  onValueChange={async (variantId) => {
                                    const variant = matchedSvc.variants!.find((v) => v.id === variantId);
                                    if (!variant || !matchedSvc) return;
                                    const newName = `${matchedSvc.name} (${variant.label})`;
                                    await supabase.from("integrations").update({ provider_name: newName }).eq("id", provider.id);
                                    queryClient.invalidateQueries({ queryKey: ["integrations"] });
                                    toast({ title: "Model updated", description: `Switched to ${variant.label}.` });
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-auto min-w-[140px] bg-background text-[11px] gap-1 px-2">
                                    <SelectValue placeholder="Select version…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {matchedSvc.variants.map((v) => (
                                      <SelectItem key={v.id} value={v.id} className="text-xs">{v.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => { setEditingId(provider.id); setKeys((p) => ({ ...p, [provider.id]: "" })); }}>
                                <Pencil className="h-3 w-3" /> Change
                              </Button>
                            </div>
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
                        <Select value={selectedService} onValueChange={(val) => {
                          setSelectedService(val);
                          setSelectedVariant("");
                          const providerGroup = Object.values(PROVIDER_GROUPS).find((ids) => ids.includes(val));
                          if (providerGroup && integrations) {
                            const existingInt = integrations.find((int) => {
                              const mappedSection = LEGACY_SECTION_MAP[int.section_id] || int.section_id;
                              const cat = SERVICE_CATALOGS[mappedSection] || [];
                              const matchedSvc = cat.find((s) => int.provider_name.startsWith(s.name));
                              return matchedSvc && providerGroup.includes(matchedSvc.id) && int.is_verified && int.api_key_encrypted;
                            });
                            if (existingInt?.api_key_encrypted) {
                              setServiceKey(existingInt.api_key_encrypted);
                              return;
                            }
                          }
                          setServiceKey("");
                        }}>
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
                  ) : null}

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

        <div className="grid grid-cols-2 gap-4">
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

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveCreditSettings} disabled={savingCredits} className="gap-2">
                {savingCredits ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Thresholds</>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ScrollArea>
  );
};

export default SettingsIntegrations;
