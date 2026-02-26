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
}

const GenerationManagerContext = createContext<GenerationManagerContextType>({
  activeGenerations: [],
  hasActiveGenerations: false,
  startGeneration: () => "",
  getGenerationsForShot: () => [],
  clearCompleted: () => {},
});

export const useGenerationManager = () => useContext(GenerationManagerContext);

let genCounter = 0;

export const GenerationManagerProvider = ({ children }: { children: ReactNode }) => {
  const [activeGenerations, setActiveGenerations] = useState<ActiveGeneration[]>([]);

  const hasActiveGenerations = activeGenerations.some((g) => g.status === "running");

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

      // Fire-and-forget the actual generation
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

  return (
    <GenerationManagerContext.Provider
      value={{
        activeGenerations,
        hasActiveGenerations,
        startGeneration,
        getGenerationsForShot,
        clearCompleted,
      }}
    >
      {children}
    </GenerationManagerContext.Provider>
  );
};
