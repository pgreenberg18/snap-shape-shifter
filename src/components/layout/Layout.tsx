import { ReactNode, useState } from "react";
import { NavLink, useLocation, useParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useFilm, useFilmId } from "@/hooks/useFilm";
import { useAuth } from "@/hooks/useAuth";
import { useAccessControl } from "@/hooks/useAccessControl";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useGenerationManager } from "@/hooks/useGenerationManager";
import {
  ScreenplayIcon,
  ClapperboardIcon,
  CineCameraIcon,
  TimelineIcon,
  DeliveryIcon,
  PrecisionGearIcon,
  InfoBeaconIcon,
  CineBackIcon,
  FilmStripIcon,
  MixingConsoleIcon,
  PowerIcon,
  PanelCollapseIcon,
  PanelExpandIcon,
  VersionsIcon,
} from "@/components/ui/cinema-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHelp } from "@/components/help/HelpPanel";
import CreditMeter from "./CreditMeter";

const GenerationIndicator = ({ expanded }: { expanded: boolean }) => {
  const { activeGenerations } = useGenerationManager();
  const running = activeGenerations.filter((g) => g.status === "running");
  if (running.length === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center rounded-xl text-primary transition-all duration-200",
              expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center"
            )}
          >
            <span className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
              <CineCameraIcon className="h-4.5 w-4.5 shrink-0 icon-glow animate-pulse" strokeWidth={1.5} />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-[0_0_8px_rgba(47,125,255,0.5)]">
                {running.length}
              </span>
            </span>
            {expanded && (
              <span className="text-xs font-medium truncate">
                {running.length} generating…
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs">{running.length} generation{running.length > 1 ? "s" : ""} in progress</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const phases = [
  { key: "development", icon: ScreenplayIcon, label: "Development", tint: "hsl(220 30% 5%)" },
  { key: "pre-production", icon: ClapperboardIcon, label: "Pre-Production", tint: "hsl(225 28% 6%)" },
  { key: "production", icon: CineCameraIcon, label: "Production", tint: "hsl(210 25% 5%)" },
  { key: "post-production", icon: TimelineIcon, label: "Post-Production", tint: "hsl(230 22% 6%)" },
  { key: "release", icon: DeliveryIcon, label: "Release", tint: "hsl(200 20% 5%)" },
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

  /** Wraps an element with a lens-flare tooltip when sidebar is collapsed */
  const FlareTooltip = ({ label, children }: { label: string; children: React.ReactNode }) => {
    if (expanded) return <>{children}</>;
    return (
      <TooltipProvider delayDuration={120}>
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={8}
            data-sidebar-flare=""
            className="relative overflow-visible border-primary/20 bg-secondary/95 backdrop-blur-md shadow-[0_0_16px_-4px_rgba(47,125,255,0.4)]"
          >
            <p className="text-xs font-medium tracking-wide text-foreground">{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderNavItem = (key: string, icon: React.ElementType, label: string, tint?: string) => {
    const to = `${basePath}/${key}`;
    const isActive = location.pathname.includes(`/${key}`);
    const Icon = icon;
    const disabled = isAnalyzing && key !== "development";

    if (disabled) {
      return (
        <FlareTooltip key={key} label="Script is being analyzed…">
          <span
            className={cn(
              "flex items-center rounded-xl text-muted-foreground/40 cursor-not-allowed transition-all duration-200",
              expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center"
            )}
          >
            <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
              <Icon className="h-4.5 w-4.5 shrink-0 icon-glow" strokeWidth={1.5} />
            </span>
            {expanded && <span className="text-xs font-medium truncate">{label}</span>}
          </span>
        </FlareTooltip>
      );
    }

    return (
      <FlareTooltip key={key} label={label}>
        <NavLink
          to={to}
          data-help-id={`nav-${key}`}
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
      </FlareTooltip>
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
        <FlareTooltip label="Versions">
          <button
            onClick={() => !isAnalyzing && navigate(`/projects/${projectId}`)}
            data-help-id="nav-versions"
            className={cn(
              "mb-4 flex items-center rounded-xl transition-all duration-200",
              expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center",
              isAnalyzing
                ? "text-muted-foreground/40 cursor-not-allowed"
                : "text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)]"
            )}
          >
            <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
              <CineBackIcon className="h-4.5 w-4.5 shrink-0 icon-glow" />
            </span>
            {expanded && <span className="text-xs font-medium truncate">Versions</span>}
          </button>
        </FlareTooltip>

        <nav className={cn("flex flex-1 flex-col gap-1", expanded ? "w-full px-2" : "items-center")}>
          {phases.filter((phase) => hasPhaseAccess(phase.key)).map((phase) => renderNavItem(phase.key, phase.icon, phase.label, phase.tint))}
        </nav>

        {/* Bottom nav — Toggle + Help + Settings */}
        <div className={cn("flex flex-col gap-1 mb-2", expanded ? "w-full px-2" : "items-center")}>
          {/* Active generations indicator */}
          <GenerationIndicator expanded={expanded} />



          {/* Expand/Collapse toggle */}
          <FlareTooltip label={expanded ? "Collapse" : "Expand"}>
            <button
              onClick={() => setExpanded((e) => !e)}
              className={cn(
                "flex items-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)] transition-all duration-200",
                expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center"
              )}
            >
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
                {expanded ? <PanelCollapseIcon className="h-4.5 w-4.5 shrink-0 icon-glow" /> : <PanelExpandIcon className="h-4.5 w-4.5 shrink-0 icon-glow" />}
              </span>
              {expanded && <span className="text-xs font-medium truncate">Collapse</span>}
            </button>
          </FlareTooltip>

          <FlareTooltip label="Help">
            <button
              onClick={toggleHelp}
              data-help-id="nav-help"
              className={cn(
                "flex items-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)] transition-all duration-200",
                expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center"
              )}
            >
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
                <InfoBeaconIcon className="h-4.5 w-4.5 shrink-0 icon-glow" />
              </span>
              {expanded && <span className="text-xs font-medium truncate">Help</span>}
            </button>
          </FlareTooltip>

          <div className={expanded ? "w-full" : ""}>
            {renderNavItem("settings", PrecisionGearIcon, "Settings")}
          </div>

          <FlareTooltip label="Global Settings">
            <button
              onClick={() => navigate("/settings/admin")}
              data-help-id="nav-global-settings"
              className={cn(
                "flex items-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground hover:[box-shadow:0_0_12px_-3px_rgba(47,125,255,0.2)] transition-all duration-200",
                expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center"
              )}
            >
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
                <MixingConsoleIcon className="h-4.5 w-4.5 shrink-0 icon-glow" />
              </span>
              {expanded && <span className="text-xs font-medium truncate">Global Settings</span>}
            </button>
          </FlareTooltip>

          <FlareTooltip label="Sign Out">
            <button
              onClick={async () => { await signOut(); navigate("/login"); }}
              className={cn(
                "flex items-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200",
                expanded ? "h-10 gap-3 px-3 w-full" : "h-10 w-10 justify-center"
              )}
            >
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/30">
                <PowerIcon className="h-3.5 w-3.5 shrink-0 icon-glow" />
              </span>
              {expanded && <span className="text-xs font-medium truncate">Sign Out</span>}
            </button>
          </FlareTooltip>
        </div>
      </aside>

      {/* Right content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-border px-6 pro-panel specular-edge overflow-hidden" style={{ borderRadius: 0 }}>
          {/* Anamorphic streak */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[1.5px] opacity-60" style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(124,203,255,0.1) 15%, rgba(124,203,255,0.35) 45%, rgba(124,203,255,0.5) 50%, rgba(124,203,255,0.35) 55%, rgba(124,203,255,0.1) 85%, transparent 95%)', filter: 'blur(1px)', animation: 'streak-pulse 6s ease-in-out infinite' }} />
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[6px] opacity-20" style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(124,203,255,0.15) 30%, rgba(124,203,255,0.3) 50%, rgba(124,203,255,0.15) 70%, transparent 90%)', filter: 'blur(4px)', animation: 'streak-pulse 6s ease-in-out infinite' }} />
          </div>
          <div className="relative flex items-center gap-3 z-10">
            {/* Anamorphic lens flare behind title */}
            <div className="pointer-events-none absolute -inset-x-8 -inset-y-4 z-0" style={{ animation: 'flare-breathe 5s ease-in-out infinite' }}>
              {/* Core horizontal flare */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(47,125,255,0.2) 15%, rgba(124,203,255,0.6) 40%, rgba(200,230,255,0.9) 50%, rgba(124,203,255,0.6) 60%, rgba(47,125,255,0.2) 85%, transparent 100%)', filter: 'blur(1.5px)', animation: 'streak-pulse 3.5s ease-in-out infinite' }} />
              {/* Wide diffused glow */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[18px]" style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(47,125,255,0.05) 20%, rgba(124,203,255,0.2) 40%, rgba(124,203,255,0.35) 50%, rgba(124,203,255,0.2) 60%, rgba(47,125,255,0.05) 80%, transparent 95%)', filter: 'blur(8px)', animation: 'streak-pulse 5s ease-in-out infinite 0.5s' }} />
              {/* Vertical cross-flare */}
              <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px]" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(124,203,255,0.15) 30%, rgba(200,230,255,0.4) 50%, rgba(124,203,255,0.15) 70%, transparent 100%)', filter: 'blur(2px)', animation: 'streak-pulse 4.5s ease-in-out infinite 1s' }} />
            </div>
            <FilmStripIcon className="relative z-10 h-5 w-5 text-primary icon-glow" />
            <span className="relative z-10 font-display text-[1.9rem] leading-tight font-extrabold tracking-wide text-foreground drop-shadow-[0_0_12px_rgba(124,203,255,0.4)]">
              Virtual Film Studio
            </span>
          </div>

          {/* Centered film name + version */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              title="View versions"
            >
              <VersionsIcon className="h-3.5 w-3.5 text-primary icon-glow" />
              <span className="font-display truncate max-w-[200px]">
                {film?.title ?? "Loading…"}
              </span>
              {film?.version_name && (
                <span className="text-muted-foreground">— {film.version_name}</span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {isAnalyzing && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Loader2 className="h-3 w-3 animate-spin" /> Analyzing…
              </span>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main
          className="relative flex-1 overflow-hidden transition-colors duration-300 lens-flare lens-flare-streak"
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
