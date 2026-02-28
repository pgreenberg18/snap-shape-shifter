import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Sparkles, Lock, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useGenerationManager } from "@/hooks/useGenerationManager";

interface AssetOption {
  id: string;
  name: string;
  description: string;
  image_url: string;
  option_index: number;
}

interface AssetAuditionPaneProps {
  filmId: string;
  assetType: "location" | "prop" | "wardrobe" | "vehicle";
  assetName: string;
  characterId?: string;
  onLock?: (option: AssetOption) => void;
}

/* ── Cloth Reveal Skeleton ── */
const ClothSkeleton = () => (
  <div className="aspect-[4/5] rounded-xl overflow-hidden relative bg-secondary">
    {/* Cloth fabric layers */}
    <div className="absolute inset-0 cloth-shimmer" />
    <div className="absolute inset-0 cloth-wave" />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary/60 animate-pulse" />
        <span className="text-[10px] font-display uppercase tracking-widest text-muted-foreground/70">
          Generating
        </span>
      </div>
    </div>
  </div>
);

const AssetAuditionPane = ({ filmId, assetType, assetName, characterId, onLock }: AssetAuditionPaneProps) => {
  const [options, setOptions] = useState<AssetOption[]>([]);
  const [lockedIndex, setLockedIndex] = useState<number | null>(null);
  const [lockingIndex, setLockingIndex] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState<Record<number, boolean>>({});

  const { startAssetAudition, getAssetAudition } = useGenerationManager();
  const task = getAssetAudition(filmId, assetType, assetName);
  const loading = task?.status === "running";

  // Sync completed task results into local state
  useEffect(() => {
    if (task?.status === "complete" && task.options && task.options.length > 0) {
      setOptions(task.options);
      setImageLoaded({});
    }
  }, [task?.status, task?.options]);

  const generate = useCallback(() => {
    setOptions([]);
    setLockedIndex(null);
    setImageLoaded({});
    startAssetAudition(filmId, assetType, assetName, characterId);
  }, [filmId, assetType, assetName, characterId, startAssetAudition]);

  const lockOption = useCallback(async (option: AssetOption) => {
    setLockingIndex(option.option_index);
    try {
      await supabase
        .from("film_assets")
        .delete()
        .eq("film_id", filmId)
        .eq("asset_type", assetType)
        .eq("asset_name", assetName);

      const { error } = await supabase.from("film_assets").insert({
        film_id: filmId,
        asset_type: assetType,
        asset_name: assetName,
        character_id: characterId || null,
        option_index: option.option_index,
        description: option.description,
        image_url: option.image_url,
        locked: true,
      });

      if (error) throw error;
      setLockedIndex(option.option_index);
      toast.success(`"${option.description}" locked for ${assetName}`);
      onLock?.(option);
    } catch (e: any) {
      toast.error(e.message || "Failed to lock option");
    } finally {
      setLockingIndex(null);
    }
  }, [filmId, assetType, assetName, characterId]);

  if (options.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <Button onClick={generate} className="gap-2" disabled={loading}>
          <Sparkles className="h-4 w-4" />
          Generate Options
        </Button>
        <p className="text-xs text-muted-foreground">
          Generate 5 deterministic variations for <span className="font-semibold">{assetName}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-display font-semibold uppercase tracking-wider">
          {assetName} — {loading ? "generating…" : `${options.length} options`}
        </p>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Regenerate
        </Button>
      </div>

      {/* Loading state — cloth animation */}
      {loading && (
        <div className={cn("grid gap-3", assetType === "wardrobe" ? "grid-cols-5" : "grid-cols-2 lg:grid-cols-3")}>
          {[0, 1, 2, 3, 4].map((i) => (
            <ClothSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Options grid */}
      {!loading && (
        <ScrollArea className="max-h-[500px]">
          <div className={cn("grid gap-3", assetType === "wardrobe" ? "grid-cols-5" : "grid-cols-2 lg:grid-cols-3")}>
            {options.map((opt) => {
              const isLocked = lockedIndex === opt.option_index;
              const isLocking = lockingIndex === opt.option_index;
              const loaded = imageLoaded[opt.option_index];
              return (
                <button
                  key={opt.id}
                  onClick={() => lockOption(opt)}
                  disabled={isLocking}
                  className={cn(
                    "group relative rounded-xl border overflow-hidden transition-all text-left",
                    isLocked
                      ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                      : "border-border hover:border-primary/50 hover:ring-1 hover:ring-primary/20 bg-card"
                  )}
                >
                  {/* Image with cloth reveal */}
                  <div className={cn("overflow-hidden bg-secondary relative", assetType === "wardrobe" ? "aspect-[4/5]" : "aspect-square")}>
                    {!loaded && (
                      <div className="absolute inset-0 cloth-shimmer z-10" />
                    )}
                    <img
                      src={opt.image_url}
                      alt={opt.description}
                      className={cn(
                        "h-full w-full object-cover transition-all duration-700",
                        loaded
                          ? "opacity-100 scale-100"
                          : "opacity-0 scale-105"
                      )}
                      loading="lazy"
                      onLoad={() =>
                        setImageLoaded((prev) => ({ ...prev, [opt.option_index]: true }))
                      }
                    />
                  </div>

                  {/* Description */}
                  <div className="p-2.5">
                    <p className="text-xs font-display font-semibold text-foreground leading-snug">
                      {opt.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Option {opt.option_index + 1}
                    </p>
                  </div>

                  {/* Locked badge */}
                  {isLocked && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-lg">
                      <Lock className="h-2.5 w-2.5" /> Locked
                    </div>
                  )}

                  {/* Loading overlay */}
                  {isLocking && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default AssetAuditionPane;
