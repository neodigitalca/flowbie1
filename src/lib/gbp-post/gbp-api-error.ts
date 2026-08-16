/** Read a non-empty error string from a NEO Pulse /api/gmb JSON body. */
export function readGbpApiError(
  data: Record<string, unknown>,
  response: Response,
  fallback: string,
): string {
  const fromError = typeof data.error === "string" ? data.error.trim() : "";
  if (fromError) return fromError;
  const fromMessage = typeof data.message === "string" ? data.message.trim() : "";
  if (fromMessage) return fromMessage;
  const status = response.statusText?.trim();
  if (status && status.toLowerCase() !== "ok") return status;
  return fallback;
}
