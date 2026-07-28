/**
 * Normalize competitor domain strings for matching Semrush rows to tier output.
 * Tier models may return `example.com`, `www.example.com`, or `https://example.com/path`.
 */
export function normalizeCompetitorDomainKey(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  try {
    if (/^https?:\/\//i.test(s)) {
      return new URL(s).hostname.replace(/^www\./i, "").toLowerCase();
    }
  } catch {
    /* ignore */
  }
  return s.replace(/^www\./i, "").toLowerCase();
}
