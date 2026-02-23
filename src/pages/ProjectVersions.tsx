import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Copy, ArrowLeft, Film, Calendar, Trash2 } from "lucide-react";
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

const ProjectVersions = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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

  const createVersion = useMutation({
    mutationFn: async () => {
      const nextNum = (versions?.length || 0) + 1;
      const name = versionName.trim() || `Version ${nextNum}`;
      const { data, error } = await supabase
        .from("films")
        .insert({
          title: project?.title || "Untitled",
          project_id: projectId!,
          version_number: nextNum,
          version_name: name,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (film) => {
      queryClient.invalidateQueries({ queryKey: ["versions", projectId] });
      setNewVersionOpen(false);
      setVersionName("");
      toast.success("Version created");
      navigate(`/projects/${projectId}/versions/${film.id}/development`);
    },
    onError: (e) => toast.error(e.message),
  });

  const copyVersion = useMutation({
    mutationFn: async (sourceFilmId: string) => {
      const nextNum = (versions?.length || 0) + 1;
      const { data: newFilm, error: filmErr } = await supabase
        .from("films")
        .insert({
          title: project?.title || "Untitled",
          project_id: projectId!,
          version_number: nextNum,
          version_name: `Version ${nextNum} (copy)`,
          copied_from_version_id: sourceFilmId,
        })
        .select()
        .single();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versions", projectId] });
      toast.success("Version copied");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteVersion = useMutation({
    mutationFn: async (filmId: string) => {
      // Delete all related data
      await Promise.all([
        supabase.from("characters").delete().eq("film_id", filmId),
        supabase.from("shots").delete().eq("film_id", filmId),
        supabase.from("script_analyses").delete().eq("film_id", filmId),
        supabase.from("content_safety").delete().eq("film_id", filmId),
        supabase.from("asset_identity_registry").delete().eq("film_id", filmId),
        supabase.from("post_production_clips").delete().eq("film_id", filmId),
      ]);
      const { error } = await supabase.from("films").delete().eq("id", filmId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versions", projectId] });
      setDeleteTarget(null);
      toast.success("Version deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {project?.title || "Loading…"}
            </h1>
            {project?.description && (
              <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <Dialog open={newVersionOpen} onOpenChange={setNewVersionOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />New Version</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New Version</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-foreground">Version Name</label>
                  <Input value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder={`Version ${(versions?.length || 0) + 1}`} className="mt-1" />
                </div>
                <p className="text-xs text-muted-foreground">This creates a blank version. Upload a new script in the Development phase.</p>
                <Button onClick={() => createVersion.mutate()} disabled={createVersion.isPending} className="w-full">
                  {createVersion.isPending ? "Creating…" : "Create Version"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="p-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {versions?.map((v) => (
              <div
                key={v.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-primary/40 hover:cinema-glow"
              >
                <button
                  onClick={() => navigate(`/projects/${projectId}/versions/${v.id}/development`)}
                  className="flex flex-1 flex-col text-left"
                >
                  <div className="flex h-24 items-center justify-center bg-secondary">
                    <Film className="h-8 w-8 text-muted-foreground/40 transition-colors group-hover:text-primary/60" />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      {v.version_name || `Version ${v.version_number}`}
                    </h3>
                    <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(v.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </button>
                <div className="border-t border-border p-2 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-2 text-xs"
                    onClick={() => copyVersion.mutate(v.id)}
                    disabled={copyVersion.isPending}
                  >
                    <Copy className="h-3 w-3" />
                    {copyVersion.isPending ? "Copying…" : "Duplicate"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ id: v.id, name: v.version_name || `Version ${v.version_number}` });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>"{deleteTarget?.name}"</strong> and all its scenes, characters, shots, and analysis data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteVersion.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteVersion.isPending ? "Deleting…" : "Delete Version"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectVersions;
