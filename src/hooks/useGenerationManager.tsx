import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type GenerationMode = "anchor" | "animate" | "targeted_edit";

export interface ActiveGeneration {
  id: string;
  shotId: string;
  mode: GenerationMode;
  status: "running" | "complete" | "error";
  startedAt: number;
  result?: {
    output_urls?: string[];
    scores?: unknown[];
    generation_id?: string;
    seed?: number;
    engine?: string;
    compile_hash?: string;
  };
  error?: string;
}

/* ── Asset Audition Background Task ── */
export interface AssetAuditionTask {
  id: string;
  filmId: string;
  assetType: string;
  assetName: string;
  characterId?: string;
  status: "running" | "complete" | "error";
  startedAt: number;
  options?: Array<{
    id: string;
    name: string;
    description: string;
    image_url: string;
    option_index: number;
  }>;
  error?: string;
}

interface GenerationManagerContextType {
  activeGenerations: ActiveGeneration[];
  hasActiveGenerations: boolean;
  startGeneration: (
    shotId: string,
    mode: GenerationMode,
    body: Record<string, unknown>,
    onComplete?: (gen: ActiveGeneration) => void
  ) => string;
  getGenerationsForShot: (shotId: string) => ActiveGeneration[];
  clearCompleted: () => void;

  /* Asset audition */
  assetAuditions: AssetAuditionTask[];
  startAssetAudition: (
    filmId: string,
    assetType: string,
    assetName: string,
    characterId?: string,
    onComplete?: (task: AssetAuditionTask) => void
  ) => string;
  getAssetAudition: (filmId: string, assetType: string, assetName: string) => AssetAuditionTask | undefined;
  clearAssetAudition: (filmId: string, assetType: string, assetName: string) => void;
}

const GenerationManagerContext = createContext<GenerationManagerContextType>({
  activeGenerations: [],
  hasActiveGenerations: false,
  startGeneration: () => "",
  getGenerationsForShot: () => [],
  clearCompleted: () => {},
  assetAuditions: [],
  startAssetAudition: () => "",
  getAssetAudition: () => undefined,
  clearAssetAudition: () => {},
});

export const useGenerationManager = () => useContext(GenerationManagerContext);

let genCounter = 0;

export const GenerationManagerProvider = ({ children }: { children: ReactNode }) => {
  const [activeGenerations, setActiveGenerations] = useState<ActiveGeneration[]>([]);
  const [assetAuditions, setAssetAuditions] = useState<AssetAuditionTask[]>([]);

  const hasActiveGenerations =
    activeGenerations.some((g) => g.status === "running") ||
    assetAuditions.some((a) => a.status === "running");

  const startGeneration = useCallback(
    (
      shotId: string,
      mode: GenerationMode,
      body: Record<string, unknown>,
      onComplete?: (gen: ActiveGeneration) => void
    ): string => {
      const id = `gen-${++genCounter}-${Date.now()}`;
      const gen: ActiveGeneration = {
        id,
        shotId,
        mode,
        status: "running",
        startedAt: Date.now(),
      };

      setActiveGenerations((prev) => [...prev, gen]);

      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke("orchestrate-generation", { body });
          if (error) throw error;

          const completed: ActiveGeneration = {
            ...gen,
            status: "complete",
            result: {
              output_urls: data?.output_urls,
              scores: data?.scores,
              generation_id: data?.generation_id,
              seed: data?.seed,
              engine: data?.engine,
              compile_hash: data?.compile_hash,
            },
          };

          setActiveGenerations((prev) =>
            prev.map((g) => (g.id === id ? completed : g))
          );

          const modeLabel = mode === "anchor" ? "Anchor frames" : mode === "animate" ? "Video" : "Repair";
          toast.success(`${modeLabel} generation complete`, {
            description: "Your shot is ready to review.",
          });

          onComplete?.(completed);
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          setActiveGenerations((prev) =>
            prev.map((g) =>
              g.id === id ? { ...g, status: "error" as const, error: errorMsg } : g
            )
          );
          toast.error("Generation failed", { description: errorMsg });
        }
      })();

      return id;
    },
    []
  );

  const getGenerationsForShot = useCallback(
    (shotId: string) => activeGenerations.filter((g) => g.shotId === shotId),
    [activeGenerations]
  );

  const clearCompleted = useCallback(() => {
    setActiveGenerations((prev) => prev.filter((g) => g.status === "running"));
  }, []);

  /* ── Asset Audition Methods ── */

  const assetKey = (filmId: string, assetType: string, assetName: string) =>
    `${filmId}::${assetType}::${assetName}`;

  const getAssetAudition = useCallback(
    (filmId: string, assetType: string, assetName: string) => {
      const key = assetKey(filmId, assetType, assetName);
      return assetAuditions.find(
        (a) => assetKey(a.filmId, a.assetType, a.assetName) === key
      );
    },
    [assetAuditions]
  );

  const clearAssetAudition = useCallback(
    (filmId: string, assetType: string, assetName: string) => {
      const key = assetKey(filmId, assetType, assetName);
      setAssetAuditions((prev) =>
        prev.filter((a) => assetKey(a.filmId, a.assetType, a.assetName) !== key)
      );
    },
    []
  );

  const startAssetAudition = useCallback(
    (
      filmId: string,
      assetType: string,
      assetName: string,
      characterId?: string,
      onComplete?: (task: AssetAuditionTask) => void
    ): string => {
      const id = `asset-${++genCounter}-${Date.now()}`;
      const key = assetKey(filmId, assetType, assetName);

      const task: AssetAuditionTask = {
        id,
        filmId,
        assetType,
        assetName,
        characterId,
        status: "running",
        startedAt: Date.now(),
      };

      // Replace any existing task for same asset
      setAssetAuditions((prev) => [
        ...prev.filter((a) => assetKey(a.filmId, a.assetType, a.assetName) !== key),
        task,
      ]);

      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke("generate-asset-options", {
            body: { film_id: filmId, asset_type: assetType, asset_name: assetName, character_id: characterId },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          const completed: AssetAuditionTask = {
            ...task,
            status: "complete",
            options: data.options || [],
          };

          setAssetAuditions((prev) =>
            prev.map((a) => (a.id === id ? completed : a))
          );

          toast.success(`${data.options?.length || 0} options generated for ${assetName}`);
          onComplete?.(completed);
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          setAssetAuditions((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, status: "error" as const, error: errorMsg } : a
            )
          );
          toast.error(`Failed to generate options for ${assetName}`, { description: errorMsg });
        }
      })();

      return id;
    },
    []
  );

  return (
    <GenerationManagerContext.Provider
      value={{
        activeGenerations,
        hasActiveGenerations,
        startGeneration,
        getGenerationsForShot,
        clearCompleted,
        assetAuditions,
        startAssetAudition,
        getAssetAudition,
        clearAssetAudition,
      }}
    >
      {children}
    </GenerationManagerContext.Provider>
  );
};
