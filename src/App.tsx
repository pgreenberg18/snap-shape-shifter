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
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
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
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectVersions /></ProtectedRoute>} />

              {/* Version-scoped phase routes */}
              <Route path="/projects/:projectId/versions/:versionId/development" element={<ProtectedRoute><VersionLayout><Development /></VersionLayout></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/pre-production" element={<ProtectedRoute><VersionLayout><PreProduction /></VersionLayout></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/production" element={<ProtectedRoute><VersionLayout><Production /></VersionLayout></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/post-production" element={<ProtectedRoute><VersionLayout><PostProduction /></VersionLayout></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/release" element={<ProtectedRoute><VersionLayout><Release /></VersionLayout></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/settings" element={<ProtectedRoute><VersionLayout><VersionSettings /></VersionLayout></ProtectedRoute>} />

              {/* Global settings (API keys) */}
              <Route path="/settings" element={<ProtectedRoute><SettingsIntegrations /></ProtectedRoute>} />
              <Route path="/projects/:projectId/versions/:versionId/global-assets" element={<ProtectedRoute><VersionLayout><GlobalAssets /></VersionLayout></ProtectedRoute>} />

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
