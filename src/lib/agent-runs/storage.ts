export const DEFAULT_AGENT_RUNS_SIDEBAR_WIDTH = 440;
export const MIN_AGENT_RUNS_SIDEBAR_WIDTH = 320;
export const MAX_AGENT_RUNS_SIDEBAR_WIDTH = 960;

const OPEN_KEY = "neo_pulse_agent_runs_open";
const WIDTH_KEY = "neo_pulse_agent_runs_sidebar_width";

export function readAgentRunsSidebarOpen(): boolean {
  try {
    return sessionStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAgentRunsSidebarOpen(open: boolean): void {
  try {
    sessionStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function readAgentRunsSidebarWidth(): number {
  try {
    const raw = sessionStorage.getItem(WIDTH_KEY);
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(n)) return clampAgentRunsSidebarWidth(n);
  } catch {
    /* ignore */
  }
  return DEFAULT_AGENT_RUNS_SIDEBAR_WIDTH;
}

export function writeAgentRunsSidebarWidth(width: number): void {
  try {
    sessionStorage.setItem(WIDTH_KEY, String(clampAgentRunsSidebarWidth(width)));
  } catch {
    /* ignore */
  }
}

export function clampAgentRunsSidebarWidth(width: number): number {
  return Math.min(MAX_AGENT_RUNS_SIDEBAR_WIDTH, Math.max(MIN_AGENT_RUNS_SIDEBAR_WIDTH, width));
}
