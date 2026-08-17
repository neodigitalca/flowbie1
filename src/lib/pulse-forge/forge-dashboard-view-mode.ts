export type ForgeDashboardViewMode = "demo" | "live";

const STORAGE_KEY = "pulse-forge-dashboard-view";

export function readForgeDashboardViewMode(): ForgeDashboardViewMode {
  if (typeof window === "undefined") return "live";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "demo") return "demo";
  return "live";
}

export function writeForgeDashboardViewMode(mode: ForgeDashboardViewMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}
