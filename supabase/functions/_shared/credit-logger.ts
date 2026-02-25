import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

/**
 * Log a credit usage event. Uses the service role to insert regardless of RLS.
 * Call this after a successful AI API call in any edge function.
 */
export async function logCreditUsage(params: {
  userId: string;
  filmId?: string | null;
  serviceName: string;
  serviceCategory: string;
  operation: string;
  credits?: number;
}) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    await sb.rpc("log_credit_usage", {
      p_user_id: params.userId,
      p_film_id: params.filmId || null,
      p_service_name: params.serviceName,
      p_service_category: params.serviceCategory,
      p_operation: params.operation,
      p_credits: params.credits ?? 1,
    });
  } catch (e) {
    // Don't let logging failures break the main flow
    console.error("Credit logging failed:", e);
  }
}
