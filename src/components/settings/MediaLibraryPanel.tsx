import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Film, Image, FileText, Users, MapPin, Shirt, Package,
  ChevronRight, ChevronDown, Folder, Eye,
} from "lucide-react";

type MediaItem = {
  id: string;
  name: string;
  url: string;
  type: "image" | "video" | "script" | "other";
  category: string;
  subCategory?: string;
  createdAt: string;
};

const MediaLibraryPanel = () => {
  const { user } = useAuth();
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [activeTab, setActiveTab] = useState("shots");
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (key: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Fetch shots (video/image)
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

  // Fetch characters (headshots, references)
  const { data: characters } = useQuery({
    queryKey: ["settings-media-characters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("id, name, image_url, reference_image_url, created_at")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch film assets (locations, props, wardrobe, vehicles)
  const { data: filmAssets } = useQuery({
    queryKey: ["settings-media-film-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("film_assets")
        .select("id, asset_name, asset_type, image_url, description, created_at")
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
        .select("id, file_name, storage_path, created_at, status")
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
    }));

  const characterItems: MediaItem[] = (characters || []).flatMap((c) => {
    const items: MediaItem[] = [];
    if (c.image_url) {
      items.push({
        id: `${c.id}-headshot`,
        name: `${c.name} — Headshot`,
        url: c.image_url,
        type: "image",
        category: "Characters",
        subCategory: c.name,
        createdAt: c.created_at,
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
    }));

  const scriptItems: MediaItem[] = (scripts || []).map((s) => ({
    id: s.id,
    name: s.file_name,
    url: s.storage_path,
    type: "script" as const,
    category: "Scripts",
    createdAt: s.created_at,
  }));

  const tabData: Record<string, { icon: React.ReactNode; items: MediaItem[] }> = {
    shots: { icon: <Film className="h-3 w-3" />, items: shotItems },
    characters: { icon: <Users className="h-3 w-3" />, items: characterItems },
    locations: { icon: <MapPin className="h-3 w-3" />, items: assetItems.filter((a) => a.category.toLowerCase() === "location") },
    wardrobe: { icon: <Shirt className="h-3 w-3" />, items: assetItems.filter((a) => a.category.toLowerCase() === "wardrobe") },
    props: { icon: <Package className="h-3 w-3" />, items: assetItems.filter((a) => !["location", "wardrobe", "characters"].includes(a.category.toLowerCase())) },
    scripts: { icon: <FileText className="h-3 w-3" />, items: scriptItems },
  };

  const totalCount = Object.values(tabData).reduce((sum, d) => sum + d.items.length, 0);

  const renderGroupedItems = (items: MediaItem[]) => {
    // Group by subCategory if exists
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
          return (
            <div key={key}>
              <button
                onClick={() => toggleFolder(key)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors"
              >
                {isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <Folder className="h-3 w-3 text-primary/60" />
                <span className="font-mono text-[11px] font-medium text-foreground">{key}</span>
                <span className="ml-auto text-[9px] text-muted-foreground/60 font-mono">{groupItems.length}</span>
              </button>
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
        <button
          key={item.id}
          onClick={() => item.type !== "script" && setPreviewItem(item)}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent transition-colors group"
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
              <FileText className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono font-medium text-foreground truncate">{item.name}</p>
            <p className="text-[9px] font-mono text-muted-foreground/60">
              {new Date(item.createdAt).toLocaleDateString()}
            </p>
          </div>
          {item.type !== "script" && (
            <Eye className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
          )}
        </button>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
            <ScrollArea className="max-h-[60vh]">
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
                  <video
                    src={previewItem.url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[70vh]"
                  />
                ) : (
                  <img
                    src={previewItem.url}
                    alt={previewItem.name}
                    className="max-w-full max-h-[70vh] object-contain"
                  />
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
    </div>
  );
};

export default MediaLibraryPanel;
