import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { WordPressSitesProvider } from "@/hooks/use-wordpress-sites";
import { ActiveWordPressSiteProvider } from "@/contexts/active-wordpress-site-context";
import { WordPressOptimizationProvider } from "@/contexts/wordpress-optimization-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
    // Prevent default browser error handling
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    console.error('[Global Error]', event.error);
  });
}

const App = () => {
  try {
    return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WordPressSitesProvider>
            <ActiveWordPressSiteProvider>
              <WordPressOptimizationProvider>
          {/* Single column fills #root so nested routes can use flex-1 + min-h-0 + overflow */}
          <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <BrowserRouter basename={import.meta.env.BASE_URL}>
                <AuthProvider>
                  <ErrorBoundary>
                    <Routes>
                      <Route
                        path="/login"
                        element={
                          <div className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-hidden">
                            <Login />
                          </div>
                        }
                      />
                      <Route
                        path="/"
                        element={
                          <ProtectedRoute>
                            <div className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-hidden">
                              <Index />
                            </div>
                          </ProtectedRoute>
                        }
                      />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route
                        path="*"
                        element={
                          <div className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-hidden">
                            <NotFound />
                          </div>
                        }
                      />
                    </Routes>
                  </ErrorBoundary>
                </AuthProvider>
              </BrowserRouter>
            </div>
          </div>
              </WordPressOptimizationProvider>
            </ActiveWordPressSiteProvider>
          </WordPressSitesProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
    );
  } catch (error) {
    throw error;
  }
};

export default App;
