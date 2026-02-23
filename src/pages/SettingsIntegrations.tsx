import { useState } from "react";
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
  Plug, ScrollText, Image, AudioLines, Camera, Clapperboard, Check, Plus, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

/* ── Service catalogs per section ── */
type ServiceDef = { id: string; name: string; placeholder: string };

const SERVICE_CATALOGS: Record<string, ServiceDef[]> = {
  "script-analysis": [
    { id: "openai-chat", name: "ChatGPT (OpenAI)", placeholder: "Enter OpenAI API key…" },
    { id: "gemini", name: "Gemini (Google)", placeholder: "Enter Gemini API key…" },
    { id: "claude", name: "Claude (Anthropic)", placeholder: "Enter Anthropic API key…" },
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
  ],
  "sound-stage": [
    { id: "elevenlabs", name: "ElevenLabs", placeholder: "Enter ElevenLabs API key…" },
    { id: "playht", name: "Play.ht", placeholder: "Enter Play.ht API key…" },
    { id: "murf", name: "Murf AI", placeholder: "Enter Murf API key…" },
    { id: "wellsaid", name: "WellSaid Labs", placeholder: "Enter WellSaid API key…" },
    { id: "resemble", name: "Resemble AI", placeholder: "Enter Resemble API key…" },
  ],
  "camera-cart": [
    { id: "seedance", name: "Seedance (ByteDance)", placeholder: "Enter Seedance API key…" },
    { id: "kling", name: "Kling AI", placeholder: "Enter Kling API key…" },
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
    title: "Video Generation (Seedance, Kling, Sora)",
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
  const { data: integrations, isLoading } = useIntegrations();
  const [keys, setKeys] = useState<Record<string, string>>({});
  // Per-section add state
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [addedServices, setAddedServices] = useState<Record<string, Array<{ id: string; name: string }>>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleConnect = async (id: string) => {
    const key = keys[id];
    if (!key) return;
    await supabase.from("integrations").update({ api_key_encrypted: key, is_verified: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["integrations"] });
    toast({ title: "Connected", description: "API key saved and verified." });
  };

  const handleAddService = (sectionId: string) => {
    if (!selectedService || !serviceKey) return;
    setSaving(true);
    const catalog = SERVICE_CATALOGS[sectionId] || [];
    const svc = catalog.find((s) => s.id === selectedService);
    setAddedServices((prev) => ({
      ...prev,
      [sectionId]: [...(prev[sectionId] || []), { id: selectedService, name: svc?.name || selectedService }],
    }));
    setSelectedService("");
    setServiceKey("");
    setAddingSection(null);
    setSaving(false);
    toast({ title: "Service added", description: `${svc?.name} connected.` });
  };

  const openAdd = (sectionId: string) => {
    setAddingSection(sectionId);
    setSelectedService("");
    setServiceKey("");
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
        <div className="flex items-center gap-2 mb-2">
          <Plug className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-bold">External Integrations (BYOK)</h2>
        </div>
        <p className="text-sm text-muted-foreground">Bring Your Own Keys — connect your AI service providers to enhance the pipeline.</p>
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
                <span className="flex items-center gap-2">{meta.icon}{meta.title}</span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-muted-foreground mb-3">{meta.description}</p>
                <div className="space-y-3 pb-2">
                  {/* Existing DB-backed providers */}
                  {providers?.map((provider) => (
                    <div key={provider.id} className="rounded-lg border border-border bg-secondary p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{provider.provider_name}</p>
                        {provider.is_verified && <Check className="h-4 w-4 text-green-400" />}
                      </div>
                      <Input
                        type="password"
                        placeholder="Enter API key…"
                        value={keys[provider.id] ?? ""}
                        onChange={(e) => setKeys((p) => ({ ...p, [provider.id]: e.target.value }))}
                        className="font-mono text-xs bg-background border-border"
                      />
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleConnect(provider.id)}>
                        <Plug className="h-3.5 w-3.5" />
                        Connect & Verify
                      </Button>
                    </div>
                  ))}

                  {/* Locally added services */}
                  {added.map((svc) => (
                    <div key={svc.id} className="rounded-lg border border-border bg-secondary p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{svc.name}</p>
                        <Check className="h-4 w-4 text-green-400" />
                      </div>
                    </div>
                  ))}

                  {/* Add new service form */}
                  {isAdding ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{meta.addLabel}</p>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setAddingSection(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Service</Label>
                        <Select value={selectedService} onValueChange={setSelectedService}>
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
                      {selectedService && (
                        <div className="space-y-1.5">
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">API Key</Label>
                          <Input
                            type="password"
                            placeholder={catalog.find((s) => s.id === selectedService)?.placeholder || "Enter API key…"}
                            value={serviceKey}
                            onChange={(e) => setServiceKey(e.target.value)}
                            className="font-mono text-xs bg-background border-border"
                          />
                        </div>
                      )}
                      <Button
                        size="sm"
                        className="gap-1.5 w-full"
                        disabled={!selectedService || !serviceKey || saving}
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
    </div>
  );
};

export default SettingsIntegrations;
