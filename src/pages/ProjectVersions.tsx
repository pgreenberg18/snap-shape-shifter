import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Copy, ArrowLeft, Film, Calendar, Trash2, Pencil, Check, X,
  HelpCircle, Settings, Archive, ArchiveRestore, HardDrive, ChevronDown, ChevronRight,
} from "lucide-react";
import { useHelp } from "@/components/help/HelpPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/* ── Size estimation helpers ── */
const estimateJsonBytes = (val: unknown): number => {
  if (val == null) return 0;
  try { return new Blob([JSON.stringify(val)]).size; } catch { return 0; }
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const ProjectVersions = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionNameError, setVersionNameError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: versions, isLoading } = useQuery({
    queryKey: ["versions", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("films")
        .select("*")
        .eq("project_id", projectId!)
        .order("version_number", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  /* ── Size estimation query: count related rows per film ── */
  const { data: sizeData } = useQuery({
    queryKey: ["version-sizes", projectId],
    queryFn: async () => {
      const filmIds = versions?.map((v) => v.id) || [];
      if (!filmIds.length) return {};

      const [chars, shots, analyses, safety, assets, clips, templates, scenes, filmAssets, provSelections] = await Promise.all([
        supabase.from("characters").select("film_id, description, image_url, reference_image_url").in("film_id", filmIds),
        supabase.from("shots").select("film_id, prompt_text, video_url").in("film_id", filmIds),
        supabase.from("script_analyses").select("film_id, scene_breakdown, global_elements, ai_generation_notes, visual_summary, storage_path").in("film_id", filmIds),
        supabase.from("content_safety").select("film_id").in("film_id", filmIds),
        supabase.from("asset_identity_registry").select("film_id, description, reference_image_url").in("film_id", filmIds),
        supabase.from("post_production_clips").select("film_id, label").in("film_id", filmIds),
        // Join through shots for templates
        supabase.from("shots").select("film_id, id").in("film_id", filmIds),
        supabase.from("parsed_scenes").select("film_id, raw_text, heading").in("film_id", filmIds),
        supabase.from("film_assets").select("film_id, image_url, description").in("film_id", filmIds),
        supabase.from("version_provider_selections").select("film_id").in("film_id", filmIds),
      ]);

      const sizes: Record<string, number> = {};
      for (const fid of filmIds) sizes[fid] = 0;

      // Estimate data sizes per version
      const addRows = (rows: any[] | null, estimator: (r: any) => number) => {
        for (const r of rows || []) {
          if (r.film_id && sizes[r.film_id] !== undefined) {
            sizes[r.film_id] += estimator(r);
          }
        }
      };

      // ~200 bytes base per row + field contents
      addRows(chars.data, (r) => 200 + estimateJsonBytes(r.description) + (r.image_url?.length || 0) + (r.reference_image_url?.length || 0));
      addRows(shots.data, (r) => 150 + estimateJsonBytes(r.prompt_text) + (r.video_url?.length || 0));
      addRows(analyses.data, (r) => 300 + estimateJsonBytes(r.scene_breakdown) + estimateJsonBytes(r.global_elements) + estimateJsonBytes(r.ai_generation_notes) + (r.visual_summary?.length || 0));
      addRows(safety.data, () => 100);
      addRows(assets.data, (r) => 200 + estimateJsonBytes(r.description) + (r.reference_image_url?.length || 0));
      addRows(clips.data, (r) => 100 + (r.label?.length || 0));
      addRows(scenes.data, (r) => 100 + (r.raw_text?.length || 0) + (r.heading?.length || 0));
      addRows(filmAssets.data, (r) => 150 + (r.image_url?.length || 0) + estimateJsonBytes(r.description));
      addRows(provSelections.data, () => 80);

      return sizes;
    },
    enabled: !!versions?.length,
  });

  const activeVersions = useMemo(() => versions?.filter((v) => !v.is_archived) || [], [versions]);
  const archivedVersions = useMemo(() => versions?.filter((v) => v.is_archived) || [], [versions]);

  const totalProjectSize = useMemo(() => {
    if (!sizeData) return 0;
    return Object.values(sizeData).reduce((sum, s) => sum + s, 0);
  }, [sizeData]);

  const isDuplicateName = (name: string, excludeId?: string) => {
    if (!versions) return false;
    const normalized = name.trim().toLowerCase();
    return versions.some(
      (v) => v.id !== excludeId && (v.version_name || `Version ${v.version_number}`).toLowerCase() === normalized
    );
  };

  const createVersion = useMutation({
    mutationFn: async () => {
      const nextNum = (versions?.length || 0) + 1;
      const name = versionName.trim() || `Version ${nextNum}`;
      if (isDuplicateName(name)) throw new Error(`A version named "${name}" already exists`);
      const { data, error } = await supabase
        .from("films")
        .insert({ title: project?.title || "Untitled", project_id: projectId!, version_number: nextNum, version_name: name })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (film) => {
      queryClient.invalidateQueries({ queryKey: ["versions", projectId] });
      setNewVersionOpen(false); setVersionName(""); setVersionNameError("");
      toast.success("Version created");
      navigate(`/projects/${projectId}/versions/${film.id}/development`);
    },
    onError: (e) => { setVersionNameError(e.message); toast.error(e.message); },
  });

  const renameVersion = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name cannot be empty");
      if (isDuplicateName(trimmed, id)) throw new Error(`"${trimmed}" already exists`);
      const { error } = await supabase.from("films").update({ version_name: trimmed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["versions", projectId] }); setRenamingId(null); toast.success("Version renamed"); },
    onError: (e) => toast.error(e.message),
  });

  const copyVersion = useMutation({
    mutationFn: async (sourceFilmId: string) => {
      const nextNum = (versions?.length || 0) + 1;
      const { data: newFilm, error: filmErr } = await supabase
        .from("films")
        .insert({ title: project?.title || "Untitled", project_id: projectId!, version_number: nextNum, version_name: `Version ${nextNum} (copy)`, copied_from_version_id: sourceFilmId })
        .select().single();
      if (filmErr) throw filmErr;
      const { data: chars } = await supabase.from("characters").select("*").eq("film_id", sourceFilmId);
      if (chars?.length) await supabase.from("characters").insert(chars.map(({ id, created_at, ...c }) => ({ ...c, film_id: newFilm.id })));
      const { data: shots } = await supabase.from("shots").select("*").eq("film_id", sourceFilmId);
      if (shots?.length) await supabase.from("shots").insert(shots.map(({ id, created_at, ...s }) => ({ ...s, film_id: newFilm.id })));
      const { data: analyses } = await supabase.from("script_analyses").select("*").eq("film_id", sourceFilmId);
      if (analyses?.length) await supabase.from("script_analyses").insert(analyses.map(({ id, created_at, updated_at, ...a }) => ({ ...a, film_id: newFilm.id })));
      const { data: safety } = await supabase.from("content_safety").select("*").eq("film_id", sourceFilmId);
      if (safety?.length) await supabase.from("content_safety").insert(safety.map(({ id, updated_at, ...s }) => ({ ...s, film_id: newFilm.id })));
      const { data: assets } = await supabase.from("asset_identity_registry").select("*").eq("film_id", sourceFilmId);
      if (assets?.length) await supabase.from("asset_identity_registry").insert(assets.map(({ id, created_at, updated_at, ...a }) => ({ ...a, film_id: newFilm.id })));
      const { data: clips } = await supabase.from("post_production_clips").select("*").eq("film_id", sourceFilmId);
      if (clips?.length) await supabase.from("post_production_clips").insert(clips.map(({ id, created_at, ...c }) => ({ ...c, film_id: newFilm.id })));
      return newFilm;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["versions", projectId] }); toast.success("Version copied"); },
    onError: (e) => toast.error(e.message),
  });

  const archiveVersion = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase.from("films").update({ is_archived: archive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["versions", projectId] });
      toast.success(vars.archive ? "Version archived" : "Version restored");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteVersion = useMutation({
    mutationFn: async (filmId: string) => {
      await Promise.all([
        supabase.from("characters").delete().eq("film_id", filmId),
        supabase.from("shots").delete().eq("film_id", filmId),
        supabase.from("script_analyses").delete().eq("film_id", filmId),
        supabase.from("content_safety").delete().eq("film_id", filmId),
        supabase.from("asset_identity_registry").delete().eq("film_id", filmId),
        supabase.from("post_production_clips").delete().eq("film_id", filmId),
        supabase.from("version_provider_selections").delete().eq("film_id", filmId),
      ]);
      const { error } = await supabase.from("films").delete().eq("id", filmId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["version-sizes", projectId] });
      setDeleteTarget(null);
      toast.success("Version deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const { toggle: toggleHelp } = useHelp();

  /* ── Reusable version card ── */
  const renderVersionCard = (v: NonNullable<typeof versions>[number], isArchived: boolean) => {
    const versionSize = sizeData?.[v.id] || 0;
    return (
      <div
        key={v.id}
        className={`group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200 ${
          isArchived ? "border-border/50 opacity-75" : "border-border hover:border-primary/40 hover:cinema-glow"
        }`}
      >
        <button
          onClick={() => renamingId !== v.id && navigate(`/projects/${projectId}/versions/${v.id}/development`)}
          className="flex flex-1 flex-col text-left"
        >
          <div className="flex h-16 items-center justify-center bg-secondary">
            <Film className="h-6 w-6 text-muted-foreground/40 transition-colors group-hover:text-primary/60" />
          </div>
          <div className="flex flex-1 flex-col p-3">
            {renamingId === v.id ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameVersion.mutate({ id: v.id, name: renameValue });
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => renameVersion.mutate({ id: v.id, name: renameValue })}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setRenamingId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <h3 className="font-display text-sm font-semibold text-foreground">
                {v.version_name || `Version ${v.version_number}`}
              </h3>
            )}
            <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(v.created_at).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1" title="Estimated data size">
                <HardDrive className="h-3 w-3" />
                {formatBytes(versionSize)}
              </span>
            </div>
          </div>
        </button>
        <div className="border-t border-border p-2 flex items-center gap-1">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); setRenamingId(v.id); setRenameValue(v.version_name || `Version ${v.version_number}`); }}>
            <Pencil className="h-3 w-3" /> Rename
          </Button>
          {!isArchived && (
            <Button variant="ghost" size="sm" className="flex-1 gap-2 text-xs" onClick={() => copyVersion.mutate(v.id)} disabled={copyVersion.isPending}>
              <Copy className="h-3 w-3" /> {copyVersion.isPending ? "Copying…" : "Duplicate"}
            </Button>
          )}
          <Button
            variant="ghost" size="sm" className="gap-1.5 text-xs"
            onClick={(e) => { e.stopPropagation(); archiveVersion.mutate({ id: v.id, archive: !isArchived }); }}
            title={isArchived ? "Restore from archive" : "Move to archive"}
          >
            {isArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost" size="sm"
            className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: v.id, name: v.version_name || `Version ${v.version_number}` }); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex h-full w-16 flex-col items-center border-r border-border bg-card py-4">
        <button onClick={() => navigate("/projects")} title="Back to projects" className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1" />
        <div className="flex flex-col items-center gap-1 mb-2">
          <button onClick={toggleHelp} title="Help" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200">
            <HelpCircle className="h-5 w-5" />
          </button>
          <button onClick={() => navigate("/settings")} title="Global Settings" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-border bg-card px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {project?.title || "Loading…"}
              </h1>
              <div className="flex items-center gap-4 mt-1">
                {project?.description && (
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Total estimated project size">
                  <HardDrive className="h-3.5 w-3.5" />
                  {formatBytes(totalProjectSize)}
                </span>
              </div>
            </div>
            <Dialog open={newVersionOpen} onOpenChange={(o) => { setNewVersionOpen(o); if (!o) { setVersionNameError(""); setVersionName(""); } }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />New Version</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create New Version</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium text-foreground">Version Name</label>
                    <Input value={versionName} onChange={(e) => { setVersionName(e.target.value); if (versionNameError) setVersionNameError(""); }} placeholder={`Version ${(versions?.length || 0) + 1}`} className="mt-1" />
                    {versionNameError && <p className="text-xs text-destructive mt-1">{versionNameError}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">This creates a blank version. Upload a new script in the Development phase.</p>
                  <Button onClick={() => { const name = versionName.trim() || `Version ${(versions?.length || 0) + 1}`; if (isDuplicateName(name)) { setVersionNameError(`A version named "${name}" already exists`); return; } createVersion.mutate(); }} disabled={createVersion.isPending} className="w-full">
                    {createVersion.isPending ? "Creating…" : "Create Version"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-card" />)}
            </div>
          ) : (
            <>
              {/* Active versions */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {activeVersions.map((v) => renderVersionCard(v, false))}
              </div>

              {/* Archived section */}
              {archivedVersions.length > 0 && (
                <div>
                  <button
                    onClick={() => setArchiveOpen(!archiveOpen)}
                    className="flex items-center gap-2 text-sm font-display font-semibold text-muted-foreground hover:text-foreground transition-colors mb-4"
                  >
                    {archiveOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Archive className="h-4 w-4" />
                    Archived ({archivedVersions.length})
                  </button>
                  {archiveOpen && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {archivedVersions.map((v) => renderVersionCard(v, true))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Version?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>"{deleteTarget?.name}"</strong> and all its data. This action cannot be undone. Consider archiving instead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTarget && deleteVersion.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleteVersion.isPending ? "Deleting…" : "Delete Version"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ProjectVersions;
