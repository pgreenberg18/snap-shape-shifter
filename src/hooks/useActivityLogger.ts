import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useActivityLogger = () => {
  const { user } = useAuth();
  const location = useLocation();
  const lastPath = useRef<string>("");

  // Log page views on route change
  useEffect(() => {
    if (!user || location.pathname === lastPath.current) return;
    lastPath.current = location.pathname;

    const logPageView = async () => {
      try {
        // Get IP + geo (best effort)
        let ip = "";
        let city = "";
        let region = "";
        let country = "";
        try {
          const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const geo = await res.json();
            ip = geo.ip || "";
            city = geo.city || "";
            region = geo.region || "";
            country = geo.country_name || "";
          }
        } catch {
          // Geo lookup failed, that's fine
        }

        await supabase.from("activity_logs").insert({
          user_id: user.id,
          user_email: user.email || "",
          user_name: user.user_metadata?.full_name || "",
          event_type: "page_view",
          page_path: location.pathname,
          ip_address: ip,
          city,
          region,
          country,
        });
      } catch {
        // Silent fail - logging should never block UX
      }
    };

    logPageView();
  }, [user, location.pathname]);
};

export const logAuthEvent = async (eventType: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    let ip = "";
    let city = "";
    let region = "";
    let country = "";
    try {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const geo = await res.json();
        ip = geo.ip || "";
        city = geo.city || "";
        region = geo.region || "";
        country = geo.country_name || "";
      }
    } catch {}

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_email: user.email || "",
      user_name: user.user_metadata?.full_name || "",
      event_type: eventType,
      ip_address: ip,
      city,
      region,
      country,
    });
  } catch {}
};
