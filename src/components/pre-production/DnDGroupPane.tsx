import { useState, useCallback, useEffect, useMemo } from "react";
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
import { ChevronDown, ChevronRight, GripVertical, Plus, X, Pencil, Check, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ── Types ── */
interface ItemGroup {
  id: string;
  name: string;
  children: string[];
}

interface DnDGroupPaneProps {
  items: string[];
  filmId: string | undefined;
  storagePrefix: string;
  icon: LucideIcon;
  title: string;
  emptyMessage: string;
  /** Optional subtitle per item (e.g. wardrobe character name) */
  subtitles?: Record<string, string>;
}

/* ── Persistence helpers ── */
const storageKey = (prefix: string, filmId: string) => `${prefix}-groups-${filmId}`;

const loadGroups = (prefix: string, filmId: string): ItemGroup[] => {
  try {
    const raw = localStorage.getItem(storageKey(prefix, filmId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveGroups = (prefix: string, filmId: string, groups: ItemGroup[]) => {
  localStorage.setItem(storageKey(prefix, filmId), JSON.stringify(groups));
};

/* ── Main component ── */
const DnDGroupPane = ({ items, filmId, storagePrefix, icon: Icon, title, emptyMessage, subtitles }: DnDGroupPaneProps) => {
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (filmId) setGroups(loadGroups(storagePrefix, filmId));
  }, [filmId, storagePrefix]);

  const persistGroups = useCallback(
    (next: ItemGroup[]) => {
      setGroups(next);
      if (filmId) saveGroups(storagePrefix, filmId, next);
    },
    [filmId, storagePrefix]
  );

  const ungrouped = useMemo(() => {
    const grouped = new Set(groups.flatMap((g) => g.children));
    return items.filter((l) => !grouped.has(l));
  }, [items, groups]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const draggedItem = active.id as string;
    const targetId = over.id as string;

    if (targetId.startsWith("group::")) {
      const groupId = targetId.replace("group::", "");
      const next = groups.map((g) => {
        const cleaned = { ...g, children: g.children.filter((c) => c !== draggedItem) };
        if (cleaned.id === groupId && !cleaned.children.includes(draggedItem)) {
          return { ...cleaned, children: [...cleaned.children, draggedItem] };
        }
        return cleaned;
      });
      persistGroups(next);
      toast.success("Moved to group");
      return;
    }

    if (ungrouped.includes(targetId) && ungrouped.includes(draggedItem)) {
      const newGroup: ItemGroup = {
        id: crypto.randomUUID(),
        name: "New Group",
        children: [targetId, draggedItem],
      };
      persistGroups([...groups, newGroup]);
      toast.success("Created new group — rename it!");
      return;
    }
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    persistGroups([...groups, { id: crypto.randomUUID(), name: newGroupName.trim(), children: [] }]);
    setNewGroupName("");
    setCreatingGroup(false);
  };

  const handleDeleteGroup = (groupId: string) => {
    persistGroups(groups.filter((g) => g.id !== groupId));
    toast.success("Group removed");
  };

  const handleRemoveFromGroup = (groupId: string, item: string) => {
    persistGroups(groups.map((g) => g.id === groupId ? { ...g, children: g.children.filter((c) => c !== item) } : g));
  };

  const handleRenameGroup = (groupId: string) => {
    if (!editName.trim()) return;
    persistGroups(groups.map((g) => (g.id === groupId ? { ...g, name: editName.trim() } : g)));
    setEditingGroupId(null);
    setEditName("");
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-center">
        <div className="space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
            <Icon className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">{items.length}</span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCreatingGroup(true)}>
            <Plus className="h-3.5 w-3.5" /> New Group
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Drag items onto each other to merge them, or drag into a group.</p>
      </div>

      <ScrollArea className="flex-1">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="p-4 space-y-4">
            {creatingGroup && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Input autoFocus value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()} placeholder="Group name…" className="h-8 text-sm bg-background" />
                <Button size="sm" onClick={handleCreateGroup} className="h-8 shrink-0">Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreatingGroup(false)} className="h-8 shrink-0 px-2"><X className="h-4 w-4" /></Button>
              </div>
            )}

            {groups.map((group) => (
              <GroupDropZone
                key={group.id}
                group={group}
                icon={Icon}
                isCollapsed={collapsed.has(group.id)}
                onToggle={() => toggleCollapse(group.id)}
                onDelete={() => handleDeleteGroup(group.id)}
                onRemoveChild={(item) => handleRemoveFromGroup(group.id, item)}
                isEditing={editingGroupId === group.id}
                editName={editName}
                onStartEdit={() => { setEditingGroupId(group.id); setEditName(group.name); }}
                onEditChange={setEditName}
                onSaveEdit={() => handleRenameGroup(group.id)}
                subtitles={subtitles}
              />
            ))}

            {ungrouped.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {groups.length > 0 ? "Ungrouped" : `All ${title}`}
                  </h3>
                  <div className="flex-1 border-t border-border ml-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ungrouped.map((item) => (
                    <DraggableItem key={item} id={item} icon={Icon} isOverlay={false} subtitle={subtitles?.[item]} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <DragOverlay>
            {activeId ? <DraggableItem id={activeId} icon={Icon} isOverlay subtitle={subtitles?.[activeId]} /> : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
    </div>
  );
};

/* ── Draggable item card ── */
const DraggableItem = ({ id, icon: Icon, isOverlay, subtitle }: { id: string; icon: LucideIcon; isOverlay: boolean; subtitle?: string }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id });

  return (
    <div
      ref={(node) => { setNodeRef(node); if (!isOverlay) setDropRef(node); }}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-lg border bg-card p-3 flex items-center gap-2 cursor-grab active:cursor-grabbing transition-all select-none",
        isOverlay && "shadow-xl ring-2 ring-primary/40 rotate-2 scale-105",
        isDragging && "opacity-30",
        isOver && !isDragging && "border-primary ring-2 ring-primary/20 bg-primary/5"
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-display font-semibold text-foreground truncate">{id}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </div>
  );
};

