import { ReactNode, useState } from "react";
import { NavLink, useLocation, useParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useFilm, useFilmId } from "@/hooks/useFilm";
import { useAuth } from "@/hooks/useAuth";
import { useAccessControl } from "@/hooks/useAccessControl";
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
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  SlidersHorizontal,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHelp } from "@/components/help/HelpPanel";
import CreditMeter from "./CreditMeter";

const phases = [
  { key: "development", icon: FileText, label: "Development", tint: "hsl(220 30% 5%)" },
  { key: "pre-production", icon: Clapperboard, label: "Pre-Production", tint: "hsl(225 28% 6%)" },
  { key: "production", icon: Video, label: "Production", tint: "hsl(210 25% 5%)" },
  { key: "post-production", icon: Film, label: "Post-Production", tint: "hsl(230 22% 6%)" },
  { key: "release", icon: Rocket, label: "Release", tint: "hsl(200 20% 5%)" },
];

const Layout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId, versionId } = useParams<{ projectId: string; versionId: string }>();
  const { data: film } = useFilm();
  const filmId = useFilmId();
  const { signOut } = useAuth();
  const { toggle: toggleHelp } = useHelp();
  const { hasPhaseAccess } = useAccessControl();
  const [expanded, setExpanded] = useState(false);

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

  const renderNavItem = (key: string, icon: React.ElementType, label: string, tint?: string) => {
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
                className={cn(
                  "flex items-center rounded-xl text-muted-foreground/40 cursor-not-allowed transition-all duration-200",
                  expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center"
                )}
                title={label}
              >
                <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
                  <Icon className="h-4.5 w-4.5 shrink-0 icon-glow" strokeWidth={1.5} />
                </span>
                {expanded && <span className="text-xs font-medium truncate">{label}</span>}
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
          "flex items-center rounded-xl transition-all duration-200",
          expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center",
          isActive
            ? "text-primary [box-shadow:0_0_20px_-4px_rgba(47,125,255,0.45),0_0_8px_-2px_rgba(47,125,255,0.2)]"
            : "text-muted-foreground hover:text-foreground hover:[box-shadow:0_0_16px_-3px_rgba(47,125,255,0.25)] hover:bg-accent"
        )}
        style={isActive && tint ? { backgroundColor: tint } : undefined}
      >
        <span className={cn(
          "flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-200",
          isActive ? "bg-primary/15 shadow-[0_0_12px_-2px_rgba(47,125,255,0.3)]" : "bg-muted/30 group-hover:bg-accent"
        )}>
          <Icon className="h-4.5 w-4.5 shrink-0 icon-glow" strokeWidth={1.5} />
        </span>
        {expanded && <span className="text-xs font-medium truncate">{label}</span>}
      </NavLink>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left Sidebar — rack-mount equipment panel */}
      <aside
        className={cn(
          "flex h-full flex-col items-center py-4 transition-all duration-200 shrink-0 pro-panel border-r-0",
          expanded ? "w-44" : "w-16"
        )}
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Back to project */}
        <button
          onClick={() => !isAnalyzing && navigate(`/projects/${projectId}`)}
          title="Back to versions"
          className={cn(
            "mb-4 flex items-center rounded-xl transition-all duration-200",
            expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center",
            isAnalyzing
              ? "text-muted-foreground/40 cursor-not-allowed"
              : "text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)]"
          )}
        >
          <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
            <ArrowLeft className="h-4.5 w-4.5 shrink-0 icon-glow" strokeWidth={1.5} />
          </span>
          {expanded && <span className="text-xs font-medium truncate">Versions</span>}
        </button>

        <nav className={cn("flex flex-1 flex-col gap-1", expanded ? "w-full px-2" : "items-center")}>
          {phases.filter((phase) => hasPhaseAccess(phase.key)).map((phase) => renderNavItem(phase.key, phase.icon, phase.label, phase.tint))}
        </nav>

        {/* Bottom nav — Toggle + Help + Settings */}
        <div className={cn("flex flex-col gap-1 mb-2", expanded ? "w-full px-2" : "items-center")}>
          {/* Credit Meter */}
          <CreditMeter expanded={expanded} />

          {/* Expand/Collapse toggle */}
          <button
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className={cn(
              "flex items-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)] transition-all duration-200",
              expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center"
            )}
          >
            <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
              {expanded ? <ChevronsLeft className="h-4.5 w-4.5 shrink-0 icon-glow" strokeWidth={1.5} /> : <ChevronsRight className="h-4.5 w-4.5 shrink-0 icon-glow" strokeWidth={1.5} />}
            </span>
            {expanded && <span className="text-xs font-medium truncate">Collapse</span>}
          </button>

          <button
            onClick={toggleHelp}
            title="Help"
            className={cn(
              "flex items-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)] transition-all duration-200",
              expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center"
            )}
          >
            <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
              <HelpCircle className="h-4.5 w-4.5 shrink-0 icon-glow" strokeWidth={1.5} />
            </span>
            {expanded && <span className="text-xs font-medium truncate">Help</span>}
          </button>

          <div className={expanded ? "w-full" : ""}>
            {renderNavItem("settings", Settings, "Settings")}
          </div>

          <button
            onClick={() => navigate("/settings/admin")}
            title="Global Settings"
            className={cn(
              "flex items-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)] transition-all duration-200",
              expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center"
            )}
          >
            <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
              <SlidersHorizontal className="h-4.5 w-4.5 shrink-0 icon-glow" strokeWidth={1.5} />
            </span>
            {expanded && <span className="text-xs font-medium truncate">Global Settings</span>}
          </button>
        </div>
      </aside>

      {/* Right content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6 pro-panel specular-edge" style={{ borderRadius: 0 }}>
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-primary icon-glow" strokeWidth={1.5} />
            <span className="font-display text-sm font-bold tracking-tight text-foreground">
              Virtual Film Studio
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isAnalyzing && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Loader2 className="h-3 w-3 animate-spin" /> Analyzing…
              </span>
            )}
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Credits: {film?.credits?.toLocaleString() ?? "—"}
            </span>
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              title="View versions"
            >
              <Clapperboard className="h-3.5 w-3.5 text-primary icon-glow" strokeWidth={1.5} />
              <span className="font-display truncate max-w-[200px]">
                {film?.title ?? "Loading…"}
              </span>
              {film?.version_name && (
                <span className="text-muted-foreground">— {film.version_name}</span>
              )}
            </button>
            <button
              onClick={async () => { await signOut(); navigate("/login"); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5 icon-glow" strokeWidth={1.5} />
              Sign Out
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main
          className="relative flex-1 overflow-y-auto transition-colors duration-300 lens-flare lens-flare-streak"
          style={{ backgroundColor: phases.find((p) => location.pathname.includes(`/${p.key}`))?.tint }}
        >
          {/* Tertiary flare — center bloom */}
          <div className="pointer-events-none fixed top-1/3 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full z-[14] mix-blend-screen opacity-40" style={{ background: 'radial-gradient(circle, rgba(47,125,255,0.12) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
