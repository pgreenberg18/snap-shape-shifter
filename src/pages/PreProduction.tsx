import { useState, useCallback, useEffect } from "react";
import { useCharacters, useShots, useBreakdownAssets, useFilmId } from "@/hooks/useFilm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, MapPin, Shirt, Mic, Film, Lock, Sparkles, Loader2, Check, User,
  Save, AudioWaveform, Package,
} from "lucide-react";
import CharacterSidebar from "@/components/pre-production/CharacterSidebar";
import StoryboardPanel from "@/components/pre-production/StoryboardPanel";
import DnDGroupPane from "@/components/pre-production/DnDGroupPane";

/* ── Audition card type ── */
interface AuditionCard {
  id: number;
  section: "archetype" | "wildcard" | "novel";
  label: string;
  imageUrl: string | null;
  locked: boolean;
}

const CARD_TEMPLATE: Omit<AuditionCard, "imageUrl" | "locked">[] = [
  { id: 0, section: "archetype", label: "Classic" },
  { id: 1, section: "archetype", label: "Dramatic" },
  { id: 2, section: "archetype", label: "Subtle" },
  { id: 3, section: "archetype", label: "Intense" },
  { id: 4, section: "archetype", label: "Warm" },
  { id: 5, section: "wildcard", label: "Unexpected A" },
  { id: 6, section: "wildcard", label: "Unexpected B" },
  { id: 7, section: "wildcard", label: "Unexpected C" },
  { id: 8, section: "novel", label: "Novel I" },
  { id: 9, section: "novel", label: "Novel II" },
];

const PLACEHOLDER_FACES = [
  "https://api.dicebear.com/9.x/personas/svg?seed=classic",
  "https://api.dicebear.com/9.x/personas/svg?seed=dramatic",
  "https://api.dicebear.com/9.x/personas/svg?seed=subtle",
  "https://api.dicebear.com/9.x/personas/svg?seed=intense",
  "https://api.dicebear.com/9.x/personas/svg?seed=warm",
  "https://api.dicebear.com/9.x/personas/svg?seed=unexpectedA",
  "https://api.dicebear.com/9.x/personas/svg?seed=unexpectedB",
  "https://api.dicebear.com/9.x/personas/svg?seed=unexpectedC",
  "https://api.dicebear.com/9.x/personas/svg?seed=novelI",
  "https://api.dicebear.com/9.x/personas/svg?seed=novelII",
];

