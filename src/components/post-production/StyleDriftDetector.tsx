import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Shot = Tables<"shots">;

interface StyleDriftDetectorProps {
  shots: Shot[];
  contractVersion: number | null;
  filmId: string;
  onRegenerate?: (shotIds: string[]) => void;
}

type DriftStatus = "current" | "outdated" | "unknown";

function getShotDriftStatus(shot: Shot, contractVersion: number | null): DriftStatus {
  if (contractVersion === null) return "unknown";
  const shotVersion = (shot as any).style_contract_version as number | null;
  if (shotVersion === null || shotVersion === undefined) return "unknown";
  if (shotVersion < contractVersion) return "outdated";
  return "current";
}

/* ── Scene Drift Group ── */
function SceneDriftGroup({
  sceneNumber,
  shots,
  contractVersion,
  selectedIds,
  onToggle,
}: {
  sceneNumber: number;
  shots: Shot[];
  contractVersion: number | null;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const outdatedCount = shots.filter((s) => getShotDriftStatus(s, contractVersion) === "outdated").length;
  const unknownCount = shots.filter((s) => getShotDriftStatus(s, contractVersion) === "unknown").length;

  if (outdatedCount === 0 && unknownCount === 0) return null;

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-secondary/60 hover:bg-secondary/80 transition-colors text-left"
      >
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <span className="text-[10px] font-mono font-bold" style={{ color: "#FFD600" }}>
          Scene {sceneNumber}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {outdatedCount > 0 && (
            <Badge variant="destructive" className="text-[8px] px-1.5 py-0 h-4 font-mono">
              {outdatedCount} outdated
            </Badge>
          )}
          {unknownCount > 0 && (
            <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 font-mono">
              {unknownCount} untracked
            </Badge>
          )}
        </div>
      </button>
      {open && (
        <div className="p-2 space-y-1">
          {shots.map((shot, idx) => {
            const status = getShotDriftStatus(shot, contractVersion);
            const shotVersion = (shot as any).style_contract_version as number | null;
            if (status === "current") return null;
            return (
              <label
                key={shot.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                  selectedIds.has(shot.id) ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/60 border border-transparent"
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(shot.id)}
                  onChange={() => onToggle(shot.id)}
                  className="accent-primary h-3 w-3"
                />
                <span className="text-[10px] font-mono text-foreground/80 flex-1">
                  Shot {idx + 1} · {shot.camera_angle || shot.prompt_text?.slice(0, 30) || "Untitled"}
                </span>
                {status === "outdated" ? (
                  <span className="text-[8px] font-mono text-destructive">
                    v{shotVersion} → v{contractVersion}
                  </span>
                ) : (
                  <span className="text-[8px] font-mono text-muted-foreground">
                    no version
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

const StyleDriftDetector = ({ shots, contractVersion, filmId, onRegenerate }: StyleDriftDetectorProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { outdatedShots, unknownShots, currentShots, sceneGroups } = useMemo(() => {
    const outdated: Shot[] = [];
    const unknown: Shot[] = [];
    const current: Shot[] = [];

    for (const shot of shots) {
      const status = getShotDriftStatus(shot, contractVersion);
      if (status === "outdated") outdated.push(shot);
      else if (status === "unknown") unknown.push(shot);
      else current.push(shot);
    }

    // Group by scene
    const grouped = new Map<number, Shot[]>();
    for (const shot of shots) {
      const arr = grouped.get(shot.scene_number) || [];
      arr.push(shot);
      grouped.set(shot.scene_number, arr);
    }

    return {
      outdatedShots: outdated,
      unknownShots: unknown,
      currentShots: current,
      sceneGroups: [...grouped.entries()].sort(([a], [b]) => a - b),
    };
  }, [shots, contractVersion]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOutdated = () => {
    setSelectedIds(new Set([...outdatedShots, ...unknownShots].map((s) => s.id)));
  };

  const handleRegenerate = async () => {
    if (selectedIds.size === 0) return;
    setIsRegenerating(true);
    try {
      // Mark selected shots with current contract version (simulating regeneration)
      const ids = [...selectedIds];
      const { error } = await supabase
        .from("shots")
        .update({ style_contract_version: contractVersion } as any)
        .in("id", ids);

      if (error) throw error;

      toast.success(`Queued ${ids.length} shot${ids.length > 1 ? "s" : ""} for regeneration with Style Contract v${contractVersion}`);
      onRegenerate?.(ids);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error("Failed to queue regeneration: " + err.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const totalDrifted = outdatedShots.length + unknownShots.length;
  const allCurrent = totalDrifted === 0;

  if (contractVersion === null) return null;

  return (
    <div className="space-y-3">
      {/* Summary Banner */}
      <div
        className={cn(
          "rounded-lg border p-3 flex items-center gap-3",
          allCurrent
            ? "border-primary/30 bg-primary/5"
            : "border-destructive/30 bg-destructive/5"
        )}
      >
        {allCurrent ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] font-mono font-bold text-primary">All shots current</p>
              <p className="text-[9px] font-mono text-muted-foreground">
                {shots.length} shot{shots.length !== 1 ? "s" : ""} aligned with Style Contract v{contractVersion}
              </p>
            </div>
            <Shield className="h-4 w-4 text-primary/40" />
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] font-mono font-bold text-destructive">
                Style drift detected
              </p>
              <p className="text-[9px] font-mono text-muted-foreground">
                {outdatedShots.length} outdated · {unknownShots.length} untracked · {currentShots.length} current — Contract v{contractVersion}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Scene Groups */}
      {!allCurrent && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Drifted Shots by Scene
            </span>
            <button
              onClick={selectAllOutdated}
              className="text-[9px] font-mono text-primary hover:text-primary/80 transition-colors"
            >
              Select all ({totalDrifted})
            </button>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {sceneGroups.map(([sceneNum, sceneShots]) => (
              <SceneDriftGroup
                key={sceneNum}
                sceneNumber={sceneNum}
                shots={sceneShots}
                contractVersion={contractVersion}
                selectedIds={selectedIds}
                onToggle={toggleId}
              />
            ))}
          </div>

          {/* Regenerate Action */}
          <Button
            onClick={handleRegenerate}
            disabled={selectedIds.size === 0 || isRegenerating}
            className={cn(
              "w-full h-9 text-[10px] font-mono font-bold uppercase tracking-widest gap-2",
              "shadow-[0_0_16px_-4px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_24px_-4px_hsl(var(--primary)/0.45)]"
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
            {isRegenerating
              ? "Queuing…"
              : `Regenerate ${selectedIds.size} shot${selectedIds.size !== 1 ? "s" : ""} with current style`}
          </Button>
        </>
      )}
    </div>
  );
};

export default StyleDriftDetector;
