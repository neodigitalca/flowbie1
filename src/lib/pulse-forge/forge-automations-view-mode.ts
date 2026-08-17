export type ForgeAutomationsViewMode = "demo" | "live";

const STORAGE_KEY = "pulse-forge-automations-view";

export function readForgeAutomationsViewMode(): ForgeAutomationsViewMode {
  if (typeof window === "undefined") return "live";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "demo") return "demo";
  return "live";
}

export function writeForgeAutomationsViewMode(mode: ForgeAutomationsViewMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}
