import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import AdminPanel, { isAdminUser } from "@/components/admin/AdminPanel";
import NDADocument from "@/components/admin/NDADocument";
import MediaLibraryPanel from "@/components/settings/MediaLibraryPanel";
import { useCreditUsage, useCreditSettings } from "@/hooks/useCreditUsage";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  FileSignature, Shield, Download, RotateCcw, Activity,
  Trash2, ChevronDown, ChevronRight, ArrowLeft, Eye,
  Users, Settings, Image, Gauge, Plug,
  Lock, Unlock, ShieldAlert,
} from "lucide-react";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ─── Your Signed NDA ─── */
const YourNDA = ({ userId }: { userId: string }) => {
  const { data: profile } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!profile?.nda_signed) {
    return <p className="text-sm text-muted-foreground">No NDA on file.</p>;
  }

  return (
    <NDADocument
      fullName={profile.full_name}
      email={profile.email}
      phone={profile.phone}
      address={profile.address}
      signatureData={profile.signature_data}
      ndaSignedAt={profile.nda_signed_at}
    />
  );
};

/* ─── All Signed NDAs (Admin) ─── */
const AllNDAs = () => {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; name: string } | null>(null);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from("user_access_controls").delete().eq("user_id", userId);
      await supabase.from("activity_logs").delete().eq("user_id", userId);
      await supabase.from("user_profiles").delete().eq("user_id", userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      setDeleteTarget(null);
      toast.success("User data removed");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      {!profiles?.length ? (
        <p className="text-sm text-muted-foreground">No signed NDAs yet.</p>
      ) : (
        profiles.map((p) => (
          <Collapsible key={p.id}>
            <div className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors">
                <div className="text-left">
                  <p className="text-[11px] font-medium text-foreground">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Signed: {p.nda_signed_at ? new Date(p.nda_signed_at).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ userId: p.user_id, name: p.full_name });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <NDADocument
                  fullName={p.full_name}
                  email={p.email}
                  phone={p.phone}
                  address={p.address}
                  signatureData={p.signature_data}
                  ndaSignedAt={p.nda_signed_at}
                />
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove their profile, NDA, access controls, and activity logs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteUser.mutate(deleteTarget.userId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ─── Credit Usage Section ─── */
const CATEGORY_LABELS: Record<string, string> = {
  "script-analysis": "Script Analysis",
  "image-generation": "Image Generation",
  "sound-stage": "Voice & Audio",
  "camera-cart": "Video Generation",
  "post-house": "Post-Production",
};

const CreditUsageSection = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const { data: usage } = useCreditUsage(period);
  const { data: settings } = useCreditSettings();

  // Fetch all configured integrations for this user
  const { data: integrations } = useQuery({
    queryKey: ["user-integrations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("provider_name, section_id, is_verified")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const total = usage?.total ?? 0;
  const warningThreshold = settings?.warning_threshold ? Number(settings.warning_threshold) : null;
  const cutoffThreshold = settings?.cutoff_threshold ? Number(settings.cutoff_threshold) : null;

  // Group integrations by category and merge credit usage
  const categorizedServices = (() => {
    const cats: Record<string, { name: string; credits: number; verified: boolean }[]> = {};
    for (const integ of integrations || []) {
      const cat = integ.section_id;
      if (!cats[cat]) cats[cat] = [];
      const credits = usage?.byService[integ.provider_name] ?? 0;
      cats[cat].push({ name: integ.provider_name, credits, verified: integ.is_verified });
    }
    return cats;
  })();

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {(["week", "month", "year"] as const).map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p)}
            className="text-xs uppercase tracking-wider"
          >
            {p === "week" ? "This Week" : p === "month" ? "This Month" : "This Year"}
          </Button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Total Used</p>
          <p className="font-display text-lg font-bold text-foreground">{total.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Warning At</p>
          <p className="font-display text-lg font-bold text-foreground">{warningThreshold ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Cutoff At</p>
          <p className="font-display text-lg font-bold text-foreground">{cutoffThreshold ?? "—"}</p>
        </div>
      </div>

      {/* Services by Category with per-integration subtotals */}
      {Object.keys(categorizedServices).length > 0 ? (
        <div className="space-y-5">
          {Object.entries(categorizedServices)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cat, services]) => {
              const categoryTotal = services.reduce((sum, s) => sum + s.credits, 0);
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {CATEGORY_LABELS[cat] || cat}
                    </h3>
                    <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                      {categoryTotal.toFixed(0)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {services
                      .sort((a, b) => b.credits - a.credits || a.name.localeCompare(b.name))
                      .map((svc) => (
                        <div key={svc.name} className="flex items-center justify-between rounded-md bg-secondary/30 border border-border px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-foreground">{svc.name}</span>
                            {svc.verified && (
                              <span className="text-[9px] uppercase tracking-wider bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">
                                Active
                              </span>
                            )}
                          </div>
                          <span className={`font-mono text-[11px] font-medium tabular-nums ${svc.credits > 0 ? "text-primary" : "text-muted-foreground/40"}`}>
                            {svc.credits.toFixed(0)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-12 text-center">
          <Gauge className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/60 font-mono">No services configured yet.</p>
          <p className="text-xs text-muted-foreground/40 mt-1">Add API integrations from the Integrations page to see them here.</p>
        </div>
      )}
    </div>
  );
};

/* ─── Access Control (Admin) ─── */
const AccessControl = () => {
  const queryClient = useQueryClient();

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: accessMap } = useQuery({
    queryKey: ["all-access-controls"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_access_controls").select("*");
      if (error) throw error;
      const map: Record<string, any> = {};
      data?.forEach((a) => (map[a.user_id] = a));
      return map;
    },
  });

  const toggleAccess = useMutation({
    mutationFn: async ({ userId, field, value }: { userId: string; field: string; value: boolean }) => {
      const existing = accessMap?.[userId];
      if (existing) {
        const { error } = await supabase
          .from("user_access_controls")
          .update({ [field]: value })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_access_controls")
          .insert({ user_id: userId, [field]: value });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-access-controls"] }),
    onError: (e) => toast.error(e.message),
  });

  const phases = [
    { key: "access_development", label: "Development" },
    { key: "access_pre_production", label: "Pre-Production" },
    { key: "access_production", label: "Production" },
    { key: "access_post_production", label: "Post-Production" },
    { key: "access_release", label: "Release" },
    { key: "access_sample_projects", label: "Sample Projects" },
  ];

  const getLockStatus = (access: any) => {
    const count = phases.filter(({ key }) => !!access[key]).length;
    if (count === 0) return "locked";
    if (count === phases.length) return "unlocked";
    return "partial";
  };

  const LockIcon = ({ status }: { status: string }) => {
    if (status === "unlocked") return <Unlock className="h-4 w-4 text-green-500" />;
    if (status === "partial") return <ShieldAlert className="h-4 w-4 text-yellow-500" />;
    return <Lock className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="space-y-2">
      {!profiles?.length ? (
        <p className="text-sm text-muted-foreground">No users yet.</p>
      ) : (
        profiles.map((p) => {
          const access = accessMap?.[p.user_id] || {};
          const status = getLockStatus(access);
          return (
            <Collapsible key={p.user_id}>
              <div className="rounded-lg border border-border bg-secondary/30">
                <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3">
                  <LockIcon status={status} />
                  <span className="text-[11px] font-medium text-foreground flex-1 text-left">{p.full_name}</span>
                  <span className="text-[11px] text-muted-foreground/60 font-mono mr-2">{p.email}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {phases.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between rounded bg-background/50 px-3 py-2">
                        <span className="text-xs text-foreground">{label}</span>
                        <Switch
                          checked={!!access[key]}
                          onCheckedChange={(v) =>
                            toggleAccess.mutate({ userId: p.user_id, field: key, value: v })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })
      )}
    </div>
  );
};

/* ─── Login Records (Admin) ─── */
const LoginRecords = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  // Group by user_email
  const grouped: Record<string, typeof logs> = {};
  logs?.forEach((log) => {
    const key = log.user_email || "unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key]!.push(log);
  });

  // Sort groups by most recent activity
  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    const aTime = new Date(a[1]![0].created_at).getTime();
    const bTime = new Date(b[1]![0].created_at).getTime();
    return bTime - aTime;
  });

  return (
    <div className="space-y-3">
      {!sortedGroups.length ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        sortedGroups.map(([email, entries]) => {
          const latest = entries![0];
          const pageViews = entries!.filter((e) => e.event_type === "page_view");
          const loginEvents = entries!.filter((e) => e.event_type !== "page_view");

          return (
            <Collapsible key={email}>
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <div className="text-left">
                    <p className="text-[11px] font-medium text-foreground">
                      {latest.user_name || email}
                    </p>
                    <p className="text-xs text-muted-foreground">{email}</p>
                    <p className="text-[11px] text-muted-foreground/60">
                      Last: {new Date(latest.created_at).toLocaleString()}
                      {latest.city && ` · ${latest.city}, ${latest.region || ""} ${latest.country || ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{loginEvents.length} logins</span>
                    <span>·</span>
                    <span>{pageViews.length} pages</span>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-1">
                  {loginEvents.length > 0 && (
                    <div className="mb-2">
                      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Sessions</p>
                      {loginEvents.slice(0, 10).map((e) => (
                        <div key={e.id} className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                          <Activity className="h-3 w-3 text-primary/60" />
                          <span>{e.event_type}</span>
                          <span className="ml-auto">{new Date(e.created_at).toLocaleString()}</span>
                          {e.ip_address && <span className="text-muted-foreground/50">{e.ip_address}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {pageViews.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Pages Visited</p>
                      {pageViews.slice(0, 20).map((e) => (
                        <div key={e.id} className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                          <Eye className="h-3 w-3 text-muted-foreground/40" />
                          <span className="font-mono">{e.page_path}</span>
                          <span className="ml-auto">{new Date(e.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })
      )}
    </div>
  );
};

/* ─── Main Settings Page ─── */
const SettingsAdmin = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isAdminUser(user?.email);

  // Support deep-linking via ?section= query param; default to no selection
  const searchParams = new URLSearchParams(window.location.search);
  const sectionParam = searchParams.get("section");
  const [activeSection, setActiveSection] = useState<string | null>(sectionParam);

  const handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    signOut();
    toast.success("App reset. You have been signed out.");
  };

  const userSections = [
    { id: "your-nda", label: "Your Signed NDA", icon: FileSignature },
    { id: "integrations", label: "Integrations", icon: Plug },
    { id: "credit-usage", label: "Credit Usage", icon: Gauge },
    { id: "media-library", label: "Media Library", icon: Image },
    { id: "reset-app", label: "Reset App", icon: RotateCcw },
  ];

  const adminSections = [
    { id: "admin-dashboard", label: "Admin Dashboard", icon: Activity },
    { id: "all-ndas", label: "All Signed NDAs", icon: Users },
    { id: "access-control", label: "Access Control", icon: Shield },
    { id: "downloads", label: "Downloads", icon: Download },
    { id: "login-records", label: "Login Records", icon: Activity },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <Button variant="ghost" className="gap-2 w-full justify-start" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4" /> Back to Projects
          </Button>
        </div>
        <div className="p-3 flex-1 flex flex-col">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary px-3 mb-2">
            <Settings className="inline h-3 w-3 mr-1" />
            Settings
          </h2>
          <nav className="space-y-0.5">
            {userSections.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  if (s.id === "integrations") {
                    navigate("/settings");
                  } else {
                    setActiveSection(s.id);
                  }
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  activeSection === s.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </button>
            ))}
          </nav>

          {isAdmin && (
            <>
              <div className="border-t border-border my-4" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2">
                <Shield className="inline h-3 w-3 mr-1" />
                System Management
              </h2>
              <nav className="space-y-0.5">
                {adminSections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      activeSection === s.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <s.icon className="h-4 w-4" />
                    {s.label}
                  </button>
                ))}
              </nav>
            </>
          )}
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl">
          {!activeSection && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <Settings className="h-10 w-10 text-muted-foreground/20 mb-4" />
              <h2 className="font-display text-lg font-bold text-foreground mb-2">Settings</h2>
              <p className="text-xs text-muted-foreground max-w-sm">Select a section from the sidebar to view or manage your account, integrations, credit usage, and more.</p>
            </div>
          )}

          {activeSection === "your-nda" && (
            <div>
              <h2 className="font-display text-lg font-bold text-foreground mb-4">Your Signed NDA</h2>
              <p className="text-xs text-muted-foreground mb-6">Review your signed non-disclosure agreement.</p>
              {user && <YourNDA userId={user.id} />}
            </div>
          )}

          {activeSection === "credit-usage" && (
            <div>
              <h2 className="font-display text-lg font-bold text-foreground mb-4">Credit Usage</h2>
              <p className="text-xs text-muted-foreground mb-6">Your personal AI credit consumption breakdown by service and category.</p>
              <CreditUsageSection />
            </div>
          )}

          {activeSection === "media-library" && (
            <div>
              <h2 className="font-display text-lg font-bold text-foreground mb-4">Media Library</h2>
              <p className="text-xs text-muted-foreground mb-6">Browse all uploaded and generated media across your projects, organized by category.</p>
              <MediaLibraryPanel />
            </div>
          )}


          {activeSection === "admin-dashboard" && isAdmin && (
            <div>
              <h2 className="font-display text-lg font-bold text-foreground mb-4">Admin Dashboard</h2>
              <p className="text-xs text-muted-foreground mb-6">System-wide overview of users, projects, versions, and credit allocation.</p>
              <AdminPanel />
            </div>
          )}

          {activeSection === "all-ndas" && isAdmin && (
            <div>
              <h2 className="font-display text-lg font-bold text-foreground mb-4">All Signed NDAs</h2>
              <p className="text-xs text-muted-foreground mb-6">View and manage all user NDAs. Deleting a user removes their NDA, access controls, and activity logs.</p>
              <AllNDAs />
            </div>
          )}

          {activeSection === "access-control" && isAdmin && (
            <div>
              <h2 className="font-display text-lg font-bold text-foreground mb-4">Access Control</h2>
              <p className="text-xs text-muted-foreground mb-6">Grant or revoke access to phases and content for each user.</p>
              <AccessControl />
            </div>
          )}

          {activeSection === "downloads" && isAdmin && (
            <div>
              <h2 className="font-display text-lg font-bold text-foreground mb-4">Downloads</h2>
              <p className="text-xs text-muted-foreground mb-6">Export content as PDF, images, text, or HTML files.</p>
              <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-8 text-center">
                <Download className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Download center coming soon.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Frame grabs, instruction manuals, and script breakdowns will be exportable here.</p>
              </div>
            </div>
          )}

          {activeSection === "login-records" && isAdmin && (
            <div>
              <h2 className="font-display text-lg font-bold text-foreground mb-4">Login Records</h2>
              <p className="text-xs text-muted-foreground mb-6">Audit trail of login events and page navigation across all users.</p>
              <LoginRecords />
            </div>
          )}

          {activeSection === "reset-app" && (
            <div>
              <h2 className="font-display text-lg font-bold text-foreground mb-4">Reset App</h2>
              <p className="text-xs text-muted-foreground mb-6">Clear all local cached data and sign out. This does not delete your account or server-side data.</p>
              <Button variant="destructive" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Reset &amp; Sign Out
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SettingsAdmin;
