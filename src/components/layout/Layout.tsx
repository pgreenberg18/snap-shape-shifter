import { ReactNode } from "react";
import { NavLink, useLocation, useParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useFilm, useFilmId } from "@/hooks/useFilm";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Clapperboard,
  Video,
  Film,
  Rocket,
  Settings,
  HelpCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHelp } from "@/components/help/HelpPanel";

const phases = [
  { key: "development", icon: FileText, label: "Development" },
  { key: "pre-production", icon: Clapperboard, label: "Pre-Production" },
  { key: "production", icon: Video, label: "Production" },
  { key: "post-production", icon: Film, label: "Post-Production" },
  { key: "release", icon: Rocket, label: "Release" },
];

const Layout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId, versionId } = useParams<{ projectId: string; versionId: string }>();
  const { data: film } = useFilm();
  const filmId = useFilmId();
  const { toggle: toggleHelp } = useHelp();

  // Check if script is currently being analyzed
  const { data: latestAnalysis } = useQuery({
    queryKey: ["script-analysis", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("script_analyses")
        .select("status")
        .eq("film_id", filmId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d && (d.status === "pending" || d.status === "analyzing")) return 3000;
      return false;
    },
  });

  const isAnalyzing = latestAnalysis?.status === "pending" || latestAnalysis?.status === "analyzing";

  const basePath = `/projects/${projectId}/versions/${versionId}`;

  const renderNavItem = (key: string, icon: React.ElementType, label: string) => {
    const to = `${basePath}/${key}`;
    const isActive = location.pathname.includes(`/${key}`);
    const Icon = icon;
    const disabled = isAnalyzing && key !== "development";

    if (disabled) {
      return (
        <TooltipProvider key={key}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground/40 cursor-not-allowed"
                title={label}
              >
                <Icon className="h-5 w-5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="text-xs">Script is being analyzed…</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <NavLink
        key={key}
        to={to}
        title={label}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
          isActive
            ? "text-primary cinema-glow"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
      </NavLink>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left Sidebar */}
      <aside className="flex h-full w-16 flex-col items-center border-r border-border bg-card py-4">
        {/* Back to project */}
        <button
          onClick={() => !isAnalyzing && navigate(`/projects/${projectId}`)}
          title="Back to versions"
          className={cn(
            "mb-4 flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
            isAnalyzing
              ? "text-muted-foreground/40 cursor-not-allowed"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <nav className="flex flex-1 flex-col items-center gap-1">
          {phases.map((phase) => renderNavItem(phase.key, phase.icon, phase.label))}
        </nav>

        {/* Bottom nav — Help + Settings */}
        <div className="flex flex-col items-center gap-1 mb-2">
          <button
            onClick={toggleHelp}
            title="Help"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          {renderNavItem("settings", Settings, "Settings")}
        </div>
      </aside>

      {/* Right content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-base font-semibold tracking-tight">
              {film?.title ?? "Loading…"}
            </h1>
            {film?.version_name && (
              <span className="text-xs text-muted-foreground">
                — {film.version_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isAnalyzing && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Loader2 className="h-3 w-3 animate-spin" /> Analyzing…
              </span>
            )}
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Credits: {film?.credits?.toLocaleString() ?? "—"}
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
