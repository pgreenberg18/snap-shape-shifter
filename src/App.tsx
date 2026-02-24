import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { HelpProvider } from "@/components/help/HelpPanel";
import HelpPanel from "@/components/help/HelpPanel";
import { AuthProvider } from "@/hooks/useAuth";
import Projects from "@/pages/Projects";
import ProjectVersions from "@/pages/ProjectVersions";
import Development from "@/pages/Development";
import PreProduction from "@/pages/PreProduction";
import Production from "@/pages/Production";
import PostProduction from "@/pages/PostProduction";
import Release from "@/pages/Release";
import SettingsIntegrations from "@/pages/SettingsIntegrations";
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
            <HelpPanel />
            <Routes>
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:projectId" element={<ProjectVersions />} />

              {/* Version-scoped phase routes */}
              <Route path="/projects/:projectId/versions/:versionId/development" element={<VersionLayout><Development /></VersionLayout>} />
              <Route path="/projects/:projectId/versions/:versionId/pre-production" element={<VersionLayout><PreProduction /></VersionLayout>} />
              <Route path="/projects/:projectId/versions/:versionId/production" element={<VersionLayout><Production /></VersionLayout>} />
              <Route path="/projects/:projectId/versions/:versionId/post-production" element={<VersionLayout><PostProduction /></VersionLayout>} />
              <Route path="/projects/:projectId/versions/:versionId/release" element={<VersionLayout><Release /></VersionLayout>} />
              <Route path="/projects/:projectId/versions/:versionId/settings" element={<VersionLayout><VersionSettings /></VersionLayout>} />

              {/* Global settings (API keys) */}
              <Route path="/settings" element={<SettingsIntegrations />} />
              <Route path="/projects/:projectId/versions/:versionId/global-assets" element={<VersionLayout><GlobalAssets /></VersionLayout>} />

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
