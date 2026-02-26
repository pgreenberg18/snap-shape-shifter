import { useState } from "react";
import {
  useViceConflicts,
  useViceDirtyQueue,
  useViceRealtime,
  useResolveConflict,
  useDismissDirtyItem,
  useDetectConflicts,
  useRegenerateAllDirty,
} from "@/hooks/useVice";
import { useStyleContract } from "@/hooks/useStyleContract";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  X,
  Check,
  Zap,
  Paintbrush,
  Shirt,
  User,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ViceDependencyGraph from "./ViceDependencyGraph";

interface VicePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const conflictTypeConfig: Record<string, { icon: typeof AlertTriangle; label: string }> = {
  style_drift: { icon: Paintbrush, label: "Style Drift" },
  character_drift: { icon: User, label: "Character Drift" },
  wardrobe_mismatch: { icon: Shirt, label: "Wardrobe Mismatch" },
  prop_missing: { icon: Zap, label: "Prop Missing" },
  lighting_shift: { icon: Zap, label: "Lighting Shift" },
};

const VicePanel = ({ open, onOpenChange }: VicePanelProps) => {
  useViceRealtime();
  const { data: conflicts = [], isLoading: conflictsLoading } = useViceConflicts();
  const { data: dirtyQueue = [], isLoading: dirtyLoading } = useViceDirtyQueue();
  const { data: styleContract } = useStyleContract();
  const resolveConflict = useResolveConflict();
  const dismissDirty = useDismissDirtyItem();
  const detectConflicts = useDetectConflicts();
  const regenerateAll = useRegenerateAllDirty();
  const [scanning, setScanning] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    try {
      await detectConflicts.mutateAsync(undefined);
    } finally {
      setScanning(false);
    }
  };

  const handleRegenerateAll = async () => {
    if (!dirtyQueue.length) return;
    setRegenerating(true);
    try {
      await regenerateAll.mutateAsync(dirtyQueue);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[440px] bg-card border-border p-0">
        <SheetHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 font-display text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              VICE Dashboard
            </SheetTitle>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            Visual Intent Creativity Engine
          </p>
        </SheetHeader>

        <Separator />

        {/* Style Contract Status */}
        <div className="px-5 py-3 bg-secondary/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Style Contract
            </span>
            {styleContract ? (
              <Badge variant="outline" className="text-[9px] font-mono">
                v{styleContract.version}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[9px] font-mono">
                None
              </Badge>
            )}
          </div>
          {styleContract?.visual_dna && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
              {String(styleContract.visual_dna)}
            </p>
          )}
        </div>

        <Separator />

        <Tabs defaultValue="dashboard" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 pt-2">
            <TabsList className="w-full h-8 bg-secondary/50">
              <TabsTrigger value="dashboard" className="text-[10px] font-mono flex-1 gap-1.5 data-[state=active]:bg-card">
                <ShieldCheck className="h-3 w-3" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="graph" className="text-[10px] font-mono flex-1 gap-1.5 data-[state=active]:bg-card">
                <GitBranch className="h-3 w-3" />
                Dep Graph
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              {/* Scan Button */}
              <div className="px-5 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-mono"
                  onClick={handleScan}
                  disabled={scanning}
                >
                  <RefreshCw className={cn("h-3 w-3 mr-2", scanning && "animate-spin")} />
                  {scanning ? "Scanning…" : "Run Continuity Scan"}
                </Button>
              </div>

              {/* Conflicts Section */}
              <div className="px-5 pb-2">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" />
                  Conflicts ({conflicts.length})
                </h3>

                {conflictsLoading ? (
                  <p className="text-[10px] text-muted-foreground/50 font-mono py-2">Loading…</p>
                ) : conflicts.length === 0 ? (
                  <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-mono">No conflicts detected</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {conflicts.map((conflict) => {
                      const cfg = conflictTypeConfig[conflict.conflict_type] || { icon: AlertTriangle, label: conflict.conflict_type };
                      const ConflictIcon = cfg.icon;
                      return (
                        <div
                          key={conflict.id}
                          className={cn(
                            "flex items-start gap-2 p-2.5 rounded-lg border text-[10px]",
                            conflict.severity === "error"
                              ? "bg-red-500/5 border-red-500/20"
                              : "bg-amber-500/5 border-amber-500/20"
                          )}
                        >
                          <ConflictIcon className={cn(
                            "h-3.5 w-3.5 mt-0.5 shrink-0",
                            conflict.severity === "error" ? "text-red-400" : "text-amber-400"
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Badge variant="outline" className="text-[8px] px-1 py-0 font-mono">
                                Sc {conflict.scene_number}
                              </Badge>
                              <span className="font-mono text-muted-foreground">{cfg.label}</span>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">{conflict.description}</p>
                          </div>
                          <button
                            onClick={() => resolveConflict.mutate(conflict.id)}
                            className="p-1 rounded hover:bg-accent shrink-0"
                            title="Mark as resolved"
                          >
                            <Check className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator className="my-2" />

              {/* Dirty Queue Section */}
              <div className="px-5 pb-5">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3" />
                  Regeneration Queue ({dirtyQueue.length})
                </h3>

                {dirtyLoading ? (
                  <p className="text-[10px] text-muted-foreground/50 font-mono py-2">Loading…</p>
                ) : dirtyQueue.length === 0 ? (
                  <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-mono">All shots up to date</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {dirtyQueue.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[10px]"
                      >
                        <RefreshCw className="h-3 w-3 text-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-muted-foreground">
                            Shot needs regen — triggered by{" "}
                            <span className="text-foreground font-bold">{`{{${item.triggered_by}}}`}</span>
                          </span>
                          <Badge variant="outline" className="ml-1.5 text-[8px] px-1 py-0 font-mono">
                            {item.trigger_type}
                          </Badge>
                        </div>
                        <button
                          onClick={() => dismissDirty.mutate(item.id)}
                          className="p-1 rounded hover:bg-accent shrink-0"
                          title="Dismiss"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs font-mono mt-2 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={handleRegenerateAll}
                      disabled={regenerating}
                    >
                      <Zap className={cn("h-3 w-3 mr-2", regenerating && "animate-pulse")} />
                      {regenerating ? `Regenerating ${dirtyQueue.length} shot(s)…` : `Regenerate All Dirty (${dirtyQueue.length})`}
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="graph" className="flex-1 overflow-hidden mt-0">
            <ViceDependencyGraph />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default VicePanel;
