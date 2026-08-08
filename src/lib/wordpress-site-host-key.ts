/** Normalized hostname for matching properties across browser + server mirrors. */
export function wordPressSiteHostKey(url: string | undefined | null): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
