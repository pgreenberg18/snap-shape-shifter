import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/layout/Layout";
import Development from "@/pages/Development";
import PreProduction from "@/pages/PreProduction";
import Production from "@/pages/Production";
import PostProduction from "@/pages/PostProduction";
import Release from "@/pages/Release";
import SettingsIntegrations from "@/pages/SettingsIntegrations";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/development" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/development" element={<ProtectedLayout><Development /></ProtectedLayout>} />
            <Route path="/pre-production" element={<ProtectedLayout><PreProduction /></ProtectedLayout>} />
            <Route path="/production" element={<ProtectedLayout><Production /></ProtectedLayout>} />
            <Route path="/post-production" element={<ProtectedLayout><PostProduction /></ProtectedLayout>} />
            <Route path="/release" element={<ProtectedLayout><Release /></ProtectedLayout>} />
            <Route path="/settings/integrations" element={<ProtectedLayout><SettingsIntegrations /></ProtectedLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
