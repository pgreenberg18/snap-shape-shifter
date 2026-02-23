import { useState } from "react";
import { useCharacters } from "@/hooks/useFilm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Users, MapPin, Shirt, Mic, Film, ChevronRight,
} from "lucide-react";

const PreProduction = () => {
  const { data: characters, isLoading } = useCharacters();
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  const selectedChar = characters?.find((c) => c.id === selectedCharId) ?? null;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-border bg-card px-6 py-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Pre-Production War Room
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Asset &amp; Identity Lock — define every visual and auditory element before shooting begins.
        </p>
      </header>

      {/* ── Tabbed Interface ── */}
      <Tabs defaultValue="casting" className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border bg-card/60 backdrop-blur-sm px-6">
          <TabsList className="h-12 bg-transparent gap-1 p-0">
            <WarRoomTab value="casting" icon={Users} label="Casting (10/5 Engine)" />
            <WarRoomTab value="locations" icon={MapPin} label="Locations & 360 Panos" />
            <WarRoomTab value="props" icon={Shirt} label="Props & Wardrobe" />
            <WarRoomTab value="voice" icon={Mic} label="Voice Casting" />
            <WarRoomTab value="storyboard" icon={Film} label="Storyboard Pre-Viz" />
          </TabsList>
        </div>

        {/* ═══ CASTING TAB ═══ */}
        <TabsContent value="casting" className="flex-1 flex overflow-hidden m-0">
          {/* Sidebar — Character list */}
          <aside className="w-[280px] min-w-[240px] border-r border-border bg-card flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Characters
              </h2>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {characters?.length ?? 0} in cast
              </p>
            </div>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
                  ))}
                </div>
              ) : !characters?.length ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="font-display font-semibold">No characters yet</p>
                  <p className="text-xs mt-1">Analyze a script in Development to populate the cast.</p>
                </div>
              ) : (
                <div className="py-1">
                  {characters.map((char) => {
                    const isActive = selectedCharId === char.id;
                    return (
                      <button
                        key={char.id}
                        onClick={() => setSelectedCharId(char.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-l-2",
                          isActive
                            ? "border-l-primary bg-primary/5"
                            : "border-l-transparent hover:bg-secondary/60"
                        )}
                      >
                        {/* Avatar */}
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold font-display uppercase",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground"
                          )}
                        >
                          {char.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm font-display font-semibold truncate",
                              isActive ? "text-primary" : "text-foreground"
                            )}
                          >
                            {char.name}
                          </p>
                          {char.voice_description && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {char.voice_description}
                            </p>
                          )}
                        </div>
                        {isActive && (
                          <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </aside>

          {/* Main staging area */}
          <main className="flex-1 flex items-center justify-center p-8">
            {selectedChar ? (
              <div className="text-center space-y-4 max-w-lg">
                <div className="mx-auto h-20 w-20 rounded-full bg-secondary flex items-center justify-center cinema-inset">
                  <span className="font-display text-2xl font-bold text-muted-foreground">
                    {selectedChar.name.charAt(0)}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  {selectedChar.name}
                </h2>
                <div className="rounded-xl border border-border bg-accent/30 backdrop-blur-sm p-8 cinema-shadow">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Select an Audition Card to lock{" "}
                    <span className="text-primary font-semibold">{selectedChar.name}</span>'s identity.
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-3">
                    Audition cards with AI-generated face options will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                  <Users className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Casting — 10/5 Engine
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Select a character from the sidebar to begin the identity lock process.
                </p>
              </div>
            )}
          </main>
        </TabsContent>

        {/* ═══ PLACEHOLDER TABS ═══ */}
        <TabsContent value="locations" className="flex-1 m-0">
          <PlaceholderPane icon={MapPin} title="Locations & 360 Panos" description="Scout, generate, and lock location assets. 360° panoramic environment previews coming soon." />
        </TabsContent>
        <TabsContent value="props" className="flex-1 m-0">
          <PlaceholderPane icon={Shirt} title="Props & Wardrobe" description="Define and lock prop inventories and wardrobe continuity for every scene." />
        </TabsContent>
        <TabsContent value="voice" className="flex-1 m-0">
          <PlaceholderPane icon={Mic} title="Voice Casting" description="Generate and audition AI voice profiles for each character. Lock vocal identity before production." />
        </TabsContent>
        <TabsContent value="storyboard" className="flex-1 m-0">
          <PlaceholderPane icon={Film} title="Storyboard Pre-Viz" description="Build storyboard sequences and animated pre-visualizations from your locked scene breakdown." />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ── Tab trigger with icon ── */
const WarRoomTab = ({ value, icon: Icon, label }: { value: string; icon: any; label: string }) => (
  <TabsTrigger
    value={value}
    className="gap-2 px-4 py-2.5 text-xs font-display font-semibold uppercase tracking-wider rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none bg-transparent text-muted-foreground hover:text-foreground transition-colors"
  >
    <Icon className="h-3.5 w-3.5" />
    {label}
  </TabsTrigger>
);

/* ── Placeholder for unbuilt tabs ── */
const PlaceholderPane = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
  <div className="flex-1 flex items-center justify-center p-8 h-full">
    <div className="text-center space-y-3 max-w-md">
      <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center cinema-inset">
        <Icon className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  </div>
);

export default PreProduction;
