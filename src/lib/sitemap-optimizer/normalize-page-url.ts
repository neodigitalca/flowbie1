import { normalizedPageUrlForCompare } from "@/lib/rank-math-redirect-csv";

/** Canonical key for matching GSC page URLs to WordPress inventory rows. */
export function normalizePageUrlKey(url: string): string {
  const norm = normalizedPageUrlForCompare(url);
  if (norm) return norm;
  return url.trim().toLowerCase();
}
