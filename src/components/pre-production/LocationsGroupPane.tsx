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
import { MapPin, ChevronDown, ChevronRight, GripVertical, Plus, X, Pencil, Check, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import AssetAuditionPane from "./AssetAuditionPane";

/* ── Types ── */
interface LocationGroup {
  id: string;
  name: string;
  children: string[];
}

interface LocationsGroupPaneProps {
  locations: string[];
  filmId: string | undefined;
}

/* ── Persistence helpers (localStorage by filmId) ── */
const storageKey = (filmId: string) => `location-groups-${filmId}`;

const loadGroups = (filmId: string): LocationGroup[] => {
  try {
    const raw = localStorage.getItem(storageKey(filmId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveGroups = (filmId: string, groups: LocationGroup[]) => {
  localStorage.setItem(storageKey(filmId), JSON.stringify(groups));
};

/* ── Main component ── */
const LocationsGroupPane = ({ locations, filmId }: LocationsGroupPaneProps) => {
  const [groups, setGroups] = useState<LocationGroup[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [auditionLocation, setAuditionLocation] = useState<string | null>(null);

  // Load groups from localStorage
  useEffect(() => {
    if (filmId) setGroups(loadGroups(filmId));
  }, [filmId]);

  // Persist whenever groups change
  const persistGroups = useCallback(
    (next: LocationGroup[]) => {
      setGroups(next);
      if (filmId) saveGroups(filmId, next);
    },
    [filmId]
  );

  // Locations that aren't in any group
  const ungrouped = useMemo(() => {
    const grouped = new Set(groups.flatMap((g) => g.children));
    return locations.filter((l) => !grouped.has(l));
  }, [locations, groups]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const draggedLoc = active.id as string;
    const targetId = over.id as string;

    // Dropping onto a group drop zone
    if (targetId.startsWith("group::")) {
      const groupId = targetId.replace("group::", "");
      const next = groups.map((g) => {
        // Remove from any other group first
        const cleaned = { ...g, children: g.children.filter((c) => c !== draggedLoc) };
        if (cleaned.id === groupId && !cleaned.children.includes(draggedLoc)) {
          return { ...cleaned, children: [...cleaned.children, draggedLoc] };
        }
        return cleaned;
      });
      persistGroups(next);
      toast.success(`Moved to group`);
      return;
    }

    // Dropping onto another ungrouped location → create a new group
    if (ungrouped.includes(targetId) && ungrouped.includes(draggedLoc)) {
      const newGroup: LocationGroup = {
        id: crypto.randomUUID(),
        name: "New Location Group",
        children: [targetId, draggedLoc],
      };
      persistGroups([...groups, newGroup]);
      toast.success("Created new location group — rename it!");
      return;
    }
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: LocationGroup = {
      id: crypto.randomUUID(),
      name: newGroupName.trim(),
      children: [],
    };
    persistGroups([...groups, newGroup]);
    setNewGroupName("");
    setCreatingGroup(false);
    toast.success(`Group "${newGroup.name}" created`);
  };

  const handleDeleteGroup = (groupId: string) => {
    persistGroups(groups.filter((g) => g.id !== groupId));
    toast.success("Group removed — locations returned to ungrouped");
  };

  const handleRemoveFromGroup = (groupId: string, loc: string) => {
    persistGroups(
      groups.map((g) =>
        g.id === groupId ? { ...g, children: g.children.filter((c) => c !== loc) } : g
      )
    );
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

  if (locations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-center">
        <div className="space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
            <MapPin className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            No locations extracted from script breakdown yet. Lock your script in the Development phase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Locations</h2>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
              {locations.length}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setCreatingGroup(true)}
          >
            <Plus className="h-3.5 w-3.5" /> New Group
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Merge duplicate locations that share the same physical space but have different names in the script. Group together distinct areas within the same building or compound to maintain visual consistency across related spaces.
        </p>
      </div>

      <ScrollArea className="flex-1">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="p-4 space-y-4">
            {/* New group creation input */}
            {creatingGroup && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Input
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                  placeholder="Group name (e.g. Wells Home)"
                  className="h-8 text-sm bg-background"
                />
                <Button size="sm" onClick={handleCreateGroup} className="h-8 shrink-0">
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCreatingGroup(false)}
                  className="h-8 shrink-0 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Grouped locations */}
            {groups.map((group) => (
              <GroupDropZone
                key={group.id}
                group={group}
                isCollapsed={collapsed.has(group.id)}
                onToggle={() => toggleCollapse(group.id)}
                onDelete={() => handleDeleteGroup(group.id)}
                onRemoveChild={(loc) => handleRemoveFromGroup(group.id, loc)}
                isEditing={editingGroupId === group.id}
                editName={editName}
                onStartEdit={() => {
                  setEditingGroupId(group.id);
                  setEditName(group.name);
                }}
                onEditChange={setEditName}
                onSaveEdit={() => handleRenameGroup(group.id)}
              />
            ))}

            {/* Ungrouped locations */}
            {ungrouped.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {groups.length > 0 ? "Ungrouped" : "All Locations"}
                  </h3>
                  <div className="flex-1 border-t border-border ml-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ungrouped.map((loc) => (
                    <DraggableLocation
                      key={loc}
                      id={loc}
                      isOverlay={false}
                      isAuditionActive={auditionLocation === loc}
                      onAudition={() => setAuditionLocation(auditionLocation === loc ? null : loc)}
                    />
                  ))}
                </div>
                {/* Audition pane for selected ungrouped location */}
                {auditionLocation && ungrouped.includes(auditionLocation) && filmId && (
                  <div className="mt-4 rounded-xl border border-border bg-card/50 p-4">
                    <AssetAuditionPane
                      filmId={filmId}
                      assetType="location"
                      assetName={auditionLocation}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <DragOverlay>
            {activeId ? <DraggableLocation id={activeId} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
    </div>
  );
};

/* ── Draggable location card ── */
const DraggableLocation = ({ id, isOverlay, isAuditionActive, onAudition }: { id: string; isOverlay: boolean; isAuditionActive?: boolean; onAudition?: () => void }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (!isOverlay) setDropRef(node);
      }}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-lg border bg-card p-3 flex items-center gap-2 cursor-grab active:cursor-grabbing transition-all select-none",
        isOverlay && "shadow-xl ring-2 ring-primary/40 rotate-2 scale-105",
        isDragging && "opacity-30",
        isOver && !isDragging && "border-primary ring-2 ring-primary/20 bg-primary/5",
        isAuditionActive && "border-primary ring-1 ring-primary/30 bg-primary/5"
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
      <p className="text-sm font-display font-semibold text-foreground truncate flex-1">{id}</p>
      {onAudition && (
        <button
          onClick={(e) => { e.stopPropagation(); onAudition(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="shrink-0 text-muted-foreground hover:text-primary transition-colors p-1"
          title="Generate visual options"
        >
          <Image className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

/* ── Group drop zone ── */
const GroupDropZone = ({
  group,
  isCollapsed,
  onToggle,
  onDelete,
  onRemoveChild,
  isEditing,
  editName,
  onStartEdit,
  onEditChange,
  onSaveEdit,
}: {
  group: LocationGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRemoveChild: (loc: string) => void;
  isEditing: boolean;
  editName: string;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onSaveEdit: () => void;
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: `group::${group.id}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border bg-card/50 transition-all",
        isOver ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border"
      )}
    >
      {/* Group header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-colors">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              autoFocus
              value={editName}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSaveEdit()}
              className="h-7 text-sm bg-background"
            />
            <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-7 px-2">
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-display text-sm font-bold text-foreground flex-1 truncate">
              {group.name}
            </h3>
            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              {group.children.length}
            </span>
            <button
              onClick={onStartEdit}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Rename group"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
              title="Delete group"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        )}
      </div>

      {/* Children */}
      {!isCollapsed && (
        <div className="px-4 pb-3 space-y-1.5">
          {group.children.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-center">
              <p className="text-xs text-muted-foreground">Drop locations here</p>
            </div>
          ) : (
            group.children.map((loc) => (
              <div
                key={loc}
                className="rounded-lg border border-border bg-card pl-8 pr-3 py-2 flex items-center gap-2 group/child"
              >
                <MapPin className="h-3 w-3 text-primary/60 shrink-0" />
                <p className="text-sm text-foreground truncate flex-1">{loc}</p>
                <button
                  onClick={() => onRemoveChild(loc)}
                  className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/child:opacity-100 p-0.5"
                  title="Remove from group"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LocationsGroupPane;
