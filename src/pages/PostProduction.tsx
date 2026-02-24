import { useState, useEffect, useCallback, useRef } from "react";
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
import VfxFixItBay from "@/components/post-production/VfxFixItBay";
import PostProductionSidebar from "@/components/post-production/PostProductionSidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Play, Film, Music, Plus, Trash2, ChevronDown, Undo2, Redo2, FileDown } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Clip = Tables<"post_production_clips">;

/* ── Track-based clip colors ── */
const getClipColor = (track: string): string => {
  if (track.startsWith("video")) return "hsl(215 15% 30% / 0.85)"; // Slate
  if (track === "audio3" || track.includes("effect")) return "hsl(270 30% 25% / 0.85)"; // Deep purple for Effects/VFX
  return "hsl(175 30% 22% / 0.85)"; // Dark teal for audio
};

const getClipBorder = (track: string): string => {
  if (track.startsWith("video")) return "hsl(215 20% 50% / 0.5)";
  if (track === "audio3" || track.includes("effect")) return "hsl(270 40% 45% / 0.5)";
  return "hsl(175 40% 38% / 0.5)";
};

function DraggableClip({ clip, onDoubleClick }: { clip: Clip; onDoubleClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: clip.id });

  const style: React.CSSProperties = {
    position: "absolute",
    left: clip.left_pos,
    width: clip.width,
    transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
    top: 4,
    bottom: 4,
    background: getClipColor(clip.track),
    borderColor: getClipBorder(clip.track),
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={clip.track.startsWith("video") ? onDoubleClick : undefined}
      style={style}
      className="rounded-lg border px-1 flex items-center text-[10px] font-mono text-foreground/80 cursor-grab active:cursor-grabbing select-none group/clip"
      title={clip.track.startsWith("video") ? "Double-click for VFX" : clip.label}
    >
      {/* Left trim handle */}
      <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center rounded-l-lg hover:bg-white/10 transition-colors opacity-0 group-hover/clip:opacity-100">
        <div className="w-px h-3 bg-foreground/30" />
        <div className="w-px h-3 bg-foreground/30 ml-px" />
      </div>
      {/* Label */}
      <span className="relative z-10 truncate px-2 flex-1">{clip.label}</span>
      {/* Right trim handle */}
      <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center rounded-r-lg hover:bg-white/10 transition-colors opacity-0 group-hover/clip:opacity-100">
        <div className="w-px h-3 bg-foreground/30" />
        <div className="w-px h-3 bg-foreground/30 ml-px" />
      </div>
    </div>
  );
}

/* ── Undo/Redo History Hook ── */
type TimelineState = { tracks: Track[]; clips: Clip[] };

function useUndoRedo(initial: TimelineState, maxHistory = 100) {
  const [past, setPast] = useState<TimelineState[]>([]);
  const [present, setPresent] = useState<TimelineState>(initial);
  const [future, setFuture] = useState<TimelineState[]>([]);
  const skipRecord = useRef(false);

  const setState = useCallback((next: TimelineState | ((prev: TimelineState) => TimelineState)) => {
    setPresent((prev) => {
      const nextState = typeof next === "function" ? next(prev) : next;
      if (!skipRecord.current) {
        setPast((p) => [...p.slice(-(maxHistory - 1)), prev]);
        setFuture([]);
      }
      skipRecord.current = false;
      return nextState;
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [present, ...f].slice(0, maxHistory));
      skipRecord.current = true;
      setPresent(prev);
      return p.slice(0, -1);
    });
  }, [present, maxHistory]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, present].slice(-maxHistory));
      skipRecord.current = true;
      setPresent(next);
      return f.slice(1);
    });
  }, [present, maxHistory]);

  return { state: present, setState, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}

type Track = { id: string; label: string; type: "video" | "audio"; icon: React.ReactNode };

