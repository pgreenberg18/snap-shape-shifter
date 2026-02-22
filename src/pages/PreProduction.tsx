import { useState } from "react";
import { mockCharacters } from "@/data/dummyData";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Lock, Eye, MapPin, Users, AudioLines, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

const PreProduction = () => {
  const [selectedChar, setSelectedChar] = useState(mockCharacters[0]);

  return (
    <div className="flex h-full">
      {/* Left Col — Accordion Menu */}
      <aside className="w-1/4 border-r border-border p-4 overflow-y-auto">
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Departments
        </h3>
        <Accordion type="single" collapsible defaultValue="characters">
          <AccordionItem value="pre-viz">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2"><Eye className="h-4 w-4" /> Pre-Viz</span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-xs text-muted-foreground">Storyboard sequences and animatics.</p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="characters">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Characters</span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-xs text-muted-foreground">Manage cast & AI character profiles.</p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="locations">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Locations</span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-xs text-muted-foreground">Scout and generate locations.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </aside>

      {/* Center Col — Character Cards */}
      <div className="w-1/2 overflow-y-auto p-6">
        <h2 className="font-display text-xl font-bold mb-4">Cast Gallery</h2>
        <div className="grid grid-cols-2 gap-4">
          {mockCharacters.map((char) => (
            <div
              key={char.id}
              onClick={() => setSelectedChar(char)}
              className="group relative rounded-xl border border-border bg-card overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1"
              style={{
                boxShadow: "0 8px 24px -4px hsl(0 0% 0% / 0.5), 0 4px 8px -2px hsl(0 0% 0% / 0.3)",
              }}
            >
              <img
                src={char.imageUrl}
                alt={char.name}
                className="h-48 w-full object-cover"
              />
              <div className="p-3">
                <p className="font-display font-semibold text-sm">{char.name}</p>
                <p className="text-xs text-muted-foreground truncate">{char.voiceDescription}</p>
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="outline" className="gap-1.5 border-primary/50 text-primary">
                  <Lock className="h-3.5 w-3.5" />
                  Lock Asset
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Col — Voice Casting */}
      <aside className="w-1/4 border-l border-border p-4 overflow-y-auto">
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Voice Casting
        </h3>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={selectedChar.imageUrl}
              alt={selectedChar.name}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/30"
            />
            <div>
              <p className="font-display font-semibold text-sm">{selectedChar.name}</p>
              <p className="text-xs text-muted-foreground">Seed #{selectedChar.voiceGenerationSeed}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {selectedChar.voiceDescription}
          </p>

          {/* Mock Audio Waveform */}
          <div className="rounded-lg bg-secondary p-4">
            <div className="flex items-center gap-2 mb-2">
              <AudioLines className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Waveform Preview</span>
            </div>
            <div className="flex items-end gap-[2px] h-12">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-full bg-primary/40"
                  style={{
                    height: `${Math.max(8, Math.sin(i * 0.4) * 30 + Math.random() * 20 + 10)}px`,
                  }}
                />
              ))}
            </div>
          </div>

          <Button className="w-full gap-2">
            <Mic className="h-4 w-4" />
            Generate Voice Profile
          </Button>
        </div>
      </aside>
    </div>
  );
};

export default PreProduction;
