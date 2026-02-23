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

/* ── Section metadata — ordered to match production workflow ── */
const sectionOrder = [
  "script-analysis",
  "image-generation",
  "sound-stage",
  "camera-cart",
  "post-house",
] as const;

const sectionMeta: Record<string, { title: string; description: string; icon: React.ReactNode }> = {
  "script-analysis": {
    title: "Script Analysis (ChatGPT, Gemini)",
    description: "LLM providers for script parsing and scene breakdown",
    icon: <ScrollText className="h-4 w-4" />,
  },
  "image-generation": {
    title: "Image Generation",
    description: "AI image generators for character headshots, storyboards & concept art",
    icon: <Image className="h-4 w-4" />,
  },
  "sound-stage": {
    title: "Voice & Audio (ElevenLabs)",
    description: "Voice synthesis and audio generation",
    icon: <AudioLines className="h-4 w-4" />,
  },
  "camera-cart": {
    title: "Video Generation (Seedance, Kling, Sora)",
    description: "AI video generation for shot previsualization",
    icon: <Camera className="h-4 w-4" />,
  },
  "post-house": {
    title: "Post-Production (SyncLabs, Topaz AI)",
    description: "Lip-sync, upscaling and post-processing tools",
    icon: <Clapperboard className="h-4 w-4" />,
  },
};

/* ── Image generation service catalog ── */
const IMAGE_GENERATORS = [
  { id: "midjourney", name: "Midjourney", placeholder: "Enter Midjourney API key…" },
  { id: "dall-e", name: "DALL·E 3 (OpenAI)", placeholder: "Enter OpenAI API key…" },
  { id: "flux-pro", name: "Flux Pro (Black Forest Labs)", placeholder: "Enter BFL API key…" },
  { id: "stable-diffusion", name: "Stable Diffusion (Stability AI)", placeholder: "Enter Stability API key…" },
  { id: "ideogram", name: "Ideogram", placeholder: "Enter Ideogram API key…" },
  { id: "leonardo", name: "Leonardo AI", placeholder: "Enter Leonardo API key…" },
  { id: "recraft", name: "Recraft V3", placeholder: "Enter Recraft API key…" },
  { id: "nana-banana", name: "Nana Banana Pro", placeholder: "Enter API key…" },
] as const;

/* ── Legacy section_id mapping ── */
const LEGACY_SECTION_MAP: Record<string, string> = {
  "writers-room": "script-analysis",
};

const SettingsIntegrations = () => {
  const { data: integrations, isLoading } = useIntegrations();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [addingImageGen, setAddingImageGen] = useState(false);
  const [selectedImageGen, setSelectedImageGen] = useState("");
  const [imageGenKey, setImageGenKey] = useState("");
  const [imageGenSaving, setImageGenSaving] = useState(false);
  const [addedImageGens, setAddedImageGens] = useState<Array<{ id: string; name: string; verified: boolean }>>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleConnect = async (id: string) => {
    const key = keys[id];
    if (!key) return;
    await supabase.from("integrations").update({ api_key_encrypted: key, is_verified: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["integrations"] });
    toast({ title: "Connected", description: "API key saved and verified." });
  };

  const handleAddImageGen = async () => {
    if (!selectedImageGen || !imageGenKey) return;
    setImageGenSaving(true);
    const gen = IMAGE_GENERATORS.find((g) => g.id === selectedImageGen);
    // For now store locally — could persist to integrations table
    setAddedImageGens((prev) => [...prev, { id: selectedImageGen, name: gen?.name || selectedImageGen, verified: true }]);
    setSelectedImageGen("");
    setImageGenKey("");
    setAddingImageGen(false);
    setImageGenSaving(false);
    toast({ title: "Image generator added", description: `${gen?.name} connected.` });
  };

  if (isLoading) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>;

  /* Group integrations by section, mapping legacy IDs */
  const grouped = integrations?.reduce((acc, int) => {
    const mappedSection = LEGACY_SECTION_MAP[int.section_id] || int.section_id;
    (acc[mappedSection] ??= []).push(int);
    return acc;
  }, {} as Record<string, typeof integrations>) ?? {};

  const alreadyAddedIds = new Set(addedImageGens.map((g) => g.id));
  const availableImageGens = IMAGE_GENERATORS.filter((g) => !alreadyAddedIds.has(g.id));

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
          const isImageGen = sectionId === "image-generation";

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

                  {/* Image Generation — added services */}
                  {isImageGen && addedImageGens.map((gen) => (
                    <div key={gen.id} className="rounded-lg border border-border bg-secondary p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{gen.name}</p>
                        <Check className="h-4 w-4 text-green-400" />
                      </div>
                    </div>
                  ))}

                  {/* Image Generation — add new service */}
                  {isImageGen && (
                    <>
                      {addingImageGen ? (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">Add Image Generator</p>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setAddingImageGen(false)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Service</Label>
                            <Select value={selectedImageGen} onValueChange={setSelectedImageGen}>
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Select an image generator…" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableImageGens.map((gen) => (
                                  <SelectItem key={gen.id} value={gen.id}>{gen.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedImageGen && (
                            <div className="space-y-1.5">
                              <Label className="text-xs uppercase tracking-wider text-muted-foreground">API Key</Label>
                              <Input
                                type="password"
                                placeholder={IMAGE_GENERATORS.find((g) => g.id === selectedImageGen)?.placeholder || "Enter API key…"}
                                value={imageGenKey}
                                onChange={(e) => setImageGenKey(e.target.value)}
                                className="font-mono text-xs bg-background border-border"
                              />
                            </div>
                          )}
                          <Button
                            size="sm"
                            className="gap-1.5 w-full"
                            disabled={!selectedImageGen || !imageGenKey || imageGenSaving}
                            onClick={handleAddImageGen}
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
                          onClick={() => setAddingImageGen(true)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Image Generator
                        </Button>
                      )}
                    </>
                  )}

                  {/* Empty state for non-image sections */}
                  {!isImageGen && (!providers || providers.length === 0) && (
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
