import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/components/pulse-assist/pulse-assist-theme.css";
import { migrateAllLegacyNeoPulseStorageKeys } from "@/lib/neo-pulse-storage-migrate";

migrateAllLegacyNeoPulseStorageKeys();

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
