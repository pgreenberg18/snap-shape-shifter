import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensors,
  useSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Users, ChevronRight, Lock, GripVertical, Pencil, Check, X, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CharacterRanking, CharacterTier } from "@/hooks/useCharacterRanking";

interface Character {
  id: string;
  name: string;
  image_url: string | null;
  voice_description: string | null;
  voice_generation_seed: number | null;
}

interface CharacterSidebarProps {
  characters: Character[] | undefined;
  isLoading: boolean;
  selectedCharId: string | null;
  onSelect: (id: string) => void;
  showVoiceSeed?: boolean;
  rankings?: CharacterRanking[];
}

const TIER_COLORS: Record<CharacterTier, string> = {
  LEAD: "bg-primary/20 text-primary border-primary/30",
  STRONG_SUPPORT: "bg-accent text-foreground border-border",
  FEATURE: "bg-secondary text-muted-foreground border-border",
  UNDER_5: "bg-muted text-muted-foreground border-border/50",
  BACKGROUND: "bg-muted/50 text-muted-foreground/60 border-border/30",
};

const TIER_LABELS: Record<CharacterTier, string> = {
  LEAD: "Lead",
  STRONG_SUPPORT: "Strong Support",
  FEATURE: "Feature",
  UNDER_5: "Under 5",
  BACKGROUND: "Background",
};

