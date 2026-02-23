import { ReactNode } from "react";
import { NavLink, useLocation, useParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useFilm } from "@/hooks/useFilm";
import {
  FileText,
  Clapperboard,
  Video,
  Film,
  Rocket,
  Settings,
  Layers,
  ArrowLeft,
} from "lucide-react";

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

  const basePath = `/projects/${projectId}/versions/${versionId}`;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left Sidebar */}
      <aside className="flex h-full w-16 flex-col items-center border-r border-border bg-card py-4">
        {/* Back to project */}
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          title="Back to versions"
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <nav className="flex flex-1 flex-col items-center gap-1">
          {phases.map((phase) => {
            const to = `${basePath}/${phase.key}`;
            const isActive = location.pathname.includes(`/${phase.key}`);
            return (
              <NavLink
                key={phase.key}
                to={to}
                title={phase.label}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
                  isActive
                    ? "text-primary cinema-glow"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <phase.icon className="h-5 w-5" />
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom nav */}
        <div className="flex flex-col items-center gap-1 mb-2">
          {[
            { key: "global-assets", icon: Layers, label: "Global Assets" },
            { key: "settings", icon: Settings, label: "Settings" },
          ].map((item) => {
            const to = `${basePath}/${item.key}`;
            const isActive = location.pathname.includes(`/${item.key}`);
            return (
              <NavLink
                key={item.key}
                to={to}
                title={item.label}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
                  isActive
                    ? "text-primary cinema-glow"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
              </NavLink>
            );
          })}
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
