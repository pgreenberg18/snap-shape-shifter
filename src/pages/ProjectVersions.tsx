import { useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Copy, ArrowLeft, Film, Calendar, Trash2, Pencil, Check, X,
  HelpCircle, Settings, Archive, ArchiveRestore, HardDrive, ChevronDown, ChevronRight,
  SlidersHorizontal, ImagePlus, ArrowUpDown,
  ScrollText, Image, AudioLines, Camera, Clapperboard, Minus, ExternalLink, Plug,
} from "lucide-react";
import clapperboardTemplate from "@/assets/clapperboard-template.jpg";
import {
  FilmStripIcon,
  CineBackIcon,
  InfoBeaconIcon,
  PrecisionGearIcon,
  MixingConsoleIcon,
  PowerIcon,
  VersionsIcon,
} from "@/components/ui/cinema-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import ProjectServicesDialog from "@/components/settings/ProjectServicesDialog";
import ProviderConflictDialog from "@/components/settings/ProviderConflictDialog";
import { useAuth } from "@/hooks/useAuth";

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

/* ── Inline Services Panel (replaces dialog) ── */
const SECTION_ORDER = ["script-analysis", "image-generation", "sound-stage", "camera-cart", "post-house"] as const;
const SECTION_META: Record<string, { title: string; icon: React.ReactNode }> = {
  "script-analysis": { title: "Script Analysis (LLM)", icon: <ScrollText className="h-4 w-4" /> },
  "image-generation": { title: "Image Generation", icon: <Image className="h-4 w-4" /> },
  "sound-stage": { title: "Voice & Audio", icon: <AudioLines className="h-4 w-4" /> },
  "camera-cart": { title: "Video Generation", icon: <Camera className="h-4 w-4" /> },
  "post-house": { title: "Post-Production", icon: <Clapperboard className="h-4 w-4" /> },
};
const SERVICES_LEGACY_MAP: Record<string, string> = { "writers-room": "script-analysis" };

