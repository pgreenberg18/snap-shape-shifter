import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_EMAIL = "paul@greenbergdirect.com";

export interface AccessControls {
  access_development: boolean;
  access_pre_production: boolean;
  access_production: boolean;
  access_post_production: boolean;
  access_release: boolean;
  access_sample_projects: boolean;
  allowed_project_ids: string[] | null;
}

export function useAccessControl() {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const { data: controls, isLoading } = useQuery({
    queryKey: ["access-controls", user?.id],
    queryFn: async (): Promise<AccessControls | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_access_controls")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as AccessControls | null;
    },
    enabled: !!user?.id,
  });

  const hasPhaseAccess = (phase: string): boolean => {
    if (isAdmin) return true;
    if (!controls) return false;
    switch (phase) {
      case "development": return controls.access_development;
      case "pre-production": return controls.access_pre_production;
      case "production": return controls.access_production;
      case "post-production": return controls.access_post_production;
      case "release": return controls.access_release;
      default: return false;
    }
  };

  const hasProjectAccess = (projectId: string): boolean => {
    if (isAdmin) return true;
    if (!controls?.allowed_project_ids) return false;
    return controls.allowed_project_ids.includes(projectId);
  };

  return {
    isAdmin,
    controls,
    isLoading,
    hasPhaseAccess,
    hasProjectAccess,
  };
}
