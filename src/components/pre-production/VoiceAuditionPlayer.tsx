import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, Pause, Check, Loader2, RotateCcw } from "lucide-react";

interface VoiceAudition {
  id: string;
  voice_index: number;
  voice_id: string;
  voice_name: string;
  audio_url: string | null;
  selected: boolean;
}

interface VoiceAuditionPlayerProps {
  auditions: VoiceAudition[];
  onSelect: (auditionId: string) => void;
  onRecast: () => void;
  recasting: boolean;
}

const VoiceAuditionPlayer = ({ auditions, onSelect, onRecast, recasting }: VoiceAuditionPlayerProps) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>();

  const selectedAudition = auditions.find((a) => a.selected);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlayingId(null);
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioRef.current) {
        audioRef.current.src = "";
      }
    };
  }, [stopPlayback]);

  const handlePlay = useCallback((audition: VoiceAudition) => {
    if (!audition.audio_url) return;

    if (playingId === audition.id) {
      stopPlayback();
      return;
    }

    stopPlayback();

    const audio = new Audio(audition.audio_url);
    audioRef.current = audio;
    setPlayingId(audition.id);

    const updateProgress = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setProgress((prev) => ({ ...prev, [audition.id]: (audio.currentTime / audio.duration) * 100 }));
      }
      if (!audio.paused) {
        rafRef.current = requestAnimationFrame(updateProgress);
      }
    };

    audio.onended = () => {
      setPlayingId(null);
      setProgress((prev) => ({ ...prev, [audition.id]: 0 }));
    };

    audio.play().then(() => {
      rafRef.current = requestAnimationFrame(updateProgress);
    });
  }, [playingId, stopPlayback]);

  return (
    <div className="space-y-3">
      {auditions.map((audition) => {
        const isPlaying = playingId === audition.id;
        const pct = progress[audition.id] ?? 0;
        const isSelected = audition.selected;

        return (
          <div
            key={audition.id}
            className={cn(
              "relative rounded-lg border p-3 transition-all duration-200 overflow-hidden",
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border bg-card hover:border-primary/30"
            )}
          >
            {/* Progress bar background */}
            {isPlaying && (
              <div
                className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-100"
                style={{ width: `${pct}%` }}
              />
            )}

            <div className="relative flex items-center gap-3">
              {/* Play/Pause button */}
              <Button
                size="icon"
                variant={isPlaying ? "default" : "outline"}
                className="h-9 w-9 shrink-0 rounded-full"
                onClick={() => handlePlay(audition)}
                disabled={!audition.audio_url}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </Button>

              {/* Voice info */}
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm font-bold text-foreground">
                  {audition.voice_name}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Voice {audition.voice_index + 1} of {auditions.length}
                </p>
              </div>

              {/* Waveform visualization */}
              <div className="hidden sm:flex items-end gap-[2px] h-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-[2px] rounded-full transition-all duration-150",
                      isPlaying ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                    style={{
                      height: isPlaying
                        ? `${6 + Math.sin(i * 0.8 + pct * 0.1) * 14 + Math.random() * 4}px`
                        : `${4 + Math.sin(i * 0.7) * 8}px`,
                    }}
                  />
                ))}
              </div>

              {/* Select button */}
              <Button
                size="sm"
                variant={isSelected ? "default" : "outline"}
                className={cn(
                  "gap-1.5 shrink-0",
                  isSelected && "bg-primary text-primary-foreground"
                )}
                onClick={() => onSelect(audition.id)}
              >
                {isSelected ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Selected
                  </>
                ) : (
                  "Select"
                )}
              </Button>
            </div>
          </div>
        );
      })}

      {/* Recast button */}
      <Button
        variant="outline"
        className="w-full gap-2 mt-2"
        onClick={onRecast}
        disabled={recasting}
      >
        {recasting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Recasting voices…
          </>
        ) : (
          <>
            <RotateCcw className="h-4 w-4" />
            Recast — Generate New Voices
          </>
        )}
      </Button>
    </div>
  );
};

export default VoiceAuditionPlayer;
