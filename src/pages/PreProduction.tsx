import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useCharacters, useShots, useBreakdownAssets, useFilmId, useFilm } from "@/hooks/useFilm";
import { useCharacterRanking } from "@/hooks/useCharacterRanking";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, MapPin, Shirt, Mic, Film, Lock, Sparkles, Loader2, Check, User,
  Save, AudioWaveform, Package, Car, ChevronDown, ChevronRight, Upload,
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
  generating?: boolean;
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

const PreProduction = () => {
  const { data: characters, isLoading } = useCharacters();
  const { data: film } = useFilm();
  const filmId = useFilmId();
  const { data: breakdownAssets } = useBreakdownAssets();
  const rankings = useCharacterRanking();
  const queryClient = useQueryClient();
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [cards, setCards] = useState<AuditionCard[]>([]);
  const [locking, setLocking] = useState<number | null>(null);
  // Voice state
  const [voiceDesc, setVoiceDesc] = useState("");
  const [savingVoice, setSavingVoice] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  // Character metadata state
  const [charDescription, setCharDescription] = useState("");
  const [charSex, setCharSex] = useState("Unknown");
  const [charAgeMin, setCharAgeMin] = useState("");
  const [charAgeMax, setCharAgeMax] = useState("");
  const [charIsChild, setCharIsChild] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedChar = characters?.find((c) => c.id === selectedCharId) ?? null;
  const hasLockedImage = !!selectedChar?.image_url;

  // Fetch script analysis for auto-deducing metadata
  const { data: scriptAnalysis } = useQuery({
    queryKey: ["script-analysis-for-chars", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("script_analyses")
        .select("scene_breakdown, global_elements")
        .eq("film_id", filmId!)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });

  // Auto-deduce character metadata from script analysis when character is selected
  useEffect(() => {
    if (!selectedChar) return;
    const existing = selectedChar as any;
    setVoiceDesc(selectedChar.voice_description ?? "");
    setCharDescription(existing.description ?? "");
    setCharSex(existing.sex ?? "Unknown");
    setCharAgeMin(existing.age_min?.toString() ?? "");
    setCharAgeMax(existing.age_max?.toString() ?? "");
    setCharIsChild(existing.is_child ?? false);
    setVoiceOpen(false);

    // Auto-populate from script if fields are empty
    if (!existing.description && !existing.sex && !existing.age_min && scriptAnalysis?.scene_breakdown) {
      const deduced = deduceCharacterMeta(selectedChar.name, scriptAnalysis.scene_breakdown as any[]);
      if (deduced) {
        if (deduced.description) setCharDescription(deduced.description);
        if (deduced.sex && deduced.sex !== "Unknown") setCharSex(deduced.sex);
        if (deduced.ageMin) setCharAgeMin(deduced.ageMin.toString());
        if (deduced.ageMax) setCharAgeMax(deduced.ageMax.toString());
        if (deduced.isChild !== undefined) setCharIsChild(deduced.isChild);
      }
    }
  }, [selectedChar?.id, scriptAnalysis]);

  const handleSaveMeta = useCallback(async () => {
    if (!selectedChar) return;
    setSavingMeta(true);
    const { error } = await supabase.from("characters").update({
      description: charDescription || null,
      sex: charSex,
      age_min: charAgeMin ? parseInt(charAgeMin) : null,
      age_max: charAgeMax ? parseInt(charAgeMax) : null,
      is_child: charIsChild,
    } as any).eq("id", selectedChar.id);
    setSavingMeta(false);
    if (error) { toast.error("Failed to save character details"); return; }
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast.success(`Details saved for ${selectedChar.name}`);
  }, [selectedChar, charDescription, charSex, charAgeMin, charAgeMax, charIsChild, queryClient]);

  const handleGenerate = useCallback(async () => {
    if (!selectedChar) return;
    setGenerating(true);

    const skeletonCards: AuditionCard[] = CARD_TEMPLATE.map((t) => ({
      ...t, imageUrl: null, locked: false, generating: true,
    }));
    setCards(skeletonCards);

    const results = await Promise.allSettled(
      CARD_TEMPLATE.map(async (t) => {
        const { data, error } = await supabase.functions.invoke("generate-headshot", {
          body: {
            characterName: selectedChar.name,
            description: charDescription || (selectedChar as any)?.description || "",
            sex: charSex !== "Unknown" ? charSex : (selectedChar as any)?.sex,
            ageMin: charAgeMin ? parseInt(charAgeMin) : (selectedChar as any)?.age_min,
            ageMax: charAgeMax ? parseInt(charAgeMax) : (selectedChar as any)?.age_max,
            isChild: charIsChild,
            filmTitle: film?.title ?? "",
            timePeriod: film?.time_period ?? "",
            genre: "",
            cardIndex: t.id,
          },
        });
        if (error) throw error;
        return { id: t.id, imageUrl: data?.imageUrl ?? null };
      })
    );

    const finalCards: AuditionCard[] = CARD_TEMPLATE.map((t) => {
      const result = results[t.id];
      const imageUrl = result.status === "fulfilled" ? result.value.imageUrl : null;
      return { ...t, imageUrl, locked: false, generating: false };
    });

    setCards(finalCards);
    setGenerating(false);

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    toast.success(`${successCount}/10 audition faces generated for ${selectedChar.name}`);
  }, [selectedChar, charDescription, charSex, charAgeMin, charAgeMax, charIsChild, film]);

  const handleLockIdentity = useCallback(async (card: AuditionCard) => {
    if (!selectedChar || !card.imageUrl) return;
    setLocking(card.id);
    const { error } = await supabase
      .from("characters")
      .update({ image_url: card.imageUrl })
      .eq("id", selectedChar.id);
    setLocking(null);
    if (error) { toast.error("Failed to lock identity"); return; }
    setCards((prev) => prev.map((c) => ({ ...c, locked: c.id === card.id })));
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast.success(`${selectedChar.name}'s identity locked`);
  }, [selectedChar, queryClient]);

  const handleUploadReference = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChar || !filmId) return;
    setUploadingRef(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${filmId}/references/${selectedChar.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("character-assets").upload(path, file, { upsert: true });
    if (uploadErr) { toast.error("Upload failed"); setUploadingRef(false); return; }
    const { data: urlData } = supabase.storage.from("character-assets").getPublicUrl(path);
    await supabase.from("characters").update({ reference_image_url: urlData.publicUrl } as any).eq("id", selectedChar.id);
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast.success("Reference image uploaded");
    setUploadingRef(false);
  }, [selectedChar, filmId, queryClient]);

  const handleSuggestCasting = useCallback((charId: string) => {
    const char = characters?.find(c => c.id === charId);
    if (!char) return;
    setSelectedCharId(charId);
    // Trigger generation automatically
    setTimeout(() => {
      const btn = document.querySelector('[data-casting-call]') as HTMLButtonElement;
      if (btn) btn.click();
    }, 100);
  }, [characters]);

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

  const selectChar = (id: string) => {
    setSelectedCharId(id);
    setCards([]);
  };

  const sections: { key: AuditionCard["section"]; title: string }[] = [
    { key: "archetype", title: "Archetypes" },
    { key: "wildcard", title: "Wildcards" },
    { key: "novel", title: "Novel AI Faces" },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <header className="shrink-0 border-b border-border bg-card px-6 py-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Pre-Production War Room</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Asset &amp; Identity Lock — define every visual and auditory element before shooting begins.
        </p>
      </header>

      <Tabs defaultValue="casting" className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border bg-card/60 backdrop-blur-sm px-6">
          <TabsList className="h-12 bg-transparent gap-1 p-0">
            <WarRoomTab value="casting" icon={Users} label="Auditions" />
            <WarRoomTab value="locations" icon={MapPin} label="Locations" />
            <WarRoomTab value="props" icon={Package} label="Props" />
            <WarRoomTab value="wardrobe" icon={Shirt} label="Wardrobe" />
            <WarRoomTab value="vehicles" icon={Car} label="Picture Vehicles" />
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
            onSuggest={handleSuggestCasting}
            showVoiceSeed
            rankings={rankings}
          />

          <main className="flex-1 overflow-y-auto">
            {selectedChar ? (
              <div className="p-6 space-y-6">
                {/* Character header + Casting Call button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                      {selectedChar.image_url ? (
                        <img src={selectedChar.image_url} alt={selectedChar.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-display text-lg font-bold text-muted-foreground">{selectedChar.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold text-foreground">{selectedChar.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {selectedChar.image_url ? "Identity locked — regenerate to change" : "Run a Casting Call to begin"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Upload reference image */}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadReference} />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingRef} className="gap-2">
                      {uploadingRef ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Upload Reference
                    </Button>
                    <Button data-casting-call onClick={handleGenerate} disabled={generating} className="gap-2">
                      {generating ? <><Loader2 className="h-4 w-4 animate-spin" />Casting…</> : <><Sparkles className="h-4 w-4" />Casting Call</>}
                    </Button>
                  </div>
                </div>

                {/* Reference image preview */}
                {(selectedChar as any).reference_image_url && (
                  <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                    <img src={(selectedChar as any).reference_image_url} alt="Reference" className="h-16 w-16 rounded-lg object-cover border border-border" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reference Image</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">This will inform AI casting suggestions</p>
                    </div>
                  </div>
                )}

                {/* ═══ CHARACTER METADATA ═══ */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4 cinema-shadow">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Character Details</h3>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                    <Textarea
                      value={charDescription}
                      onChange={(e) => setCharDescription(e.target.value)}
                      placeholder="A weathered detective in his late 40s, carries himself with quiet authority…"
                      className="min-h-[80px] bg-secondary/50 border-border text-sm resize-none"
                    />
                  </div>

                  {/* Sex / Age / Child row */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sex</label>
                      <Select value={charSex} onValueChange={setCharSex}>
                        <SelectTrigger className="h-9 bg-secondary/50 border-border text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Age Min</label>
                      <Input
                        type="number"
                        value={charAgeMin}
                        onChange={(e) => setCharAgeMin(e.target.value)}
                        placeholder="25"
                        className="h-9 bg-secondary/50 border-border text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Age Max</label>
                      <Input
                        type="number"
                        value={charAgeMax}
                        onChange={(e) => setCharAgeMax(e.target.value)}
                        placeholder="35"
                        className="h-9 bg-secondary/50 border-border text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Adult / Child</label>
                      <Select value={charIsChild ? "child" : "adult"} onValueChange={(v) => setCharIsChild(v === "child")}>
                        <SelectTrigger className="h-9 bg-secondary/50 border-border text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="adult">Adult</SelectItem>
                          <SelectItem value="child">Child</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={handleSaveMeta} disabled={savingMeta} variant="secondary" className="gap-2">
                    {savingMeta ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Details</>}
                  </Button>
                </div>

                {/* Audition cards grid */}
                {cards.length === 0 && !generating ? (
                  <div className="rounded-xl border border-border bg-accent/30 backdrop-blur-sm p-12 text-center cinema-shadow">
                    <User className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Click <span className="text-primary font-semibold">Casting Call</span> to create 10 AI headshot variations for{" "}
                      <span className="text-primary font-semibold">{selectedChar.name}</span>.
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-2">5 Archetypes · 3 Wildcards · 2 Novel AI Faces</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sections.map(({ key, title }) => {
                      const sectionCards = cards.filter((c) => c.section === key);
                      return (
                        <div key={key}>
                          <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
                            <span className="text-[10px] text-muted-foreground/50 bg-secondary px-1.5 py-0.5 rounded">{sectionCards.length}</span>
                            <div className="flex-1 border-t border-border ml-2" />
                          </div>
                          <div className={cn(
                            "grid gap-3",
                            key === "archetype" ? "grid-cols-5" : key === "wildcard" ? "grid-cols-3" : "grid-cols-2"
                          )}>
                            {sectionCards.map((card) => (
                              <AuditionCardComponent key={card.id} card={card} locking={locking === card.id} onLock={() => handleLockIdentity(card)} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ═══ VOICE IDENTITY SECTION — Gated behind image lock ═══ */}
                <Collapsible open={voiceOpen} onOpenChange={setVoiceOpen} disabled={!hasLockedImage}>
                  <div className={cn("border-t border-border pt-4 mt-6", !hasLockedImage && "opacity-50")}>
                    <CollapsibleTrigger className="w-full flex items-center gap-2 group" disabled={!hasLockedImage}>
                      {voiceOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <Mic className="h-4 w-4 text-primary" />
                      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Voice Identity</h3>
                      {!hasLockedImage && (
                        <span className="text-[10px] text-muted-foreground ml-2 flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Lock a face first
                        </span>
                      )}
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="space-y-4 mt-4">
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
                                <p className="font-display text-2xl font-bold tracking-wider text-primary tabular-nums">{selectedChar.voice_generation_seed}</p>
                              </div>
                              <div className="flex items-center gap-1.5 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                                <Lock className="h-3 w-3" /> Locked
                              </div>
                            </div>
                            <div className="rounded-lg bg-secondary/50 border border-border p-4">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Voice Profile — Ready for Production</p>
                              <div className="flex items-end justify-center gap-[3px] h-10">
                                {Array.from({ length: 32 }).map((_, i) => (
                                  <div key={i} className="w-[3px] rounded-full bg-primary/70"
                                    style={{ height: `${12 + Math.sin(i * 0.6) * 18 + Math.cos(i * 1.1) * 10}px`, animation: `waveform-bar ${0.8 + (i % 5) * 0.15}s ease-in-out ${i * 0.04}s infinite alternate` }} />
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
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 h-full">
                <div className="text-center space-y-3">
                  <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                    <Users className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h2 className="font-display text-xl font-bold text-foreground">Auditions</h2>
                  <p className="text-sm text-muted-foreground max-w-sm">Select a character to lock their visual identity and vocal profile.</p>
                </div>
              </div>
            )}
          </main>
        </TabsContent>

        {/* ═══ OTHER TABS ═══ */}
        <TabsContent value="locations" className="flex-1 flex overflow-hidden m-0">
          <DnDGroupPane items={breakdownAssets?.locations ?? []} filmId={filmId} storagePrefix="locations" icon={MapPin} title="Locations" emptyMessage="No locations extracted yet. Lock your script in Development." />
        </TabsContent>
        <TabsContent value="props" className="flex-1 flex overflow-hidden m-0">
          <DnDGroupPane items={breakdownAssets?.props ?? []} filmId={filmId} storagePrefix="props" icon={Package} title="Props" emptyMessage="No props extracted yet. Lock your script in Development." />
        </TabsContent>
        <TabsContent value="wardrobe" className="flex-1 flex overflow-hidden m-0">
          <DnDGroupPane
            items={(breakdownAssets?.wardrobe ?? []).map((w) => w.clothing)} filmId={filmId} storagePrefix="wardrobe" icon={Shirt} title="Wardrobe"
            emptyMessage="No wardrobe data extracted yet. Lock your script in Development."
            subtitles={(breakdownAssets?.wardrobe ?? []).reduce((acc, w) => { acc[w.clothing] = w.character; return acc; }, {} as Record<string, string>)}
          />
        </TabsContent>
        <TabsContent value="vehicles" className="flex-1 flex overflow-hidden m-0">
          <DnDGroupPane items={breakdownAssets?.vehicles ?? []} filmId={filmId} storagePrefix="vehicles" icon={Car} title="Picture Vehicles" emptyMessage="No vehicles identified in the script breakdown yet." />
        </TabsContent>
        <TabsContent value="storyboard" className="flex-1 flex overflow-hidden m-0">
          <StoryboardPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ── Deduce character metadata from script analysis ── */
function deduceCharacterMeta(charName: string, scenes: any[]): {
  description: string; sex: string; ageMin: number | null; ageMax: number | null; isChild: boolean;
} | null {
  const nameUpper = charName.toUpperCase().replace(/\s*\(.*?\)\s*/g, "").trim();
  const descriptions: string[] = [];
  let sex = "Unknown";
  let ageMin: number | null = null;
  let ageMax: number | null = null;
  let isChild = false;

  for (const scene of scenes) {
    if (!Array.isArray(scene.characters)) continue;
    for (const c of scene.characters) {
      if (typeof c === "string") continue;
      const cName = (c.name || "").toUpperCase().replace(/\s*\(.*?\)\s*/g, "").trim();
      if (cName !== nameUpper) continue;

      // Collect behavior/expression descriptions
      if (c.physical_behavior) descriptions.push(c.physical_behavior);
      if (c.emotional_tone) descriptions.push(c.emotional_tone);
      if (c.key_expressions) descriptions.push(c.key_expressions);
    }

    // Check wardrobe for gender/age clues
    if (Array.isArray(scene.wardrobe)) {
      for (const w of scene.wardrobe) {
        const wChar = (w.character || "").toUpperCase().trim();
        if (wChar !== nameUpper) continue;
        const clothing = (w.clothing_style || "").toLowerCase();
        const hairMakeup = (w.hair_makeup || "").toLowerCase();
        const combined = clothing + " " + hairMakeup;

        // Sex deduction
        if (sex === "Unknown") {
          if (/\b(dress|skirt|blouse|heels|lipstick|mascara|her hair)\b/.test(combined)) sex = "Female";
          else if (/\b(suit|tie|beard|mustache|his hair)\b/.test(combined)) sex = "Male";
        }
      }
    }

    // Check scene description for age clues
    const desc = (scene.description || "").toLowerCase();
    const nameInDesc = charName.toLowerCase();
    if (desc.includes(nameInDesc)) {
      // Age patterns
      const agePatterns = [
        { re: /\b(\d{1,2})\s*(?:years?\s*old|year-old)\b/i, handler: (m: RegExpMatchArray) => { const a = parseInt(m[1]); return { min: a, max: a }; } },
        { re: /\bin\s+(?:his|her|their)\s+(?:early\s+)?(\d)0s\b/i, handler: (m: RegExpMatchArray) => { const d = parseInt(m[1]); return { min: d * 10, max: d * 10 + 9 }; } },
        { re: /\b(?:early)\s+(\d)0s\b/i, handler: (m: RegExpMatchArray) => { const d = parseInt(m[1]); return { min: d * 10, max: d * 10 + 3 }; } },
        { re: /\b(?:mid)\s*-?\s*(\d)0s\b/i, handler: (m: RegExpMatchArray) => { const d = parseInt(m[1]); return { min: d * 10 + 3, max: d * 10 + 6 }; } },
        { re: /\b(?:late)\s+(\d)0s\b/i, handler: (m: RegExpMatchArray) => { const d = parseInt(m[1]); return { min: d * 10 + 7, max: d * 10 + 9 }; } },
        { re: /\b(teenager|teen)\b/i, handler: () => ({ min: 13, max: 19 }) },
        { re: /\b(child|kid|boy|girl)\b/i, handler: () => ({ min: 5, max: 12 }) },
        { re: /\b(toddler|infant|baby)\b/i, handler: () => ({ min: 0, max: 3 }) },
        { re: /\b(elderly|old man|old woman)\b/i, handler: () => ({ min: 65, max: 85 }) },
        { re: /\b(middle.aged)\b/i, handler: () => ({ min: 40, max: 55 }) },
        { re: /\b(young man|young woman|young adult)\b/i, handler: () => ({ min: 20, max: 30 }) },
      ];
      for (const { re, handler } of agePatterns) {
        const match = desc.match(re);
        if (match && ageMin === null) {
          const result = handler(match);
          ageMin = result.min;
          ageMax = result.max;
          if (result.max <= 12) isChild = true;
        }
      }

      // Sex from description
      if (sex === "Unknown") {
        if (/\b(woman|girl|she|her|mother|wife|daughter|sister|actress|queen|princess)\b/i.test(desc)) sex = "Female";
        else if (/\b(man|guy|boy|he|his|father|husband|son|brother|actor|king|prince)\b/i.test(desc)) sex = "Male";
      }
    }
  }

  if (descriptions.length === 0 && sex === "Unknown" && ageMin === null) return null;

  // Build a concise description from the first few unique descriptors
  const uniqueDescs = [...new Set(descriptions)].slice(0, 4);
  const description = uniqueDescs.join(". ").replace(/\.\./g, ".");

  return { description, sex, ageMin, ageMax, isChild };
}

/* ── Audition Card ── */
const AuditionCardComponent = ({ card, locking, onLock }: { card: AuditionCard; locking: boolean; onLock: () => void }) => (
  <div className={cn(
    "group relative aspect-[3/4] rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer",
    card.locked ? "border-primary/50 ring-2 ring-primary/30" : "border-border hover:border-primary/30 hover:cinema-glow"
  )}>
    {card.generating ? (
      <div className="h-full w-full bg-secondary flex items-center justify-center animate-pulse">
        <Loader2 className="h-6 w-6 text-muted-foreground/40 animate-spin" />
      </div>
    ) : card.imageUrl ? (
      <img src={card.imageUrl} alt={card.label} className="h-full w-full object-cover bg-secondary" />
    ) : (
      <div className="h-full w-full bg-secondary flex items-center justify-center">
        <User className="h-8 w-8 text-muted-foreground/20" />
      </div>
    )}

    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/90 to-transparent p-2 pt-6">
      <p className="text-[10px] font-display font-semibold uppercase tracking-wider text-foreground truncate">{card.label}</p>
    </div>

    {card.locked && (
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">
        <Check className="h-3 w-3" /> Locked
      </div>
    )}

    {!card.locked && !card.generating && card.imageUrl && (
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onLock(); }} disabled={locking} className="gap-1.5">
          {locking ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Locking…</> : <><Lock className="h-3.5 w-3.5" />Lock Identity</>}
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

export default PreProduction;
