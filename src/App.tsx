import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { HelpProvider } from "@/components/help/HelpPanel";
import HelpPanel from "@/components/help/HelpPanel";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AccessGuard from "@/components/AccessGuard";
import OnboardingGuard from "@/components/OnboardingGuard";
import ActivityLoggerProvider from "@/components/ActivityLoggerProvider";
import ContextualHelpProvider from "@/components/ContextualHelpProvider";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Onboarding from "@/pages/Onboarding";
import TermsNDA from "@/pages/TermsNDA";
import Projects from "@/pages/Projects";
import ProjectVersions from "@/pages/ProjectVersions";
import Development from "@/pages/Development";
import PreProduction from "@/pages/PreProduction";
import Production from "@/pages/Production";
import PostProduction from "@/pages/PostProduction";
import Release from "@/pages/Release";
import SettingsIntegrations from "@/pages/SettingsIntegrations";
import SettingsAdmin from "@/pages/SettingsAdmin";
import VersionSettings from "@/pages/VersionSettings";
import GlobalAssets from "@/pages/GlobalAssets";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const VersionLayout = ({ children }: { children: React.ReactNode }) => (
  <Layout>{children}</Layout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <HelpProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ActivityLoggerProvider />
            <ContextualHelpProvider />
            <HelpPanel />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/terms-nda" element={<TermsNDA />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/projects" element={<ProtectedRoute><OnboardingGuard><Projects /></OnboardingGuard></ProtectedRoute>} />
              <Route path="/projects/:projectId" element={<ProtectedRoute><OnboardingGuard><AccessGuard><ProjectVersions /></AccessGuard></OnboardingGuard></ProtectedRoute>} />

              {/* Version-scoped phase routes */}
              <Route path="/projects/:projectId/versions/:versionId/development" element={<ProtectedRoute><OnboardingGuard><AccessGuard phase="development"><VersionLayout><Development /></VersionLayout></AccessGuard></OnboardingGuard></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/pre-production" element={<ProtectedRoute><OnboardingGuard><AccessGuard phase="pre-production"><VersionLayout><PreProduction /></VersionLayout></AccessGuard></OnboardingGuard></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/production" element={<ProtectedRoute><OnboardingGuard><AccessGuard phase="production"><VersionLayout><Production /></VersionLayout></AccessGuard></OnboardingGuard></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/post-production" element={<ProtectedRoute><OnboardingGuard><AccessGuard phase="post-production"><VersionLayout><PostProduction /></VersionLayout></AccessGuard></OnboardingGuard></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/release" element={<ProtectedRoute><OnboardingGuard><AccessGuard phase="release"><VersionLayout><Release /></VersionLayout></AccessGuard></OnboardingGuard></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/settings" element={<ProtectedRoute><OnboardingGuard><AccessGuard><VersionLayout><VersionSettings /></VersionLayout></AccessGuard></OnboardingGuard></ProtectedRoute>} />

              {/* Settings */}
              <Route path="/settings" element={<ProtectedRoute><OnboardingGuard><SettingsIntegrations /></OnboardingGuard></ProtectedRoute>} />
              <Route path="/settings/admin" element={<ProtectedRoute><OnboardingGuard><SettingsAdmin /></OnboardingGuard></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/global-assets" element={<ProtectedRoute><OnboardingGuard><VersionLayout><GlobalAssets /></VersionLayout></OnboardingGuard></ProtectedRoute>} />

              {/* Legacy redirects */}
              <Route path="/development" element={<Navigate to="/projects" replace />} />
              <Route path="/pre-production" element={<Navigate to="/projects" replace />} />
              <Route path="/production" element={<Navigate to="/projects" replace />} />
              <Route path="/post-production" element={<Navigate to="/projects" replace />} />
              <Route path="/release" element={<Navigate to="/projects" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </HelpProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
