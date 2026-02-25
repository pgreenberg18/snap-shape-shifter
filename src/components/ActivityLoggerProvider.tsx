import { useActivityLogger, logAuthEvent } from "@/hooks/useActivityLogger";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";

const ActivityLoggerProvider = () => {
  useActivityLogger();

  const { session } = useAuth();
  const prevSession = useRef<string | null>(null);

  // Log auth events when session changes
  useEffect(() => {
    const currentId = session?.user?.id || null;
    if (currentId && currentId !== prevSession.current) {
      logAuthEvent("SIGNED_IN");
    }
    prevSession.current = currentId;
  }, [session?.user?.id]);

  return null;
};

export default ActivityLoggerProvider;