const InlineServicesPanel = ({
  projectId, versions, onClose, onManageProviders,
}: {
  projectId: string;
  versions: Array<{ id: string; version_name: string | null; version_number: number; is_archived: boolean }>;
  onClose: () => void;
  onManageProviders: () => void;
}) => {
  const { data: integrations } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("integrations").select("*").order("section_id");
      if (error) throw error;
      return data;
    },
  });

  const filmIds = versions.map((v) => v.id);
  const { data: selections } = useQuery({
    queryKey: ["project-provider-selections", projectId],
    queryFn: async () => {
      if (!filmIds.length) return [];
      const { data, error } = await supabase.from("version_provider_selections").select("*").in("film_id", filmIds);
      if (error) throw error;
      return data;
    },
    enabled: filmIds.length > 0,
  });

  const bySection: Record<string, Array<{ id: string; provider_name: string; is_verified: boolean }>> = {};
  for (const int of integrations || []) {
    const section = SERVICES_LEGACY_MAP[int.section_id] || int.section_id;
    (bySection[section] ??= []).push(int);
  }

  const selectionMap: Record<string, Record<string, string>> = {};
  for (const s of selections || []) {
    (selectionMap[s.film_id] ??= {})[s.section_id] = s.provider_service_id;
  }

  const providerNames: Record<string, string> = {};
  for (const int of integrations || []) providerNames[int.id] = int.provider_name;

  const activeVersions = versions.filter((v) => !v.is_archived);

  return (
    <div className="mb-6 rounded-xl border border-border bg-card/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold text-foreground">Project Services Overview</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onManageProviders}>
            <ExternalLink className="h-3 w-3" /> Manage Providers
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Global API services configured in the app, and which provider each version in this project is using.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTION_ORDER.map((sectionId) => {
          const meta = SECTION_META[sectionId];
          const providers = bySection[sectionId] || [];
          if (!meta) return null;
          return (
            <div key={sectionId} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                {meta.icon}
                <span className="text-xs font-display font-semibold">{meta.title}</span>
              </div>
              {providers.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No providers configured</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {providers.map((p) => (
                    <span key={p.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${p.is_verified ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"}`}>
                      {p.is_verified ? <Check className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                      {p.provider_name}
                    </span>
                  ))}
                </div>
              )}
              {providers.length > 0 && activeVersions.length > 0 && (
                <div className="rounded-md bg-secondary/50 p-2 space-y-1">
                  {activeVersions.map((v) => {
                    const selectedId = selectionMap[v.id]?.[sectionId];
                    const selectedName = selectedId ? providerNames[selectedId] : null;
                    const verifiedProviders = providers.filter((p) => p.is_verified);
                    const autoSelected = verifiedProviders.length === 1 ? verifiedProviders[0].provider_name : null;
                    return (
                      <div key={v.id} className="flex items-center justify-between text-[10px]">
                        <span className="text-foreground font-medium truncate max-w-[100px]">{v.version_name || `v${v.version_number}`}</span>
                        {selectedName ? (
                          <span className="text-primary flex items-center gap-0.5"><Check className="h-2.5 w-2.5" /> {selectedName}</span>
                        ) : autoSelected ? (
                          <span className="text-muted-foreground flex items-center gap-0.5"><Check className="h-2.5 w-2.5" /> {autoSelected} (auto)</span>
                        ) : verifiedProviders.length > 1 ? (
                          <span className="text-yellow-500 text-[10px]">⚠ Not set</span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "alpha">("newest");
  const [servicesOpen, setServicesOpen] = useState(false);
  const [conflictFilmId, setConflictFilmId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Array<{ section: string; providers: Array<{ id: string; provider_name: string }> }>>([]);
  const { user, signOut } = useAuth();

  const LEGACY_MAP: Record<string, string> = { "writers-room": "script-analysis" };

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

  const activeVersions = useMemo(() => {
    const filtered = versions?.filter((v) => !v.is_archived) || [];
    return [...filtered].sort((a, b) => {
      if (sortOrder === "alpha") return (a.version_name || "").localeCompare(b.version_name || "");
      if (sortOrder === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [versions, sortOrder]);
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
      // Get shot IDs and character IDs for dependent cleanup
      const shotIds = (await supabase.from("shots").select("id").eq("film_id", filmId)).data?.map(s => s.id) || [];
      const charIds = (await supabase.from("characters").select("id").eq("film_id", filmId)).data?.map(c => c.id) || [];

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
        supabase.from("characters").delete().eq("film_id", filmId),
        supabase.from("shots").delete().eq("film_id", filmId),
        supabase.from("script_analyses").delete().eq("film_id", filmId),
        supabase.from("content_safety").delete().eq("film_id", filmId),
        supabase.from("asset_identity_registry").delete().eq("film_id", filmId),
        supabase.from("post_production_clips").delete().eq("film_id", filmId),
        supabase.from("version_provider_selections").delete().eq("film_id", filmId),
        supabase.from("film_director_profiles").delete().eq("film_id", filmId),
        supabase.from("film_style_contracts").delete().eq("film_id", filmId),
        supabase.from("film_assets").delete().eq("film_id", filmId),
        supabase.from("scene_style_overrides").delete().eq("film_id", filmId),
        supabase.from("parsed_scenes").delete().eq("film_id", filmId),
        supabase.from("wardrobe_scene_assignments").delete().eq("film_id", filmId),
        supabase.from("production_presets").delete().eq("film_id", filmId),
        supabase.from("credit_usage_logs").delete().eq("film_id", filmId),
        supabase.from("parse_jobs").delete().eq("film_id", filmId),
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

  /* ── Check for provider conflicts before navigating ── */
  const handleVersionClick = useCallback(async (filmId: string) => {
    if (!user?.id) { navigate(`/projects/${projectId}/versions/${filmId}/development`); return; }
    // Get verified integrations
    const { data: integrations } = await supabase
      .from("integrations").select("id, section_id, provider_name, is_verified")
      .eq("user_id", user.id);
    // Get existing selections for this film
    const { data: selections } = await supabase
      .from("version_provider_selections").select("section_id")
      .eq("film_id", filmId);
    const selectedSections = new Set(selections?.map(s => s.section_id) || []);
    // Group verified by section
    const bySection: Record<string, Array<{ id: string; provider_name: string }>> = {};
    for (const i of integrations || []) {
      if (!i.is_verified) continue;
      const section = LEGACY_MAP[i.section_id] || i.section_id;
      (bySection[section] ??= []).push({ id: i.id, provider_name: i.provider_name });
    }
    // Find conflicts: multiple providers, no selection yet
    const unresolved = Object.entries(bySection)
      .filter(([section, providers]) => providers.length > 1 && !selectedSections.has(section))
      .map(([section, providers]) => ({ section, providers }));
    if (unresolved.length > 0) {
      setConflictFilmId(filmId);
      setConflicts(unresolved);
    } else {
      navigate(`/projects/${projectId}/versions/${filmId}/development`);
    }
  }, [user?.id, projectId, navigate]);

  /* ── Poster upload handler ── */
  const handlePosterUpload = useCallback(async (filmId: string, file: File) => {
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `posters/${filmId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("film-assets")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("film-assets").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from("films")
        .update({ poster_url: publicUrl })
        .eq("id", filmId);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["versions", projectId] });
      toast.success("Poster updated");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
  }, [projectId, queryClient]);

  /* ── Reusable version card ── */
  const renderVersionCard = (v: NonNullable<typeof versions>[number], isArchived: boolean) => {
    const versionSize = sizeData?.[v.id] || 0;
    return (
      <div
        key={v.id}
        className={`group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300 ${
          isArchived ? "border-border/50 opacity-75" : "border-border hover:border-primary/40 hover:cinema-glow"
        }`}
      >
        {/* Hover lens flare bloom */}
        {!isArchived && (
          <div className="pointer-events-none absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-screen" style={{ background: 'radial-gradient(circle, rgba(124,203,255,0.25) 0%, rgba(47,125,255,0.1) 35%, transparent 65%)', filter: 'blur(16px)' }} />
        )}
        <button
          onClick={() => renamingId !== v.id && handleVersionClick(v.id)}
          className="flex flex-1 flex-col text-left"
        >
          <div className="relative aspect-video overflow-hidden bg-secondary">
            <img
              src={v.poster_url || clapperboardTemplate}
              alt={v.version_name || `Version ${v.version_number}`}
              className="h-full w-full object-cover"
            />
            {/* Text overlay on clapperboard */}
            {!v.poster_url && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 px-3 text-center">
                <span className="font-display text-[11px] font-bold leading-tight text-white drop-shadow-md">
                  {project?.title}
                </span>
                <span className="mt-0.5 text-[9px] font-medium text-white/80 drop-shadow">
                  {v.version_name || `Version ${v.version_number}`}
                </span>
                <span className="mt-0.5 text-[8px] text-white/60">
                  {new Date(v.created_at).toLocaleDateString()}
                </span>
              </div>
            )}
            {/* Upload overlay */}
            <label
              className="absolute bottom-1 right-1 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-black/60 text-white/70 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80 hover:text-white"
              title="Upload custom poster"
              onClick={(e) => e.stopPropagation()}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePosterUpload(v.id, file);
                  e.target.value = "";
                }}
              />
            </label>
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

  const SidebarTooltip = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="border-primary/20 bg-secondary/95 backdrop-blur-md shadow-[0_0_16px_-4px_rgba(47,125,255,0.4)]"
        >
          <p className="text-xs font-medium tracking-wide text-foreground">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className="flex h-full w-16 flex-col items-center py-4 shrink-0 pro-panel"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <SidebarTooltip label="Back to Projects">
          <button onClick={() => navigate("/projects")} className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)] transition-all duration-200">
            <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
              <CineBackIcon className="h-4.5 w-4.5 shrink-0 icon-glow" />
            </span>
          </button>
        </SidebarTooltip>
        <div className="flex-1" />
        <div className="flex flex-col items-center gap-1 mb-2">
          <SidebarTooltip label="Help">
            <button onClick={toggleHelp} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)] transition-all duration-200">
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
                <InfoBeaconIcon className="h-4.5 w-4.5 shrink-0 icon-glow" />
              </span>
            </button>
          </SidebarTooltip>
          <SidebarTooltip label="Project Services">
            <button onClick={() => setServicesOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)] transition-all duration-200">
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
                <PrecisionGearIcon className="h-4.5 w-4.5 shrink-0 icon-glow" />
              </span>
            </button>
          </SidebarTooltip>
          <SidebarTooltip label="Global Settings">
            <button onClick={() => navigate("/settings/admin")} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)] transition-all duration-200">
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
                <MixingConsoleIcon className="h-4.5 w-4.5 shrink-0 icon-glow" />
              </span>
            </button>
          </SidebarTooltip>
          <SidebarTooltip label="Sign Out">
            <button
              onClick={async () => { await signOut(); navigate("/login"); }}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            >
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
                <PowerIcon className="h-3.5 w-3.5 shrink-0 icon-glow" />
              </span>
            </button>
          </SidebarTooltip>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Branded Header */}
        <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-border px-6 pro-panel specular-edge overflow-hidden" style={{ borderRadius: 0 }}>
          {/* Anamorphic streak */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[1.5px] opacity-60" style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(124,203,255,0.1) 15%, rgba(124,203,255,0.35) 45%, rgba(124,203,255,0.5) 50%, rgba(124,203,255,0.35) 55%, rgba(124,203,255,0.1) 85%, transparent 95%)', filter: 'blur(1px)', animation: 'streak-pulse 6s ease-in-out infinite' }} />
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[6px] opacity-20" style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(124,203,255,0.15) 30%, rgba(124,203,255,0.3) 50%, rgba(124,203,255,0.15) 70%, transparent 90%)', filter: 'blur(4px)', animation: 'streak-pulse 6s ease-in-out infinite' }} />
          </div>
          <div className="relative flex items-center gap-3 z-10">
            <div className="pointer-events-none absolute -inset-x-8 -inset-y-4 z-0" style={{ animation: 'flare-breathe 5s ease-in-out infinite' }}>
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(47,125,255,0.2) 15%, rgba(124,203,255,0.6) 40%, rgba(200,230,255,0.9) 50%, rgba(124,203,255,0.6) 60%, rgba(47,125,255,0.2) 85%, transparent 100%)', filter: 'blur(1.5px)', animation: 'streak-pulse 3.5s ease-in-out infinite' }} />
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[18px]" style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(47,125,255,0.05) 20%, rgba(124,203,255,0.2) 40%, rgba(124,203,255,0.35) 50%, rgba(124,203,255,0.2) 60%, rgba(47,125,255,0.05) 80%, transparent 95%)', filter: 'blur(8px)', animation: 'streak-pulse 5s ease-in-out infinite 0.5s' }} />
              <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px]" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(124,203,255,0.15) 30%, rgba(200,230,255,0.4) 50%, rgba(124,203,255,0.15) 70%, transparent 100%)', filter: 'blur(2px)', animation: 'streak-pulse 4.5s ease-in-out infinite 1s' }} />
            </div>
            <FilmStripIcon className="relative z-10 h-5 w-5 text-primary icon-glow" />
            <span className="relative z-10 font-display text-[1.9rem] leading-tight font-extrabold tracking-wide text-foreground drop-shadow-[0_0_12px_rgba(124,203,255,0.4)]">
              Virtual Film Studio
            </span>
          </div>

          {/* Centered project name */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground">
              <VersionsIcon className="h-3.5 w-3.5 text-primary icon-glow" />
              <span className="font-display truncate max-w-[200px]">
                {project?.title ?? "Loading…"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 z-10">
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" title="Total estimated project size">
              <HardDrive className="h-3 w-3" />
              {formatBytes(totalProjectSize)}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="relative flex-1 overflow-y-auto lens-flare lens-flare-streak">
          <div className="pointer-events-none fixed top-1/3 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full z-[14] mix-blend-screen opacity-40" style={{ background: 'radial-gradient(circle, rgba(47,125,255,0.12) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="mx-auto max-w-7xl px-8 py-6">
            {/* Inline Services Overview */}
            {servicesOpen && versions && projectId && (
              <InlineServicesPanel
                projectId={projectId}
                versions={versions}
                onClose={() => setServicesOpen(false)}
                onManageProviders={() => navigate("/settings")}
              />
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                  Versions
                </h2>
                <span className="text-xs text-muted-foreground">
                  {activeVersions.length} active{archivedVersions.length > 0 ? `, ${archivedVersions.length} archived` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground"
                  onClick={() => setSortOrder((prev) => prev === "newest" ? "oldest" : prev === "oldest" ? "alpha" : "newest")}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {sortOrder === "newest" ? "Newest" : sortOrder === "oldest" ? "Oldest" : "A–Z"}
                </Button>
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
            </div>

            {/* Version Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2].map((i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-card" />)}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {activeVersions.map((v) => renderVersionCard(v, false))}
                </div>

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
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {archivedVersions.map((v) => renderVersionCard(v, true))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

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

        {/* Services dialog removed – now inline */}

        {conflictFilmId && conflicts.length > 0 && (
          <ProviderConflictDialog
            filmId={conflictFilmId}
            conflicts={conflicts}
            open={true}
            onResolved={() => {
              const fid = conflictFilmId;
              setConflictFilmId(null);
              setConflicts([]);
              navigate(`/projects/${projectId}/versions/${fid}/development`);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectVersions;
