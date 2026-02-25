import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Database, Activity, Shield } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const ADMIN_EMAIL = "paul@greenbergdirect.com";

export const isAdminUser = (email?: string | null) =>
  email?.toLowerCase() === ADMIN_EMAIL;

const AdminPanel = () => {
  // Fetch all users via auth admin isn't available client-side,
  // so we query projects to get unique user_ids, then show system stats
  const { data: allProjects } = useQuery({
    queryKey: ["admin-all-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, user_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allFilms } = useQuery({
    queryKey: ["admin-all-films"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("films")
        .select("id, title, project_id, credits, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: creditLogs } = useQuery({
    queryKey: ["admin-credit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_usage_logs")
        .select("id, user_id, credits_used, operation, service_name, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const uniqueUsers = new Set(allProjects?.map((p) => p.user_id).filter(Boolean));
  const totalCreditsUsed = creditLogs?.reduce((sum, l) => sum + (l.credits_used || 0), 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Admin Panel
        </h3>
      </div>

      {/* System Stats */}
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Users
          </span>
          <span className="text-sm font-display font-bold text-foreground">
            {uniqueUsers.size}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Database className="h-3 w-3" /> Total Projects
          </span>
          <span className="text-sm font-display font-bold text-foreground">
            {allProjects?.length || 0}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3 w-3" /> Total Versions
          </span>
          <span className="text-sm font-display font-bold text-foreground">
            {allFilms?.length || 0}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3 w-3" /> Credits Used (recent)
          </span>
          <span className="text-sm font-display font-bold text-foreground">
            {totalCreditsUsed.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Users List */}
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Users by Project
        </h4>
        <ScrollArea className="max-h-48">
          <div className="space-y-1">
            {allProjects?.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2 text-xs"
              >
                <span className="truncate text-foreground font-medium max-w-[120px]" title={p.title}>
                  {p.title}
                </span>
                <span className="text-muted-foreground text-[10px] font-mono truncate max-w-[80px]" title={p.user_id || ""}>
                  {p.user_id ? p.user_id.slice(0, 8) + "…" : "—"}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Recent Credit Usage */}
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Recent Credit Usage
        </h4>
        <ScrollArea className="max-h-40">
          <div className="space-y-1">
            {creditLogs?.slice(0, 20).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2 text-xs"
              >
                <span className="truncate text-foreground max-w-[100px]" title={log.operation}>
                  {log.service_name}
                </span>
                <span className="text-primary font-mono font-medium">
                  -{log.credits_used}
                </span>
              </div>
            ))}
            {(!creditLogs || creditLogs.length === 0) && (
              <p className="text-xs text-muted-foreground px-3 py-2">No usage yet</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AdminPanel;
