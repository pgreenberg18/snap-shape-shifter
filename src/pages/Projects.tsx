import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const Projects = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

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
      const { data, error } = await supabase
        .from("films")
        .select("project_id");
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
      // Create project
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .insert({ title, description: description || null })
        .select()
        .single();
      if (projErr) throw projErr;

      // Create initial version (film)
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Projects
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your film projects and versions
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-foreground">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Film title…"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description…"
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={() => createProject.mutate()}
                  disabled={!title.trim() || createProject.isPending}
                  className="w-full"
                >
                  {createProject.isPending ? "Creating…" : "Create Project"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Grid */}
      <div className="p-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        ) : !projects?.length ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground/30" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Create your first project to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all duration-200 hover:border-primary/40 hover:cinema-glow"
              >
                {/* Poster area */}
                <div className="flex h-32 items-center justify-center bg-secondary">
                  <FolderOpen className="h-10 w-10 text-muted-foreground/40 transition-colors group-hover:text-primary/60" />
                </div>
                {/* Info */}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-display text-base font-semibold text-foreground truncate">
                    {project.title}
                  </h3>
                  {project.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
                    <span>{versionCounts?.[project.id] || 0} version(s)</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;
