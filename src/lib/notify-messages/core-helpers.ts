/** Generic notify message helpers (header-safe titles only). */

export function notifyActionFailed(action: string, _err?: unknown): string {
  return `${action} failed`;
}

export function notifyErrorMessage(err: unknown, fallback?: string): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (typeof err === "string" && err.trim()) return err.trim();
  if (fallback?.trim()) return fallback.trim();
  return String(err ?? "").trim();
}
