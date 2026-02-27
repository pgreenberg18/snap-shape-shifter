import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useCharacters, useShots, useBreakdownAssets, useFilmId, useFilm, useParsedScenes } from "@/hooks/useFilm";
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
  Users, MapPin, Shirt, Mic, Film, Lock, Sparkles, Loader2, Check, User, Pencil,
  Save, AudioWaveform, Package, Car, ChevronDown, ChevronRight, Upload, Eye, ScrollText, Star,
  RotateCcw, Layers,
} from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import CharacterSidebar from "@/components/pre-production/CharacterSidebar";

import DnDGroupPane from "@/components/pre-production/DnDGroupPane";

/* ── Audition card type ── */
interface AuditionCard {
  id: number;
  characterId: string;
  section: "archetype" | "wildcard" | "novel";
  label: string;
  imageUrl: string | null;
  locked: boolean;
  generating?: boolean;
  rating: number;
}

const CARD_TEMPLATE: Omit<AuditionCard, "imageUrl" | "locked" | "rating" | "characterId">[] = [
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
  const generatingCharIdRef = useRef<string | null>(null);
  const [locking, setLocking] = useState<number | null>(null);
  const [expandedCard, setExpandedCard] = useState<AuditionCard | null>(null);
  // Modify flow state
  const [modifyMode, setModifyMode] = useState(false);
  const [modifyText, setModifyText] = useState("");
  const [modifyVariations, setModifyVariations] = useState<{ index: number; imageUrl: string | null; generating: boolean }[]>([]);
  const [modifyGenerating, setModifyGenerating] = useState(false);
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
  // Consistency views confirmation
  const [consistencyDialogOpen, setConsistencyDialogOpen] = useState(false);
  const [pendingConsistencyCharId, setPendingConsistencyCharId] = useState<string | null>(null);
  const [generatingViews, setGeneratingViews] = useState(false);
  const [characterPhotoOpen, setCharacterPhotoOpen] = useState(false);

  // Fetch consistency views for all characters in this film
  const { data: consistencyViews } = useQuery({
    queryKey: ["consistency-views", filmId],
    queryFn: async () => {
      if (!filmId) return [];
      const charIds = characters?.map(c => c.id) ?? [];
      if (!charIds.length) return [];
      const { data, error } = await supabase
        .from("character_consistency_views")
        .select("*")
        .in("character_id", charIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!filmId && !!characters?.length,
    refetchInterval: generatingViews ? 5000 : false,
  });

  const viewsByCharacter = useMemo(() => {
    const map = new Map<string, typeof consistencyViews>();
    for (const v of consistencyViews ?? []) {
      if (!map.has(v.character_id)) map.set(v.character_id, []);
      map.get(v.character_id)!.push(v);
    }
    // Sort each character's views by angle_index
    for (const [, views] of map) views.sort((a, b) => a.angle_index - b.angle_index);
    return map;
  }, [consistencyViews]);

  const charsWithViews = useMemo(() => {
    const set = new Set<string>();
    for (const [charId, views] of viewsByCharacter) {
      if (views.some(v => v.status === "complete" && v.image_url)) set.add(charId);
    }
    return set;
  }, [viewsByCharacter]);

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

  // Fetch parsed scenes (single source of truth for scene-level data)
  const { data: parsedScenes } = useParsedScenes();

  // Bulk auto-populate metadata for ALL characters that don't have it yet
  useEffect(() => {
    if (!characters?.length || !parsedScenes?.length) return;
    const charsNeedingMeta = characters.filter((c: any) => 
      !c.description && (!c.sex || c.sex === "Unknown") && !c.age_min
    );
    if (charsNeedingMeta.length === 0) return;

    (async () => {
      for (const char of charsNeedingMeta) {
        const deduced = deduceCharacterMeta(char.name, parsedScenes as any[]);
        if (deduced && (deduced.description || deduced.sex !== "Unknown" || deduced.ageMin !== null)) {
          await supabase.from("characters").update({
            description: deduced.description || null,
            sex: deduced.sex,
            age_min: deduced.ageMin,
            age_max: deduced.ageMax,
            is_child: deduced.isChild,
          } as any).eq("id", char.id);
        }
      }
      if (charsNeedingMeta.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["characters"] });
      }
    })();
  }, [characters?.length, parsedScenes?.length]);

  // Fetch script analysis for global_elements + storage_path only (NOT scene_breakdown)
  const { data: scriptAnalysis } = useQuery({
    queryKey: ["script-analysis-for-chars", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("script_analyses")
        .select("global_elements, storage_path")
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

  // Extract location groups from Global Elements to pre-seed the Locations sidebar
  const globalElementsLocationGroups = useMemo(() => {
    const ge = scriptAnalysis?.global_elements as any;
    const managed = ge?._managed?.categories?.locations;
    if (!managed?.groups || !Array.isArray(managed.groups)) return undefined;
    return managed.groups
      .filter((g: any) => g.variants?.length > 0)
      .map((g: any) => ({
        id: g.id || crypto.randomUUID(),
        name: g.parentName || "Group",
        children: g.variants as string[],
      }));
  }, [scriptAnalysis?.global_elements]);

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
    } else if (parsedScenes && parsedScenes.length > 0) {
      // Always try to deduce from script when no DB values exist
      const deduced = deduceCharacterMeta(selectedChar.name, parsedScenes as any[]);
      setCharDescription(deduced?.description ?? "");
      setCharSex(deduced?.sex ?? "Unknown");
      setCharAgeMin(deduced?.ageMin?.toString() ?? "");
      setCharAgeMax(deduced?.ageMax?.toString() ?? "");
      setCharIsChild(deduced?.isChild ?? false);

      // Auto-save deduced metadata to DB so it persists
      if (deduced && (deduced.description || deduced.sex !== "Unknown" || deduced.ageMin !== null)) {
        supabase.from("characters").update({
          description: deduced.description || null,
          sex: deduced.sex,
          age_min: deduced.ageMin,
          age_max: deduced.ageMax,
          is_child: deduced.isChild,
        } as any).eq("id", selectedChar.id).then(({ error }) => {
          if (!error) queryClient.invalidateQueries({ queryKey: ["characters"] });
        });
      }
    } else {
      setCharDescription("");
      setCharSex("Unknown");
      setCharAgeMin("");
      setCharAgeMax("");
      setCharIsChild(false);
    }
  }, [selectedChar?.id, parsedScenes]);

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
    const charId = selectedChar.id;
    const charName = selectedChar.name;
    generatingCharIdRef.current = charId;
    setGenerating(true);

    const skeletonCards: AuditionCard[] = CARD_TEMPLATE.map((t) => ({
      ...t, characterId: charId, imageUrl: null, locked: false, generating: true, rating: 0,
    }));
    setCards(skeletonCards);

    // Capture current values so generation continues even if user navigates away
    const genBody = {
      characterName: charName,
      description: charDescription || (selectedChar as any)?.description || "",
      sex: charSex !== "Unknown" ? charSex : (selectedChar as any)?.sex,
      ageMin: charAgeMin ? parseInt(charAgeMin) : (selectedChar as any)?.age_min,
      ageMax: charAgeMax ? parseInt(charAgeMax) : (selectedChar as any)?.age_max,
      isChild: charIsChild,
      filmTitle: film?.title ?? "",
      timePeriod: film?.time_period ?? "",
      genre: "",
    };

    let successCount = 0;

    // Fire all requests and update each card as it resolves
    const promises = CARD_TEMPLATE.map(async (t) => {
      try {
        const { data, error } = await supabase.functions.invoke("generate-headshot", {
          body: { ...genBody, cardIndex: t.id },
        });
        if (error) throw error;
        const imageUrl = data?.imageUrl ?? null;

        // Persist to DB immediately
        if (imageUrl) {
          successCount++;
          await supabase.from("character_auditions").upsert({
            character_id: charId,
            card_index: t.id,
            section: t.section,
            label: t.label,
            image_url: imageUrl,
            locked: false,
          }, { onConflict: "character_id,card_index" });
        }

        // Update UI only if this character is still selected
        if (generatingCharIdRef.current === charId) {
          setCards((prev) => prev.map((c) =>
            c.id === t.id ? { ...c, imageUrl, generating: false } : c
          ));
        }
      } catch (e) {
        console.error(`Headshot ${t.id} failed:`, e);
        if (generatingCharIdRef.current === charId) {
          setCards((prev) => prev.map((c) =>
            c.id === t.id ? { ...c, generating: false } : c
          ));
        }
      }
    });

    await Promise.allSettled(promises);

    if (generatingCharIdRef.current === charId) {
      setGenerating(false);
    }
    generatingCharIdRef.current = null;

    toast.success(`${successCount}/10 audition faces generated for ${charName}`);
  }, [selectedChar, charDescription, charSex, charAgeMin, charAgeMax, charIsChild, film]);

  const handleLockIdentity = useCallback(async (card: AuditionCard) => {
    if (!card.imageUrl || !card.characterId) return;
    const targetCharId = card.characterId;
    setLocking(card.id);
    const { error } = await supabase
      .from("characters")
      .update({ image_url: card.imageUrl })
      .eq("id", targetCharId);
    setLocking(null);
    if (error) { toast.error("Failed to cast actor"); return; }
    setCards((prev) => prev.map((c) => c.characterId === targetCharId ? { ...c, locked: c.id === card.id } : c));
    await supabase.from("character_auditions").update({ locked: false }).eq("character_id", targetCharId);
    await supabase.from("character_auditions").update({ locked: true }).eq("character_id", targetCharId).eq("card_index", card.id);
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    const charName = characters?.find(c => c.id === targetCharId)?.name ?? "Character";
    toast.success(`${charName} has been cast`);
    // Prompt for consistency views
    setPendingConsistencyCharId(targetCharId);
    setConsistencyDialogOpen(true);
  }, [characters, queryClient]);

  const handleGenerateConsistencyViews = useCallback(async () => {
    if (!pendingConsistencyCharId) return;
    setConsistencyDialogOpen(false);
    setGeneratingViews(true);
    const charName = characters?.find(c => c.id === pendingConsistencyCharId)?.name ?? "Character";
    toast.info(`Generating 8 consistency views for ${charName}… This may take a few minutes.`);
    try {
      const { data, error } = await supabase.functions.invoke("generate-consistency-views", {
        body: { character_id: pendingConsistencyCharId },
      });
      if (error) throw error;
      toast.success(`${data?.generated ?? 0}/8 consistency views generated for ${charName}`);
    } catch (e: any) {
      console.error("Consistency views error:", e);
      toast.error(e?.message || "Failed to generate consistency views");
    } finally {
      setGeneratingViews(false);
      setPendingConsistencyCharId(null);
      queryClient.invalidateQueries({ queryKey: ["consistency-views"] });
    }
  }, [pendingConsistencyCharId, characters]);

  const handleRate = useCallback(async (card: AuditionCard, rating: number) => {
    if (!card.characterId) return;
    setCards((prev) => prev.map((c) => c.id === card.id && c.characterId === card.characterId ? { ...c, rating } : c));
    if (expandedCard?.id === card.id) setExpandedCard((prev) => prev ? { ...prev, rating } : prev);
    await supabase.from("character_auditions").update({ rating } as any).eq("character_id", card.characterId).eq("card_index", card.id);
  }, [expandedCard]);

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
    if (!parsedScenes || parsedScenes.length === 0) return;
    const scene = parsedScenes.find((s) => s.scene_number === sceneNumber) || parsedScenes[sceneNumber - 1];
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
      const heading = (scene as any).scene_heading?.trim() || scene.heading?.trim();
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
    // If we're still generating for a different character, keep generating flag only if it matches
    if (generatingCharIdRef.current && generatingCharIdRef.current !== id) {
      setGenerating(false);
    } else if (generatingCharIdRef.current === id) {
      setGenerating(true);
    }
    // Load persisted audition cards from DB
    const { data: savedCards } = await supabase
      .from("character_auditions")
      .select("*")
      .eq("character_id", id)
      .order("card_index");
    if (savedCards && savedCards.length > 0) {
      const isGeneratingThis = generatingCharIdRef.current === id;
      const restored: AuditionCard[] = CARD_TEMPLATE.map((t) => {
        const saved = savedCards.find((s: any) => s.card_index === t.id);
        return {
          ...t,
          characterId: id,
          imageUrl: saved?.image_url ?? null,
          locked: saved?.locked ?? false,
          generating: isGeneratingThis && !saved?.image_url,
          rating: (saved as any)?.rating ?? 0,
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
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border bg-card px-6 py-3 flex items-baseline gap-3">
        <h1 className="font-display text-sm font-bold tracking-tight text-foreground whitespace-nowrap">Pre-Production</h1>
        <p className="text-[10px] text-muted-foreground truncate">
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
            
          </TabsList>
        </div>

        {/* ═══ CASTING TAB ═══ */}
        <TabsContent value="casting" className="flex-1 flex overflow-hidden m-0" data-help-id="preprod-characters">
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
                    <div
                      className={cn("h-12 w-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden", selectedChar.image_url && "cursor-pointer ring-offset-background hover:ring-2 hover:ring-primary/50 hover:ring-offset-2 transition-all")}
                      onClick={() => selectedChar.image_url && setCharacterPhotoOpen(true)}
                    >
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
                      {generating ? <><Loader2 className="h-4 w-4 animate-spin" />Casting…</> : cards.length > 0 ? <><Sparkles className="h-4 w-4" />Recast</> : <><Sparkles className="h-4 w-4" />Casting Call</>}
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

                {/* ═══ CHARACTER METADATA (moved above scenes) ═══ */}
                <Collapsible>
                  <div className="rounded-xl border border-border bg-card cinema-shadow overflow-hidden">
                    <CollapsibleTrigger className="w-full flex items-center gap-2 p-4 hover:bg-secondary/30 transition-colors">
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
                      <User className="h-4 w-4 text-primary" />
                      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Character Details</h3>
                      <div className="flex-1" />
                      <Button onClick={(e) => { e.stopPropagation(); handleSaveMeta(); }} disabled={savingMeta} variant="secondary" size="sm" className="gap-1.5 text-xs h-7">
                        {savingMeta ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><Save className="h-3.5 w-3.5" />Save</>}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-5 pb-5 space-y-4">
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
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* ═══ SCENE APPEARANCES ═══ */}
                {(() => {
                  const ranking = rankings?.find(r => r.nameNormalized === selectedChar.name.toUpperCase());
                  if (!ranking?.sceneNumbers?.length) return null;
                  return (
                    <Collapsible>
                      <div className="rounded-xl border border-border bg-card cinema-shadow overflow-hidden">
                        <CollapsibleTrigger className="w-full flex items-center gap-2 p-4 hover:bg-secondary/30 transition-colors">
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
                          <Film className="h-4 w-4 text-primary" />
                          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Scenes</h3>
                          <span className="text-xs text-muted-foreground/50">{ranking.sceneNumbers.length} appearances</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4">
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
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })()}

                {/* ═══ CASTING — Audition cards grid ═══ */}
                {(cards.length > 0 || generating) && (
                  <Collapsible>
                    <div className="rounded-xl border border-border bg-card cinema-shadow overflow-hidden">
                      <CollapsibleTrigger className="w-full flex items-center gap-2 p-4 hover:bg-secondary/30 transition-colors">
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
                        <Sparkles className="h-4 w-4 text-primary" />
                        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Casting</h3>
                        <span className="text-xs text-muted-foreground/50">{cards.length} candidates</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-6">
                          {/* Row 1: Archetypes */}
                          {(() => {
                            const archetypeCards = [...cards.filter((c) => c.section === "archetype")].sort((a, b) => (b.rating || 0) - (a.rating || 0));
                            return archetypeCards.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Archetypes</h3>
                                  <span className="text-[10px] text-muted-foreground/50 bg-secondary px-1.5 py-0.5 rounded">{archetypeCards.length}</span>
                                  <div className="flex-1 border-t border-border ml-2" />
                                </div>
                                <div className="grid gap-3 grid-cols-5" style={{ gridAutoRows: "1fr" }}>
                                  {archetypeCards.map((card) => (
                                    <AuditionCardComponent key={card.id} card={card} locking={locking === card.id} onLock={() => handleLockIdentity(card)} onExpand={() => setExpandedCard(card)} onRate={handleRate} hasConsistencyViews={charsWithViews.has(card.characterId)} />
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Row 2: Wildcards + Novel AI Faces side by side */}
                          {(() => {
                            const row2Cards = [...cards.filter((c) => c.section === "wildcard" || c.section === "novel")].sort((a, b) => (b.rating || 0) - (a.rating || 0));
                            return row2Cards.length > 0 && (
                              <div className="grid gap-3 grid-cols-5" style={{ gridAutoRows: "1fr" }}>
                                {row2Cards.map((card) => (
                                  <AuditionCardComponent key={card.id} card={card} locking={locking === card.id} onLock={() => handleLockIdentity(card)} onExpand={() => setExpandedCard(card)} onRate={handleRate} hasConsistencyViews={charsWithViews.has(card.characterId)} />
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

                {/* Expanded headshot dialog */}
                <Dialog open={!!expandedCard} onOpenChange={(open) => { if (!open) { setExpandedCard(null); setModifyMode(false); setModifyText(""); setModifyVariations([]); setModifyGenerating(false); } }}>
                  <DialogContent className="max-w-4xl p-0 bg-card border-border max-h-[85vh] overflow-y-auto">
                    <DialogHeader className="sr-only">
                      <DialogTitle>{expandedCard?.label}</DialogTitle>
                      <DialogDescription>Expanded headshot view</DialogDescription>
                    </DialogHeader>
                    <div className="flex">
                      {/* Left: headshot image, compact */}
                      <div className="w-[260px] shrink-0">
                        {expandedCard?.imageUrl && (
                          <img src={expandedCard.imageUrl} alt={expandedCard.label} className="w-full object-cover" style={{ aspectRatio: "4/5" }} />
                        )}
                      </div>
                      {/* Right: controls + variations */}
                      <div className="flex-1 flex flex-col p-4 gap-3 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-display font-semibold text-foreground">{expandedCard?.label}</p>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3].map((star) => (
                              <button key={star} onClick={() => expandedCard && handleRate(expandedCard, expandedCard.rating === star ? 0 : star)} className="p-0.5">
                                <Star className={cn("h-4 w-4 transition-colors", (expandedCard?.rating || 0) >= star ? "fill-primary text-primary" : "text-muted-foreground/30")} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {expandedCard && !expandedCard.locked && !modifyMode && (
                            <Button size="sm" variant="outline" onClick={() => setModifyMode(true)} className="gap-1.5">
                              <Pencil className="h-3.5 w-3.5" />Modify
                            </Button>
                          )}
                          {expandedCard && !expandedCard.locked && (
                            <Button size="sm" onClick={() => { handleLockIdentity(expandedCard); setExpandedCard(null); }} disabled={locking === expandedCard.id} className="gap-1.5">
                              {locking === expandedCard.id ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Casting…</> : <><User className="h-3.5 w-3.5" />Cast This Actor</>}
                            </Button>
                          )}
                        </div>

                        {/* Modify section */}
                        {modifyMode && (
                          <div className="space-y-2 border-t border-border pt-2">
                            <div className="flex items-center gap-2">
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Describe Changes</p>
                            </div>
                            <Textarea
                              value={modifyText}
                              onChange={(e) => setModifyText(e.target.value)}
                              placeholder="e.g. Make hair darker, add stubble, older looking…"
                              className="min-h-[50px] bg-secondary/50 border-border text-sm resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                disabled={!modifyText.trim() || modifyGenerating}
                                onClick={async () => {
                                  if (!expandedCard || !selectedChar || !film || !expandedCard.imageUrl) return;
                                  setModifyGenerating(true);
                                  setModifyVariations([
                                    { index: 0, imageUrl: null, generating: true },
                                    { index: 1, imageUrl: null, generating: true },
                                    { index: 2, imageUrl: null, generating: true },
                                  ]);
                                  const genBody = {
                                    characterName: selectedChar.name,
                                    description: charDescription || (selectedChar as any)?.description || "",
                                    sex: charSex !== "Unknown" ? charSex : (selectedChar as any)?.sex,
                                    ageMin: charAgeMin ? parseInt(charAgeMin) : (selectedChar as any)?.age_min,
                                    ageMax: charAgeMax ? parseInt(charAgeMax) : (selectedChar as any)?.age_max,
                                    isChild: charIsChild,
                                    filmTitle: film.title ?? "",
                                    timePeriod: film.time_period ?? "",
                                    genre: "",
                                    referenceImageUrl: expandedCard.imageUrl,
                                    modifyInstructions: modifyText.trim(),
                                  };
                                  const variationIndices = [0, 1, 2];
                                  const promises = variationIndices.map(async (vi) => {
                                    try {
                                      const { data, error } = await supabase.functions.invoke("generate-headshot", {
                                        body: { ...genBody, cardIndex: expandedCard.id * 3 + vi },
                                      });
                                      if (error) throw error;
                                      const imageUrl = data?.imageUrl ?? null;
                                      setModifyVariations((prev) => prev.map((v) => v.index === vi ? { ...v, imageUrl, generating: false } : v));
                                    } catch (e) {
                                      console.error(`Modify variation ${vi} failed:`, e);
                                      setModifyVariations((prev) => prev.map((v) => v.index === vi ? { ...v, generating: false } : v));
                                    }
                                  });
                                  await Promise.allSettled(promises);
                                  setModifyGenerating(false);
                                }}
                                className="gap-1.5"
                              >
                                {modifyGenerating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</> : <><Sparkles className="h-3.5 w-3.5" />Generate Variations</>}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setModifyMode(false); setModifyText(""); setModifyVariations([]); }}>Cancel</Button>
                            </div>
                          </div>
                        )}

                        {/* Variation results */}
                        {modifyVariations.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mt-auto">
                            {modifyVariations.map((v) => (
                              <div key={v.index} className="relative rounded-lg overflow-hidden border border-border bg-secondary/30">
                                {v.generating ? (
                                  <div className="aspect-[4/5] flex items-center justify-center">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                  </div>
                                ) : v.imageUrl ? (
                                  <>
                                    <img src={v.imageUrl} alt={`Variation ${v.index + 1}`} className="w-full aspect-[4/5] object-cover" />
                                    <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                      <Button
                                        size="sm"
                                        onClick={async () => {
                                          if (!expandedCard || !v.imageUrl) return;
                                          setCards((prev) => prev.map((c) => c.id === expandedCard.id && c.characterId === expandedCard.characterId ? { ...c, imageUrl: v.imageUrl } : c));
                                          await supabase.from("character_auditions").update({ image_url: v.imageUrl }).eq("character_id", expandedCard.characterId).eq("card_index", expandedCard.id);
                                          setExpandedCard((prev) => prev ? { ...prev, imageUrl: v.imageUrl! } : prev);
                                          setModifyMode(false);
                                          setModifyText("");
                                          setModifyVariations([]);
                                          toast.success("Variation selected");
                                        }}
                                        className="gap-1.5"
                                      >
                                        <Check className="h-3.5 w-3.5" />Select
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="aspect-[4/5] flex items-center justify-center text-xs text-muted-foreground">Failed</div>
                                )}
                                <p className="text-[10px] text-center text-muted-foreground py-0.5">Var {v.index + 1}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Consistency turnaround views */}
                        {expandedCard && (() => {
                          const views = viewsByCharacter.get(expandedCard.characterId);
                          const completedViews = views?.filter(v => v.status === "complete" && v.image_url) ?? [];
                          if (!completedViews.length) return null;
                          return (
                            <div className="border-t border-border pt-3 mt-auto">
                              <div className="flex items-center gap-2 mb-2">
                                <Layers className="h-3 w-3 text-primary" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                  Turnaround Views
                                </p>
                                <span className="text-[10px] text-muted-foreground/50">
                                  {completedViews.length}/8
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                {completedViews.map((v) => (
                                  <div key={v.id} className="relative rounded-lg overflow-hidden border border-border bg-secondary/30">
                                    <img
                                      src={v.image_url!}
                                      alt={v.angle_label}
                                      className="w-full aspect-square object-cover"
                                      loading="lazy"
                                    />
                                    <p className="text-[9px] text-center text-muted-foreground py-0.5 bg-background/80">
                                      {v.angle_label}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Character photo + consistency views popup */}
                {selectedChar?.image_url && (
                  <Dialog open={characterPhotoOpen} onOpenChange={setCharacterPhotoOpen}>
                    <DialogContent className="max-w-3xl p-0 bg-card border-border max-h-[85vh] overflow-y-auto">
                      <DialogHeader className="sr-only">
                        <DialogTitle>{selectedChar.name}</DialogTitle>
                        <DialogDescription>Character identity photo and turnaround views</DialogDescription>
                      </DialogHeader>
                      <div className="p-5 space-y-4">
                        {/* Enlarged cast photo */}
                        <div className="flex gap-4">
                          <div className="w-[240px] shrink-0">
                            <img
                              src={selectedChar.image_url}
                              alt={selectedChar.name}
                              className="w-full rounded-lg object-cover border border-border"
                              style={{ aspectRatio: "4/5" }}
                            />
                          </div>
                          <div className="flex-1 flex flex-col gap-2 min-w-0">
                            <h3 className="font-display text-lg font-bold text-foreground">{selectedChar.name}</h3>
                            {selectedChar.description && (
                              <p className="text-xs text-muted-foreground leading-relaxed">{selectedChar.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground/60 mt-auto">
                              {selectedChar.sex && <span>{selectedChar.sex}</span>}
                              {(selectedChar.age_min || selectedChar.age_max) && (
                                <span>Age: {selectedChar.age_min ?? "?"}-{selectedChar.age_max ?? "?"}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Consistency turnaround views */}
                        {(() => {
                          const views = viewsByCharacter.get(selectedChar.id);
                          const completedViews = views?.filter(v => v.status === "complete" && v.image_url) ?? [];
                          if (!completedViews.length) return null;
                          return (
                            <div className="border-t border-border pt-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Layers className="h-3.5 w-3.5 text-primary" />
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                  Turnaround Views
                                </p>
                                <span className="text-xs text-muted-foreground/50">
                                  {completedViews.length}/8
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {completedViews.map((v) => (
                                  <div key={v.id} className="relative rounded-lg overflow-hidden border border-border bg-secondary/30">
                                    <img
                                      src={v.image_url!}
                                      alt={v.angle_label}
                                      className="w-full aspect-square object-cover"
                                      loading="lazy"
                                    />
                                    <p className="text-[10px] text-center text-muted-foreground py-1 bg-background/80 font-mono">
                                      {v.angle_label}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </DialogContent>
                  </Dialog>
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
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Voice Description</p>
                          </div>
                          <Button onClick={handleSaveVoiceDesc} disabled={savingVoice} variant="secondary" size="sm" className="gap-1.5 text-xs h-7">
                            {savingVoice ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><Save className="h-3.5 w-3.5" />Save</>}
                          </Button>
                        </div>
                        <Textarea
                          value={voiceDesc}
                          onChange={(e) => setVoiceDesc(e.target.value)}
                          placeholder="Gravelly, mid-40s, slight transatlantic accent…"
                          className="min-h-[80px] bg-secondary/50 border-border text-sm resize-none"
                        />
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
        <TabsContent value="locations" className="flex-1 flex overflow-hidden m-0" data-help-id="preprod-locations">
          <DnDGroupPane items={augmentedLocations} filmId={filmId} storagePrefix="locations" icon={MapPin} title="Locations" emptyMessage="No locations extracted yet. Lock your script in Development." subtitles={breakdownAssets?.locationDescriptions} expandableSubtitles sceneBreakdown={parsedScenes as any[] | undefined} storagePath={scriptAnalysis?.storage_path as string | undefined} initialGroups={globalElementsLocationGroups} />
        </TabsContent>
        <TabsContent value="props" className="flex-1 flex overflow-hidden m-0" data-help-id="preprod-props">
          <DnDGroupPane
            items={filteredProps} filmId={filmId} storagePrefix="props" icon={Package} title="Props"
            emptyMessage="No props extracted yet. Lock your script in Development."
            subtitles={breakdownAssets?.propDescriptions}
            expandableSubtitles
            sceneBreakdown={parsedScenes as any[] | undefined}
            storagePath={scriptAnalysis?.storage_path as string | undefined}
            excludeFromKeyObjects={augmentedVehicles}
            reclassifyOptions={[
              { label: "Locations", value: "locations", icon: MapPin },
              { label: "Picture Vehicles", value: "vehicles", icon: Car },
            ]}
            onReclassify={handleReclassify}
          />
        </TabsContent>
        <TabsContent value="wardrobe" className="flex-1 flex overflow-hidden m-0" data-help-id="preprod-wardrobe">
          {(() => {
            const wardrobeItems = breakdownAssets?.wardrobe ?? [];
            // Deduplicate: same clothing for different characters gets a character-scoped key
            const byCharacter = new Map<string, string[]>();
            const clothingCounts = new Map<string, number>();
            for (const w of wardrobeItems) {
              clothingCounts.set(w.clothing, (clothingCounts.get(w.clothing) || 0) + 1);
            }
            // Build unique item keys: append character when clothing appears for multiple characters
            const uniqueItems: string[] = [];
            const subtitleMap: Record<string, string> = {};
            for (const w of wardrobeItems) {
              const char = w.character || "Unknown";
              // Use character-scoped key if the same clothing appears under multiple characters
              const itemKey = (clothingCounts.get(w.clothing) || 0) > 1
                ? `${w.clothing} (${char})`
                : w.clothing;
              if (!uniqueItems.includes(itemKey)) {
                uniqueItems.push(itemKey);
                subtitleMap[itemKey] = char;
              }
              if (!byCharacter.has(char)) byCharacter.set(char, []);
              if (!byCharacter.get(char)!.includes(itemKey)) {
                byCharacter.get(char)!.push(itemKey);
              }
            }
            // Sort character groups by ranking order (matching auditions sidebar)
            const charOrder = (rankings || []).map(r => r.nameNormalized);
            const sortedChars = [...byCharacter.keys()].sort((a, b) => {
              const aIdx = charOrder.indexOf(a.toUpperCase());
              const bIdx = charOrder.indexOf(b.toUpperCase());
              const aPos = aIdx === -1 ? 9999 : aIdx;
              const bPos = bIdx === -1 ? 9999 : bIdx;
              return aPos - bPos;
            });
            const wardrobeInitialGroups = sortedChars.map((char) => ({
              id: `wardrobe-char-${char.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
              name: char,
              children: byCharacter.get(char)!,
            }));
            const scenes = (parsedScenes as any[] | undefined) || [];
            const allSceneNums = scenes.map((s: any) => s.scene_number).filter((n: number) => !isNaN(n)).sort((a: number, b: number) => a - b);
            const headings: Record<number, string> = {};
            for (const s of scenes) {
              if (s.heading) headings[s.scene_number] = s.heading;
            }
            return (
              <DnDGroupPane
                items={uniqueItems} filmId={filmId} storagePrefix="wardrobe" icon={Shirt} title="Wardrobe"
                emptyMessage="No wardrobe data extracted yet. Lock your script in Development."
                subtitles={subtitleMap}
                sceneBreakdown={scenes}
                storagePath={scriptAnalysis?.storage_path as string | undefined}
                initialGroups={wardrobeInitialGroups}
                allSceneNumbers={allSceneNums}
                sceneHeadings={headings}
              />
            );
          })()}
        </TabsContent>
        <TabsContent value="vehicles" className="flex-1 flex overflow-hidden m-0" data-help-id="preprod-vehicles">
          <DnDGroupPane items={augmentedVehicles} filmId={filmId} storagePrefix="vehicles" icon={Car} title="Picture Vehicles" emptyMessage="No vehicles identified in the script breakdown yet." subtitles={breakdownAssets?.vehicleDescriptions} expandableSubtitles sceneBreakdown={parsedScenes as any[] | undefined} storagePath={scriptAnalysis?.storage_path as string | undefined} />
        </TabsContent>
      </Tabs>

      {/* ═══ SCRIPT VIEWER DIALOG ═══ */}
      <Dialog open={scriptDialogOpen} onOpenChange={setScriptDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" />
              {scriptDialogScene?.heading || scriptDialogScene?.scene_heading || `Scene ${scriptDialogSceneNum}`}
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

      {/* Consistency Views Confirmation Dialog */}
      <AlertDialog open={consistencyDialogOpen} onOpenChange={setConsistencyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display">
              <RotateCcw className="h-5 w-5 text-primary" />
              Generate Character Consistency Views
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-sm leading-relaxed">
              <span className="block">
                8 turnaround views of{" "}
                <span className="font-semibold text-foreground">
                  {characters?.find(c => c.id === pendingConsistencyCharId)?.name ?? "this character"}
                </span>{" "}
                will be generated from different angles (front, profiles, ¾ views, and back) for the character consistency engine.
              </span>
              <span className="block text-xs text-muted-foreground border-l-2 border-primary/30 pl-3">
                This will use AI credits. Make sure you are sure of your choice — the cast headshot will be used as the identity reference for all 8 views.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConsistencyDialogOpen(false); setPendingConsistencyCharId(null); }}>
              Do This Later
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerateConsistencyViews}>
              OK — Generate Views
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ── Deduce character metadata from script analysis ── */
function deduceCharacterMeta(charName: string, scenes: any[]): {
  description: string; sex: string; ageMin: number | null; ageMax: number | null; isChild: boolean;
} | null {
  const nameUpper = charName.toUpperCase().replace(/\s*\(.*?\)\s*/g, "").trim();
  const nameTokens = nameUpper.split(/\s+/);
  const nameLower = charName.toLowerCase();
  const nameFirstUpper = nameTokens[0] || nameUpper;

  // Flexible name matching: full match, first-name match, or substring containment
  const matchesCharName = (rawName: string): boolean => {
    const norm = rawName.toUpperCase().replace(/\s*\(.*?\)\s*/g, "").trim();
    if (norm === nameUpper) return true;
    if (norm === nameFirstUpper) return true;
    if (nameUpper.startsWith(norm + " ") || norm.startsWith(nameUpper + " ")) return true;
    return false;
  };
  let sex = "Unknown";
  let ageMin: number | null = null;
  let ageMax: number | null = null;
  let isChild = false;

  // ── 0. Scan raw_text for the character's FIRST introduction in the script ──
  // Scripts introduce characters in ALL CAPS followed by parenthetical attributes and
  // descriptive prose, e.g.:
  //   JULES WINNFIELD (early 30s, Black) is a hitman with a philosophical bent...
  //   BUTCH COOLIDGE, a white, tough-looking, serious-faced prizefighter...
  let scriptIntroDescription = "";

  for (const scene of scenes) {
    if (scriptIntroDescription) break; // Only need the first introduction
    const rawText = scene.raw_text || "";
    const escapedName = nameUpper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Match: CHARNAME followed by optional parenthetical, then grab the rest of the
    // introductory text up to the next blank line, character cue, or scene heading.
    // This captures the full prose description the screenwriter wrote.
    const introPattern = new RegExp(
      `${escapedName}\\s*(?:\\(([^)]{3,120})\\))?[,.]?\\s*([^\\n]{5,})`,
      "m"
    );
    const introMatch = rawText.match(introPattern);
    if (introMatch) {
      const parenthetical = introMatch[1] || "";
      const proseAfter = (introMatch[2] || "").trim();

      // Extract age from parenthetical
      if (parenthetical) {
        const earlyMatch = parenthetical.match(/early\s+(\d)0s/i);
        const midMatch = parenthetical.match(/mid[- ]?(\d)0s/i);
        const lateMatch = parenthetical.match(/late\s+(\d)0s/i);
        const plainDecade = parenthetical.match(/\b(\d)0s\b/i);
        const exactAge = parenthetical.match(/\b(\d{1,2})\b/);

        if (earlyMatch) {
          const d = parseInt(earlyMatch[1]);
          ageMin = d * 10;
          ageMax = d * 10 + 3;
        } else if (midMatch) {
          const d = parseInt(midMatch[1]);
          ageMin = d * 10 + 4;
          ageMax = d * 10 + 6;
        } else if (lateMatch) {
          const d = parseInt(lateMatch[1]);
          ageMin = d * 10 + 7;
          ageMax = d * 10 + 9;
        } else if (plainDecade) {
          const d = parseInt(plainDecade[1]);
          ageMin = d * 10;
          ageMax = d * 10 + 9;
        } else if (exactAge) {
          const a = parseInt(exactAge[1]);
          if (a > 0 && a < 100) { ageMin = a; ageMax = a; }
        }

        if (ageMax !== null && ageMax <= 12) isChild = true;

        // Extract sex clues from parenthetical
        const pLower = parenthetical.toLowerCase();
        if (/\b(female|woman|girl|she)\b/.test(pLower)) sex = "Female";
      }

      // Build the script introduction description from parenthetical + prose
      // Grab additional continuation lines (next 1-2 lines that are part of the same action block)
      const matchEnd = rawText.indexOf(introMatch[0]) + introMatch[0].length;
      const restAfterMatch = rawText.substring(matchEnd);
      const continuationLines = restAfterMatch.split("\n");
      let fullProse = proseAfter;

      for (const line of continuationLines) {
        const trimmed = line.trim();
        // Stop at blank lines, character cues (ALL CAPS short lines), or scene headings
        if (!trimmed) break;
        if (/^[A-Z][A-Z\s.'-]{1,30}$/.test(trimmed)) break; // Looks like a character cue
        if (/^(INT\.|EXT\.|INT\/EXT)/.test(trimmed)) break;
        if (/^\(/.test(trimmed)) break; // Parenthetical dialogue direction
        fullProse += " " + trimmed;
        if (fullProse.length > 300) break; // Enough context
      }

      // Clean up the description
      scriptIntroDescription = fullProse
        .replace(/\s+/g, " ")
        .trim();
      // Truncate to ~2 sentences if very long
      const sentences = scriptIntroDescription.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 3) {
        scriptIntroDescription = sentences.slice(0, 3).join("").trim();
      }
    }
  }

  // ── 1. Find FIRST TWO appearances and gather introduction-level description ──
  let firstSceneDesc = "";
  const introFragments: string[] = [];
  const allBehavior: string[] = [];
  let appearanceCount = 0;

  for (const scene of scenes) {
    const charDetails = Array.isArray(scene.character_details) ? scene.character_details : [];
    for (const c of charDetails) {
      if (typeof c === "string" || !c?.name) continue;
      const cName = (c.name || "");
      if (!matchesCharName(cName)) continue;

      if (appearanceCount < 2) {
        appearanceCount++;
        if (appearanceCount === 1) {
          firstSceneDesc = scene.description || "";
        }
        if (c.character_introduction) introFragments.push(c.character_introduction);
        if (c.physical_behavior) introFragments.push(c.physical_behavior);
        if (c.key_expressions) introFragments.push(c.key_expressions);

        if (Array.isArray(scene.wardrobe)) {
          for (const w of scene.wardrobe) {
            const wChar = (w.character || "").toUpperCase().trim();
            if (!matchesCharName(wChar)) continue;
            if (w.hair_makeup) introFragments.push(w.hair_makeup);
            if (w.clothing_style) introFragments.push(w.clothing_style);
          }
        }
      }

      if (c.physical_behavior) allBehavior.push(c.physical_behavior);
    }

  }

  // Build introduction description: prioritize raw script intro over AI fragments
  let introDescription = "";
  if (scriptIntroDescription) {
    // Use the actual screenwriter's introduction text
    introDescription = scriptIntroDescription;
  } else if (introFragments.length > 0) {
    introDescription = [...new Set(introFragments)].join(". ").replace(/\.\./g, ".").trim();
  }
  if (introDescription && !introDescription.endsWith(".")) introDescription += ".";

  // ── 2. Scan ALL scenes for sex via pronouns & role titles ──
  const FEMALE_PRONOUNS = /\b(she|her|hers|herself|woman|girl|mother|mom|wife|daughter|sister|actress|queen|princess|waitress|hostess|mrs|ms|miss|lady|ma'am|gal|bride|girlfriend|aunt|grandma|grandmother|niece)\b/i;
  const MALE_PRONOUNS = /\b(he|him|his|himself|man|guy|boy|father|dad|husband|son|brother|actor|king|prince|waiter|mr|sir|gentleman|groom|boyfriend|uncle|grandpa|grandfather|nephew)\b/i;
  let femaleCues = 0;
  let maleCues = 0;

  for (const scene of scenes) {
    // Check scene description for character name + pronoun proximity
    const desc = (scene.description || "").toLowerCase();
    if (desc.includes(nameLower) || desc.includes(nameFirstUpper.toLowerCase())) {
      // Count pronouns in the same sentence/context as character name
      const sentences = desc.split(/[.!?]/);
      for (const sent of sentences) {
        if (!sent.includes(nameLower) && !sent.includes(nameFirstUpper.toLowerCase())) continue;
        const fMatches = sent.match(new RegExp(FEMALE_PRONOUNS.source, "gi"));
        const mMatches = sent.match(new RegExp(MALE_PRONOUNS.source, "gi"));
        femaleCues += fMatches?.length ?? 0;
        maleCues += mMatches?.length ?? 0;
      }
    }

    // Check character entries for this character — look at emotional tone for gendered words
    if (Array.isArray(scene.character_details)) {
      for (const c of scene.character_details) {
        if (typeof c === "string" || !c?.name) continue;
        const cName = (c.name || "");
        if (!matchesCharName(cName)) continue;
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
        if (!matchesCharName(wChar)) continue;
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
    if (desc.toLowerCase().includes(nameLower) || desc.toLowerCase().includes(nameFirstUpper.toLowerCase())) textsToScan.push(desc);

    // Also scan raw_text which contains the original screenplay text with character introductions
    const rawText = scene.raw_text || "";
    if (rawText.toLowerCase().includes(nameLower) || rawText.toUpperCase().includes(nameUpper)) textsToScan.push(rawText);

    if (Array.isArray(scene.character_details)) {
      for (const c of scene.character_details) {
        if (typeof c === "string" || !c?.name) continue;
        const cName = (c.name || "");
        if (!matchesCharName(cName)) continue;
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
  let description = introDescription;
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
const AuditionCardComponent = ({ card, locking, onLock, onExpand, onRate, hasConsistencyViews }: { card: AuditionCard; locking: boolean; onLock: () => void; onExpand: () => void; onRate: (card: AuditionCard, rating: number) => void; hasConsistencyViews?: boolean }) => (
  <div
    className={cn(
      "group relative rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer",
      "aspect-[3/4]",
      card.locked ? "border-primary/50 ring-2 ring-primary/30" : "border-border hover:border-primary/30 hover:cinema-glow"
    )}
    onClick={() => card.imageUrl && !card.generating && onExpand()}
  >
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

    {/* Consistency views icon - top left */}
    {hasConsistencyViews && card.imageUrl && !card.generating && (
      <div className="absolute top-2 left-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm text-primary text-[9px] font-bold uppercase tracking-wider px-1.5 py-1 rounded-md border border-primary/20" title="Turnaround views available">
        <Layers className="h-3 w-3" />
      </div>
    )}

    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/90 to-transparent p-2 pt-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-display font-semibold uppercase tracking-wider text-foreground truncate">{card.label}</p>
        {!card.generating && card.imageUrl && (
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map((star) => (
              <button key={star} onClick={(e) => { e.stopPropagation(); onRate(card, card.rating === star ? 0 : star); }} className="p-0">
                <Star className={cn("h-3 w-3 transition-colors", (card.rating || 0) >= star ? "fill-primary text-primary" : "text-muted-foreground/40")} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>

    {card.locked && (
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">
        <Check className="h-3 w-3" /> Cast
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
