import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Prediction from "./pages/Prediction";
import Health from "./pages/Health";
import Explorer from "./pages/Explorer";
import Alerts from "./pages/Alerts";
import Offline from "./pages/Offline";
import Settings from "./pages/Settings";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

const App = () => {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Landing as initial page without navigation */}
            <Route path="/" element={<Landing />} />

            {/* App routes with shared layout & navigation */}
            <Route path="/" element={<Layout />}>
              <Route path="dashboard" element={<Index />} />
              <Route path="prediction" element={<Prediction />} />
              <Route path="health" element={<Health />} />
              <Route path="explorer" element={<Explorer />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="offline" element={<Offline />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
