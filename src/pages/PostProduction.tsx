import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useShots, useTimelineClips, useFilmId } from "@/hooks/useFilm";
import { useStyleContract } from "@/hooks/useStyleContract";
import { supabase } from "@/integrations/supabase/client";
import StyleDriftDetector from "@/components/post-production/StyleDriftDetector";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
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
import { Play, Film, Music, Plus, Trash2, ChevronDown, ChevronRight, Undo2, Redo2, FileDown, AudioWaveform, Palette, Music2, Wand2, FileAudio, FileImage, FileVideo, X, FolderOpen, Folder, ZoomIn, ZoomOut } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { SHOT_COLORS } from "@/lib/shot-colors";
type Clip = Tables<"post_production_clips">;
type Shot = Tables<"shots">;

export type ImportedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  tab: string;
  category: string;
  importedAt: string;
};

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

/* ── Trim handle logic ── */
function useTrimHandle(
  side: "left" | "right",
  clipId: string,
  currentLeft: number,
  currentWidth: number,
  onTrim: (id: string, newLeft: number, newWidth: number) => void
) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startLeft = currentLeft;
    const startWidth = currentWidth;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (side === "left") {
        const newLeft = Math.max(0, startLeft + dx);
        const newWidth = Math.max(30, startWidth - dx);
        onTrim(clipId, newLeft, newWidth);
      } else {
        const newWidth = Math.max(30, startWidth + dx);
        onTrim(clipId, startLeft, newWidth);
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [side, clipId, currentLeft, currentWidth, onTrim]);

  return handleMouseDown;
}

/* ── Draggable Timeline Clip ── */
function DraggableClip({ clip, onDoubleClick, onTrim }: { clip: Clip; onDoubleClick: () => void; onTrim: (id: string, left: number, width: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: clip.id,
    data: { type: "timeline-clip", clip },
  });

  const leftTrim = useTrimHandle("left", clip.id, clip.left_pos, clip.width, onTrim);
  const rightTrim = useTrimHandle("right", clip.id, clip.left_pos, clip.width, onTrim);

  const style: React.CSSProperties = {
    position: "absolute",
    left: clip.left_pos,
    width: clip.width,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    top: 4,
    bottom: 4,
    background: getClipColor(clip.track),
    borderColor: getClipBorder(clip.track),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
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
      <div
        onMouseDown={leftTrim}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center rounded-l-lg hover:bg-white/10 transition-colors opacity-0 group-hover/clip:opacity-100 z-20"
      >
        <div className="w-px h-3 bg-foreground/30" />
        <div className="w-px h-3 bg-foreground/30 ml-px" />
      </div>
      {/* Label */}
      <span className="relative z-10 truncate px-2 flex-1">{clip.label}</span>
      {/* Right trim handle */}
      <div
        onMouseDown={rightTrim}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center rounded-r-lg hover:bg-white/10 transition-colors opacity-0 group-hover/clip:opacity-100 z-20"
      >
        <div className="w-px h-3 bg-foreground/30" />
        <div className="w-px h-3 bg-foreground/30 ml-px" />
      </div>
    </div>
  );
}

