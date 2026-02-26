import { useState, useCallback, useMemo } from "react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensors, useSensor,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Users, ChevronRight, ChevronDown, Lock, GripVertical, Pencil, Check, X, Sparkles, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ResizableSidebar from "./ResizableSidebar";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CharacterRanking, CharacterTier } from "@/hooks/useCharacterRanking";

interface Character {
  id: string;
  name: string;
  image_url: string | null;
  voice_description: string | null;
  voice_generation_seed: number | null;
  approved?: boolean;
}

interface CharacterSidebarProps {
  characters: Character[] | undefined;
  isLoading: boolean;
  selectedCharId: string | null;
  onSelect: (id: string) => void;
  onSuggest?: (id: string) => void;
  showVoiceSeed?: boolean;
  rankings?: CharacterRanking[];
}

const TIER_META: Record<CharacterTier, { label: string; color: string }> = {
  LEAD: { label: "Lead", color: "bg-primary/15 text-primary border-primary/30" },
  STRONG_SUPPORT: { label: "Strong Support", color: "bg-primary/10 text-primary/80 border-primary/20" },
  FEATURE: { label: "Feature", color: "bg-primary/10 text-primary/70 border-primary/20" },
  UNDER_5: { label: "Under 5", color: "bg-primary/10 text-primary/60 border-primary/15" },
  BACKGROUND: { label: "Background", color: "bg-primary/5 text-primary/50 border-primary/10" },
};

const TIER_ORDER: CharacterTier[] = ["LEAD", "STRONG_SUPPORT", "FEATURE", "UNDER_5", "BACKGROUND"];

