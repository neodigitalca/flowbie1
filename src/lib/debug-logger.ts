/**
 * Debug logging stub. Previously sent to a local ingest server; disabled for production builds.
 */
export function debugLog(_payload: {
  location: string;
  message: string;
  data?: unknown;
  timestamp?: number;
  sessionId?: string;
  runId?: string;
  hypothesisId?: string;
}): void {
  // Intentionally empty
}

export function isDebugLogEnabled(): boolean {
  return false;
}
