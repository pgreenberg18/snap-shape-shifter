import { useState, useEffect } from "react";
import { useShots, useTimelineClips } from "@/hooks/useFilm";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  useDraggable,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Play, Film, Music, Wand2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Clip = Tables<"post_production_clips">;

function DraggableClip({ clip, onDoubleClick }: { clip: Clip; onDoubleClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: clip.id });

  const style: React.CSSProperties = {
    position: "absolute",
    left: clip.left_pos,
    width: clip.width,
    transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
    top: 4,
    bottom: 4,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={clip.track === "video1" ? onDoubleClick : undefined}
      style={style}
      className="rounded-md border border-white/10 px-2 flex items-center text-[10px] font-mono text-foreground/80 cursor-grab active:cursor-grabbing select-none truncate"
      title={clip.track === "video1" ? "Double-click for VFX" : clip.label}
    >
      <span className="absolute inset-0 rounded-md" style={{ background: clip.color ?? "hsl(51 100% 50% / 0.3)" }} />
      <span className="relative z-10 truncate">{clip.label}</span>
    </div>
  );
}

const PostProduction = () => {
  const { data: shotsData, isLoading: shotsLoading } = useShots();
  const { data: clipsData, isLoading: clipsLoading } = useTimelineClips();
  const [clips, setClips] = useState<Clip[]>([]);
  const [vfxClip, setVfxClip] = useState<Clip | null>(null);

  useEffect(() => {
    if (clipsData) setClips(clipsData);
  }, [clipsData]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta } = event;
    const updated = clips.map((c) =>
      c.id === active.id ? { ...c, left_pos: Math.max(0, c.left_pos + delta.x) } : c
    );
    setClips(updated);
    const moved = updated.find((c) => c.id === active.id);
    if (moved) {
      await supabase.from("post_production_clips").update({ left_pos: moved.left_pos }).eq("id", moved.id);
    }
  };

  const tracks = [
    { id: "video1", label: "Video 1", icon: <Film className="h-3 w-3" /> },
    { id: "audio1", label: "Dialogue", icon: <Music className="h-3 w-3" /> },
    { id: "audio2", label: "Foley", icon: <Music className="h-3 w-3" /> },
    { id: "audio3", label: "Effects", icon: <Music className="h-3 w-3" /> },
    { id: "audio4", label: "Music", icon: <Music className="h-3 w-3" /> },
  ];

  if (shotsLoading || clipsLoading) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>;

  return (
    <div className="flex h-full flex-col">
      {/* Top Half */}
      <div className="flex flex-[5] min-h-0">
        {/* Media Bin */}
        <div className="w-1/3 border-r border-border p-4 overflow-y-auto">
          <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Media Bin</h3>
          <div className="space-y-2">
            {shotsData?.map((shot) => (
              <div key={shot.id} className="rounded-lg border border-border bg-secondary p-3 cinema-inset">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">SC{shot.scene_number}</span>
                  <span className="text-[10px] text-muted-foreground">{shot.camera_angle}</span>
                </div>
                <p className="mt-1 text-xs text-foreground/80 line-clamp-2">{shot.prompt_text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Playback Monitor */}
        <div className="flex-1 flex items-center justify-center bg-black relative">
          <div className="text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
              <Play className="h-8 w-8 text-white/30" />
            </div>
            <p className="text-xs font-mono text-white/30">No playback</p>
          </div>
          <div className="absolute bottom-3 left-3 text-[10px] font-mono text-white/20">00:00:00:00</div>
        </div>
      </div>

      {/* Bottom Half — Timeline */}
      <div className="flex-[5] bg-card border-t border-border flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Timeline</span>
          <span className="text-[10px] font-mono text-muted-foreground">24fps • 00:00:18:00</span>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-auto relative">
            {tracks.map((track) => (
              <div key={track.id} className="flex border-b border-border/50">
                <div className="w-24 shrink-0 flex items-center gap-1.5 px-3 border-r border-border/50 bg-secondary/50">
                  {track.icon}
                  <span className="text-[10px] font-mono text-muted-foreground">{track.label}</span>
                </div>
                <div className="relative flex-1 h-14">
                  {clips.filter((c) => c.track === track.id).map((clip) => (
                    <DraggableClip key={clip.id} clip={clip} onDoubleClick={() => setVfxClip(clip)} />
                  ))}
                </div>
              </div>
            ))}

            <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none" style={{ left: `calc(96px + 120px)` }}>
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-primary rotate-45" />
            </div>
          </div>
        </DndContext>
      </div>

      {/* VFX Dialog */}
      <Dialog open={!!vfxClip} onOpenChange={() => setVfxClip(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">VFX Inpaint — {vfxClip?.label}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 gap-4 min-h-0">
            <div className="flex-1 rounded-lg bg-black flex items-center justify-center cursor-crosshair">
              <p className="text-xs font-mono text-white/20">Paint over area to inpaint</p>
            </div>
            <div className="w-64 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inpaint Prompt</label>
                <Textarea className="mt-1.5 h-28 text-sm bg-secondary border-border resize-none" placeholder="Remove object, change background, add effect..." />
              </div>
              <Button className="w-full gap-2">
                <Wand2 className="h-4 w-4" />
                Auto-Heal VFX
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PostProduction;
