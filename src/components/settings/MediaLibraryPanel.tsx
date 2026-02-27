import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Film, Image, FileText, Users, MapPin, Shirt, Package,
  ChevronRight, ChevronDown, Folder, Eye, Trash2, Download,
  CheckSquare, Square, FolderDown,
} from "lucide-react";
import { type ExportRecord, triggerDownload } from "@/components/release/ExportHistoryPanel";
import { toast } from "sonner";
import DraggableScriptPopup from "@/components/DraggableScriptPopup";

type MediaItem = {
  id: string;
  name: string;
  url: string;
  type: "image" | "video" | "script" | "other";
  category: string;
  subCategory?: string;
  createdAt: string;
  sourceTable?: string;
  filmId?: string;
};

const MediaLibraryPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [activeTab, setActiveTab] = useState("shots");
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [scriptPreview, setScriptPreview] = useState<{ name: string; text: string } | null>(null);

  const toggleFolder = (key: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((items: MediaItem[]) => {
    setSelected((prev) => {
      const ids = items.map((i) => i.id);
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  // Fetch films for version links
  const { data: films } = useQuery({
    queryKey: ["settings-media-films"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("films")
        .select("id, title, version_name, project_id");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filmMap = new Map(
    (films || []).map((f) => [f.id, { title: f.title, versionName: f.version_name, projectId: f.project_id }])
  );

  // Fetch shots
  const { data: shots } = useQuery({
    queryKey: ["settings-media-shots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shots")
        .select("id, scene_number, camera_angle, video_url, prompt_text, created_at, film_id")
        .order("scene_number")
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch characters
  const { data: characters } = useQuery({
    queryKey: ["settings-media-characters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("id, name, image_url, reference_image_url, created_at, film_id")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch film assets
  const { data: filmAssets } = useQuery({
    queryKey: ["settings-media-film-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("film_assets")
        .select("id, asset_name, asset_type, image_url, description, created_at, film_id")
        .order("asset_type")
        .order("asset_name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch scripts
  const { data: scripts } = useQuery({
    queryKey: ["settings-media-scripts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("script_analyses")
        .select("id, file_name, storage_path, created_at, status, film_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Build organized media items
  const shotItems: MediaItem[] = (shots || [])
    .filter((s) => s.video_url)
    .map((s) => ({
      id: s.id,
      name: `Scene ${s.scene_number} — ${s.camera_angle || "Shot"}`,
      url: s.video_url!,
      type: s.video_url!.includes(".mp4") || s.video_url!.includes("video") ? "video" : "image",
      category: "Shots",
      subCategory: `Scene ${s.scene_number}`,
      createdAt: s.created_at,
      sourceTable: "shots",
      filmId: s.film_id,
    }));

  const characterItems: MediaItem[] = (characters || []).flatMap((c) => {
    const items: MediaItem[] = [];
    if (c.image_url) {
      items.push({
        id: `${c.id}-headshot`,
        name: `${c.name}`,
        url: c.image_url,
        type: "image",
        category: "Characters",
        subCategory: c.name,
        createdAt: c.created_at,
        sourceTable: "characters",
        filmId: c.film_id,
      });
    }
    if (c.reference_image_url) {
      items.push({
        id: `${c.id}-ref`,
        name: `${c.name} — Reference`,
        url: c.reference_image_url,
        type: "image",
        category: "Characters",
        subCategory: c.name,
        createdAt: c.created_at,
        sourceTable: "characters",
        filmId: c.film_id,
      });
    }
    return items;
  });

  const assetItems: MediaItem[] = (filmAssets || [])
    .filter((a) => a.image_url)
    .map((a) => ({
      id: a.id,
      name: a.asset_name,
      url: a.image_url!,
      type: "image",
      category: a.asset_type.charAt(0).toUpperCase() + a.asset_type.slice(1),
      createdAt: a.created_at,
      sourceTable: "film_assets",
      filmId: a.film_id,
    }));

  const scriptItems: MediaItem[] = (scripts || []).map((s) => ({
    id: s.id,
    name: s.file_name,
    url: s.storage_path,
    type: "script" as const,
    category: "Scripts",
    createdAt: s.created_at,
    sourceTable: "script_analyses",
    filmId: s.film_id,
  }));

  // Load exports from localStorage
  const exportItems: MediaItem[] = (() => {
    try {
      const stored = localStorage.getItem("vfs-exports");
      if (!stored) return [];
      const parsed: ExportRecord[] = JSON.parse(stored).map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      }));
      return parsed.map((e) => ({
        id: e.id,
        name: e.label,
        url: e.fileName,
        type: "other" as const,
        category: "Exports",
        subCategory: e.type,
        createdAt: e.timestamp.toISOString(),
        sourceTable: "exports-local",
      }));
    } catch {
      return [];
    }
  })();

  const tabData: Record<string, { icon: React.ReactNode; items: MediaItem[] }> = {
    shots: { icon: <Film className="h-3 w-3" />, items: shotItems },
    characters: { icon: <Users className="h-3 w-3" />, items: characterItems },
    locations: { icon: <MapPin className="h-3 w-3" />, items: assetItems.filter((a) => a.category.toLowerCase() === "location") },
    wardrobe: { icon: <Shirt className="h-3 w-3" />, items: assetItems.filter((a) => a.category.toLowerCase() === "wardrobe") },
    props: { icon: <Package className="h-3 w-3" />, items: assetItems.filter((a) => !["location", "wardrobe", "characters"].includes(a.category.toLowerCase())) },
    scripts: { icon: <FileText className="h-3 w-3" />, items: scriptItems },
    exports: { icon: <FolderDown className="h-3 w-3" />, items: exportItems },
  };

  const totalCount = Object.values(tabData).reduce((sum, d) => sum + d.items.length, 0);
  const currentTabItems = tabData[activeTab]?.items || [];
  const selectedInTab = currentTabItems.filter((i) => selected.has(i.id));
  const allInTabSelected = currentTabItems.length > 0 && currentTabItems.every((i) => selected.has(i.id));

  // Download selected items
  const handleDownloadSelected = useCallback(async () => {
    for (const item of selectedInTab) {
      try {
        const response = await fetch(item.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = item.type === "video" ? ".mp4" : item.type === "script" ? ".pdf" : ".png";
        a.download = `${item.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        toast.error(`Failed to download ${item.name}`);
      }
    }
    toast.success(`Downloaded ${selectedInTab.length} item(s)`);
  }, [selectedInTab]);

  // Delete selected items
  const handleDeleteSelected = useCallback(async () => {
    let deleted = 0;
    for (const item of selectedInTab) {
      try {
        if (item.sourceTable === "shots") {
          await supabase.from("shots").update({ video_url: null }).eq("id", item.id);
        } else if (item.sourceTable === "film_assets") {
          await supabase.from("film_assets").delete().eq("id", item.id);
        } else if (item.sourceTable === "characters") {
          const realId = item.id.replace(/-headshot$|-ref$/, "");
          if (item.id.endsWith("-headshot")) {
            await supabase.from("characters").update({ image_url: null }).eq("id", realId);
          } else {
            await supabase.from("characters").update({ reference_image_url: null }).eq("id", realId);
          }
        } else if (item.sourceTable === "script_analyses") {
          await supabase.from("script_analyses").delete().eq("id", item.id);
        } else if (item.sourceTable === "exports-local") {
          // Remove from localStorage
          try {
            const stored = localStorage.getItem("vfs-exports");
            if (stored) {
              const parsed = JSON.parse(stored);
              const filtered = parsed.filter((e: any) => e.id !== item.id);
              localStorage.setItem("vfs-exports", JSON.stringify(filtered));
            }
          } catch { /* ignore */ }
        }
        deleted++;
      } catch {
        toast.error(`Failed to delete ${item.name}`);
      }
    }
    setSelected(new Set());
    setShowDeleteConfirm(false);
    queryClient.invalidateQueries({ queryKey: ["settings-media-shots"] });
    queryClient.invalidateQueries({ queryKey: ["settings-media-characters"] });
    queryClient.invalidateQueries({ queryKey: ["settings-media-film-assets"] });
    queryClient.invalidateQueries({ queryKey: ["settings-media-scripts"] });
    toast.success(`Deleted ${deleted} item(s)`);
  }, [selectedInTab, queryClient]);

  const renderGroupedItems = (items: MediaItem[]) => {
    const groups = new Map<string, MediaItem[]>();
    items.forEach((item) => {
      const key = item.subCategory || "Ungrouped";
      const arr = groups.get(key) || [];
      arr.push(item);
      groups.set(key, arr);
    });

    if (groups.size === 1 && groups.has("Ungrouped")) {
      return renderItemList(items);
    }

    const sortedKeys = [...groups.keys()].sort();
    return (
      <div className="space-y-1">
        {sortedKeys.map((key) => {
          const groupItems = groups.get(key)!;
          const isOpen = openFolders.has(key);
          const allGroupSelected = groupItems.every((i) => selected.has(i.id));
          const someGroupSelected = groupItems.some((i) => selected.has(i.id));
          return (
            <div key={key}>
              <div className="flex items-center gap-1">
                <Checkbox
                  checked={allGroupSelected}
                  className="h-3.5 w-3.5 ml-1"
                  onCheckedChange={() => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      const ids = groupItems.map((i) => i.id);
                      if (allGroupSelected) {
                        ids.forEach((id) => next.delete(id));
                      } else {
                        ids.forEach((id) => next.add(id));
                      }
                      return next;
                    });
                  }}
                />
                <button
                  onClick={() => toggleFolder(key)}
                  className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  {isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <Folder className="h-3 w-3 text-primary/60" />
                  <span className="font-mono text-[11px] font-medium text-foreground">{key}</span>
                  <span className="ml-auto text-[9px] text-muted-foreground/60 font-mono">{groupItems.length}</span>
                </button>
              </div>
              {isOpen && <div className="ml-5">{renderItemList(groupItems)}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderItemList = (items: MediaItem[]) => (
    <div className="space-y-0.5">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent transition-colors group"
        >
          <Checkbox
            checked={selected.has(item.id)}
            onCheckedChange={() => toggleSelect(item.id)}
            className="h-3.5 w-3.5 shrink-0"
          />
          <button
            onClick={() => {
              if (item.type === "script") {
                // Fetch all scenes for this script's film and display as scrollable text
                (async () => {
                  const { data: analysis } = await supabase
                    .from("script_analyses")
                    .select("film_id")
                    .eq("id", item.id)
                    .maybeSingle();
                  if (!analysis) return;
                  const { data: scenes } = await supabase
                    .from("parsed_scenes")
                    .select("scene_number, heading, raw_text")
                    .eq("film_id", analysis.film_id)
                    .order("scene_number");
                  if (scenes && scenes.length > 0) {
                    const fullText = scenes.map((s) => `${s.heading}\n\n${s.raw_text}`).join("\n\n\n");
                    setScriptPreview({ name: item.name, text: fullText });
                  }
                })();
              } else {
                setPreviewItem(item);
              }
            }}
            className="flex flex-1 items-center gap-2.5 min-w-0"
          >
            {item.type === "image" && item.url ? (
              <div className="h-8 w-12 rounded border border-border overflow-hidden bg-secondary/50 shrink-0">
                <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
              </div>
            ) : item.type === "video" ? (
              <div className="h-8 w-12 rounded border border-border overflow-hidden bg-secondary/50 shrink-0 flex items-center justify-center">
                <Film className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
            ) : (
              <div className="h-8 w-12 rounded border border-border overflow-hidden bg-secondary/50 shrink-0 flex items-center justify-center">
                <FileText className="h-3.5 w-3.5 text-foreground" />
              </div>
            )}
            <p className="flex-1 min-w-0 text-base font-mono font-medium text-foreground truncate">{item.name}</p>
            <div className="flex items-center gap-2 shrink-0">
              {item.filmId && filmMap.get(item.filmId) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const film = filmMap.get(item.filmId!);
                    if (film?.projectId) navigate(`/projects/${film.projectId}/versions`);
                  }}
                  className="text-[10px] font-mono text-primary/70 hover:text-primary hover:underline transition-colors truncate max-w-[120px]"
                  title={`${filmMap.get(item.filmId)!.title} — ${filmMap.get(item.filmId)!.versionName}`}
                >
                  {filmMap.get(item.filmId)!.versionName || filmMap.get(item.filmId)!.title}
                </button>
              )}
              <span className="text-xs font-mono text-muted-foreground/60">
                {new Date(item.createdAt).toLocaleDateString()}
              </span>
            </div>
            <Eye className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Image className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{totalCount} media items</p>
          <p className="text-[11px] text-muted-foreground">Across all projects and versions</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelected(new Set()); }}>
        <TabsList className="w-full h-9 bg-secondary/60 border border-border/50 p-0.5">
          {Object.entries(tabData).map(([key, { icon, items }]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="flex-1 text-[9px] font-mono uppercase tracking-wider h-full gap-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
            >
              {icon}
              {key}
              {items.length > 0 && (
                <span className="text-[8px] opacity-60">({items.length})</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(tabData).map(([key, { items }]) => (
          <TabsContent key={key} value={key} className="mt-3">
            {/* Bulk action bar */}
            {items.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] gap-1.5 h-7 px-2"
                  onClick={() => toggleSelectAll(items)}
                >
                  {allInTabSelected ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                  {allInTabSelected ? "Deselect All" : "Select All"}
                </Button>
                {selectedInTab.length > 0 && (
                  <>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {selectedInTab.length} selected
                    </span>
                    <div className="ml-auto flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] gap-1.5 h-7 px-2.5"
                        onClick={handleDownloadSelected}
                      >
                        <Download className="h-3 w-3" /> Download
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="text-[10px] gap-1.5 h-7 px-2.5"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            <ScrollArea className="max-h-[55vh]">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <Image className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/50 font-mono">No {key} files yet.</p>
                </div>
              ) : (
                renderGroupedItems(items)
              )}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {previewItem && (
            <div className="flex flex-col">
              <div className="bg-black flex items-center justify-center min-h-[300px] max-h-[70vh]">
                {previewItem.type === "video" ? (
                  <video src={previewItem.url} controls autoPlay className="max-w-full max-h-[70vh]" />
                ) : (
                  <img src={previewItem.url} alt={previewItem.name} className="max-w-full max-h-[70vh] object-contain" />
                )}
              </div>
              <div className="px-4 py-3 border-t border-border bg-card">
                <p className="text-sm font-mono font-medium text-foreground">{previewItem.name}</p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {previewItem.category} · {new Date(previewItem.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Script Preview — draggable & resizable */}
      <DraggableScriptPopup
        open={!!scriptPreview}
        onClose={() => setScriptPreview(null)}
        title={scriptPreview?.name ?? ""}
        subtitle="Full screenplay text"
      >
        <div className="px-6 py-4">
          <div
            className="mx-auto bg-white text-black shadow-lg rounded"
            style={{
              fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
              fontSize: "12px",
              lineHeight: "1.0",
              padding: "72px 60px 72px 90px",
              maxWidth: "612px",
              minHeight: "400px",
            }}
          >
            {scriptPreview?.text.split("\n").map((line, i) => {
              const trimmed = line.trim();
              const isHeading = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(trimmed);
              const isCharacter = trimmed === trimmed.toUpperCase() && trimmed.length > 1 && trimmed.length < 40 && !isHeading && !/^\(/.test(trimmed);
              const isParenthetical = /^\(.*\)$/.test(trimmed);
              const isDialogue = !isHeading && !isCharacter && !isParenthetical && line.startsWith("  ") && !line.startsWith("    ");

              if (isHeading) {
                return <p key={i} style={{ textTransform: "uppercase", fontWeight: "bold", marginTop: i === 0 ? 0 : 24, marginBottom: 12 }}>{trimmed}</p>;
              }
              if (isCharacter) {
                return <p key={i} style={{ textAlign: "center", textTransform: "uppercase", marginTop: 18, marginBottom: 0, paddingLeft: "20%" }}>{trimmed}</p>;
              }
              if (isParenthetical) {
                return <p key={i} style={{ paddingLeft: "25%", fontStyle: "italic", marginBottom: 0, marginTop: 0 }}>{trimmed}</p>;
              }
              if (isDialogue) {
                return <p key={i} style={{ paddingLeft: "15%", paddingRight: "15%", marginBottom: 0, marginTop: 0 }}>{trimmed}</p>;
              }
              if (!trimmed) return <div key={i} style={{ height: 12 }} />;
              return <p key={i} style={{ marginTop: 12, marginBottom: 0 }}>{trimmed}</p>;
            })}
          </div>
        </div>
      </DraggableScriptPopup>


      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedInTab.length} item(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected media files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteSelected}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MediaLibraryPanel;
