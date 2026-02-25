import { Navigate, useParams } from "react-router-dom";
import { useAccessControl } from "@/hooks/useAccessControl";

interface AccessGuardProps {
  phase?: string;
  children: React.ReactNode;
}

const AccessGuard = ({ phase, children }: AccessGuardProps) => {
  const { projectId } = useParams();
  const { isAdmin, isLoading, hasPhaseAccess, hasProjectAccess } = useAccessControl();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-mono">Checking access…</p>
        </div>
      </div>
    );
  }

  if (isAdmin) return <>{children}</>;

  // Check project access
  if (projectId && !hasProjectAccess(projectId)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="font-display text-2xl font-bold">Access Restricted</h1>
          <p className="text-muted-foreground text-sm">
            You don't have access to this project. Contact your administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  // Check phase access
  if (phase && !hasPhaseAccess(phase)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="font-display text-2xl font-bold">Phase Locked</h1>
          <p className="text-muted-foreground text-sm">
            You don't have access to this production phase. Contact your administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AccessGuard;
