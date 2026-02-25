import { Navigate } from "react-router-dom";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";

const OnboardingGuard = ({ children }: { children: React.ReactNode }) => {
  const { needsOnboarding, isLoading } = useOnboardingGuard();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-mono">Loading…</p>
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default OnboardingGuard;
