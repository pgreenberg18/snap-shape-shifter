import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useOnboardingGuard = () => {
  const { user, loading: authLoading } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile-onboarding", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("onboarding_complete")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const needsOnboarding = !authLoading && !!user && !profileLoading && !profile?.onboarding_complete;
  const isLoading = authLoading || (!!user && profileLoading);

  return { needsOnboarding, isLoading };
};
