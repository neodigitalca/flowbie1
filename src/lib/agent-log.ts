/**
 * Optional agent diagnostics hook (no-op by default).
 */
export function agentLog(_payload: {
  location?: string;
  message?: string;
  data?: unknown;
  hypothesisId?: string;
  [key: string]: unknown;
}): void {
  // Intentionally empty - was used for local debug ingest during development.
}
