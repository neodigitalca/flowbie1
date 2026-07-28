import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

void import("@/components/integrations/storage").then(({ getStoredSites }) =>
  import("@/lib/local-analysis/entity-site-warm-cache").then(({ bootstrapEntitySiteWarmOnAppLoad }) => {
    bootstrapEntitySiteWarmOnAppLoad(getStoredSites());
  }),
);

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element '#root' not found in document");
}

try {
  const root = createRoot(rootElement);
  root.render(<App />);
} catch (error) {
  console.error('[main.tsx] Failed to render App:', error);
  throw error;
}
