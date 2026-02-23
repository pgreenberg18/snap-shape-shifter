import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { ChevronDown, ChevronRight, GripVertical, Plus, X, Pencil, Check, Merge, Upload, Loader2, Eye, ScrollText, Search, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  subtitles?: Record<string, string>;
  sceneBreakdown?: any[];
  storagePath?: string;
}

// ... keep existing code (persistence helpers, CONTEXT_MAP)
const storageKey = (prefix: string, filmId: string, suffix: string) => `${prefix}-${suffix}-${filmId}`;

const loadJson = <T,>(prefix: string, filmId: string, suffix: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(storageKey(prefix, filmId, suffix));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveJson = (prefix: string, filmId: string, suffix: string, data: any) => {
  localStorage.setItem(storageKey(prefix, filmId, suffix), JSON.stringify(data));
};

const CONTEXT_MAP: Record<string, string> = {
  locations: "location",
  props: "prop",
  wardrobe: "wardrobe",
  vehicles: "vehicle",
};

/* ── Find scenes containing an item by storagePrefix type ── */
function findScenesForItem(itemName: string, scenes: any[], storagePrefix: string): { sceneIndex: number; scene: any }[] {
  const nameLower = itemName.toLowerCase();
  const results: { sceneIndex: number; scene: any }[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    let found = false;

    if (storagePrefix === "locations") {
      const setting = (scene.setting || "").toLowerCase();
      const heading = (scene.scene_heading || "").toLowerCase();
      if (setting.includes(nameLower) || nameLower.includes(setting) || heading.includes(nameLower)) found = true;
    } else if (storagePrefix === "props") {
      if (Array.isArray(scene.key_objects)) {
        found = scene.key_objects.some((o: string) => typeof o === "string" && o.toLowerCase().includes(nameLower));
      }
    } else if (storagePrefix === "wardrobe") {
      if (Array.isArray(scene.wardrobe)) {
        found = scene.wardrobe.some((w: any) => {
          const style = (w?.clothing_style || "").toLowerCase();
          const condition = (w?.condition || "").toLowerCase();
          return style.includes(nameLower) || condition.includes(nameLower) || nameLower.includes(style);
        });
      }
    } else if (storagePrefix === "vehicles") {
      if (Array.isArray(scene.key_objects)) {
        found = scene.key_objects.some((o: string) => typeof o === "string" && o.toLowerCase().includes(nameLower));
      }
      if (!found && Array.isArray(scene.vehicles)) {
        found = scene.vehicles.some((v: string) => typeof v === "string" && v.toLowerCase().includes(nameLower));
      }
    }

    // Also check environment_details and description
    if (!found) {
      const env = (scene.environment_details || "").toLowerCase();
      const desc = (scene.description || "").toLowerCase();
      if (env.includes(nameLower) || desc.includes(nameLower)) found = true;
    }

    if (found) results.push({ sceneIndex: i, scene });
  }
  return results;
}

/* ── Main component ── */
const DnDGroupPane = ({ items, filmId, storagePrefix, icon: Icon, title, emptyMessage, subtitles, sceneBreakdown, storagePath }: DnDGroupPaneProps) => {
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [mergedAway, setMergedAway] = useState<Set<string>>(new Set());
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [refImages, setRefImages] = useState<Record<string, string>>({});
  const [refDescriptions, setRefDescriptions] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mergeDialog, setMergeDialog] = useState<{ source: string; target: string } | null>(null);
  const [analyzingItem, setAnalyzingItem] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");

  // Script viewer state
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptHighlightTerms, setScriptHighlightTerms] = useState<string[]>([]);
  const [scriptScenes, setScriptScenes] = useState<{ sceneNum: number; heading: string; paragraphs: { type: string; text: string }[] }[]>([]);
  const [scriptLoading, setScriptLoading] = useState(false);

  // Load persisted state
  useEffect(() => {
    if (!filmId) return;
    setGroups(loadJson(storagePrefix, filmId, "groups", []));
    setMergedAway(new Set(loadJson<string[]>(storagePrefix, filmId, "merged", [])));
    setRenames(loadJson(storagePrefix, filmId, "renames", {}));
    setRefImages(loadJson(storagePrefix, filmId, "refImages", {}));
    setRefDescriptions(loadJson(storagePrefix, filmId, "refDescs", {}));
  }, [filmId, storagePrefix]);

  const persistGroups = useCallback((next: ItemGroup[]) => {
    setGroups(next);
    if (filmId) saveJson(storagePrefix, filmId, "groups", next);
  }, [filmId, storagePrefix]);

  const persistMerged = useCallback((next: Set<string>) => {
    setMergedAway(next);
    if (filmId) saveJson(storagePrefix, filmId, "merged", [...next]);
  }, [filmId, storagePrefix]);

  const persistRenames = useCallback((next: Record<string, string>) => {
    setRenames(next);
    if (filmId) saveJson(storagePrefix, filmId, "renames", next);
  }, [filmId, storagePrefix]);

  const persistRefImages = useCallback((next: Record<string, string>) => {
    setRefImages(next);
    if (filmId) saveJson(storagePrefix, filmId, "refImages", next);
  }, [filmId, storagePrefix]);

  const persistRefDescs = useCallback((next: Record<string, string>) => {
    setRefDescriptions(next);
    if (filmId) saveJson(storagePrefix, filmId, "refDescs", next);
  }, [filmId, storagePrefix]);

  // Visible items = items minus merged-away ones
  const visibleItems = useMemo(() => items.filter((i) => !mergedAway.has(i)), [items, mergedAway]);

  const query = searchQuery.toLowerCase().trim();

  const filteredVisibleItems = useMemo(() => {
    if (!query) return visibleItems;
    return visibleItems.filter((i) => {
      const name = (renames[i] || i).toLowerCase();
      return name.includes(query);
    });
  }, [visibleItems, query, renames]);

  const ungrouped = useMemo(() => {
    const grouped = new Set(groups.flatMap((g) => g.children));
    return filteredVisibleItems.filter((l) => !grouped.has(l));
  }, [filteredVisibleItems, groups]);

  const filteredGroups = useMemo(() => {
    if (!query) return groups;
    return groups.filter((g) => {
      if (g.name.toLowerCase().includes(query)) return true;
      return g.children.some((c) => (renames[c] || c).toLowerCase().includes(query));
    });
  }, [groups, query, renames]);

  const displayName = useCallback((item: string) => renames[item] || item, [renames]);

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
      setMergeDialog({ source: draggedItem, target: targetId });
      return;
    }
  };

  const handleMerge = useCallback(() => {
    if (!mergeDialog) return;
    const next = new Set(mergedAway);
    next.add(mergeDialog.source);
    persistMerged(next);
    persistGroups(groups.map((g) => ({ ...g, children: g.children.filter((c) => c !== mergeDialog.source) })));
    toast.success(`Merged "${displayName(mergeDialog.source)}" into "${displayName(mergeDialog.target)}"`);
    setMergeDialog(null);
  }, [mergeDialog, mergedAway, persistMerged, groups, persistGroups, displayName]);

  const handleRenameItem = useCallback((itemId: string) => {
    if (!editName.trim()) return;
    persistRenames({ ...renames, [itemId]: editName.trim() });
    setEditingItemId(null);
    setEditName("");
    toast.success("Renamed");
  }, [editName, renames, persistRenames]);

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

  const handleUnmerge = useCallback((item: string) => {
    const next = new Set(mergedAway);
    next.delete(item);
    persistMerged(next);
    toast.success(`"${displayName(item)}" restored`);
  }, [mergedAway, persistMerged, displayName]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleUploadReference = useCallback(async (itemId: string, file: File) => {
    if (!filmId) return;
    const ext = file.name.split(".").pop() || "jpg";
    const safeName = itemId.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const path = `${filmId}/${storagePrefix}/${safeName}-ref.${ext}`;
    setAnalyzingItem(itemId);
    const { error: uploadErr } = await supabase.storage.from("character-assets").upload(path, file, { upsert: true });
    if (uploadErr) { toast.error("Upload failed"); setAnalyzingItem(null); return; }
    const { data: urlData } = supabase.storage.from("character-assets").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    persistRefImages({ ...refImages, [itemId]: publicUrl });
    toast.success("Reference uploaded — analyzing…");
    const context = CONTEXT_MAP[storagePrefix] || "prop";
    try {
      const { data: analysisData, error: analysisErr } = await supabase.functions.invoke("analyze-reference-image", {
        body: { imageUrl: publicUrl, context },
      });
      if (analysisErr) throw analysisErr;
      if (analysisData?.description) {
        persistRefDescs({ ...refDescriptions, [itemId]: analysisData.description.trim() });
        toast.success("Reference analyzed");
      }
    } catch (err) {
      console.error("Reference analysis failed:", err);
      toast.error("Could not analyze reference image");
    } finally {
      setAnalyzingItem(null);
    }
  }, [filmId, storagePrefix, refImages, refDescriptions, persistRefImages, persistRefDescs]);

  /* ── Open script viewer for one or more items ── */
  const openScriptForItems = useCallback(async (itemNames: string[], dialogTitle: string) => {
    if (!sceneBreakdown || sceneBreakdown.length === 0) {
      toast.error("No script analysis available");
      return;
    }

    // Find all matching scenes across all item names
    const allMatches = new Map<number, any>();
    for (const name of itemNames) {
      const matches = findScenesForItem(name, sceneBreakdown, storagePrefix);
      for (const m of matches) {
        if (!allMatches.has(m.sceneIndex)) allMatches.set(m.sceneIndex, m.scene);
      }
    }

    if (allMatches.size === 0) {
      toast.info("No scenes found referencing this item in the script breakdown");
      return;
    }

    setScriptTitle(dialogTitle);
    setScriptHighlightTerms(itemNames);
    setScriptOpen(true);
    setScriptScenes([]);
    setScriptLoading(true);

    // Sort scenes by scene number
    const sortedScenes = [...allMatches.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, scene]) => scene);

    if (!storagePath) {
      // No script file — show scene descriptions from breakdown
      setScriptScenes(sortedScenes.map((scene) => ({
        sceneNum: scene.scene_number ? parseInt(scene.scene_number, 10) : 0,
        heading: scene.scene_heading || "Unknown",
        paragraphs: [
          { type: "Scene Heading", text: scene.scene_heading || "" },
          { type: "Action", text: scene.description || "" },
        ],
      })));
      setScriptLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.storage.from("scripts").download(storagePath);
      if (error || !data) throw error || new Error("Download failed");
      const full = await data.text();
      const isFdx = full.trimStart().startsWith("<?xml") || full.includes("<FinalDraft");

      const parsedScenes: { sceneNum: number; heading: string; paragraphs: { type: string; text: string }[] }[] = [];

      for (const scene of sortedScenes) {
        const heading = scene.scene_heading?.trim();
        const sceneNum = scene.scene_number ? parseInt(scene.scene_number, 10) : 0;

        if (isFdx) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(full, "text/xml");
          const paragraphs = Array.from(doc.querySelectorAll("Paragraph"));
          let startIdx = -1, endIdx = paragraphs.length;
          for (let i = 0; i < paragraphs.length; i++) {
            const p = paragraphs[i];
            const pType = p.getAttribute("Type") || "";
            const texts = Array.from(p.querySelectorAll("Text"));
            const content = texts.map((t) => t.textContent || "").join("").trim();
            if (pType === "Scene Heading") {
              if (startIdx === -1 && heading && content.toUpperCase().includes(heading.toUpperCase())) {
                startIdx = i;
              } else if (startIdx !== -1) { endIdx = i; break; }
            }
          }
          if (startIdx === -1) continue;
          const result: { type: string; text: string }[] = [];
          for (let i = startIdx; i < endIdx; i++) {
            const p = paragraphs[i];
            const pType = p.getAttribute("Type") || "Action";
            const texts = Array.from(p.querySelectorAll("Text"));
            const content = texts.map((t) => t.textContent || "").join("");
            if (content.trim()) result.push({ type: pType, text: content });
          }
          parsedScenes.push({ sceneNum, heading: heading || "Unknown", paragraphs: result });
        } else {
          if (!heading) continue;
          const headingPattern = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const startMatch = full.match(new RegExp(`^(.*${headingPattern}.*)$`, "mi"));
          if (!startMatch || startMatch.index === undefined) continue;
          const sIdx = startMatch.index;
          const afterHeading = full.substring(sIdx + startMatch[0].length);
          const nextScene = afterHeading.match(/\n\s*((?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.).+)/i);
          const eIdx = nextScene?.index !== undefined ? sIdx + startMatch[0].length + nextScene.index : full.length;
          const sceneText = full.substring(sIdx, eIdx).trim();
          const parsed = sceneText.split("\n").filter((l) => l.trim()).map((line) => {
            const trimmed = line.trim();
            if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/.test(trimmed)) return { type: "Scene Heading", text: trimmed };
            if (/^[A-Z][A-Z\s'.()-]+$/.test(trimmed) && trimmed.length < 40) return { type: "Character", text: trimmed };
            return { type: "Action", text: trimmed };
          });
          parsedScenes.push({ sceneNum, heading: heading || "Unknown", paragraphs: parsed });
        }
      }

      setScriptScenes(parsedScenes);
    } catch {
      toast.error("Could not load script file");
      setScriptScenes(sortedScenes.map((scene) => ({
        sceneNum: scene.scene_number ? parseInt(scene.scene_number, 10) : 0,
        heading: scene.scene_heading || "Unknown",
        paragraphs: [
          { type: "Scene Heading", text: scene.scene_heading || "" },
          { type: "Action", text: scene.description || "[Could not load script file]" },
        ],
      })));
    } finally {
      setScriptLoading(false);
    }
  }, [sceneBreakdown, storagePath, storagePrefix]);

  const handleItemClick = useCallback((itemName: string) => {
    openScriptForItems([itemName], displayName(itemName));
  }, [openScriptForItems, displayName]);

  const handleGroupClick = useCallback((group: ItemGroup) => {
    if (group.children.length === 0) return;
    openScriptForItems(group.children, group.name);
  }, [openScriptForItems]);

  const mergedCount = mergedAway.size;

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

  /* ── Highlight helper ── */
  const highlightTerms = (text: string, terms: string[]) => {
    if (terms.length === 0) return text;
    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`(${escaped.join("|")})`, "gi");
    const parts = text.split(re);
    if (parts.length === 1) return text;
    return parts.map((part, j) =>
      re.test(part) ? <mark key={j} style={{ backgroundColor: "#facc15", color: "black", padding: "0 2px", borderRadius: 2 }}>{part}</mark> : part
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
              {visibleItems.length}{mergedCount > 0 ? ` (${mergedCount} merged)` : ""}
            </span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCreatingGroup(true)}>
            <Plus className="h-3.5 w-3.5" /> New Group
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}…`}
            className="h-9 text-sm pl-9 bg-background"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Drag items onto each other to merge duplicates · Drag into groups to organize · Click any item to view its script references
        </p>
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

            {filteredGroups.map((group) => (
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
                onStartEdit={() => { setEditingGroupId(group.id); setEditingItemId(null); setEditName(group.name); }}
                onEditChange={setEditName}
                onSaveEdit={() => handleRenameGroup(group.id)}
                subtitles={subtitles}
                displayName={displayName}
                refImages={refImages}
                refDescriptions={refDescriptions}
                analyzingItem={analyzingItem}
                onUploadReference={handleUploadReference}
                onItemClick={handleItemClick}
                onGroupClick={handleGroupClick}
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
                    <DraggableItem
                      key={item}
                      id={item}
                      label={displayName(item)}
                      icon={Icon}
                      isOverlay={false}
                      subtitle={refDescriptions[item] || subtitles?.[item]}
                      refImageUrl={refImages[item]}
                      isAnalyzing={analyzingItem === item}
                      onUploadReference={(file) => handleUploadReference(item, file)}
                      isEditing={editingItemId === item}
                      editName={editName}
                      onStartEdit={() => { setEditingItemId(item); setEditingGroupId(null); setEditName(displayName(item)); }}
                      onEditChange={setEditName}
                      onSaveEdit={() => handleRenameItem(item)}
                      onCancelEdit={() => { setEditingItemId(null); setEditName(""); }}
                      onClick={() => handleItemClick(item)}
                    />
                  ))}
                </div>
              </div>
            )}

            {mergedCount > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Merged Away</h3>
                  <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{mergedCount}</span>
                  <div className="flex-1 border-t border-border ml-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {[...mergedAway].filter((m) => items.includes(m)).map((item) => (
                    <div key={item} className="rounded-lg border border-dashed border-border bg-secondary/20 p-3 flex items-center gap-2 opacity-60">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <p className="text-sm text-muted-foreground truncate flex-1 line-through">{displayName(item)}</p>
                      <button onClick={() => handleUnmerge(item)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0" title="Restore">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DragOverlay>
            {activeId ? (
              <div className="rounded-lg border border-primary bg-card p-3 flex items-center gap-2 shadow-xl rotate-2 scale-105">
                <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-sm font-display font-semibold text-foreground truncate">{displayName(activeId)}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>

      {/* Merge confirmation */}
      <AlertDialog open={!!mergeDialog} onOpenChange={(open) => !open && setMergeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Merge className="h-5 w-5 text-primary" /> Merge Items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge <span className="font-semibold text-foreground">"{mergeDialog && displayName(mergeDialog.source)}"</span> into{" "}
              <span className="font-semibold text-foreground">"{mergeDialog && displayName(mergeDialog.target)}"</span>.
              The duplicate will be hidden. You can restore it later from the "Merged Away" section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge}>Merge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ SCRIPT VIEWER DIALOG ═══ */}
      <Dialog open={scriptOpen} onOpenChange={setScriptOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" />
              {scriptTitle}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {scriptScenes.length} scene{scriptScenes.length !== 1 ? "s" : ""} referencing this item · highlighted in yellow
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 pb-6">
            {scriptLoading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-20">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading script…
              </div>
            ) : scriptScenes.length === 0 ? (
              <div className="flex items-center justify-center text-muted-foreground py-20">
                No script content found for this item.
              </div>
            ) : (
              <div className="space-y-8">
                {scriptScenes.map((scene, si) => (
                  <div
                    key={si}
                    className="mx-auto bg-white text-black shadow-lg"
                    style={{
                      fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
                      fontSize: "12px",
                      lineHeight: "1.0",
                      padding: "72px 60px 72px 90px",
                      maxWidth: "612px",
                      minHeight: "400px",
                    }}
                  >
                    {scene.paragraphs.map((p, i) => {
                      const hl = (text: string) => highlightTerms(text, scriptHighlightTerms);
                      switch (p.type) {
                        case "Scene Heading":
                          return (
                            <p key={i} style={{ textTransform: "uppercase", fontWeight: "bold", marginTop: i === 0 ? 0 : 24, marginBottom: 12 }}>
                              <span>{scene.sceneNum}</span>
                              <span style={{ marginLeft: 24 }}>{hl(p.text)}</span>
                            </p>
                          );
                        case "Character":
                          return (
                            <p key={i} style={{ textTransform: "uppercase", textAlign: "left", paddingLeft: "37%", marginTop: 18, marginBottom: 0 }}>
                              {p.text}
                            </p>
                          );
                        case "Parenthetical":
                          return (
                            <p key={i} style={{ paddingLeft: "28%", fontStyle: "italic", marginTop: 0, marginBottom: 0 }}>
                              {hl(p.text)}
                            </p>
                          );
                        case "Dialogue":
                          return (
                            <p key={i} style={{ paddingLeft: "17%", paddingRight: "17%", marginTop: 0, marginBottom: 0 }}>
                              {hl(p.text)}
                            </p>
                          );
                        case "Transition":
                          return (
                            <p key={i} style={{ textAlign: "right", textTransform: "uppercase", marginTop: 18, marginBottom: 12 }}>
                              {p.text}
                            </p>
                          );
                        default:
                          return (
                            <p key={i} style={{ marginTop: 12, marginBottom: 0 }}>
                              {hl(p.text)}
                            </p>
                          );
                      }
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ── Draggable item card with rename + reference upload ── */
const DraggableItem = ({
  id, label, icon: Icon, isOverlay, subtitle,
  refImageUrl, isAnalyzing, onUploadReference,
  isEditing, editName, onStartEdit, onEditChange, onSaveEdit, onCancelEdit,
  onClick,
}: {
  id: string; label: string; icon: LucideIcon; isOverlay: boolean; subtitle?: string;
  refImageUrl?: string; isAnalyzing?: boolean; onUploadReference?: (file: File) => void;
  isEditing?: boolean; editName?: string;
  onStartEdit?: () => void; onEditChange?: (v: string) => void;
  onSaveEdit?: () => void; onCancelEdit?: () => void;
  onClick?: () => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id });
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div
      ref={(node) => { setNodeRef(node); if (!isOverlay) setDropRef(node); }}
      className={cn(
        "rounded-lg border bg-card p-3 flex flex-col gap-2 transition-all select-none",
        !isEditing && "cursor-grab active:cursor-grabbing",
        isOverlay && "shadow-xl ring-2 ring-primary/40 rotate-2 scale-105",
        isDragging && "opacity-30",
        isOver && !isDragging && "border-primary ring-2 ring-primary/20 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        {refImageUrl ? (
          <img src={refImageUrl} alt="" className="h-7 w-7 rounded object-cover border border-border shrink-0" />
        ) : (
          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
        )}
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <Input
              autoFocus
              value={editName}
              onChange={(e) => onEditChange?.(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit?.(); if (e.key === "Escape") onCancelEdit?.(); }}
              className="h-7 text-sm bg-background flex-1"
            />
            <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-7 px-1.5 shrink-0"><Check className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-7 px-1.5 shrink-0"><X className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1 cursor-pointer" onClick={onClick}>
              <p className="text-sm font-display font-semibold text-foreground truncate hover:text-primary transition-colors">{label}</p>
            </div>
            {onUploadReference && (
              <>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadReference(f); e.target.value = ""; }} />
                <button
                  onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                  className="shrink-0 text-muted-foreground/40 hover:text-primary transition-colors p-0.5"
                  title="Upload reference image"
                >
                  {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <Upload className="h-3 w-3" />}
                </button>
              </>
            )}
            {onStartEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
                className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"
                title="Rename"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {onClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                className="shrink-0 text-muted-foreground/40 hover:text-primary transition-colors p-0.5"
                title="View in script"
              >
                <ScrollText className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>
      {!isEditing && subtitle && (
        <p className="text-[10px] text-muted-foreground leading-relaxed pl-6 flex items-start gap-1">
          {refImageUrl && <Eye className="h-2.5 w-2.5 mt-0.5 shrink-0 text-primary/60" />}
          <span className="line-clamp-3">{subtitle}</span>
        </p>
      )}
      {isAnalyzing && (
        <p className="text-[10px] text-primary pl-6 flex items-center gap-1">
          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Analyzing reference…
        </p>
      )}
    </div>
  );
};

/* ── Group drop zone ── */
const GroupDropZone = ({
  group, icon: Icon, isCollapsed, onToggle, onDelete, onRemoveChild,
  isEditing, editName, onStartEdit, onEditChange, onSaveEdit, subtitles, displayName,
  refImages, refDescriptions, analyzingItem, onUploadReference,
  onItemClick, onGroupClick,
}: {
  group: ItemGroup; icon: LucideIcon; isCollapsed: boolean; onToggle: () => void;
  onDelete: () => void; onRemoveChild: (item: string) => void;
  isEditing: boolean; editName: string;
  onStartEdit: () => void; onEditChange: (v: string) => void; onSaveEdit: () => void;
  subtitles?: Record<string, string>; displayName: (item: string) => string;
  refImages: Record<string, string>; refDescriptions: Record<string, string>;
  analyzingItem: string | null;
  onUploadReference: (itemId: string, file: File) => void;
  onItemClick?: (itemName: string) => void;
  onGroupClick?: (group: ItemGroup) => void;
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: `group::${group.id}` });

  return (
    <div ref={setNodeRef} className={cn(
      "rounded-xl border transition-all",
      isOver ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border bg-card/50"
    )}>
      <div className="flex items-center gap-2 p-3">
        <button onClick={onToggle} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              autoFocus value={editName} onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); }}
              className="h-7 text-sm bg-background flex-1"
            />
            <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-7 px-1.5"><Check className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <>
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <p className="font-display text-sm font-bold text-foreground flex-1 cursor-pointer hover:text-primary transition-colors" onClick={() => onGroupClick?.(group)}>{group.name}</p>
            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{group.children.length}</span>
            {onGroupClick && (
              <button onClick={(e) => { e.stopPropagation(); onGroupClick(group); }} className="text-muted-foreground/40 hover:text-primary transition-colors p-0.5" title="View all in script">
                <ScrollText className="h-3 w-3" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onStartEdit(); }} className="text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"><Pencil className="h-3 w-3" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-muted-foreground/40 hover:text-destructive transition-colors p-0.5"><X className="h-3.5 w-3.5" /></button>
          </>
        )}
      </div>
      {!isCollapsed && group.children.length > 0 && (
        <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {group.children.map((item) => (
            <div key={item} className="rounded-lg border border-border bg-card p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {refImages[item] ? (
                  <img src={refImages[item]} alt="" className="h-6 w-6 rounded object-cover border border-border shrink-0" />
                ) : (
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <p className="text-sm text-foreground truncate flex-1 cursor-pointer hover:text-primary transition-colors" onClick={() => onItemClick?.(item)}>{displayName(item)}</p>
                <button onClick={(e) => { e.stopPropagation(); onItemClick?.(item); }} className="text-muted-foreground/40 hover:text-primary transition-colors p-0.5" title="View in script">
                  <ScrollText className="h-2.5 w-2.5" />
                </button>
                <button onClick={() => onRemoveChild(item)} className="text-muted-foreground/40 hover:text-destructive p-0.5 shrink-0"><X className="h-3 w-3" /></button>
              </div>
              {(refDescriptions[item] || subtitles?.[item]) && (
                <p className="text-[10px] text-muted-foreground pl-5 line-clamp-2">{refDescriptions[item] || subtitles?.[item]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DnDGroupPane;
