import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useCharacters, useShots, useBreakdownAssets, useFilmId, useFilm } from "@/hooks/useFilm";
import { useCharacterRanking } from "@/hooks/useCharacterRanking";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, MapPin, Shirt, Mic, Film, Lock, Sparkles, Loader2, Check, User,
  Save, AudioWaveform, Package, Car, ChevronDown, ChevronRight, Upload, Eye, ScrollText,
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
  const { projectId, versionId } = useParams();
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
  const [analyzingRef, setAnalyzingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reclassified/dismissed props (persisted per film)
  const [reclassified, setReclassified] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!filmId) return;
    try {
      const raw = localStorage.getItem(`props-reclassified-${filmId}`);
      if (raw) setReclassified(JSON.parse(raw));
    } catch {}
  }, [filmId]);

  const handleReclassify = useCallback((item: string, target: string) => {
    setReclassified((prev) => {
      const next = { ...prev, [item]: target };
      if (filmId) localStorage.setItem(`props-reclassified-${filmId}`, JSON.stringify(next));
      return next;
    });
    if (target === "_dismiss") {
      toast.success(`"${item}" dismissed — not a prop`);
    } else {
      const labels: Record<string, string> = { locations: "Locations", vehicles: "Picture Vehicles" };
      toast.success(`"${item}" moved to ${labels[target] || target}`);
    }
  }, [filmId]);

  // Filter props: remove reclassified items; add reclassified-to items to their target categories
  const filteredProps = useMemo(() => (breakdownAssets?.props ?? []).filter((p) => !reclassified[p]), [breakdownAssets?.props, reclassified]);
  const reclassifiedToLocations = useMemo(() => Object.entries(reclassified).filter(([, t]) => t === "locations").map(([item]) => item), [reclassified]);
  const reclassifiedToVehicles = useMemo(() => Object.entries(reclassified).filter(([, t]) => t === "vehicles").map(([item]) => item), [reclassified]);
  const augmentedLocations = useMemo(() => [...(breakdownAssets?.locations ?? []), ...reclassifiedToLocations].sort(), [breakdownAssets?.locations, reclassifiedToLocations]);
  const augmentedVehicles = useMemo(() => [...(breakdownAssets?.vehicles ?? []), ...reclassifiedToVehicles].sort(), [breakdownAssets?.vehicles, reclassifiedToVehicles]);

  const selectedChar = characters?.find((c) => c.id === selectedCharId) ?? null;
  const hasLockedImage = !!selectedChar?.image_url;

  // Fetch script analysis for auto-deducing metadata + script viewer
  const { data: scriptAnalysis } = useQuery({
    queryKey: ["script-analysis-for-chars", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("script_analyses")
        .select("scene_breakdown, global_elements, storage_path")
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

  // Script viewer state
  const [scriptDialogOpen, setScriptDialogOpen] = useState(false);
  const [scriptDialogScene, setScriptDialogScene] = useState<any>(null);
  const [scriptDialogSceneNum, setScriptDialogSceneNum] = useState<number>(0);
  const [scriptParagraphs, setScriptParagraphs] = useState<{ type: string; text: string }[] | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);

  // Auto-deduce character metadata from script analysis when character is selected
  useEffect(() => {
    if (!selectedChar) return;
    const existing = selectedChar as any;
    setVoiceDesc(selectedChar.voice_description ?? "");
    setVoiceOpen(false);

    // First try DB values, then deduce from script
    const hasDbMeta = existing.description || (existing.sex && existing.sex !== "Unknown") || existing.age_min;
    
    if (hasDbMeta) {
      setCharDescription(existing.description ?? "");
      setCharSex(existing.sex ?? "Unknown");
      setCharAgeMin(existing.age_min?.toString() ?? "");
      setCharAgeMax(existing.age_max?.toString() ?? "");
      setCharIsChild(existing.is_child ?? false);
    } else if (scriptAnalysis?.scene_breakdown) {
      // Always try to deduce from script when no DB values exist
      const deduced = deduceCharacterMeta(selectedChar.name, scriptAnalysis.scene_breakdown as any[]);
      setCharDescription(deduced?.description ?? "");
      setCharSex(deduced?.sex ?? "Unknown");
      setCharAgeMin(deduced?.ageMin?.toString() ?? "");
      setCharAgeMax(deduced?.ageMax?.toString() ?? "");
      setCharIsChild(deduced?.isChild ?? false);
    } else {
      setCharDescription("");
      setCharSex("Unknown");
      setCharAgeMin("");
      setCharAgeMax("");
      setCharIsChild(false);
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

    // Persist audition cards to DB
    for (const card of finalCards) {
      if (card.imageUrl) {
        await supabase.from("character_auditions").upsert({
          character_id: selectedChar.id,
          card_index: card.id,
          section: card.section,
          label: card.label,
          image_url: card.imageUrl,
          locked: false,
        }, { onConflict: "character_id,card_index" });
      }
    }

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
    // Persist lock status to auditions table
    await supabase.from("character_auditions").update({ locked: false }).eq("character_id", selectedChar.id);
    await supabase.from("character_auditions").update({ locked: true }).eq("character_id", selectedChar.id).eq("card_index", card.id);
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
    const publicUrl = urlData.publicUrl;
    await supabase.from("characters").update({ reference_image_url: publicUrl } as any).eq("id", selectedChar.id);
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast.success("Reference image uploaded — analyzing…");
    setUploadingRef(false);

    // Analyze the reference image for a person-focused description
    setAnalyzingRef(true);
    try {
      const { data: analysisData, error: analysisErr } = await supabase.functions.invoke("analyze-reference-image", {
        body: { imageUrl: publicUrl, context: "casting", characterName: selectedChar.name },
      });
      if (analysisErr) throw analysisErr;
      if (analysisData?.description) {
        // Prepend the AI description to existing description
        const existing = charDescription.trim();
        const aiDesc = analysisData.description.trim();
        const combined = existing ? `${aiDesc}\n\n${existing}` : aiDesc;
        setCharDescription(combined);
        toast.success("Reference analyzed — description updated");
      }
    } catch (err) {
      console.error("Reference analysis failed:", err);
      toast.error("Could not analyze reference image");
    } finally {
      setAnalyzingRef(false);
    }
  }, [selectedChar, filmId, queryClient, charDescription]);

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

  const openSceneScript = useCallback(async (sceneNumber: number) => {
    if (!scriptAnalysis?.scene_breakdown || !Array.isArray(scriptAnalysis.scene_breakdown)) return;
    const scenes = scriptAnalysis.scene_breakdown as any[];
    const scene = scenes.find((s: any) => {
      const sn = s.scene_number ? parseInt(s.scene_number, 10) : null;
      return sn === sceneNumber;
    }) || scenes[sceneNumber - 1];
    if (!scene) { toast.error("Scene not found"); return; }

    setScriptDialogScene(scene);
    setScriptDialogSceneNum(sceneNumber);
    setScriptDialogOpen(true);
    setScriptParagraphs(null);

    if (!scriptAnalysis.storage_path) {
      setScriptParagraphs([{ type: "Action", text: "[No script file available]" }]);
      return;
    }

    setScriptLoading(true);
    try {
      const { data, error } = await supabase.storage.from("scripts").download(scriptAnalysis.storage_path);
      if (error || !data) throw error || new Error("Download failed");
      const full = await data.text();
      const heading = scene.scene_heading?.trim();
      const isFdx = full.trimStart().startsWith("<?xml") || full.includes("<FinalDraft");

      if (isFdx) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(full, "text/xml");
        const paragraphs = Array.from(doc.querySelectorAll("Paragraph"));
        let startIdx = -1, endIdx = paragraphs.length;
        for (let i = 0; i < paragraphs.length; i++) {
          const p = paragraphs[i];
          const pType = p.getAttribute("Type") || "";
          const texts = Array.from(p.querySelectorAll("Text"));
          const content = texts.map((t) => t.textContent || "").join("").trim();
          if (pType === "Scene Heading") {
            if (startIdx === -1 && heading && content.toUpperCase().includes(heading.toUpperCase())) {
              startIdx = i;
            } else if (startIdx !== -1) { endIdx = i; break; }
          }
        }
        if (startIdx === -1) startIdx = 0;
        const result: { type: string; text: string }[] = [];
        for (let i = startIdx; i < endIdx; i++) {
          const p = paragraphs[i];
          const pType = p.getAttribute("Type") || "Action";
          const texts = Array.from(p.querySelectorAll("Text"));
          const content = texts.map((t) => t.textContent || "").join("");
          if (content.trim()) result.push({ type: pType, text: content });
        }
        setScriptParagraphs(result);
      } else {
        if (!heading) { setScriptParagraphs([{ type: "Action", text: full }]); setScriptLoading(false); return; }
        const headingPattern = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const startMatch = full.match(new RegExp(`^(.*${headingPattern}.*)$`, "mi"));
        if (!startMatch || startMatch.index === undefined) { setScriptParagraphs([{ type: "Action", text: full }]); setScriptLoading(false); return; }
        const sIdx = startMatch.index;
        const afterHeading = full.substring(sIdx + startMatch[0].length);
        const nextScene = afterHeading.match(/\n\s*((?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.).+)/i);
        const eIdx = nextScene?.index !== undefined ? sIdx + startMatch[0].length + nextScene.index : full.length;
        const sceneText = full.substring(sIdx, eIdx).trim();
        setScriptParagraphs(sceneText.split("\n").filter((l) => l.trim()).map((line) => {
          const trimmed = line.trim();
          if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/.test(trimmed)) return { type: "Scene Heading", text: trimmed };
          if (/^[A-Z][A-Z\s'.()-]+$/.test(trimmed) && trimmed.length < 40) return { type: "Character", text: trimmed };
          return { type: "Action", text: trimmed };
        }));
      }
    } catch {
      setScriptParagraphs([{ type: "Action", text: "[Could not load script file]" }]);
    } finally {
      setScriptLoading(false);
    }
  }, [scriptAnalysis]);

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

  const selectChar = useCallback(async (id: string) => {
    setSelectedCharId(id);
    // Load persisted audition cards from DB
    const { data: savedCards } = await supabase
      .from("character_auditions")
      .select("*")
      .eq("character_id", id)
      .order("card_index");
    if (savedCards && savedCards.length > 0) {
      const restored: AuditionCard[] = CARD_TEMPLATE.map((t) => {
        const saved = savedCards.find((s: any) => s.card_index === t.id);
        return {
          ...t,
          imageUrl: saved?.image_url ?? null,
          locked: saved?.locked ?? false,
          generating: false,
        };
      });
      setCards(restored);
    } else {
      setCards([]);
    }
  }, []);

  const sections: { key: AuditionCard["section"]; title: string }[] = [
    { key: "archetype", title: "Archetypes" },
    { key: "wildcard", title: "Wildcards" },
    { key: "novel", title: "Novel AI Faces" },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <header className="shrink-0 border-b border-border bg-card px-6 py-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Pre-Production</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Asset &amp; Identity Lock — define every visual and auditory element before shooting begins.
        </p>
      </header>

      <Tabs defaultValue="casting" className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border bg-card/60 backdrop-blur-sm px-6">
          <TabsList className="h-12 bg-transparent gap-1 p-0">
            <PreProductionTab value="casting" icon={Users} label="Auditions" />
            <PreProductionTab value="locations" icon={MapPin} label="Locations" />
            <PreProductionTab value="props" icon={Package} label="Props" />
            <PreProductionTab value="wardrobe" icon={Shirt} label="Wardrobe" />
            <PreProductionTab value="vehicles" icon={Car} label="Picture Vehicles" />
            <PreProductionTab value="storyboard" icon={Film} label="Storyboard Pre-Viz" />
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
                      {selectedChar.image_url && (
                        <p className="text-xs text-muted-foreground">Identity locked — regenerate to change</p>
                      )}
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
                {((selectedChar as any).reference_image_url || analyzingRef) && (
                  <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                    {(selectedChar as any).reference_image_url && (
                      <img src={(selectedChar as any).reference_image_url} alt="Reference" className="h-16 w-16 rounded-lg object-cover border border-border" />
                    )}
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reference Image</p>
                      {analyzingRef ? (
                        <p className="text-xs text-primary mt-0.5 flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" /> Analyzing appearance…
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                          <Eye className="h-3 w-3" /> AI-analyzed — description merged into character details
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ═══ SCENE APPEARANCES ═══ */}
                {(() => {
                  const ranking = rankings?.find(r => r.nameNormalized === selectedChar.name.toUpperCase());
                  if (!ranking?.sceneNumbers?.length) return null;
                  return (
                    <div className="rounded-xl border border-border bg-card p-4 cinema-shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <Film className="h-4 w-4 text-primary" />
                        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Scenes</h3>
                        <span className="text-xs text-muted-foreground/50">{ranking.sceneNumbers.length} appearances</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ranking.sceneNumbers.map((sn) => (
                          <button
                            key={sn}
                            onClick={() => openSceneScript(sn)}
                            className="inline-flex items-center justify-center h-7 min-w-[28px] px-2 rounded-md border border-border bg-secondary/50 text-xs font-display font-semibold text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                            title={`View Scene ${sn} script`}
                          >
                            {sn}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

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

                {/* Audition cards grid — only show after casting call */}
                {(cards.length > 0 || generating) && (
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
                          )} style={{ gridAutoRows: "1fr" }}>
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
          <DnDGroupPane items={augmentedLocations} filmId={filmId} storagePrefix="locations" icon={MapPin} title="Locations" emptyMessage="No locations extracted yet. Lock your script in Development." subtitles={breakdownAssets?.locationDescriptions} expandableSubtitles sceneBreakdown={scriptAnalysis?.scene_breakdown as any[] | undefined} storagePath={scriptAnalysis?.storage_path as string | undefined} />
        </TabsContent>
        <TabsContent value="props" className="flex-1 flex overflow-hidden m-0">
          <DnDGroupPane
            items={filteredProps} filmId={filmId} storagePrefix="props" icon={Package} title="Props"
            emptyMessage="No props extracted yet. Lock your script in Development."
            sceneBreakdown={scriptAnalysis?.scene_breakdown as any[] | undefined}
            storagePath={scriptAnalysis?.storage_path as string | undefined}
            reclassifyOptions={[
              { label: "Locations", value: "locations", icon: MapPin },
              { label: "Picture Vehicles", value: "vehicles", icon: Car },
            ]}
            onReclassify={handleReclassify}
          />
        </TabsContent>
        <TabsContent value="wardrobe" className="flex-1 flex overflow-hidden m-0">
          <DnDGroupPane
            items={(breakdownAssets?.wardrobe ?? []).map((w) => w.clothing)} filmId={filmId} storagePrefix="wardrobe" icon={Shirt} title="Wardrobe"
            emptyMessage="No wardrobe data extracted yet. Lock your script in Development."
            subtitles={(breakdownAssets?.wardrobe ?? []).reduce((acc, w) => { acc[w.clothing] = w.character; return acc; }, {} as Record<string, string>)}
            sceneBreakdown={scriptAnalysis?.scene_breakdown as any[] | undefined}
            storagePath={scriptAnalysis?.storage_path as string | undefined}
          />
        </TabsContent>
        <TabsContent value="vehicles" className="flex-1 flex overflow-hidden m-0">
          <DnDGroupPane items={augmentedVehicles} filmId={filmId} storagePrefix="vehicles" icon={Car} title="Picture Vehicles" emptyMessage="No vehicles identified in the script breakdown yet." sceneBreakdown={scriptAnalysis?.scene_breakdown as any[] | undefined} storagePath={scriptAnalysis?.storage_path as string | undefined} />
        </TabsContent>
        <TabsContent value="storyboard" className="flex-1 flex overflow-hidden m-0">
          <StoryboardPanel />
        </TabsContent>
      </Tabs>

      {/* ═══ SCRIPT VIEWER DIALOG ═══ */}
      <Dialog open={scriptDialogOpen} onOpenChange={setScriptDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" />
              {scriptDialogScene?.scene_heading || `Scene ${scriptDialogSceneNum}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Scene {scriptDialogSceneNum} · {scriptDialogScene?.int_ext} · {scriptDialogScene?.time_of_day}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 pb-6">
            {scriptLoading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-20">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading script…
              </div>
            ) : (
              <div
                className="mx-auto bg-white text-black shadow-lg"
                style={{
                  fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
                  fontSize: "12px",
                  lineHeight: "1.0",
                  padding: "72px 60px 72px 90px",
                  maxWidth: "612px",
                  minHeight: "792px",
                }}
              >
                {scriptParagraphs?.map((p, i) => {
                  const highlightName = (text: string) => {
                    if (!selectedChar?.name) return text;
                    const name = selectedChar.name;
                    const re = new RegExp(`(${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
                    const parts = text.split(re);
                    if (parts.length === 1) return text;
                    return parts.map((part, j) =>
                      re.test(part) ? <mark key={j} style={{ backgroundColor: "#facc15", color: "black", padding: "0 2px", borderRadius: 2 }}>{part}</mark> : part
                    );
                  };
                  switch (p.type) {
                    case "Scene Heading":
                      return (
                        <p key={i} style={{ textTransform: "uppercase", fontWeight: "bold", marginTop: i === 0 ? 0 : 24, marginBottom: 12 }}>
                          <span>{scriptDialogSceneNum}</span>
                          <span style={{ marginLeft: 24 }}>{p.text}</span>
                        </p>
                      );
                    case "Character":
                      return (
                        <p key={i} style={{ textTransform: "uppercase", textAlign: "left", paddingLeft: "37%", marginTop: 18, marginBottom: 0 }}>
                          {highlightName(p.text)}
                        </p>
                      );
                    case "Parenthetical":
                      return (
                        <p key={i} style={{ paddingLeft: "28%", fontStyle: "italic", marginTop: 0, marginBottom: 0 }}>
                          {highlightName(p.text)}
                        </p>
                      );
                    case "Dialogue":
                      return (
                        <p key={i} style={{ paddingLeft: "17%", paddingRight: "17%", marginTop: 0, marginBottom: 0 }}>
                          {highlightName(p.text)}
                        </p>
                      );
                    case "Transition":
                      return (
                        <p key={i} style={{ textAlign: "right", textTransform: "uppercase", marginTop: 18, marginBottom: 12 }}>
                          {p.text}
                        </p>
                      );
                    default:
                      return (
                        <p key={i} style={{ marginTop: 12, marginBottom: 0 }}>
                          {highlightName(p.text)}
                        </p>
                      );
                  }
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ── Deduce character metadata from script analysis ── */
function deduceCharacterMeta(charName: string, scenes: any[]): {
  description: string; sex: string; ageMin: number | null; ageMax: number | null; isChild: boolean;
} | null {
  const nameUpper = charName.toUpperCase().replace(/\s*\(.*?\)\s*/g, "").trim();
  const nameLower = charName.toLowerCase();
  let sex = "Unknown";
  let ageMin: number | null = null;
  let ageMax: number | null = null;
  let isChild = false;

  // ── 1. Find FIRST appearance and gather introduction-level description ──
  let firstAppearanceDesc = "";
  let firstSceneDesc = "";
  const introFragments: string[] = [];
  const allBehavior: string[] = [];
  let foundFirst = false;

  for (const scene of scenes) {
    if (!Array.isArray(scene.characters)) continue;
    for (const c of scene.characters) {
      if (typeof c === "string") continue;
      const cName = (c.name || "").toUpperCase().replace(/\s*\(.*?\)\s*/g, "").trim();
      if (cName !== nameUpper) continue;

      // First appearance: capture scene description + character details
      if (!foundFirst) {
        foundFirst = true;
        firstSceneDesc = scene.description || "";

        // Character introduction description from AI (if present)
        if (c.character_introduction) introFragments.push(c.character_introduction);
        if (c.physical_behavior) introFragments.push(c.physical_behavior);
        if (c.key_expressions) introFragments.push(c.key_expressions);

        // Check wardrobe on first appearance for physical description
        if (Array.isArray(scene.wardrobe)) {
          for (const w of scene.wardrobe) {
            const wChar = (w.character || "").toUpperCase().trim();
            if (wChar !== nameUpper) continue;
            if (w.hair_makeup) introFragments.push(w.hair_makeup);
            if (w.clothing_style) introFragments.push(w.clothing_style);
          }
        }
      }

      // Collect all physical descriptions across scenes for broader context
      if (c.physical_behavior) allBehavior.push(c.physical_behavior);
    }
  }

  // Build first-appearance description
  if (introFragments.length > 0) {
    firstAppearanceDesc = [...new Set(introFragments)].join(". ").replace(/\.\./g, ".").trim();
    if (firstAppearanceDesc && !firstAppearanceDesc.endsWith(".")) firstAppearanceDesc += ".";
  }

  // ── 2. Scan ALL scenes for sex via pronouns & role titles ──
  const FEMALE_PRONOUNS = /\b(she|her|hers|herself|woman|girl|mother|mom|wife|daughter|sister|actress|queen|princess|waitress|hostess|mrs|ms|miss|lady|ma'am|gal|bride|girlfriend|aunt|grandma|grandmother|niece)\b/i;
  const MALE_PRONOUNS = /\b(he|him|his|himself|man|guy|boy|father|dad|husband|son|brother|actor|king|prince|waiter|mr|sir|gentleman|groom|boyfriend|uncle|grandpa|grandfather|nephew)\b/i;
  let femaleCues = 0;
  let maleCues = 0;

  for (const scene of scenes) {
    // Check scene description for character name + pronoun proximity
    const desc = (scene.description || "").toLowerCase();
    if (desc.includes(nameLower)) {
      // Count pronouns in the same sentence/context as character name
      const sentences = desc.split(/[.!?]/);
      for (const sent of sentences) {
        if (!sent.includes(nameLower)) continue;
        const fMatches = sent.match(new RegExp(FEMALE_PRONOUNS.source, "gi"));
        const mMatches = sent.match(new RegExp(MALE_PRONOUNS.source, "gi"));
        femaleCues += fMatches?.length ?? 0;
        maleCues += mMatches?.length ?? 0;
      }
    }

    // Check character entries for this character — look at emotional tone for gendered words
    if (Array.isArray(scene.characters)) {
      for (const c of scene.characters) {
        if (typeof c === "string") continue;
        const cName = (c.name || "").toUpperCase().replace(/\s*\(.*?\)\s*/g, "").trim();
        if (cName !== nameUpper) continue;
        const charText = [c.emotional_tone, c.physical_behavior, c.key_expressions, c.character_introduction].filter(Boolean).join(" ").toLowerCase();
        const fM = charText.match(new RegExp(FEMALE_PRONOUNS.source, "gi"));
        const mM = charText.match(new RegExp(MALE_PRONOUNS.source, "gi"));
        femaleCues += fM?.length ?? 0;
        maleCues += mM?.length ?? 0;
      }
    }

    // Check wardrobe for gendered clothing
    if (Array.isArray(scene.wardrobe)) {
      for (const w of scene.wardrobe) {
        const wChar = (w.character || "").toUpperCase().trim();
        if (wChar !== nameUpper) continue;
        const combined = [(w.clothing_style || ""), (w.hair_makeup || "")].join(" ").toLowerCase();
        if (/\b(dress|skirt|blouse|heels|lipstick|mascara|her hair|bra|pantyhose|earrings|necklace)\b/.test(combined)) femaleCues += 2;
        if (/\b(suit and tie|tie|beard|mustache|his hair|boxers|cufflinks)\b/.test(combined)) maleCues += 2;
      }
    }

    // Scan dialogue for other characters referring to this character with pronouns
    // Use image_prompt and video_prompt which often contain "he/she" references
    for (const field of ["image_prompt", "video_prompt"]) {
      const prompt = (scene[field] || "").toLowerCase();
      if (prompt.includes(nameLower) || prompt.includes(nameUpper.toLowerCase())) {
        const fM = prompt.match(new RegExp(FEMALE_PRONOUNS.source, "gi"));
        const mM = prompt.match(new RegExp(MALE_PRONOUNS.source, "gi"));
        femaleCues += fM?.length ?? 0;
        maleCues += mM?.length ?? 0;
      }
    }
  }

  // Also check recurring_characters in global_elements (e.g. "SARAH (30s, female)")
  // That data isn't passed here but the character name itself can be gendered
  const FEMALE_NAMES = /^(sarah|mary|jane|elizabeth|emily|anna|maria|emma|olivia|sophia|charlotte|mia|ava|isabella|amelia|harper|evelyn|abigail|ella|grace|lily|hannah|chloe|victoria|natalie|rachel|rebecca|jessica|jennifer|ashley|amanda|stephanie|katherine|catherine|nicole|melissa|laura|heather|diana|claire|alice|rose|ruth|betty|dorothy|helen|margaret|patricia|linda|barbara|nancy|karen|lisa|donna|carol|sandra|sharon|susan|betty|joan|martha|gloria|teresa|julia|marie)$/i;
  const MALE_NAMES = /^(john|james|robert|michael|william|david|richard|joseph|thomas|charles|christopher|daniel|matthew|anthony|mark|donald|steven|paul|andrew|joshua|kenneth|kevin|brian|george|timothy|ronald|edward|jason|jeffrey|ryan|jacob|gary|nicholas|eric|jonathan|stephen|larry|justin|scott|brandon|benjamin|samuel|frank|raymond|gregory|jack|dennis|jerry|alexander|patrick|henry|tyler|douglas|peter|adam|nathan|zachary|harold|albert|carl|arthur|lawrence|ralph|eugene|roger|wayne|bruce|howard|antonio|carlos|miguel|luis|rafael)$/i;
  const firstName = charName.split(/\s+/)[0];
  if (FEMALE_NAMES.test(firstName)) femaleCues += 3;
  if (MALE_NAMES.test(firstName)) maleCues += 3;

  if (femaleCues > maleCues && femaleCues >= 2) sex = "Female";
  else if (maleCues > femaleCues && maleCues >= 2) sex = "Male";

  // ── 3. Scan ALL scenes for age clues ──
  const AGE_PATTERNS = [
    { re: /\b(\d{1,2})\s*(?:years?\s*old|year-old|y\.?o\.?)\b/i, handler: (m: RegExpMatchArray) => { const a = parseInt(m[1]); return { min: a, max: a }; } },
    { re: /\bage\s*(\d{1,2})\b/i, handler: (m: RegExpMatchArray) => { const a = parseInt(m[1]); return { min: a, max: a }; } },
    { re: /\b(?:in\s+)?(?:his|her|their)\s+early\s+(\d)0s\b/i, handler: (m: RegExpMatchArray) => { const d = parseInt(m[1]); return { min: d * 10, max: d * 10 + 3 }; } },
    { re: /\b(?:in\s+)?(?:his|her|their)\s+mid[- ]?(\d)0s\b/i, handler: (m: RegExpMatchArray) => { const d = parseInt(m[1]); return { min: d * 10 + 4, max: d * 10 + 6 }; } },
    { re: /\b(?:in\s+)?(?:his|her|their)\s+late\s+(\d)0s\b/i, handler: (m: RegExpMatchArray) => { const d = parseInt(m[1]); return { min: d * 10 + 7, max: d * 10 + 9 }; } },
    { re: /\b(?:in\s+)?(?:his|her|their)\s+(\d)0s\b/i, handler: (m: RegExpMatchArray) => { const d = parseInt(m[1]); return { min: d * 10, max: d * 10 + 9 }; } },
    { re: /\bearly\s+(\d)0s\b/i, handler: (m: RegExpMatchArray) => { const d = parseInt(m[1]); return { min: d * 10, max: d * 10 + 3 }; } },
    { re: /\bmid[- ]?(\d)0s\b/i, handler: (m: RegExpMatchArray) => { const d = parseInt(m[1]); return { min: d * 10 + 4, max: d * 10 + 6 }; } },
    { re: /\blate\s+(\d)0s\b/i, handler: (m: RegExpMatchArray) => { const d = parseInt(m[1]); return { min: d * 10 + 7, max: d * 10 + 9 }; } },
    { re: /\b(teenager|teen|teenaged)\b/i, handler: () => ({ min: 13, max: 19 }) },
    { re: /\b(child|kid)\b/i, handler: () => ({ min: 6, max: 12 }) },
    { re: /\b(toddler|infant|baby|newborn)\b/i, handler: () => ({ min: 0, max: 3 }) },
    { re: /\b(elderly|aged|geriatric|old man|old woman|aging)\b/i, handler: () => ({ min: 65, max: 85 }) },
    { re: /\b(middle[- ]?aged)\b/i, handler: () => ({ min: 40, max: 55 }) },
    { re: /\b(young man|young woman|young adult|twentysomething)\b/i, handler: () => ({ min: 20, max: 30 }) },
    { re: /\b(college[- ]?age|university)\b/i, handler: () => ({ min: 18, max: 24 }) },
    { re: /\b(senior|retiree|retired)\b/i, handler: () => ({ min: 60, max: 80 }) },
  ];

  // Check all text sources for age clues about this character
  for (const scene of scenes) {
    if (ageMin !== null) break; // Found age, stop
    const textsToScan: string[] = [];

    const desc = scene.description || "";
    if (desc.toLowerCase().includes(nameLower)) textsToScan.push(desc);

    if (Array.isArray(scene.characters)) {
      for (const c of scene.characters) {
        if (typeof c === "string") continue;
        const cName = (c.name || "").toUpperCase().replace(/\s*\(.*?\)\s*/g, "").trim();
        if (cName !== nameUpper) continue;
        if (c.character_introduction) textsToScan.push(c.character_introduction);
        if (c.physical_behavior) textsToScan.push(c.physical_behavior);
        if (c.emotional_tone) textsToScan.push(c.emotional_tone);
        if (c.key_expressions) textsToScan.push(c.key_expressions);
      }
    }

    // Also check image/video prompts that mention the character
    for (const field of ["image_prompt", "video_prompt"]) {
      const prompt = scene[field] || "";
      if (prompt.toLowerCase().includes(nameLower)) textsToScan.push(prompt);
    }

    for (const text of textsToScan) {
      if (ageMin !== null) break;
      for (const { re, handler } of AGE_PATTERNS) {
        const match = text.match(re);
        if (match) {
          const result = handler(match);
          ageMin = result.min;
          ageMax = result.max;
          if (result.max <= 12) isChild = true;
          break;
        }
      }
    }
  }

  // ── 4. Also try to infer age from relative references ("older", "younger") ──
  if (ageMin === null) {
    for (const scene of scenes) {
      const desc = (scene.description || "").toLowerCase();
      if (desc.includes(nameLower)) {
        if (/\bolder\b/.test(desc) && !/\byounger\b/.test(desc)) {
          ageMin = 45; ageMax = 60;
        } else if (/\byounger\b/.test(desc) && !/\bolder\b/.test(desc)) {
          ageMin = 22; ageMax = 32;
        }
        if (ageMin !== null) break;
      }
    }
  }

  // ── 5. Build description ──
  // Prefer first-appearance description; fall back to aggregated behavior
  let description = firstAppearanceDesc;
  if (!description && firstSceneDesc && firstSceneDesc.toLowerCase().includes(nameLower)) {
    // Extract the sentence(s) mentioning this character from the scene description
    const sentences = firstSceneDesc.split(/(?<=[.!?])\s+/);
    const relevant = sentences.filter(s => s.toLowerCase().includes(nameLower));
    description = relevant.join(" ").trim();
  }
  if (!description && allBehavior.length > 0) {
    description = [...new Set(allBehavior)].slice(0, 3).join(". ").replace(/\.\./g, ".").trim();
    if (description && !description.endsWith(".")) description += ".";
  }

  if (!description && sex === "Unknown" && ageMin === null) return null;

  return { description: description || "", sex, ageMin, ageMax, isChild };
}

/* ── Audition Card ── */
const AuditionCardComponent = ({ card, locking, onLock }: { card: AuditionCard; locking: boolean; onLock: () => void }) => (
  <div className={cn(
    "group relative rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer",
    "aspect-[3/4]",
    card.locked ? "border-primary/50 ring-2 ring-primary/30" : "border-border hover:border-primary/30 hover:cinema-glow"
  )}>
    {card.generating ? (
      <div className="h-full w-full bg-secondary flex items-center justify-center animate-pulse">
        <Loader2 className="h-6 w-6 text-muted-foreground/40 animate-spin" />
      </div>
    ) : card.imageUrl ? (
      <img src={card.imageUrl} alt={card.label} className="absolute inset-0 h-full w-full object-cover bg-secondary" />
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
const PreProductionTab = ({ value, icon: Icon, label }: { value: string; icon: any; label: string }) => (
  <TabsTrigger
    value={value}
    className="gap-2 px-4 py-2.5 text-xs font-display font-semibold uppercase tracking-wider rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none bg-transparent text-muted-foreground hover:text-foreground transition-colors"
  >
    <Icon className="h-3.5 w-3.5" />
    {label}
  </TabsTrigger>
);

export default PreProduction;