/* ── Draggable Media Bin Shot ── */
function DraggableShot({ shot, index }: { shot: Shot; index: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `media-shot-${shot.id}`,
    data: { type: "media-shot", shot },
  });

  const [selected, setSelected] = useState(false);
  const [trimLeft, setTrimLeft] = useState(0);
  const [trimRight, setTrimRight] = useState(0);

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  const frameBg = `hsl(${(shot.scene_number * 47) % 360} 15% 18%)`;

  const handleTrim = useCallback((side: "left" | "right", e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const container = (e.target as HTMLElement).closest("[data-trim-area]") as HTMLElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startVal = side === "left" ? trimLeft : trimRight;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const pct = (dx / rect.width) * 100;
      if (side === "left") {
        setTrimLeft(Math.max(0, Math.min(40, startVal + pct)));
      } else {
        setTrimRight(Math.max(0, Math.min(40, startVal - pct)));
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [trimLeft, trimRight]);

  return (
    <div
      ref={setNodeRef}
      {...(selected ? {} : listeners)}
      {...attributes}
      style={style}
      onClick={(e) => { e.stopPropagation(); setSelected((s) => !s); }}
      className={cn(
        "rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing select-none group/shot cinema-inset transition-colors",
        selected ? "border-primary ring-1 ring-primary/40" : "border-border"
      )}
    >
      <div
        className="relative aspect-video w-full"
        style={{
          background: frameBg,
          boxShadow: `inset 0 0 0 2px hsl(${SHOT_COLORS[index % SHOT_COLORS.length].hsl})`,
        }}
        data-trim-area
      >
        {shot.video_url ? (
          <video
            src={shot.video_url}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            preload="metadata"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="h-6 w-6 text-white/15" />
          </div>
        )}
        <div className="absolute top-1.5 left-1.5 z-10">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold leading-none"
            style={{ color: "#FFD600", background: "hsla(0, 0%, 0%, 0.65)" }}>
            SC{shot.scene_number} / SH{index + 1} / T1
          </span>
        </div>

        {selected && (
          <>
            <div className="absolute top-0 bottom-0 left-0 bg-black/60 z-10" style={{ width: `${trimLeft}%` }} />
            <div
              onMouseDown={(e) => handleTrim("left", e)}
              className="absolute top-0 bottom-0 z-20 w-2.5 cursor-col-resize flex items-center justify-center hover:bg-primary/30 transition-colors"
              style={{ left: `${trimLeft}%` }}
            >
              <div className="w-0.5 h-5 rounded-full bg-primary" />
            </div>
            <div className="absolute top-0 bottom-0 right-0 bg-black/60 z-10" style={{ width: `${trimRight}%` }} />
            <div
              onMouseDown={(e) => handleTrim("right", e)}
              className="absolute top-0 bottom-0 z-20 w-2.5 cursor-col-resize flex items-center justify-center hover:bg-primary/30 transition-colors"
              style={{ right: `${trimRight}%` }}
            >
              <div className="w-0.5 h-5 rounded-full bg-primary" />
            </div>
          </>
        )}
      </div>
      <div className="px-2 py-1.5 bg-secondary/80">
        <p className="text-[10px] font-mono text-foreground/80 truncate">
          {shot.camera_angle || shot.prompt_text?.slice(0, 50) || "Untitled shot"}
        </p>
      </div>
    </div>
  );
}

/* ── Droppable Track ── */
function DroppableTrack({ track, children, isOver }: { track: Track; children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({
    id: `track-${track.id}`,
    data: { type: "track", trackId: track.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex-1 h-14 transition-colors",
        isOver && "bg-primary/10"
      )}
    >
      {children}
    </div>
  );
}

/* ── Collapsible Scene Folder ── */
function SceneShotFolder({ sceneNumber, shots, globalIndex }: { sceneNumber: number; shots: Shot[]; globalIndex: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-secondary/60 hover:bg-secondary/80 transition-colors text-left"
      >
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        {open ? <FolderOpen className="h-3.5 w-3.5 text-primary/70" /> : <Folder className="h-3.5 w-3.5 text-primary/70" />}
        <span className="text-[10px] font-mono font-bold" style={{ color: "#FFD600" }}>
          Scene {sceneNumber}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/60 ml-auto">
          {shots.length} shot{shots.length !== 1 ? "s" : ""}
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-card/30">
          {shots.map((shot, idx) => (
            <DraggableShot key={shot.id} shot={shot} index={globalIndex + idx} />
          ))}
        </div>
      )}
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
  const filmId = useFilmId();
  const { data: styleContract } = useStyleContract();
  const [vfxClip, setVfxClip] = useState<Clip | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Track | null>(null);
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [activeImportTab, setActiveImportTab] = useState<string>("sound");

  const handleFileImport = useCallback((file: File, tab: string, category: string) => {
    const imported: ImportedFile = {
      id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      tab,
      category,
      importedAt: new Date().toISOString(),
    };
    setImportedFiles((prev) => [...prev, imported]);
    setActiveImportTab(tab);
  }, []);

  const removeImportedFile = useCallback((id: string) => {
    setImportedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const { state, setState, undo, redo, canUndo, canRedo } = useUndoRedo({
    tracks: INITIAL_TRACKS,
    clips: [],
  });

  const { tracks, clips } = state;
  const [timelineZoom, setTimelineZoom] = useState(1); // 0.25 to 4
  const [playheadPos, setPlayheadPos] = useState(0); // percentage 0-100
  const scrubberRef = useRef<HTMLDivElement>(null);

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
  const [overTrackId, setOverTrackId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ id: string; label: string; track?: string } | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const d = event.active.data.current;
    if (d?.type === "timeline-clip") {
      setActiveDrag({ id: event.active.id as string, label: d.clip?.label ?? "Clip", track: d.clip?.track });
    } else if (d?.type === "media-shot") {
      const shot = d.shot as Shot;
      setActiveDrag({ id: event.active.id as string, label: `SC${shot.scene_number} – ${shot.camera_angle || "Shot"}` });
    }
  }, []);

  const handleTrimClip = useCallback((id: string, newLeft: number, newWidth: number) => {
    setState((prev) => ({
      ...prev,
      clips: prev.clips.map((c) => c.id === id ? { ...c, left_pos: newLeft, width: newWidth } : c),
    }));
  }, [setState]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (over?.data?.current?.type === "track") {
      setOverTrackId(over.data.current.trackId as string);
    } else {
      setOverTrackId(null);
    }
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta, over } = event;
    setOverTrackId(null);
    setActiveDrag(null);
    const activeData = active.data.current;

    // Dropping a media bin shot onto a track
    if (activeData?.type === "media-shot" && over?.data?.current?.type === "track") {
      const shot = activeData.shot as Shot;
      const targetTrack = over.data.current.trackId as string;
      const existingOnTrack = clips.filter((c) => c.track === targetTrack);
      const maxRight = existingOnTrack.reduce((m, c) => Math.max(m, c.left_pos + c.width), 0);
      const newClip: Clip = {
        id: `local-${Date.now()}`,
        film_id: shot.film_id,
        label: `SC${shot.scene_number} – ${shot.camera_angle || shot.prompt_text?.slice(0, 25) || "Shot"}`,
        track: targetTrack,
        left_pos: maxRight + 8,
        width: 200,
        color: null,
        created_at: new Date().toISOString(),
      };
      setState((prev) => ({ ...prev, clips: [...prev.clips, newClip] }));
      return;
    }

    // Moving an existing timeline clip (horizontal + vertical)
    if (activeData?.type === "timeline-clip") {
      const targetTrack = over?.data?.current?.type === "track" ? (over.data.current.trackId as string) : undefined;
      const updated = clips.map((c) => {
        if (c.id !== active.id) return c;
        return {
          ...c,
          left_pos: Math.max(0, c.left_pos + delta.x),
          track: targetTrack || c.track,
        };
      });
      setState((prev) => ({ ...prev, clips: updated }));
      const moved = updated.find((c) => c.id === active.id);
      if (moved) {
        await supabase.from("post_production_clips").update({ left_pos: moved.left_pos, track: moved.track }).eq("id", moved.id);
      }
    }
  };

  if (shotsLoading || clipsLoading) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-card px-6 py-3 flex items-baseline gap-3">
        <h1 className="font-display text-sm font-bold tracking-tight text-foreground whitespace-nowrap">Post-Production</h1>
        <p className="text-[10px] text-muted-foreground truncate">Timeline editing, sound mixing, color grading, and VFX compositing.</p>
      </div>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver} collisionDetection={pointerWithin}>
    <div className="flex flex-1 min-h-0">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Top Half */}
      <div className="flex flex-[5] min-h-0">
        {/* Media Bin + Imported Files */}
        <div data-help-id="postprod-media-bin" className="w-1/3 border-r border-border flex flex-col overflow-hidden">
          <Tabs value={activeImportTab} onValueChange={setActiveImportTab} className="flex flex-col h-full">
            <div className="px-3 pt-3 pb-0 shrink-0">
              <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Media Bin</h3>
              <TabsList className="w-full h-8 bg-secondary/60 border border-border/50 p-0.5">
                <TabsTrigger value="shots" className="flex-1 text-[9px] font-mono uppercase tracking-wider h-full gap-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <Film className="h-3 w-3" /> Shots
                </TabsTrigger>
                <TabsTrigger value="sound" className="flex-1 text-[9px] font-mono uppercase tracking-wider h-full gap-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <AudioWaveform className="h-3 w-3" /> Sound
                </TabsTrigger>
                <TabsTrigger value="score" className="flex-1 text-[9px] font-mono uppercase tracking-wider h-full gap-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <Music2 className="h-3 w-3" /> Score
                </TabsTrigger>
                <TabsTrigger value="fx" className="flex-1 text-[9px] font-mono uppercase tracking-wider h-full gap-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <Wand2 className="h-3 w-3" /> FX
                </TabsTrigger>
                <TabsTrigger value="color" className="flex-1 text-[9px] font-mono uppercase tracking-wider h-full gap-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <Palette className="h-3 w-3" /> Color
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {/* Style Drift Detection */}
              {shotsData && shotsData.length > 0 && styleContract && (
                <div className="mb-3" data-help-id="postprod-style-drift">
                  <StyleDriftDetector
                    shots={shotsData}
                    contractVersion={styleContract.version}
                    filmId={filmId || ""}
                  />
                </div>
              )}
              {/* Shots tab — grouped by scene */}
              <TabsContent value="shots" className="mt-0 space-y-1">
                {(() => {
                  if (!shotsData || shotsData.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <Film className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-[11px] text-muted-foreground/50 font-mono">No shots available.</p>
                        <p className="text-[9px] text-muted-foreground/40 font-mono mt-1">Create shots in the Production tab.</p>
                      </div>
                    );
                  }
                  // Group shots by scene_number
                  const grouped = new Map<number, typeof shotsData>();
                  shotsData.forEach((shot) => {
                    const arr = grouped.get(shot.scene_number) || [];
                    arr.push(shot);
                    grouped.set(shot.scene_number, arr);
                  });
                  const sceneNumbers = [...grouped.keys()].sort((a, b) => a - b);
                  return sceneNumbers.map((sceneNum) => {
                    const sceneShots = grouped.get(sceneNum)!;
                    return (
                      <SceneShotFolder key={sceneNum} sceneNumber={sceneNum} shots={sceneShots} globalIndex={
                        shotsData.findIndex((s) => s.id === sceneShots[0].id)
                      } />
                    );
                  });
                })()}
              </TabsContent>

              {/* Imported file tabs */}
              {(["sound", "color", "score", "fx"] as const).map((tabKey) => {
                const tabFiles = importedFiles.filter((f) => f.tab === tabKey);
                const FileIcon = tabKey === "sound" || tabKey === "score" ? FileAudio : tabKey === "fx" ? FileVideo : FileImage;
                return (
                  <TabsContent key={tabKey} value={tabKey} className="mt-0 space-y-2">
                    {tabFiles.length === 0 ? (
                      <div className="text-center py-8">
                        <FileIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-[11px] text-muted-foreground/50 font-mono">
                          No files imported yet.
                        </p>
                        <p className="text-[9px] text-muted-foreground/40 font-mono mt-1">
                          Use the {tabKey === "sound" ? "Sound" : tabKey === "color" ? "Color" : tabKey === "score" ? "Score" : "FX"} panel to import files.
                        </p>
                      </div>
                    ) : (
                      tabFiles.map((f) => (
                        <div key={f.id} className="rounded-lg border border-border bg-secondary/60 p-3 cinema-inset group">
                          <div className="flex items-center gap-2">
                            <FileIcon className="h-4 w-4 text-primary/60 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-mono text-foreground/90 truncate">{f.name}</p>
                              <p className="text-[9px] font-mono text-muted-foreground/50">
                                {(f.size / 1024).toFixed(1)} KB · {f.category}
                              </p>
                            </div>
                            <button
                              onClick={() => removeImportedFile(f.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all p-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                );
              })}
            </div>
          </Tabs>
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
      <div data-help-id="postprod-timeline" className="flex-[5] bg-card border-t border-border flex flex-col min-h-0">
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

        {/* Zoom & Scrubber bar */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/50 bg-secondary/30">
          <ZoomOut className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          <input
            type="range"
            min={25}
            max={400}
            value={timelineZoom * 100}
            onChange={(e) => setTimelineZoom(Number(e.target.value) / 100)}
            className="w-20 h-1 accent-primary cursor-pointer"
            title={`Zoom: ${Math.round(timelineZoom * 100)}%`}
          />
          <ZoomIn className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          <span className="text-[9px] font-mono text-muted-foreground/50 w-8 shrink-0">{Math.round(timelineZoom * 100)}%</span>

          {/* Scrubber / position slider */}
          <div
            ref={scrubberRef}
            className="flex-1 relative h-5 cursor-pointer group/scrub ml-2"
            onMouseDown={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const update = (ev: MouseEvent) => {
                const pct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
                setPlayheadPos(pct);
              };
              update(e.nativeEvent);
              const onUp = () => {
                document.removeEventListener("mousemove", update);
                document.removeEventListener("mouseup", onUp);
              };
              document.addEventListener("mousemove", update);
              document.addEventListener("mouseup", onUp);
            }}
          >
            {/* Ruler ticks */}
            <div className="absolute inset-0 flex items-end">
              {Array.from({ length: 21 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className={cn("w-px bg-muted-foreground/20", i % 5 === 0 ? "h-2.5" : "h-1.5")} />
                  {i % 5 === 0 && (
                    <span className="text-[7px] font-mono text-muted-foreground/40 mt-px">
                      {Math.round((i / 20) * 18)}s
                    </span>
                  )}
                </div>
              ))}
            </div>
            {/* Playhead indicator */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
              style={{ left: `${playheadPos}%` }}
            >
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rotate-45" />
            </div>
          </div>
        </div>

          <div className="flex-1 overflow-auto relative">
            <div style={{ minWidth: `${100 * timelineZoom}%` }}>
            {tracks.map((track) => (
              <div key={track.id} className="flex border-b border-border/50 group">
                <div className="w-24 shrink-0 flex items-center gap-1 px-2 border-r border-border/50 bg-secondary/50 sticky left-0 z-10">
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
                <DroppableTrack track={track} isOver={overTrackId === track.id}>
                  {clips.filter((c) => c.track === track.id).map((clip) => (
                    <DraggableClip key={clip.id} clip={clip} onDoubleClick={() => setVfxClip(clip)} onTrim={handleTrimClip} />
                  ))}
                </DroppableTrack>
              </div>
            ))}
            </div>

            <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none" style={{ left: `calc(96px + ${playheadPos}% * (100% - 96px) / 100)` }}>
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-primary rotate-45" />
            </div>
          </div>
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
      <div data-help-id="postprod-vfx"><VfxFixItBay clip={vfxClip} onClose={() => setVfxClip(null)} /></div>
      </div>
      {/* Right Sidebar */}
      <PostProductionSidebar
        onFileImport={handleFileImport}
        onInsertMusicClip={(label) => {
          const musicTrack = tracks.find((t) => t.id === "audio4");
          if (!musicTrack) return;
          const existingOnTrack = clips.filter((c) => c.track === "audio4");
          const maxRight = existingOnTrack.reduce((m, c) => Math.max(m, c.left_pos + c.width), 0);
          const newClip = {
            id: `local-${Date.now()}`,
            film_id: "",
            label,
            track: "audio4",
            left_pos: maxRight + 8,
            width: 200,
            color: null,
            created_at: new Date().toISOString(),
          };
          setState((prev) => ({ ...prev, clips: [...prev.clips, newClip] }));
        }}
      />
    </div>
    <DragOverlay dropAnimation={null}>
      {activeDrag ? (
        <div
          className="rounded-lg border px-3 py-1 flex items-center text-[10px] font-mono text-foreground/90 shadow-lg pointer-events-none"
          style={{
            background: activeDrag.track ? getClipColor(activeDrag.track) : "hsl(215 15% 30% / 0.9)",
            borderColor: activeDrag.track ? getClipBorder(activeDrag.track) : "hsl(215 20% 50% / 0.5)",
            width: 180,
            height: 36,
          }}
        >
          <span className="truncate">{activeDrag.label}</span>
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
    </div>
  );
};

export default PostProduction;