const PreProduction = () => {
  const { data: characters, isLoading } = useCharacters();
  const filmId = useFilmId();
  const { data: breakdownAssets } = useBreakdownAssets();
  const queryClient = useQueryClient();
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [cards, setCards] = useState<AuditionCard[]>([]);
  const [locking, setLocking] = useState<number | null>(null);
  // Voice state
  const [voiceDesc, setVoiceDesc] = useState("");
  const [savingVoice, setSavingVoice] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);

  const selectedChar = characters?.find((c) => c.id === selectedCharId) ?? null;

  // Sync voice description when character changes
  useEffect(() => {
    setVoiceDesc(selectedChar?.voice_description ?? "");
  }, [selectedChar?.id, selectedChar?.voice_description]);

  const handleGenerate = useCallback(async () => {
    if (!selectedChar) return;
    setGenerating(true);
    // Simulate AI generation delay
    await new Promise((r) => setTimeout(r, 2200));
    const generated: AuditionCard[] = CARD_TEMPLATE.map((t, i) => ({
      ...t,
      imageUrl: `${PLACEHOLDER_FACES[i]}&backgroundColor=1a1a2e&scale=90`,
      locked: false,
    }));
    setCards(generated);
    setGenerating(false);
    toast.success(`10 audition faces generated for ${selectedChar.name}`);
  }, [selectedChar]);

  const handleLockIdentity = useCallback(async (card: AuditionCard) => {
    if (!selectedChar || !card.imageUrl) return;
    setLocking(card.id);
    const { error } = await supabase
      .from("characters")
      .update({ image_url: card.imageUrl })
      .eq("id", selectedChar.id);
    setLocking(null);
    if (error) {
      toast.error("Failed to lock identity");
      return;
    }
    setCards((prev) => prev.map((c) => ({ ...c, locked: c.id === card.id })));
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast.success(`${selectedChar.name}'s identity locked`);
  }, [selectedChar, queryClient]);

  const handleSaveVoiceDesc = useCallback(async () => {
    if (!selectedChar) return;
    setSavingVoice(true);
    const { error } = await supabase
      .from("characters")
      .update({ voice_description: voiceDesc || null })
      .eq("id", selectedChar.id);
    setSavingVoice(false);
    if (error) { toast.error("Failed to save voice description"); return; }
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast.success(`Voice description saved for ${selectedChar.name}`);
  }, [selectedChar, voiceDesc, queryClient]);

  const handleSynthesizeSeed = useCallback(async () => {
    if (!selectedChar) return;
    setSynthesizing(true);
    await new Promise((r) => setTimeout(r, 2400));
    const seed = Math.floor(100000 + Math.random() * 900000);
    const { error } = await supabase
      .from("characters")
      .update({ voice_generation_seed: seed })
      .eq("id", selectedChar.id);
    setSynthesizing(false);
    if (error) { toast.error("Failed to synthesize voice seed"); return; }
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast.success(`Voice seed locked for ${selectedChar.name}`);
  }, [selectedChar, queryClient]);

  // Reset cards when switching characters
  const selectChar = (id: string) => {
    setSelectedCharId(id);
    setCards([]);
  };

  const sections: { key: AuditionCard["section"]; title: string; count: number }[] = [
    { key: "archetype", title: "Archetypes", count: 5 },
    { key: "wildcard", title: "Wildcards", count: 3 },
    { key: "novel", title: "Novel AI Faces", count: 2 },
  ];

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
            <WarRoomTab value="casting" icon={Users} label="Casting & Voice" />
            <WarRoomTab value="locations" icon={MapPin} label="Locations" />
            <WarRoomTab value="props" icon={Package} label="Props" />
            <WarRoomTab value="wardrobe" icon={Shirt} label="Wardrobe" />
            <WarRoomTab value="storyboard" icon={Film} label="Storyboard Pre-Viz" />
          </TabsList>
        </div>

        {/* ═══ CASTING TAB ═══ */}
        <TabsContent value="casting" className="flex-1 flex overflow-hidden m-0">
          <CharacterSidebar
            characters={characters}
            isLoading={isLoading}
            selectedCharId={selectedCharId}
            onSelect={selectChar}
            showVoiceSeed
          />

          {/* Main staging area */}
          <main className="flex-1 overflow-y-auto">
            {selectedChar ? (
              <div className="p-6 space-y-6">
                {/* Character header + Generate button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                      {selectedChar.image_url ? (
                        <img src={selectedChar.image_url} alt={selectedChar.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-display font-bold text-muted-foreground">{selectedChar.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold text-foreground">{selectedChar.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {selectedChar.image_url ? "Identity locked — regenerate to change" : "Generate auditions to begin casting"}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="gap-2"
                  >
                    {generating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Generating Faces…</>
                    ) : (
                      <><Sparkles className="h-4 w-4" />Generate Auditions</>
                    )}
                  </Button>
                </div>

                {/* Audition cards grid */}
                {cards.length === 0 && !generating ? (
                  <div className="rounded-xl border border-border bg-accent/30 backdrop-blur-sm p-12 text-center cinema-shadow">
                    <User className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Click <span className="text-primary font-semibold">Generate Auditions</span> to create 10 AI face variations for{" "}
                      <span className="text-primary font-semibold">{selectedChar.name}</span>.
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-2">
                      5 Archetypes · 3 Wildcards · 2 Novel AI Faces
                    </p>
                  </div>
                ) : generating ? (
                  <div className="rounded-xl border border-border bg-card p-12 flex flex-col items-center gap-4 cinema-shadow">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <div className="text-center">
                      <p className="font-display font-semibold text-foreground">Generating 10 audition faces…</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Analyzing {selectedChar.name}'s character description to produce archetypes, wildcards, and novel variations.
                      </p>
                    </div>
                    {/* Skeleton grid */}
                    <div className="grid grid-cols-5 gap-3 w-full mt-4">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="aspect-[3/4] rounded-lg bg-secondary animate-pulse" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sections.map(({ key, title }) => {
                      const sectionCards = cards.filter((c) => c.section === key);
                      return (
                        <div key={key}>
                          <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
                              {title}
                            </h3>
                            <span className="text-[10px] text-muted-foreground/50 bg-secondary px-1.5 py-0.5 rounded">
                              {sectionCards.length}
                            </span>
                            <div className="flex-1 border-t border-border ml-2" />
                          </div>
                          <div className={cn(
                            "grid gap-3",
                            key === "archetype" ? "grid-cols-5" : key === "wildcard" ? "grid-cols-3" : "grid-cols-2"
                          )}>
                            {sectionCards.map((card) => (
                              <AuditionCardComponent
                                key={card.id}
                                card={card}
                                locking={locking === card.id}
                                onLock={() => handleLockIdentity(card)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ═══ VOICE IDENTITY SECTION ═══ */}
                <div className="border-t border-border pt-6 mt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-primary" />
                    <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                      Voice Identity
                    </h3>
                  </div>

                  {/* Voice Description */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4 cinema-shadow">
                    <div className="flex items-center gap-2">
                      <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Voice Description</p>
                    </div>
                    <Textarea
                      value={voiceDesc}
                      onChange={(e) => setVoiceDesc(e.target.value)}
                      placeholder="Gravelly, mid-40s, slight transatlantic accent…"
                      className="min-h-[80px] bg-secondary/50 border-border text-sm resize-none"
                    />
                    <Button onClick={handleSaveVoiceDesc} disabled={savingVoice} variant="secondary" className="gap-2">
                      {savingVoice ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Description</>}
                    </Button>
                  </div>

                  {/* Voice Seed */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4 cinema-shadow">
                    <div className="flex items-center gap-2">
                      <AudioWaveform className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Voice Seed</p>
                    </div>

                    {selectedChar.voice_generation_seed ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Locked Seed</p>
                            <p className="font-display text-2xl font-bold tracking-wider text-primary tabular-nums">
                              {selectedChar.voice_generation_seed}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                            <Lock className="h-3 w-3" /> Locked
                          </div>
                        </div>
                        <div className="rounded-lg bg-secondary/50 border border-border p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Voice Profile — Ready for Production</p>
                          <div className="flex items-end justify-center gap-[3px] h-10">
                            {Array.from({ length: 32 }).map((_, i) => (
                              <div
                                key={i}
                                className="w-[3px] rounded-full bg-primary/70"
                                style={{
                                  height: `${12 + Math.sin(i * 0.6) * 18 + Math.cos(i * 1.1) * 10}px`,
                                  animation: `waveform-bar ${0.8 + (i % 5) * 0.15}s ease-in-out ${i * 0.04}s infinite alternate`,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <Button onClick={handleSynthesizeSeed} disabled={synthesizing} variant="outline" className="gap-2 w-full">
                          {synthesizing ? <><Loader2 className="h-4 w-4 animate-spin" />Re-synthesizing…</> : <><AudioWaveform className="h-4 w-4" />Re-synthesize Voice Seed</>}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Generate a unique voice seed for <span className="text-primary font-semibold">{selectedChar.name}</span>. This locks the vocal identity for production.
                        </p>
                        <Button onClick={handleSynthesizeSeed} disabled={synthesizing} className="gap-2 w-full">
                          {synthesizing ? <><Loader2 className="h-4 w-4 animate-spin" />Synthesizing…</> : <><AudioWaveform className="h-4 w-4" />Synthesize Voice Seed</>}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 h-full">
                <div className="text-center space-y-3">
                  <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                    <Users className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h2 className="font-display text-xl font-bold text-foreground">
                    Casting & Voice
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Select a character to lock their visual identity and vocal profile.
                  </p>
                </div>
              </div>
            )}
          </main>
        </TabsContent>

        {/* ═══ PLACEHOLDER TABS ═══ */}
        <TabsContent value="locations" className="flex-1 flex overflow-hidden m-0">
          <DnDGroupPane
            items={breakdownAssets?.locations ?? []}
            filmId={filmId}
            storagePrefix="locations"
            icon={MapPin}
            title="Locations"
            emptyMessage="No locations extracted yet. Lock your script in Development."
          />
        </TabsContent>
        <TabsContent value="props" className="flex-1 flex overflow-hidden m-0">
          <DnDGroupPane
            items={breakdownAssets?.props ?? []}
            filmId={filmId}
            storagePrefix="props"
            icon={Package}
            title="Props"
            emptyMessage="No props extracted yet. Lock your script in Development."
          />
        </TabsContent>
        <TabsContent value="wardrobe" className="flex-1 flex overflow-hidden m-0">
          <DnDGroupPane
            items={(breakdownAssets?.wardrobe ?? []).map((w) => w.clothing)}
            filmId={filmId}
            storagePrefix="wardrobe"
            icon={Shirt}
            title="Wardrobe"
            emptyMessage="No wardrobe data extracted yet. Lock your script in Development."
            subtitles={(breakdownAssets?.wardrobe ?? []).reduce((acc, w) => {
              acc[w.clothing] = w.character;
              return acc;
            }, {} as Record<string, string>)}
          />
        </TabsContent>
        <TabsContent value="storyboard" className="flex-1 flex overflow-hidden m-0">
          <StoryboardPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ── Audition Card ── */
const AuditionCardComponent = ({ card, locking, onLock }: { card: AuditionCard; locking: boolean; onLock: () => void }) => (
  <div
    className={cn(
      "group relative aspect-[3/4] rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer",
      card.locked
        ? "border-primary/50 ring-2 ring-primary/30"
        : "border-border hover:border-primary/30 hover:cinema-glow"
    )}
  >
    {/* Face image */}
    {card.imageUrl ? (
      <img src={card.imageUrl} alt={card.label} className="h-full w-full object-cover bg-secondary" />
    ) : (
      <div className="h-full w-full bg-secondary flex items-center justify-center">
        <User className="h-8 w-8 text-muted-foreground/20" />
      </div>
    )}

    {/* Label */}
    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/90 to-transparent p-2 pt-6">
      <p className="text-[10px] font-display font-semibold uppercase tracking-wider text-foreground truncate">
        {card.label}
      </p>
    </div>

    {/* Locked badge */}
    {card.locked && (
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">
        <Check className="h-3 w-3" />
        Locked
      </div>
    )}

    {/* Hover overlay with Lock button */}
    {!card.locked && (
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          onClick={(e) => { e.stopPropagation(); onLock(); }}
          disabled={locking}
          className="gap-1.5"
        >
          {locking ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Locking…</>
          ) : (
            <><Lock className="h-3.5 w-3.5" />Lock Identity</>
          )}
        </Button>
      </div>
    )}
  </div>
);

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

/* ── Breakdown List Pane (Locations) ── */
const BreakdownListPane = ({ icon: Icon, title, emptyMessage, items }: { icon: any; title: string; emptyMessage: string; items: string[] }) => (
  <div className="flex-1 flex flex-col overflow-hidden">
    <div className="px-6 py-4 border-b border-border">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">{items.length}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Extracted from script breakdown · Lock assets for production</p>
    </div>
    <ScrollArea className="flex-1">
      {items.length === 0 ? (
        <div className="flex items-center justify-center p-12 text-center">
          <div className="space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
              <Icon className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">{emptyMessage}</p>
          </div>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-1 hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-sm font-display font-semibold text-foreground truncate">{item}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  </div>
);

/* ── Props & Wardrobe Pane ── */
const PropsWardrobePane = ({ props, wardrobe }: { props: string[]; wardrobe: { character: string; clothing: string }[] }) => (
  <div className="flex-1 flex flex-col overflow-hidden">
    <div className="px-6 py-4 border-b border-border">
      <div className="flex items-center gap-2">
        <Shirt className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">Props & Wardrobe</h2>
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
          {props.length} props · {wardrobe.length} wardrobe
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Extracted from script breakdown · All items identified across scenes</p>
    </div>
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-8">
        {/* Props */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Props & Key Objects</h3>
            <div className="flex-1 border-t border-border ml-2" />
          </div>
          {props.length === 0 ? (
            <p className="text-sm text-muted-foreground">No props extracted yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {props.map((p, i) => (
                <span key={i} className="inline-flex items-center rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Wardrobe */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Wardrobe</h3>
            <div className="flex-1 border-t border-border ml-2" />
          </div>
          {wardrobe.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wardrobe data extracted yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {wardrobe.map((w, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{w.character}</p>
                  <p className="text-sm text-foreground">{w.clothing}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  </div>
);

export default PreProduction;
