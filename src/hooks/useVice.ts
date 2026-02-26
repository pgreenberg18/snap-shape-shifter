import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFilmId } from "@/hooks/useFilm";
import { supabase } from "@/integrations/supabase/client";

/* ── VICE Status Types ── */
export type ViceStatus = "active" | "updating" | "conflict";

export interface ViceConflict {
  id: string;
  scene_number: number;
  shot_id: string | null;
  conflict_type: string;
  description: string;
  severity: string;
  resolved: boolean;
  created_at: string;
}

export interface ViceDirtyItem {
  id: string;
  shot_id: string;
  triggered_by: string;
  trigger_type: string;
  status: string;
  created_at: string;
}

/* ── Fetch unresolved conflicts ── */
export const useViceConflicts = () => {
  const filmId = useFilmId();
  return useQuery({
    queryKey: ["vice-conflicts", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vice_conflicts")
        .select("*")
        .eq("film_id", filmId!)
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ViceConflict[];
    },
    enabled: !!filmId,
    refetchInterval: 15000,
  });
};

/* ── Fetch pending dirty queue ── */
export const useViceDirtyQueue = () => {
  const filmId = useFilmId();
  return useQuery({
    queryKey: ["vice-dirty-queue", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vice_dirty_queue")
        .select("*")
        .eq("film_id", filmId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ViceDirtyItem[];
    },
    enabled: !!filmId,
    refetchInterval: 15000,
  });
};

/* ── Derive overall VICE status ── */
export const useViceStatus = (): ViceStatus => {
  const { data: conflicts } = useViceConflicts();
  const { data: dirtyQueue } = useViceDirtyQueue();

  const hasErrors = conflicts?.some((c) => c.severity === "error");
  const hasDirty = (dirtyQueue?.length ?? 0) > 0;
  const hasWarnings = (conflicts?.length ?? 0) > 0;

  if (hasErrors) return "conflict";
  if (hasDirty) return "updating";
  if (hasWarnings) return "updating";
  return "active";
};

/* ── Resolve a conflict ── */
export const useResolveConflict = () => {
  const queryClient = useQueryClient();
  const filmId = useFilmId();

  return useMutation({
    mutationFn: async (conflictId: string) => {
      const { error } = await supabase
        .from("vice_conflicts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", conflictId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vice-conflicts", filmId] });
    },
  });
};

/* ── Dismiss a dirty queue item ── */
export const useDismissDirtyItem = () => {
  const queryClient = useQueryClient();
  const filmId = useFilmId();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("vice_dirty_queue")
        .update({ status: "dismissed", resolved_at: new Date().toISOString() })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vice-dirty-queue", filmId] });
    },
  });
};

/* ── Run conflict detection ── */
export const useDetectConflicts = () => {
  const queryClient = useQueryClient();
  const filmId = useFilmId();

  return useMutation({
    mutationFn: async (sceneNumber?: number) => {
      const { data, error } = await supabase.functions.invoke("detect-continuity-conflicts", {
        body: { film_id: filmId, scene_number: sceneNumber },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vice-conflicts", filmId] });
    },
  });
};

/* ── Propagate intent change ── */
export const usePropagateChange = () => {
  const queryClient = useQueryClient();
  const filmId = useFilmId();

  return useMutation({
    mutationFn: async ({ sourceToken, triggerType }: { sourceToken: string; triggerType?: string }) => {
      const { data, error } = await supabase.functions.invoke("propagate-intent-change", {
        body: { film_id: filmId, source_token: sourceToken, trigger_type: triggerType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vice-dirty-queue", filmId] });
    },
  });
};
