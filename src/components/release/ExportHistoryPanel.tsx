import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, History, FileVideo, Image, Film, Smartphone, Package, Lock, Trash2 } from "lucide-react";
import { format } from "date-fns";

export interface ExportRecord {
  id: string;
  type: string;
  label: string;
  timestamp: Date;
  fileName: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  social: <Smartphone className="h-3.5 w-3.5" />,
  poster: <Image className="h-3.5 w-3.5" />,
  trailer: <Film className="h-3.5 w-3.5" />,
  filmfreeway: <Package className="h-3.5 w-3.5" />,
  prores: <FileVideo className="h-3.5 w-3.5" />,
  youtube: <FileVideo className="h-3.5 w-3.5" />,
  vimeo: <FileVideo className="h-3.5 w-3.5" />,
  tiktok: <Smartphone className="h-3.5 w-3.5" />,
  c2pa: <Lock className="h-3.5 w-3.5" />,
  master: <FileVideo className="h-3.5 w-3.5" />,
};

function triggerDownload(record: ExportRecord) {
  const content = `[Simulated Export]\nType: ${record.label}\nGenerated: ${record.timestamp.toISOString()}\nFile: ${record.fileName}\n\nThis is a placeholder file. In production, this would be the actual rendered media asset.`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = record.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { triggerDownload };

export default function ExportHistoryPanel({
  exports,
  onClear,
}: {
  exports: ExportRecord[];
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-[10px] font-mono h-8 relative">
          <History className="h-3.5 w-3.5" />
          Export History
          {exports.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1">
              {exports.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Export History
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Previously exported files available for re-download.
          </DialogDescription>
        </DialogHeader>

        {exports.length === 0 ? (
          <div className="text-center py-10">
            <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/60 font-mono">No exports yet.</p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[340px]">
              <div className="space-y-2 pr-3">
                {exports.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2.5"
                  >
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      {TYPE_ICONS[record.type] ?? <FileVideo className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono font-semibold truncate">{record.label}</p>
                      <p className="text-[9px] font-mono text-muted-foreground/60 truncate">
                        {record.fileName} · {format(record.timestamp, "MMM d, h:mm a")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => triggerDownload(record)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" className="gap-1 text-[10px] text-muted-foreground" onClick={onClear}>
                <Trash2 className="h-3 w-3" /> Clear History
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
