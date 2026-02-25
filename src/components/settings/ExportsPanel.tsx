import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  FileVideo, Image, Film, Smartphone, Package, Lock, Download,
  FolderDown, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { type ExportRecord, triggerDownload } from "@/components/release/ExportHistoryPanel";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  social: <Smartphone className="h-4 w-4" />,
  poster: <Image className="h-4 w-4" />,
  trailer: <Film className="h-4 w-4" />,
  filmfreeway: <Package className="h-4 w-4" />,
  prores: <FileVideo className="h-4 w-4" />,
  youtube: <FileVideo className="h-4 w-4" />,
  vimeo: <FileVideo className="h-4 w-4" />,
  tiktok: <Smartphone className="h-4 w-4" />,
  c2pa: <Lock className="h-4 w-4" />,
  master: <FileVideo className="h-4 w-4" />,
};

const ExportsPanel = () => {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [previewExport, setPreviewExport] = useState<ExportRecord | null>(null);

  useEffect(() => {
    // Load exports from localStorage (same as Release page)
    try {
      const stored = localStorage.getItem("vfs-exports");
      if (stored) {
        const parsed = JSON.parse(stored);
        setExports(
          parsed.map((e: any) => ({
            ...e,
            timestamp: new Date(e.timestamp),
          }))
        );
      }
    } catch {
      // ignore
    }
  }, []);

  if (exports.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <FolderDown className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No exports yet</p>
            <p className="text-[11px] text-muted-foreground">Exports from the Release phase will appear here.</p>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-12 text-center">
          <FolderDown className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/60 font-mono">No finished exports.</p>
          <p className="text-xs text-muted-foreground/40 mt-1">
            Export your film from the Release phase to see files here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <FolderDown className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{exports.length} exports</p>
          <p className="text-[11px] text-muted-foreground">All finished exports from the Release phase</p>
        </div>
      </div>

      <ScrollArea className="max-h-[60vh]">
        <div className="space-y-1">
          {exports.map((record) => (
            <button
              key={record.id}
              onClick={() => setPreviewExport(record)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3 hover:bg-accent transition-colors text-left group"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {TYPE_ICONS[record.type] ?? <FileVideo className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-medium text-foreground truncate">{record.label}</p>
                <p className="text-[11px] font-mono text-muted-foreground/60 truncate">
                  {record.fileName} · {format(record.timestamp, "MMM d, yyyy h:mm a")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Eye className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerDownload(record);
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Export Preview Dialog */}
      <Dialog open={!!previewExport} onOpenChange={() => setPreviewExport(null)}>
        <DialogContent className="max-w-md">
          {previewExport && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {TYPE_ICONS[previewExport.type] ?? <FileVideo className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm font-display font-bold text-foreground">{previewExport.label}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{previewExport.fileName}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Type</span>
                  <span className="text-foreground font-mono text-xs">{previewExport.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">File Name</span>
                  <span className="text-foreground font-mono text-xs truncate max-w-[200px]">{previewExport.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Exported</span>
                  <span className="text-foreground font-mono text-xs">
                    {format(previewExport.timestamp, "MMM d, yyyy h:mm:ss a")}
                  </span>
                </div>
              </div>

              <Button className="w-full gap-2" onClick={() => triggerDownload(previewExport)}>
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExportsPanel;