const CharacterSidebar = ({ characters, isLoading, selectedCharId, onSelect, showVoiceSeed, rankings }: CharacterSidebarProps) => {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mergeDialog, setMergeDialog] = useState<{
    sourceId: string;
    targetId: string;
    sourceName: string;
    targetName: string;
  } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id || !characters) return;

    const source = characters.find((c) => c.id === active.id);
    const target = characters.find((c) => c.id === over.id);
    if (!source || !target) return;

    setMergeDialog({
      sourceId: source.id,
      targetId: target.id,
      sourceName: source.name,
      targetName: target.name,
    });
  }, [characters]);

  const handleMerge = useCallback(async () => {
    if (!mergeDialog) return;
    const { sourceId, targetId } = mergeDialog;

    // Delete the source character (merge into target)
    const { error } = await supabase.from("characters").delete().eq("id", sourceId);
    if (error) {
      toast.error("Failed to merge characters");
    } else {
      toast.success("Characters merged");
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      // If the deleted char was selected, select the target
      if (selectedCharId === sourceId) onSelect(targetId);
    }
    setMergeDialog(null);
  }, [mergeDialog, queryClient, selectedCharId, onSelect]);

  const handleRename = useCallback(async (charId: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from("characters").update({ name: editName.trim() }).eq("id", charId);
    if (error) {
      toast.error("Failed to rename");
    } else {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      toast.success("Character renamed");
    }
    setEditingId(null);
    setEditName("");
  }, [editName, queryClient]);

  const activeChar = characters?.find((c) => c.id === activeId);

  // Build a lookup from normalized name → ranking
  const rankingMap = useMemo(() => {
    if (!rankings?.length) return new Map<string, CharacterRanking>();
    const map = new Map<string, CharacterRanking>();
    for (const r of rankings) map.set(r.nameNormalized, r);
    return map;
  }, [rankings]);

  // Sort characters by ranking score (highest first), unranked at end
  const sortedCharacters = useMemo(() => {
    if (!characters) return [];
    if (!rankings?.length) return characters;
    return [...characters].sort((a, b) => {
      const ra = rankingMap.get(a.name.toUpperCase());
      const rb = rankingMap.get(b.name.toUpperCase());
      if (ra && rb) return rb.score - ra.score;
      if (ra) return -1;
      if (rb) return 1;
      return 0;
    });
  }, [characters, rankings, rankingMap]);

  return (
    <aside className="w-[340px] min-w-[300px] border-r border-border bg-card flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Characters
        </h2>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {characters?.length ?? 0} in cast{rankings?.length ? " · ranked by importance" : " · drag to merge duplicates"}
        </p>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
            ))}
          </div>
        ) : !characters?.length ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="font-display font-semibold">No characters yet</p>
            <p className="text-xs mt-1">Analyze a script in Development to populate the cast.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="py-1">
              {sortedCharacters.map((char) => {
                const ranking = rankingMap.get(char.name.toUpperCase());
                return (
                  <DraggableCharItem
                    key={char.id}
                    char={char}
                    isActive={selectedCharId === char.id}
                    isLocked={showVoiceSeed ? !!char.voice_generation_seed : !!char.image_url}
                    isDragging={activeId === char.id}
                    onSelect={() => onSelect(char.id)}
                    isEditing={editingId === char.id}
                    editName={editName}
                    onStartEdit={() => { setEditingId(char.id); setEditName(char.name); }}
                    onEditChange={setEditName}
                    onSaveEdit={() => handleRename(char.id)}
                    onCancelEdit={() => { setEditingId(null); setEditName(""); }}
                    ranking={ranking}
                  />
                );
              })}
            </div>
            <DragOverlay>
              {activeChar ? (
                <div className="flex items-center gap-2 rounded-lg border border-primary bg-card p-2 shadow-xl rotate-2 scale-105">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold font-display uppercase overflow-hidden shrink-0">
                    {activeChar.image_url ? (
                      <img src={activeChar.image_url} alt="" className="h-full w-full object-cover" />
                    ) : activeChar.name.charAt(0)}
                  </div>
                  <p className="text-sm font-display font-semibold text-foreground">{activeChar.name}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </ScrollArea>

      {/* Merge confirmation dialog */}
      <AlertDialog open={!!mergeDialog} onOpenChange={(open) => !open && setMergeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge Characters?</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge <span className="font-semibold text-foreground">"{mergeDialog?.sourceName}"</span> into{" "}
              <span className="font-semibold text-foreground">"{mergeDialog?.targetName}"</span>.
              The duplicate will be deleted. You can rename the remaining character afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge}>Merge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
};

/* ── Draggable character item ── */
const DraggableCharItem = ({
  char, isActive, isLocked, isDragging, onSelect,
  isEditing, editName, onStartEdit, onEditChange, onSaveEdit, onCancelEdit, ranking,
}: {
  char: Character; isActive: boolean; isLocked: boolean; isDragging: boolean;
  onSelect: () => void;
  isEditing: boolean; editName: string;
  onStartEdit: () => void; onEditChange: (v: string) => void;
  onSaveEdit: () => void; onCancelEdit: () => void;
  ranking?: CharacterRanking;
}) => {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id: char.id });
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: char.id });

  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node); }}
      className={cn(
        "w-full text-left px-4 py-3 flex items-center gap-2 transition-all border-l-2",
        isActive
          ? "border-l-primary bg-primary/5"
          : "border-l-transparent hover:bg-secondary/60",
        isDragging && "opacity-30",
        isOver && !isDragging && "bg-primary/10 border-l-primary ring-1 ring-primary/30"
      )}
    >
      {/* Drag handle */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Avatar */}
      <button onClick={onSelect} className="shrink-0">
        <div
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold font-display uppercase overflow-hidden",
            isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          )}
        >
          {char.image_url ? (
            <img src={char.image_url} alt={char.name} className="h-full w-full object-cover" />
          ) : char.name.charAt(0)}
        </div>
      </button>

      {/* Name / Edit */}
      <button onClick={onSelect} className="flex-1 min-w-0 text-left">
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Input
              autoFocus
              value={editName}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
              className="h-7 text-sm bg-background"
            />
            <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-7 px-1.5 shrink-0">
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-7 px-1.5 shrink-0">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {ranking && (
              <span className={cn(
                "shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                TIER_COLORS[ranking.tier]
              )}>
                #{ranking.rank} {TIER_LABELS[ranking.tier]}
              </span>
            )}
            <p className={cn("text-sm font-display font-semibold", isActive ? "text-primary" : "text-foreground")}>
              {char.name}
            </p>
            {isLocked && (
              <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                <Lock className="h-2.5 w-2.5" /> Locked
              </span>
            )}
          </div>
        )}
        {!isEditing && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {ranking
              ? `${ranking.appearanceScenes} scenes · ${ranking.wordsSpoken} words · pp ${ranking.firstPage}–${ranking.lastPage}`
              : char.voice_description || ""}
          </p>
        )}
      </button>

      {/* Rename button */}
      {!isEditing && (
        <button
          onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
          className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors p-1"
          title="Rename character"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}

      {isActive && !isEditing && (
        <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
      )}
    </div>
  );
};

export default CharacterSidebar;