const CharacterSidebar = ({ characters, isLoading, selectedCharId, onSelect, onSuggest, showVoiceSeed, rankings }: CharacterSidebarProps) => {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [openTiers, setOpenTiers] = useState<Record<string, boolean>>({ LEAD: true, STRONG_SUPPORT: true, FEATURE: false, UNDER_5: false, BACKGROUND: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [mergeDialog, setMergeDialog] = useState<{
    sourceId: string; targetId: string; sourceName: string; targetName: string;
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
    setMergeDialog({ sourceId: source.id, targetId: target.id, sourceName: source.name, targetName: target.name });
  }, [characters]);

  const handleMerge = useCallback(async () => {
    if (!mergeDialog) return;
    const { sourceId, targetId } = mergeDialog;
    const { error } = await supabase.from("characters").delete().eq("id", sourceId);
    if (error) { toast.error("Failed to merge characters"); }
    else { toast.success("Characters merged"); queryClient.invalidateQueries({ queryKey: ["characters"] }); if (selectedCharId === sourceId) onSelect(targetId); }
    setMergeDialog(null);
  }, [mergeDialog, queryClient, selectedCharId, onSelect]);

  const handleRename = useCallback(async (charId: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from("characters").update({ name: editName.trim() }).eq("id", charId);
    if (error) { toast.error("Failed to rename"); }
    else { queryClient.invalidateQueries({ queryKey: ["characters"] }); toast.success("Character renamed"); }
    setEditingId(null); setEditName("");
  }, [editName, queryClient]);

  const handleToggleApproval = useCallback(async (charId: string, currentApproved: boolean) => {
    const { error } = await supabase.from("characters").update({ approved: !currentApproved } as any).eq("id", charId);
    if (error) { toast.error("Failed to update approval"); return; }
    queryClient.invalidateQueries({ queryKey: ["characters"] });
  }, [queryClient]);

  const handleApproveAll = useCallback(async (charIds: string[]) => {
    const allApproved = charIds.every(id => (characters?.find(c => c.id === id) as any)?.approved);
    const newVal = !allApproved;
    const { error } = await supabase.from("characters").update({ approved: newVal } as any).in("id", charIds);
    if (error) { toast.error("Failed to update approvals"); return; }
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast.success(newVal ? "All approved" : "All unapproved");
  }, [characters, queryClient]);

  const activeChar = characters?.find((c) => c.id === activeId);

  const rankingMap = useMemo(() => {
    if (!rankings?.length) return new Map<string, CharacterRanking>();
    const map = new Map<string, CharacterRanking>();
    for (const r of rankings) map.set(r.nameNormalized, r);
    return map;
  }, [rankings]);

  const tierGroups = useMemo(() => {
    if (!characters) return [];
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = query ? characters.filter((c) => c.name.toLowerCase().includes(query)) : characters;
    
    if (!rankings?.length) return [{ tier: "LEAD" as CharacterTier, chars: filtered }];

    const groups = new Map<CharacterTier, Character[]>();
    for (const tier of TIER_ORDER) groups.set(tier, []);

    const sorted = [...filtered].sort((a, b) => {
      const ra = rankingMap.get(a.name.toUpperCase());
      const rb = rankingMap.get(b.name.toUpperCase());
      if (ra && rb) return rb.score - ra.score;
      if (ra) return -1;
      if (rb) return 1;
      return 0;
    });

    for (const char of sorted) {
      const ranking = rankingMap.get(char.name.toUpperCase());
      const tier = ranking?.tier ?? "BACKGROUND";
      groups.get(tier)!.push(char);
    }

    return TIER_ORDER.map((tier) => ({ tier, chars: groups.get(tier)! })).filter((g) => g.chars.length > 0);
  }, [characters, rankings, rankingMap, searchQuery]);

  const toggleTier = (tier: string) => {
    setOpenTiers((prev) => ({ ...prev, [tier]: !prev[tier] }));
  };

  return (
    <ResizableSidebar defaultWidth={380} minWidth={220} maxWidthPercent={30}>
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div>
          <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Characters</h2>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {characters?.length ?? 0} in cast{rankings?.length ? " · ranked by importance" : " · drag to merge duplicates"}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search characters…"
            className="h-8 text-sm pl-8 bg-background"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />)}</div>
        ) : !characters?.length ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="font-display font-semibold">No characters yet</p>
            <p className="text-xs mt-1">Analyze a script in Development to populate the cast.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="py-1">
              {tierGroups.map(({ tier, chars }) => {
                const meta = TIER_META[tier];
                const isOpen = openTiers[tier] ?? false;
                const allApproved = chars.every((c) => (c as any).approved);
                const someApproved = chars.some((c) => (c as any).approved);
                return (
                  <Collapsible key={tier} open={isOpen} onOpenChange={() => toggleTier(tier)}>
                    <div className="flex items-center w-full px-4 py-2.5 hover:bg-secondary/40 transition-colors">
                      <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className={cn("text-xs font-display font-bold uppercase tracking-widest px-2.5 py-1 rounded border", meta.color)}>
                          {meta.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">{chars.length}</span>
                        <div className="flex-1 border-t border-border/30 ml-1" />
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={allApproved ? true : someApproved ? "indeterminate" : false}
                          onCheckedChange={() => handleApproveAll(chars.map((c) => c.id))}
                          className="h-3.5 w-3.5"
                          title="Approve all in tier"
                        />
                        <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">All</span>
                      </div>
                    </div>
                    <CollapsibleContent>
                      {chars.map((char) => {
                        const ranking = rankingMap.get(char.name.toUpperCase());
                        return (
                          <DraggableCharItem
                            key={char.id}
                            char={char}
                            isActive={selectedCharId === char.id}
                            isLocked={showVoiceSeed ? !!char.voice_generation_seed : !!char.image_url}
                            isDragging={activeId === char.id}
                            onSelect={() => onSelect(char.id)}
                            onSuggest={onSuggest ? () => onSuggest(char.id) : undefined}
                            isEditing={editingId === char.id}
                            editName={editName}
                            onStartEdit={() => { setEditingId(char.id); setEditName(char.name); }}
                            onEditChange={setEditName}
                            onSaveEdit={() => handleRename(char.id)}
                            onCancelEdit={() => { setEditingId(null); setEditName(""); }}
                            ranking={ranking}
                            approved={(char as any).approved ?? false}
                            onToggleApproval={() => handleToggleApproval(char.id, (char as any).approved ?? false)}
                          />
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
            <DragOverlay>
              {activeChar ? (
                <div className="flex items-center gap-2 rounded-lg border border-primary bg-card p-2 shadow-xl rotate-2 scale-105">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold font-display uppercase overflow-hidden shrink-0">
                    {activeChar.image_url ? <img src={activeChar.image_url} alt="" className="h-full w-full object-cover" /> : activeChar.name.charAt(0)}
                  </div>
                  <p className="text-sm font-display font-semibold text-foreground">{activeChar.name}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </ScrollArea>

      <AlertDialog open={!!mergeDialog} onOpenChange={(open) => !open && setMergeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge Characters?</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge <span className="font-semibold text-foreground">"{mergeDialog?.sourceName}"</span> into{" "}
              <span className="font-semibold text-foreground">"{mergeDialog?.targetName}"</span>. The duplicate will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge}>Merge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResizableSidebar>
  );
};

/* ── Draggable character item ── */
const DraggableCharItem = ({
  char, isActive, isLocked, isDragging, onSelect, onSuggest,
  isEditing, editName, onStartEdit, onEditChange, onSaveEdit, onCancelEdit, ranking,
  approved, onToggleApproval,
}: {
  char: Character; isActive: boolean; isLocked: boolean; isDragging: boolean;
  onSelect: () => void;
  onSuggest?: () => void;
  isEditing: boolean; editName: string;
  onStartEdit: () => void; onEditChange: (v: string) => void;
  onSaveEdit: () => void; onCancelEdit: () => void;
  ranking?: CharacterRanking;
  approved: boolean;
  onToggleApproval: () => void;
}) => {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id: char.id });
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: char.id });

  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node); }}
      className={cn(
        "w-full text-left px-4 py-2.5 flex items-center gap-2 transition-all border-l-2",
        isActive ? "border-l-primary bg-primary/5" : "border-l-transparent hover:bg-secondary/60",
        isDragging && "opacity-30",
        isOver && !isDragging && "bg-primary/10 border-l-primary ring-1 ring-primary/30"
      )}
    >
      {/* Approval checkbox */}
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <Checkbox
          checked={approved}
          onCheckedChange={onToggleApproval}
          className="h-3.5 w-3.5"
          title={approved ? "Unapprove" : "Approve casting"}
        />
      </div>

      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <button onClick={onSelect} className="shrink-0">
        <div className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold font-display uppercase overflow-hidden",
          isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
        )}>
          {char.image_url ? <img src={char.image_url} alt={char.name} className="h-full w-full object-cover" /> : char.name.charAt(0)}
        </div>
      </button>

      <button onClick={onSelect} className="flex-1 min-w-0 text-left">
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Input autoFocus value={editName} onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
              className="h-7 text-sm bg-background" />
            <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-7 px-1.5 shrink-0"><Check className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-7 px-1.5 shrink-0"><X className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {ranking && (
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                #{ranking.rank}
              </span>
            )}
            <p className={cn("text-xs font-display font-semibold", isActive ? "text-primary" : "text-foreground")}>
              {char.name}
            </p>
            {isLocked && (
              <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                <Lock className="h-2.5 w-2.5" /> Locked
              </span>
            )}
            {approved && (
              <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-accent text-accent-foreground px-1.5 py-0.5 rounded">
                <Check className="h-2.5 w-2.5" /> Approved
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


      {!isEditing && (
        <button onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
          className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors p-1" title="Rename character">
          <Pencil className="h-3 w-3" />
        </button>
      )}

      {isActive && !isEditing && <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />}
    </div>
  );
};

export default CharacterSidebar;
