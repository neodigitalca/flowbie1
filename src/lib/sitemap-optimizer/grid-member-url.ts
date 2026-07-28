import { ensureBlogDestinationUrl } from "@/lib/sitemap-optimizer/blog-destination-url";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

/** Legacy / redirect-from URL when the upload row maps old → new. */
export function gridMemberSourceUrl(row: SitemapOptimizerPostRow): string {
  return row.gridRedirectFromUrl?.trim() || row.url.trim();
}

/** Canonical live URL (redirect target) used for titles and destination planning. */
export function gridMemberCanonicalUrl(row: SitemapOptimizerPostRow): string {
  const raw = row.url.trim();
  if (row.gridRedirectFromUrl?.trim()) {
    return ensureBlogDestinationUrl(raw) ?? raw;
  }
  return raw;
}
