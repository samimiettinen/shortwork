import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Channels = lazy(() => import("./pages/Channels"));
const Compose = lazy(() => import("./pages/Compose"));
const Queue = lazy(() => import("./pages/Queue"));
const Admin = lazy(() => import("./pages/Admin"));
const TeamMembers = lazy(() => import("./pages/TeamMembers"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const WorkspaceSettings = lazy(() => import("./pages/WorkspaceSettings"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Platforms = lazy(() => import("./pages/Platforms"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const DataDeletion = lazy(() => import("./pages/DataDeletion"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));

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
          <Suspense fallback={<div role="status" className="p-8 text-center">Loading…</div>}>
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
            <Route path="/platforms" element={<Platforms />} />
            <Route path="/drafts" element={<Dashboard />} />
            <Route path="/history" element={<Dashboard />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="/api/auth/callback/:provider" element={<OAuthCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
