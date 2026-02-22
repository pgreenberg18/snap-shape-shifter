import { Film, Clapperboard, Users, Settings, LayoutDashboard, Sparkles } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/workspace/demo", icon: Clapperboard, label: "Workspace" },
  { to: "#", icon: Users, label: "Cast & Crew" },
  { to: "#", icon: Sparkles, label: "AI Studio" },
  { to: "#", icon: Settings, label: "Settings" },
];

const AppSidebar = () => {
  const location = useLocation();

  return (
    <aside className="flex h-screen w-16 flex-col items-center border-r border-border bg-card py-6 gap-2">
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
        <Film className="h-5 w-5 text-primary-foreground" />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to !== "/" && location.pathname.startsWith(item.to.split("/").slice(0, 2).join("/")));
          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={cn(
                "group flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary cinema-glow"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title={item.label}
            >
              <item.icon className="h-5 w-5" />
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default AppSidebar;
