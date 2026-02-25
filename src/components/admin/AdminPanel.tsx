import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Database, Activity, Shield, Radio } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const ADMIN_EMAIL = "paul@greenbergdirect.com";

export const isAdminUser = (email?: string | null) =>
  email?.toLowerCase() === ADMIN_EMAIL;

const AdminPanel = () => {
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

  const { data: userProfiles } = useQuery({
    queryKey: ["admin-user-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("user_id, full_name, email");
      if (error) throw error;
      const map: Record<string, { name: string; email: string }> = {};
      data?.forEach((p) => { map[p.user_id] = { name: p.full_name, email: p.email }; });
      return map;
    },
  });

  // Active users = distinct users with activity in the last 15 minutes
  const { data: activeNow } = useQuery({
    queryKey: ["admin-active-users"],
    queryFn: async () => {
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("activity_logs")
        .select("user_id")
        .gte("created_at", since);
      if (error) throw error;
      return new Set(data?.map((r) => r.user_id).filter(Boolean)).size;
    },
    refetchInterval: 30_000,
  });

  const uniqueUsers = new Set(allProjects?.map((p) => p.user_id).filter(Boolean));
  const totalCreditsUsed = allFilms?.reduce((sum, f) => sum + (f.credits || 0), 0) || 0;
  const recentCreditsUsed = creditLogs?.reduce((sum, l) => sum + (l.credits_used || 0), 0) || 0;
  const userName = (uid: string | null) => {
    if (!uid || !userProfiles) return "—";
    return userProfiles[uid]?.name || userProfiles[uid]?.email || uid.slice(0, 8) + "…";
  };

  const stats = [
    { icon: Radio, label: "Active Now", value: activeNow ?? 0, highlight: true },
    { icon: Users, label: "Users", value: uniqueUsers.size },
    { icon: Database, label: "Projects", value: allProjects?.length || 0 },
    { icon: Activity, label: "Versions", value: allFilms?.length || 0 },
    { icon: Activity, label: "Credits Allocated", value: totalCreditsUsed.toLocaleString() },
    { icon: Activity, label: "Credits Used (recent 50)", value: recentCreditsUsed.toLocaleString() },
  ];

  return (
    <div className="rounded-xl border border-border bg-card cinema-inset overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/30">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-display font-bold uppercase tracking-widest text-primary">
          Admin Panel
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-px bg-border/40">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between bg-card px-3 py-2"
          >
            <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 truncate">
              <s.icon className={`h-3 w-3 shrink-0 ${s.highlight ? "text-green-400" : ""}`} />
              {s.label}
            </span>
            <span className={`text-xs font-display font-bold ${s.highlight ? "text-green-400" : "text-foreground"}`}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Users List */}
      <div className="border-t border-border">
        <div className="px-3 py-2 bg-secondary/30">
          <span className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground">
            Users by Project
          </span>
        </div>
        <ScrollArea className="max-h-40">
          <div className="divide-y divide-border/40">
            {allProjects?.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-1.5 text-[11px]"
              >
                <span className="truncate text-foreground font-medium max-w-[120px]" title={p.title}>
                  {p.title}
                </span>
                <span className="text-muted-foreground font-mono truncate max-w-[100px]" title={p.user_id || ""}>
                  {userName(p.user_id)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AdminPanel;