/* ── Group drop zone ── */
const GroupDropZone = ({
  group, icon: Icon, isCollapsed, onToggle, onDelete, onRemoveChild,
  isEditing, editName, onStartEdit, onEditChange, onSaveEdit, subtitles,
}: {
  group: ItemGroup; icon: LucideIcon; isCollapsed: boolean; onToggle: () => void;
  onDelete: () => void; onRemoveChild: (item: string) => void;
  isEditing: boolean; editName: string; onStartEdit: () => void;
  onEditChange: (v: string) => void; onSaveEdit: () => void;
  subtitles?: Record<string, string>;
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: `group::${group.id}` });

  return (
    <div ref={setNodeRef} className={cn("rounded-xl border bg-card/50 transition-all", isOver ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border")}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-colors">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input autoFocus value={editName} onChange={(e) => onEditChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSaveEdit()} className="h-7 text-sm bg-background" />
            <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-7 px-2"><Check className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <>
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-display text-sm font-bold text-foreground flex-1 truncate">{group.name}</h3>
            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{group.children.length}</span>
            <button onClick={onStartEdit} className="text-muted-foreground hover:text-foreground transition-colors p-1" title="Rename"><Pencil className="h-3 w-3" /></button>
            <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors p-1" title="Delete"><X className="h-3 w-3" /></button>
          </>
        )}
      </div>
      {!isCollapsed && (
        <div className="px-4 pb-3 space-y-1.5">
          {group.children.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-center">
              <p className="text-xs text-muted-foreground">Drop items here</p>
            </div>
          ) : (
            group.children.map((item) => (
              <div key={item} className="rounded-lg border border-border bg-card pl-8 pr-3 py-2 flex items-center gap-2 group/child">
                <Icon className="h-3 w-3 text-primary/60 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{item}</p>
                  {subtitles?.[item] && <p className="text-[10px] text-muted-foreground truncate">{subtitles[item]}</p>}
                </div>
                <button onClick={() => onRemoveChild(item)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/child:opacity-100 p-0.5" title="Remove"><X className="h-3 w-3" /></button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default DnDGroupPane;
