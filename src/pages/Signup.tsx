import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Film } from "lucide-react";
import { lovable } from "@/integrations/lovable";

const Signup = () => {
  const { session, loading: authLoading } = useAuth();

  if (authLoading) return null;
  if (session) return <Navigate to="/projects" replace />;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left — Cinematic Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center lens-flare">
        <div className="absolute inset-0 cinema-panel" />
        <div className="absolute inset-0 cinema-bloom" />
        <div className="absolute inset-0 lens-flare-streak" />
        <div className="relative z-10 text-center space-y-6 px-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl pro-panel">
            <Film className="h-10 w-10 text-primary icon-glow" />
          </div>
          <h1 className="font-display text-4xl font-bold tracking-wide">Virtual Film Studio</h1>
          <p className="text-muted-foreground text-lg max-w-sm mx-auto leading-relaxed font-body">
            Create your account and start directing AI-powered films in minutes.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground/60 font-mono uppercase tracking-[0.2em]">
            <span>Script</span>
            <span className="h-1 w-1 rounded-full bg-primary/40" />
            <span>Direct</span>
            <span className="h-1 w-1 rounded-full bg-primary/40" />
            <span>Release</span>
          </div>
        </div>
      </div>

      {/* Right — Signup */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex flex-col items-center gap-3 mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl pro-panel">
              <Film className="h-7 w-7 text-primary icon-glow" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-wide">Virtual Film Studio</h1>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold tracking-wide">Create your account</h2>
            <p className="text-sm text-muted-foreground mt-1 font-body">Set up your studio workspace</p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-3 h-12 text-base"
            onClick={async () => {
              await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin + "/projects",
              });
            }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Signup;
