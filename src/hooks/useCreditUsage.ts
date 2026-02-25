import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CreditUsageSummary {
  total: number;
  byService: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface CreditUsageSettings {
  id?: string;
  warning_threshold: number | null;
  cutoff_threshold: number | null;
  warning_period: string;
}

function getDateRange(period: "week" | "month" | "year"): Date {
  const now = new Date();
  switch (period) {
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
  }
}

export function useCreditUsage(period: "week" | "month" | "year" = "month") {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["credit-usage", user?.id, period],
    queryFn: async (): Promise<CreditUsageSummary> => {
      const since = getDateRange(period);
      const { data, error } = await supabase
        .from("credit_usage_logs")
        .select("service_name, service_category, credits_used")
        .eq("user_id", user!.id)
        .gte("created_at", since.toISOString());

      if (error) throw error;

      const byService: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      let total = 0;

      for (const row of data || []) {
        const credits = Number(row.credits_used) || 0;
        total += credits;
        byService[row.service_name] = (byService[row.service_name] || 0) + credits;
        byCategory[row.service_category] = (byCategory[row.service_category] || 0) + credits;
      }

      return { total, byService, byCategory };
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
}

export function useCreditSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["credit-settings", user?.id],
    queryFn: async (): Promise<CreditUsageSettings | null> => {
      const { data, error } = await supabase
        .from("credit_usage_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as CreditUsageSettings | null;
    },
    enabled: !!user?.id,
  });
}
