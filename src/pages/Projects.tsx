import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Plus, FolderOpen, Calendar, Trash2, Pencil, Check, X,
  Film, Settings, HelpCircle, User, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useHelp } from "@/components/help/HelpPanel";
import { useAuth } from "@/hooks/useAuth";

const Projects = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toggle: toggleHelp } = useHelp();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: versionCounts } = useQuery({
    queryKey: ["project-version-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("films").select("project_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const f of data || []) {
        if (f.project_id) counts[f.project_id] = (counts[f.project_id] || 0) + 1;
      }
      return counts;
    },
  });

  const createProject = useMutation({
    mutationFn: async () => {
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .insert({ title, description: description || null })
        .select()
        .single();
      if (projErr) throw projErr;
      const { error: filmErr } = await supabase.from("films").insert({
        title,
        project_id: project.id,
        version_number: 1,
        version_name: "Version 1",
      });
      if (filmErr) throw filmErr;
      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      toast.success("Project created");
      navigate(`/projects/${project.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const renameProject = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name cannot be empty");
      const { error } = await supabase.from("projects").update({ title: trimmed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setRenamingId(null);
      toast.success("Project renamed");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProject = useMutation({
    mutationFn: async (projectId: string) => {
      const { data: films } = await supabase
        .from("films")
        .select("id")
        .eq("project_id", projectId);
      const filmIds = (films || []).map((f) => f.id);

      if (filmIds.length > 0) {
        await Promise.all([
          supabase.from("characters").delete().in("film_id", filmIds),
          supabase.from("shots").delete().in("film_id", filmIds),
          supabase.from("script_analyses").delete().in("film_id", filmIds),
          supabase.from("content_safety").delete().in("film_id", filmIds),
          supabase.from("asset_identity_registry").delete().in("film_id", filmIds),
          supabase.from("post_production_clips").delete().in("film_id", filmIds),
          supabase.from("ai_generation_templates").delete().in("shot_id",
            (await supabase.from("shots").select("id").in("film_id", filmIds)).data?.map(s => s.id) || []
          ),
        ]);
        await supabase.from("films").delete().eq("project_id", projectId);
      }
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-version-counts"] });
      setDeleteTarget(null);
      toast.success("Project deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Left sidebar: User section + bottom icons ── */}
      <aside className="flex h-full w-72 flex-col border-r border-border bg-card">
        {/* User profile area */}
        <div className="border-b border-border p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-semibold text-foreground truncate">
                {user?.email?.split("@")[0] || "Director"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {user?.email || "Welcome back"}
              </p>
            </div>
          </div>
          {user && (
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>

        {/* Stats / quick info */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-3">
              Studio Overview
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
                <span className="text-xs text-muted-foreground">Film Projects</span>
                <span className="text-sm font-display font-bold text-foreground">
                  {projects?.length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
                <span className="text-xs text-muted-foreground">Total Versions</span>
                <span className="text-sm font-display font-bold text-foreground">
                  {Object.values(versionCounts || {}).reduce((s, n) => s + n, 0)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Quick Actions
            </h3>
            <div className="space-y-1">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent transition-colors">
                    <Plus className="h-4 w-4 text-primary" />
                    New Project
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create New Project</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm font-medium text-foreground">Title</label>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Film title…" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Description</label>
                      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description…" className="mt-1" />
                    </div>
                    <Button onClick={() => createProject.mutate()} disabled={!title.trim() || createProject.isPending} className="w-full">
                      {createProject.isPending ? "Creating…" : "Create Project"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>


        {/* Bottom icons: Help + Settings */}
        <div className="border-t border-border p-3 flex items-center gap-1">
          <button
            onClick={toggleHelp}
            title="Help"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          <button
            onClick={() => toast.info("Settings are available within each project version.")}
            title="Settings"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {/* ── Right: Main content area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-border bg-card px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
                Virtual Film Studio
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your productions, all in one place
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Decorative film strip accent */}
              <div className="hidden md:flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-8 w-5 rounded-sm border border-primary/20 bg-primary/5"
                  />
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Projects grid */}
        <main className="flex-1 overflow-y-auto p-8">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-56 animate-pulse rounded-xl bg-card" />
              ))}
            </div>
          ) : !projects?.length ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="relative">
                <Film className="h-20 w-20 text-muted-foreground/20" />
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-6 font-display text-xl font-bold text-foreground">No productions yet</p>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                Create your first project to start building your virtual film. Upload a screenplay and let AI break it down.
              </p>
              <Button onClick={() => setOpen(true)} className="mt-6 gap-2">
                <Plus className="h-4 w-4" /> New Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/40 hover:cinema-glow"
                >
                  <button
                    onClick={() => renamingId !== project.id && navigate(`/projects/${project.id}`)}
                    className="flex flex-1 flex-col text-left"
                  >
                    {/* Poster area with film-strip pattern */}
                    <div className="relative flex h-36 items-center justify-center bg-secondary overflow-hidden">
                      {/* Film grain overlay */}
                      <div className="absolute inset-0 opacity-[0.03]" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                      }} />
                      <Film className="h-12 w-12 text-muted-foreground/20 transition-all duration-300 group-hover:text-primary/40 group-hover:scale-110" />
                      {/* Sprocket holes */}
                      <div className="absolute left-2 top-0 bottom-0 flex flex-col justify-center gap-3">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="h-3 w-2 rounded-sm bg-background/20" />
                        ))}
                      </div>
                      <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-center gap-3">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="h-3 w-2 rounded-sm bg-background/20" />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      {renamingId === project.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameProject.mutate({ id: project.id, name: renameValue });
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => renameProject.mutate({ id: project.id, name: renameValue })}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setRenamingId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <h3 className="font-display text-base font-bold text-foreground truncate">
                          {project.title}
                        </h3>
                      )}
                      {project.description && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Film className="h-3 w-3" />
                          {versionCounts?.[project.id] || 0} version{(versionCounts?.[project.id] || 0) !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(project.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Card footer actions */}
                  <div className="border-t border-border p-2.5 flex justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(project.id);
                        setRenameValue(project.title);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                      Rename
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        Open <ChevronRight className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: project.id, title: project.title });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>"{deleteTarget?.title}"</strong> and all its versions, scenes, characters, shots, and analysis data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteProject.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProject.isPending ? "Deleting…" : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Projects;
