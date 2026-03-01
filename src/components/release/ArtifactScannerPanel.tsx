import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ScanLine, AlertTriangle, CheckCircle, Loader2, Volume2, Eye, Zap, ChevronDown,
} from "lucide-react";

interface ArtifactIssue {
  id: string;
  type: "flicker" | "melt" | "inconsistency" | "audio" | "morph";
  severity: "warning" | "error";
  timestamp: string;
  description: string;
}

const SEVERITY_CONFIG = {
  warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  error: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
};

const TYPE_LABELS: Record<string, string> = {
  flicker: "Flickering Frame",
  melt: "Melting Background",
  inconsistency: "Lighting Inconsistency",
  audio: "Audio Artifact",
  morph: "Character Morph",
};

export default function ArtifactScannerPanel() {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [issues, setIssues] = useState<ArtifactIssue[]>([]);
  const [scanComplete, setScanComplete] = useState(false);
  const [loudnessNorm, setLoudnessNorm] = useState(true);
  const [targetLufs, setTargetLufs] = useState("-24");

  const handleScan = () => {
    setScanning(true);
    setProgress(0);
    setScanComplete(false);
    setIssues([]);

    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 8 + 2;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setScanning(false);
        setScanComplete(true);
        setIssues([
          { id: "1", type: "flicker", severity: "warning", timestamp: "00:02:14:08", description: "Minor frame flicker detected between cuts at Scene 3." },
          { id: "2", type: "melt", severity: "error", timestamp: "00:05:41:22", description: "Background texture melting artifact near window edge." },
          { id: "3", type: "morph", severity: "warning", timestamp: "00:08:03:15", description: "Slight hand deformation on character left hand." },
        ]);
      }
      setProgress(Math.min(100, p));
    }, 200);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-card cinema-inset overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full px-4 py-3 hover:bg-secondary/40 transition-colors text-left">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Eye className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-xs font-bold uppercase tracking-widest">Technical QC</h3>
              <p className="text-[9px] font-mono text-muted-foreground">Artifact Scanner & Loudness</p>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant={scanComplete && issues.length === 0 ? "secondary" : "default"}
                className="gap-1.5 h-7 px-3 text-[10px] font-mono cinema-inset active:translate-y-px"
                disabled={scanning}
                onClick={handleScan}
              >
                {scanning ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Scanning…</>
                ) : scanComplete && issues.length === 0 ? (
                  <><CheckCircle className="h-3 w-3" /> All Clear</>
                ) : (
                  <><ScanLine className="h-3 w-3" /> Run QC Scan</>
                )}
              </Button>
            </div>

            {/* Progress bar */}
            {scanning && (
              <div className="space-y-1">
                <Progress value={progress} className="h-1.5" />
                <p className="text-[9px] font-mono text-muted-foreground text-center">
                  Analyzing frames… {Math.round(progress)}%
                </p>
              </div>
            )}

            {/* Issues list */}
            {scanComplete && issues.length > 0 && (
              <ScrollArea className="max-h-[180px]">
                <div className="space-y-1.5">
                  {issues.map((issue) => {
                    const cfg = SEVERITY_CONFIG[issue.severity];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={issue.id}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2",
                          cfg.bg, cfg.border
                        )}
                      >
                        <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", cfg.color)} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-foreground">
                              {TYPE_LABELS[issue.type] ?? issue.type}
                            </span>
                            <span className="text-[9px] font-mono text-muted-foreground">
                              @ {issue.timestamp}
                            </span>
                          </div>
                          <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5">
                            {issue.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {scanComplete && issues.length === 0 && (
              <div className="rounded-md bg-green-500/10 border border-green-500/30 px-3 py-2 flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <span className="text-[10px] font-mono text-green-500 font-semibold">
                  No artifacts detected. Film passes QC.
                </span>
              </div>
            )}

            {/* Loudness Normalization */}
            <div className="border-t border-border/40 pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Volume2 className="h-3.5 w-3.5 text-primary/60" />
                <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">
                  Loudness Normalization
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-secondary/50 border border-border/50 px-3 py-2 cinema-inset">
                <div className="flex items-center gap-2">
                  <Switch id="loudness" checked={loudnessNorm} onCheckedChange={setLoudnessNorm} />
                  <Label htmlFor="loudness" className="text-[10px] cursor-pointer">
                    Auto-normalize to broadcast standard
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-muted-foreground/50" />
                  <select
                    value={targetLufs}
                    onChange={(e) => setTargetLufs(e.target.value)}
                    className="text-[9px] font-mono bg-transparent border-none text-foreground/80 focus:outline-none cursor-pointer"
                  >
                    <option value="-14">-14 LUFS (Streaming)</option>
                    <option value="-16">-16 LUFS (Spotify)</option>
                    <option value="-24">-24 LUFS (Broadcast)</option>
                    <option value="-27">-27 LUFS (Cinema)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
