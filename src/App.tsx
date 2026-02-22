import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Development from "@/pages/Development";
import PreProduction from "@/pages/PreProduction";
import Production from "@/pages/Production";
import PostProduction from "@/pages/PostProduction";
import Release from "@/pages/Release";
import SettingsIntegrations from "@/pages/SettingsIntegrations";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={<Navigate to="/development" replace />}
          />
          <Route
            path="/development"
            element={<Layout><Development /></Layout>}
          />
          <Route
            path="/pre-production"
            element={<Layout><PreProduction /></Layout>}
          />
          <Route
            path="/production"
            element={<Layout><Production /></Layout>}
          />
          <Route
            path="/post-production"
            element={<Layout><PostProduction /></Layout>}
          />
          <Route
            path="/release"
            element={<Layout><Release /></Layout>}
          />
          <Route
            path="/settings/integrations"
            element={<Layout><SettingsIntegrations /></Layout>}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
