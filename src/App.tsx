import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import Channels from "./pages/Channels";
import Compose from "./pages/Compose";
import Queue from "./pages/Queue";
import Admin from "./pages/Admin";
import TeamMembers from "./pages/TeamMembers";
import AcceptInvite from "./pages/AcceptInvite";
import WorkspaceSettings from "./pages/WorkspaceSettings";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/channels" element={<Channels />} />
            <Route path="/compose" element={<Compose />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/team" element={<TeamMembers />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/settings" element={<WorkspaceSettings />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/drafts" element={<Dashboard />} />
            <Route path="/history" element={<Dashboard />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