const INITIAL_TRACKS: Track[] = [
  { id: "video1", label: "Video 1", type: "video", icon: <Film className="h-3 w-3" /> },
  { id: "audio1", label: "Dialogue", type: "audio", icon: <Music className="h-3 w-3" /> },
  { id: "audio2", label: "Foley", type: "audio", icon: <Music className="h-3 w-3" /> },
  { id: "audio3", label: "Effects", type: "audio", icon: <Music className="h-3 w-3" /> },
  { id: "audio4", label: "Music", type: "audio", icon: <Music className="h-3 w-3" /> },
];

const PostProduction = () => {
  const { data: shotsData, isLoading: shotsLoading } = useShots();
  const { data: clipsData, isLoading: clipsLoading } = useTimelineClips();
  const [vfxClip, setVfxClip] = useState<Clip | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Track | null>(null);

  const { state, setState, undo, redo, canUndo, canRedo } = useUndoRedo({
    tracks: INITIAL_TRACKS,
    clips: [],
  });

  const { tracks, clips } = state;

  useEffect(() => {
    if (clipsData) setState((prev) => ({ ...prev, clips: clipsData }));
  }, [clipsData, setState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const addTrack = (type: "video" | "audio") => {
    const existing = tracks.filter((t) => t.type === type);
    const num = existing.length + 1;
    const label = type === "video" ? `Video ${num}` : `Audio ${num}`;
    const id = `${type}${Date.now()}`;
    setState((prev) => ({
      ...prev,
      tracks: [
        ...prev.tracks,
        { id, label, type, icon: type === "video" ? <Film className="h-3 w-3" /> : <Music className="h-3 w-3" /> },
      ],
    }));
  };

  const confirmDeleteTrack = () => {
    if (!deleteConfirm) return;
    const trackId = deleteConfirm.id;
    setState((prev) => ({
      tracks: prev.tracks.filter((t) => t.id !== trackId),
      clips: prev.clips.filter((c) => c.track !== trackId),
    }));
    setDeleteConfirm(null);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta } = event;
    const updated = clips.map((c) =>
      c.id === active.id ? { ...c, left_pos: Math.max(0, c.left_pos + delta.x) } : c
    );
    setState((prev) => ({ ...prev, clips: updated }));
    const moved = updated.find((c) => c.id === active.id);
    if (moved) {
      await supabase.from("post_production_clips").update({ left_pos: moved.left_pos }).eq("id", moved.id);
    }
  };

  if (shotsLoading || clipsLoading) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>;

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Timeline</span>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={undo} disabled={!canUndo}>
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><span className="text-[10px]">Undo (⌘Z)</span></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={redo} disabled={!canRedo}>
                    <Redo2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><span className="text-[10px]">Redo (⌘⇧Z)</span></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground">24fps • 00:00:18:00</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground">
                  <Plus className="h-3 w-3" /> Add Track <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => addTrack("video")} className="text-xs gap-2">
                  <Film className="h-3 w-3" /> Video Track
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addTrack("audio")} className="text-xs gap-2">
                  <Music className="h-3 w-3" /> Audio Track
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1.5 text-muted-foreground hover:text-foreground">
              <FileDown className="h-3 w-3" /> Export FCPXML
            </Button>
          </div>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-auto relative">
            {tracks.map((track) => (
              <div key={track.id} className="flex border-b border-border/50 group">
                <div className="w-24 shrink-0 flex items-center gap-1 px-2 border-r border-border/50 bg-secondary/50">
                  {track.icon}
                  <span className="text-[10px] font-mono text-muted-foreground flex-1 truncate">{track.label}</span>
                  {tracks.length > 1 && (
                    <button
                      onClick={() => setDeleteConfirm(track)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all p-0.5"
                      title={`Delete ${track.label}`}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
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

      {/* Delete Track Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Track?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteConfirm?.label}"</span>? All clips on this track will be removed. This action can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTrack} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Track
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* VFX Fix-It Bay */}
      <VfxFixItBay clip={vfxClip} onClose={() => setVfxClip(null)} />
      </div>
      {/* Right Sidebar */}
      <PostProductionSidebar />
    </div>
  );
};

export default PostProduction;
