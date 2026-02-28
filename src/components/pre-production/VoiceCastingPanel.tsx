import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, Save, Loader2, Lock, AudioWaveform, Sparkles } from "lucide-react";
import CharacterSidebar from "./CharacterSidebar";
import VoiceAuditionPlayer from "./VoiceAuditionPlayer";
import { useParsedScenes } from "@/hooks/useFilm";

interface Character {
  id: string;
  name: string;
  image_url: string | null;
  voice_description: string | null;
  voice_generation_seed: number | null;
  sex?: string | null;
  description?: string | null;
  film_id?: string;
}

interface VoiceCastingPanelProps {
  characters: Character[] | undefined;
  isLoading: boolean;
}

const VoiceCastingPanel = ({ characters, isLoading }: VoiceCastingPanelProps) => {
  const queryClient = useQueryClient();
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [voiceDesc, setVoiceDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const selectedChar = characters?.find((c) => c.id === selectedCharId) ?? null;
  const { data: parsedScenes } = useParsedScenes();

  // Fetch existing voice auditions for selected character
  const { data: auditions, refetch: refetchAuditions } = useQuery({
    queryKey: ["voice-auditions", selectedCharId],
    queryFn: async () => {
      if (!selectedCharId) return [];
      const { data, error } = await supabase
        .from("character_voice_auditions")
        .select("*")
        .eq("character_id", selectedCharId)
        .order("voice_index");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedCharId,
  });

  // Sync textarea when character changes
  useEffect(() => {
    setVoiceDesc(selectedChar?.voice_description ?? "");
  }, [selectedChar?.id, selectedChar?.voice_description]);

  const handleSaveDescription = useCallback(async () => {
    if (!selectedChar) return;
    setSaving(true);
    const { error } = await supabase
      .from("characters")
      .update({ voice_description: voiceDesc || null })
      .eq("id", selectedChar.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save voice description");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast.success(`Voice description saved for ${selectedChar.name}`);
  }, [selectedChar, voiceDesc, queryClient]);

  // Build sample text from character's first dialogue line in script
  const getSampleText = useCallback(() => {
    if (!selectedChar || !parsedScenes?.length) {
      return `Hello, my name is ${selectedChar?.name ?? "unknown"}. I'm here to tell you a story that will change everything you thought you knew.`;
    }
    // Find first scene with this character's dialogue
    for (const scene of parsedScenes) {
      const rawText = (scene as any).raw_text as string;
      if (!rawText) continue;
      const lines = rawText.split("\n");
      const charNameUpper = selectedChar.name.toUpperCase();
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === charNameUpper || trimmed.startsWith(`${charNameUpper} (`)) {
          // Next non-empty, non-parenthetical line is dialogue
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const dl = lines[j].trim();
            if (!dl || dl.startsWith("(")) continue;
            if (dl === dl.toUpperCase() && dl.length > 3) break; // next character cue
            if (dl.length > 15) return dl;
          }
        }
      }
    }
    return `Hello, my name is ${selectedChar.name}. I'm here to tell you a story that will change everything you thought you knew.`;
  }, [selectedChar, parsedScenes]);

  const handleGenerateAuditions = useCallback(async () => {
    if (!selectedChar) return;
    setGenerating(true);
    try {
      const sampleText = getSampleText();
      const { data, error } = await supabase.functions.invoke("elevenlabs-voice-audition", {
        body: {
          character_id: selectedChar.id,
          character_name: selectedChar.name,
          sex: selectedChar.sex ?? null,
          sample_text: sampleText,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchAuditions();
      toast.success(`5 voice samples generated for ${selectedChar.name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Voice generation failed", { description: msg });
    } finally {
      setGenerating(false);
    }
  }, [selectedChar, getSampleText, refetchAuditions]);

  const handleSelectVoice = useCallback(async (auditionId: string) => {
    if (!selectedChar || !auditions) return;
    // Deselect all, then select the chosen one
    for (const a of auditions) {
      if (a.id === auditionId) {
        await supabase.from("character_voice_auditions").update({ selected: true }).eq("id", a.id);
        // Also store voice_id as the voice_generation_seed (encoded) on the character
        await supabase.from("characters").update({
          voice_generation_seed: a.voice_index + 1,
          voice_description: voiceDesc || selectedChar.voice_description || null,
        }).eq("id", selectedChar.id);
      } else if (a.selected) {
        await supabase.from("character_voice_auditions").update({ selected: false }).eq("id", a.id);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["voice-auditions", selectedChar.id] });
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast.success(`Voice selected for ${selectedChar.name}`);
  }, [selectedChar, auditions, voiceDesc, queryClient]);

  return (
    <div className="flex-1 flex overflow-hidden">
      <CharacterSidebar
        characters={characters}
        isLoading={isLoading}
        selectedCharId={selectedCharId}
        onSelect={setSelectedCharId}
        showVoiceSeed
      />

      <main className="flex-1 overflow-y-auto">
        {selectedChar ? (
          <div className="p-6 space-y-6 max-w-2xl">
            {/* Character header */}
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
                <p className="text-xs text-muted-foreground">Voice Casting — ElevenLabs</p>
              </div>
            </div>

            {/* Voice Description */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 cinema-shadow">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                  Voice Description
                </h3>
              </div>
              <Textarea
                value={voiceDesc}
                onChange={(e) => setVoiceDesc(e.target.value)}
                placeholder="Gravelly, mid-40s, slight transatlantic accent…"
                className="min-h-[100px] bg-secondary/50 border-border text-sm resize-none"
              />
              <Button
                onClick={handleSaveDescription}
                disabled={saving}
                variant="secondary"
                className="gap-2"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                ) : (
                  <><Save className="h-4 w-4" />Save Description</>
                )}
              </Button>
            </div>

            {/* Voice Auditions */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-5 cinema-shadow">
              <div className="flex items-center gap-2">
                <AudioWaveform className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                  Voice Auditions
                </h3>
              </div>

              {auditions && auditions.length > 0 ? (
                <VoiceAuditionPlayer
                  auditions={auditions}
                  onSelect={handleSelectVoice}
                  onRecast={handleGenerateAuditions}
                  recasting={generating}
                />
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Generate <span className="text-primary font-semibold">5 unique voice samples</span> for{" "}
                    <span className="text-primary font-semibold">{selectedChar.name}</span> using ElevenLabs.
                    Each sample uses a different voice actor matched to the character's profile.
                  </p>
                  <Button
                    onClick={handleGenerateAuditions}
                    disabled={generating}
                    className="gap-2 w-full"
                  >
                    {generating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Generating Voice Samples…</>
                    ) : (
                      <><Sparkles className="h-4 w-4" />Generate Voice Auditions</>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Locked Voice Indicator */}
            {selectedChar.voice_generation_seed && auditions?.some((a) => a.selected) && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Selected Voice
                  </p>
                  <p className="font-display text-lg font-bold text-primary">
                    {auditions.find((a) => a.selected)?.voice_name ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                  <Lock className="h-3 w-3" />
                  Locked
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 h-full">
            <div className="text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                <Mic className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">Voice Casting</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Select a character from the sidebar to audition voices with ElevenLabs.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default VoiceCastingPanel;
