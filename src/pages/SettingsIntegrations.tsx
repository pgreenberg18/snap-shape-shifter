import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plug, MessageSquare, AudioLines, Camera, Clapperboard } from "lucide-react";

interface Provider {
  name: string;
  placeholder: string;
}

interface IntegrationSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  providers: Provider[];
}

const sections: IntegrationSection[] = [
  {
    id: "writers-room",
    title: "The Writer's Room (ChatGPT 5.3)",
    icon: <MessageSquare className="h-4 w-4" />,
    providers: [{ name: "OpenAI — ChatGPT 5.3", placeholder: "sk-proj-..." }],
  },
  {
    id: "sound-stage",
    title: "The Sound Stage (ElevenLabs)",
    icon: <AudioLines className="h-4 w-4" />,
    providers: [{ name: "ElevenLabs", placeholder: "xi-..." }],
  },
  {
    id: "camera-cart",
    title: "The Camera Cart (Seedance 2.0, Kling 3.0, Sora 2)",
    icon: <Camera className="h-4 w-4" />,
    providers: [
      { name: "Seedance 2.0", placeholder: "sd-..." },
      { name: "Kling 3.0", placeholder: "kl-..." },
      { name: "Sora 2", placeholder: "sora-..." },
    ],
  },
  {
    id: "post-house",
    title: "The Post House (SyncLabs, Topaz AI)",
    icon: <Clapperboard className="h-4 w-4" />,
    providers: [
      { name: "SyncLabs", placeholder: "sync-..." },
      { name: "Topaz AI", placeholder: "topaz-..." },
    ],
  },
];

const SettingsIntegrations = () => (
  <div className="mx-auto max-w-4xl px-6 py-10">
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <Plug className="h-5 w-5 text-primary" />
        <h2 className="font-display text-2xl font-bold">External Integrations (BYOK)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Bring Your Own Keys — connect your AI service providers.
      </p>
    </div>

    <Accordion type="multiple" className="space-y-3">
      {sections.map((section) => (
        <AccordionItem
          key={section.id}
          value={section.id}
          className="rounded-xl border border-border bg-card px-4 cinema-inset"
        >
          <AccordionTrigger className="text-sm font-display font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              {section.icon}
              {section.title}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              {section.providers.map((provider) => (
                <div
                  key={provider.name}
                  className="rounded-lg border border-border bg-secondary p-4 space-y-3"
                >
                  <p className="text-sm font-medium">{provider.name}</p>
                  <Input
                    type="password"
                    placeholder={provider.placeholder}
                    className="font-mono text-xs bg-background border-border"
                  />
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plug className="h-3.5 w-3.5" />
                    Connect & Verify
                  </Button>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </div>
);

export default SettingsIntegrations;
