import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useFilm } from "@/hooks/useFilm";
import { useAuth } from "@/hooks/useAuth";
import {
  Code2,
  Clapperboard,
  Video,
  Film,
  Rocket,
  Settings,
  LogOut,
} from "lucide-react";

const sidebarRoutes = [
  { to: "/development", icon: Code2, label: "Development" },
  { to: "/pre-production", icon: Clapperboard, label: "Pre-Production" },
  { to: "/production", icon: Video, label: "Production" },
  { to: "/post-production", icon: Film, label: "Post-Production" },
  { to: "/release", icon: Rocket, label: "Release" },
];

const Layout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { data: film } = useFilm();
  const { user, signOut } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left Sidebar */}
      <aside className="flex h-full w-16 flex-col items-center border-r border-border bg-card py-4">
        <nav className="flex flex-1 flex-col items-center gap-1">
          {sidebarRoutes.map((route) => {
            const isActive =
              location.pathname === route.to ||
              location.pathname.startsWith(route.to + "/");
            return (
              <NavLink
                key={route.to}
                to={route.to}
                title={route.label}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
                  isActive
                    ? "text-primary cinema-glow"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <route.icon className="h-5 w-5" />
              </NavLink>
            );
          })}
        </nav>

        {/* Settings at bottom */}
        <NavLink
          to="/settings/integrations"
          title="Settings"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
            location.pathname.startsWith("/settings")
              ? "text-primary cinema-glow"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Settings className="h-5 w-5" />
        </NavLink>
      </aside>

      {/* Right content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <h1 className="font-display text-base font-semibold tracking-tight">
            {film?.title ?? "Loading…"}
          </h1>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Credits: {film?.credits?.toLocaleString() ?? "—"}
            </span>

            <button
              onClick={signOut}
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
            >
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
