import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, Save, Loader2, Lock, AudioWaveform } from "lucide-react";
import CharacterSidebar from "./CharacterSidebar";

interface Character {
  id: string;
  name: string;
  image_url: string | null;
  voice_description: string | null;
  voice_generation_seed: number | null;
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
  const [synthesizing, setSynthesizing] = useState(false);

  const selectedChar = characters?.find((c) => c.id === selectedCharId) ?? null;

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

  const handleSynthesizeSeed = useCallback(async () => {
    if (!selectedChar) return;
    setSynthesizing(true);
    // Simulate AI synthesis delay
    await new Promise((r) => setTimeout(r, 2400));
    const seed = Math.floor(100000 + Math.random() * 900000);
    const { error } = await supabase
      .from("characters")
      .update({ voice_generation_seed: seed })
      .eq("id", selectedChar.id);
    setSynthesizing(false);
    if (error) {
      toast.error("Failed to synthesize voice seed");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast.success(`Voice seed locked for ${selectedChar.name}`);
  }, [selectedChar, queryClient]);

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
                <p className="text-xs text-muted-foreground">Zero-Shot Voice Synthesizer</p>
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

            {/* Voice Seed Synthesizer */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-5 cinema-shadow">
              <div className="flex items-center gap-2">
                <AudioWaveform className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                  Voice Seed
                </h3>
              </div>

              {selectedChar.voice_generation_seed ? (
                <div className="space-y-4">
                  {/* Locked seed display */}
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                        Locked Seed
                      </p>
                      <p className="font-display text-2xl font-bold tracking-wider text-primary tabular-nums">
                        {selectedChar.voice_generation_seed}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                      <Lock className="h-3 w-3" />
                      Locked
                    </div>
                  </div>

                  {/* Waveform animation */}
                  <div className="rounded-lg bg-secondary/50 border border-border p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                      Voice Profile — Ready for Production
                    </p>
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

                  {/* Re-synthesize */}
                  <Button
                    onClick={handleSynthesizeSeed}
                    disabled={synthesizing}
                    variant="outline"
                    className="gap-2 w-full"
                  >
                    {synthesizing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Re-synthesizing…</>
                    ) : (
                      <><AudioWaveform className="h-4 w-4" />Re-synthesize Voice Seed</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Generate a unique voice seed for <span className="text-primary font-semibold">{selectedChar.name}</span> based on the description above. This seed will lock the vocal identity for production.
                  </p>
                  <Button
                    onClick={handleSynthesizeSeed}
                    disabled={synthesizing}
                    className="gap-2 w-full"
                  >
                    {synthesizing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Synthesizing Voice Seed…</>
                    ) : (
                      <><AudioWaveform className="h-4 w-4" />Synthesize Voice Seed</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 h-full">
            <div className="text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                <Mic className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">Voice Casting</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Select a character from the sidebar to define their vocal identity.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default VoiceCastingPanel;
