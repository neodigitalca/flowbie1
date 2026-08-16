import { createRoot } from "react-dom/client";
import AppMobile from "./AppMobile.tsx";
import "./index.css";
import "@/components/pulse-assist/pulse-assist-theme.css";
import "@/components/agent-runs/agent-runs-theme.css";
import "@/components/mobile-app/mobile-app-theme.css";
import { migrateAllLegacyNeoPulseStorageKeys } from "@/lib/neo-pulse-storage-migrate";

migrateAllLegacyNeoPulseStorageKeys();

void import("@/components/integrations/storage").then(({ hydrateLocalAppStateFromServerIfEmpty, getStoredSites }) =>
  hydrateLocalAppStateFromServerIfEmpty().then(() =>
    import("@/lib/local-analysis/entity-site-warm-cache").then(({ bootstrapEntitySiteWarmOnAppLoad }) => {
      bootstrapEntitySiteWarmOnAppLoad(getStoredSites());
    }),
  ),
);

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element '#root' not found in document");
}

try {
  const root = createRoot(rootElement);
  root.render(<AppMobile />);
} catch (error) {
  console.error("[main-mobile.tsx] Failed to render AppMobile:", error);
  throw error;
}
