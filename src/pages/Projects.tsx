import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Trash2, Pencil, Check, X, ChevronRight, ChevronDown,
} from "lucide-react";
import {
  AddProjectIcon, FilmStripIcon, PrecisionGearIcon, InfoBeaconIcon, ProfileIcon,
} from "@/components/ui/cinema-icons";
import clapperboardTemplate from "@/assets/clapperboard-template.jpg";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHelp } from "@/components/help/HelpPanel";
import { useAuth } from "@/hooks/useAuth";
import { isAdminUser } from "@/components/admin/AdminPanel";

const Projects = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toggle: toggleHelp } = useHelp();
  const { user, signOut } = useAuth();

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-name", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [expandedProjects, setExpandedProjects] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

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

  const { data: allFilms } = useQuery({
    queryKey: ["project-films-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("films")
        .select("id, title, project_id, version_number, version_name")
        .order("version_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const versionCounts: Record<string, number> = {};
  for (const f of allFilms || []) {
    if (f.project_id) versionCounts[f.project_id] = (versionCounts[f.project_id] || 0) + 1;
  }

  const filmsByProject: Record<string, typeof allFilms> = {};
  for (const f of allFilms || []) {
    if (f.project_id) {
      if (!filmsByProject[f.project_id]) filmsByProject[f.project_id] = [];
      filmsByProject[f.project_id]!.push(f);
    }
  }

  const createProject = useMutation({
    mutationFn: async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .insert({ title, description: description || null, user_id: currentUser?.id })
        .select()
        .single();
      if (projErr) throw projErr;
      const { data: film, error: filmErr } = await supabase.from("films").insert({
        title,
        project_id: project.id,
        version_number: 1,
        version_name: "Version 1",
      }).select().single();
      if (filmErr) throw filmErr;
      // Seed default provider selections from global integrations
      const { seedVersionProviders } = await import("@/lib/seed-version-providers");
      await seedVersionProviders(film.id);
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
        // Get shot IDs for template cleanup
        const shotIds = (await supabase.from("shots").select("id").in("film_id", filmIds)).data?.map(s => s.id) || [];
        // Get character IDs for audition/consistency cleanup
        const charIds = (await supabase.from("characters").select("id").in("film_id", filmIds)).data?.map(c => c.id) || [];

        // Clean up shot-dependent tables
        if (shotIds.length > 0) {
          await Promise.all([
            supabase.from("ai_generation_templates").delete().in("shot_id", shotIds),
            supabase.from("generations").delete().in("shot_id", shotIds),
            supabase.from("vice_conflicts").delete().in("shot_id", shotIds),
            supabase.from("vice_dependencies").delete().in("shot_id", shotIds),
            supabase.from("vice_dirty_queue").delete().in("shot_id", shotIds),
          ]);
        }

        // Clean up character-dependent tables
        if (charIds.length > 0) {
          await Promise.all([
            supabase.from("character_auditions").delete().in("character_id", charIds),
            supabase.from("character_consistency_views").delete().in("character_id", charIds),
          ]);
        }

        // Clean up film-dependent tables
        await Promise.all([
          supabase.from("characters").delete().in("film_id", filmIds),
          supabase.from("shots").delete().in("film_id", filmIds),
          supabase.from("script_analyses").delete().in("film_id", filmIds),
          supabase.from("content_safety").delete().in("film_id", filmIds),
          supabase.from("asset_identity_registry").delete().in("film_id", filmIds),
          supabase.from("post_production_clips").delete().in("film_id", filmIds),
          supabase.from("film_director_profiles").delete().in("film_id", filmIds),
          supabase.from("film_style_contracts").delete().in("film_id", filmIds),
          supabase.from("film_assets").delete().in("film_id", filmIds),
          supabase.from("scene_style_overrides").delete().in("film_id", filmIds),
          supabase.from("parsed_scenes").delete().in("film_id", filmIds),
          supabase.from("wardrobe_scene_assignments").delete().in("film_id", filmIds),
          supabase.from("production_presets").delete().in("film_id", filmIds),
          supabase.from("version_provider_selections").delete().in("film_id", filmIds),
          supabase.from("credit_usage_logs").delete().in("film_id", filmIds),
          supabase.from("parse_jobs").delete().in("film_id", filmIds),
        ]);
        await supabase.from("films").delete().eq("project_id", projectId);
      }
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-films-all"] });
      setDeleteTarget(null);
      toast.success("Project deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="relative flex h-screen overflow-hidden bg-background lens-flare lens-flare-streak">
      {/* ── Left sidebar: User section + bottom icons ── */}
      <aside className="flex h-full w-72 flex-col border-r border-border bg-card">
        {/* User profile area */}
        <div className="border-b border-border p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 shadow-[0_0_12px_-2px_rgba(47,125,255,0.3)]">
              <ProfileIcon className="h-5 w-5 text-primary icon-glow" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-semibold text-foreground truncate">
                {userProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Director"}
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
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">
              Studio Overview
            </h3>
            <div className="space-y-3">
              <div>
                <button
                  onClick={() => setExpandedProjects((p) => !p)}
                  className="flex w-full items-center justify-between rounded-lg bg-secondary/50 px-4 py-3 hover:bg-secondary/80 transition-colors"
                >
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {expandedProjects ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Film Projects
                  </span>
                  <span className="text-sm font-display font-bold text-foreground">
                    {projects?.length || 0}
                  </span>
                </button>
                {expandedProjects && projects && projects.length > 0 && (
                  <div className="mt-1 ml-2 border-l border-border pl-2 space-y-0.5">
                    {projects.map((project) => (
                      <div key={project.id}>
                        <button
                          onClick={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                        >
                          {expandedProjectId === project.id ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                          <span className="truncate">{project.title}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{versionCounts[project.id] || 0}v</span>
                        </button>
                        {expandedProjectId === project.id && filmsByProject[project.id] && (
                          <div className="ml-4 border-l border-border/50 pl-2 space-y-0.5 py-0.5">
                            {filmsByProject[project.id]!.map((film) => (
                              <button
                                key={film.id}
                                onClick={() => navigate(`/projects/${project.id}`)}
                                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              >
                                <FilmStripIcon className="h-3 w-3 shrink-0" />
                                <span className="truncate">{film.version_name || `Version ${film.version_number}`}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>


          
        </div>


        {/* Bottom icons: Help + Settings */}
        <div className="border-t border-border p-3 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleHelp}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
              >
                <InfoBeaconIcon className="h-5 w-5 icon-glow" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Help</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/settings/admin")}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
              >
                <PrecisionGearIcon className="h-5 w-5 icon-glow" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>Settings & Admin</p></TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* ── Right: Main content area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-border bg-card px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
                Virtual Film Studio
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Where Imagination Meets Intention
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
                <FilmStripIcon className="h-20 w-20 text-muted-foreground/20" />
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <AddProjectIcon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-6 font-display text-lg font-bold text-foreground">No productions yet</p>
              <p className="mt-2 text-xs text-muted-foreground max-w-sm">
                Create your first project to start building your virtual film. Upload a screenplay and let AI break it down.
              </p>
              <Button onClick={() => setOpen(true)} className="mt-6 gap-2">
                <AddProjectIcon className="h-4 w-4" /> New Film Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {/* New Film Project card */}
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 hover:border-primary/40 hover:bg-accent transition-all duration-300 aspect-[4/3] cursor-pointer">
                    <AddProjectIcon className="h-8 w-8 text-primary icon-glow" />
                    <span className="text-sm font-medium text-foreground">New Film Project</span>
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create New Film Project</DialogTitle></DialogHeader>
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
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/40 hover:cinema-glow"
                >
                  {/* Hover lens flare bloom */}
                  <div className="pointer-events-none absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-screen" style={{ background: 'radial-gradient(circle, rgba(124,203,255,0.25) 0%, rgba(47,125,255,0.1) 35%, transparent 65%)', filter: 'blur(16px)' }} />
                  <button
                    onClick={() => renamingId !== project.id && navigate(`/projects/${project.id}`)}
                    className="flex flex-1 flex-col text-left"
                  >
                    {/* Poster area */}
                    <div className="relative aspect-video overflow-hidden bg-secondary">
                      <img
                        src={project.poster_url || clapperboardTemplate}
                        alt={project.title}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="flex flex-1 flex-col p-3">
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
                        <h3 className="font-display text-sm font-bold text-foreground truncate">
                          {project.title}
                        </h3>
                      )}
                      {project.description && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <FilmStripIcon className="h-3 w-3" />
                          {versionCounts?.[project.id] || 0} version{(versionCounts?.[project.id] || 0) !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <FilmStripIcon className="h-3 w-3" />
                          {new Date(project.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Card footer actions */}
                  <div className="border-t border-border p-1.5 flex justify-between">
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
