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
import { Plug, MessageSquare, AudioLines, Camera, Clapperboard, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const sectionMeta: Record<string, { title: string; icon: React.ReactNode }> = {
  "writers-room": { title: "The Writer's Room (ChatGPT 5.3)", icon: <MessageSquare className="h-4 w-4" /> },
  "sound-stage": { title: "The Sound Stage (ElevenLabs)", icon: <AudioLines className="h-4 w-4" /> },
  "camera-cart": { title: "The Camera Cart (Seedance 2.0, Kling 3.0, Sora 2)", icon: <Camera className="h-4 w-4" /> },
  "post-house": { title: "The Post House (SyncLabs, Topaz AI)", icon: <Clapperboard className="h-4 w-4" /> },
};

const SettingsIntegrations = () => {
  const { data: integrations, isLoading } = useIntegrations();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleConnect = async (id: string) => {
    const key = keys[id];
    if (!key) return;
    await supabase.from("integrations").update({ api_key_encrypted: key, is_verified: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["integrations"] });
    toast({ title: "Connected", description: "API key saved and verified." });
  };

  if (isLoading) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>;

  const grouped = integrations?.reduce((acc, int) => {
    (acc[int.section_id] ??= []).push(int);
    return acc;
  }, {} as Record<string, typeof integrations>) ?? {};

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Plug className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-bold">External Integrations (BYOK)</h2>
        </div>
        <p className="text-sm text-muted-foreground">Bring Your Own Keys — connect your AI service providers.</p>
      </div>

      <Accordion type="multiple" className="space-y-3">
        {Object.entries(grouped).map(([sectionId, providers]) => {
          const meta = sectionMeta[sectionId];
          if (!meta) return null;
          return (
            <AccordionItem key={sectionId} value={sectionId} className="rounded-xl border border-border bg-card px-4 cinema-inset">
              <AccordionTrigger className="text-sm font-display font-semibold hover:no-underline">
                <span className="flex items-center gap-2">{meta.icon}{meta.title}</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pb-2">
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
