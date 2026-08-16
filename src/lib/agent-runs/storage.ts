import {
  readSidebarOpen,
  writeSidebarOpen,
  readSidebarWidth,
  writeSidebarWidth,
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
} from "@/lib/pulse-assist/storage";

export {
  DEFAULT_SIDEBAR_WIDTH as DEFAULT_AGENT_RUNS_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH as MIN_AGENT_RUNS_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH as MAX_AGENT_RUNS_SIDEBAR_WIDTH,
};

export function readAgentRunsSidebarOpen(): boolean {
  return readSidebarOpen();
}

export function writeAgentRunsSidebarOpen(open: boolean): void {
  writeSidebarOpen(open);
}

export function readAgentRunsSidebarWidth(): number {
  return readSidebarWidth();
}

export function writeAgentRunsSidebarWidth(width: number): void {
  writeSidebarWidth(width);
}

export function clampAgentRunsSidebarWidth(width: number): number {
  return clampSidebarWidth(width);
}
