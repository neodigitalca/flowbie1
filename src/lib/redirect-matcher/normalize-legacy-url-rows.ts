import type { WordPressSite } from "@/components/integrations/types";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import type { LegacyUrlRow } from "@/lib/redirect-matcher/types";

/** Ensure legacy URL is absolute with site domain (GSC paths, relative paths, date slugs). */
export function ensureAbsoluteLegacyUrl(raw: string, site: WordPressSite): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const base = getPublicSiteUrl(site).replace(/\/$/, "");
  if (trimmed.startsWith("/")) {
    return `${base}${trimmed.endsWith("/") ? trimmed : `${trimmed}/`}`;
  }
  const path = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  return `${base}/${path}`;
}

export function normalizeLegacyUrlRows(
  rows: LegacyUrlRow[],
  site: WordPressSite,
): { rows: LegacyUrlRow[]; error?: string } {
  if (!rows.length) {
    return { rows: [], error: "No legacy URLs found." };
  }

  const absoluteRows = rows.map((row) => ({
    ...row,
    legacyUrl: ensureAbsoluteLegacyUrl(row.legacyUrl, site),
  }));

  const seen = new Set<string>();
  const deduped: LegacyUrlRow[] = [];

  for (const row of absoluteRows) {
    const trimmed = row.legacyUrl.trim();
    if (!trimmed) continue;
    const key = normalizePageUrlKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      ...row,
      legacyUrl: trimmed,
      uploadRow: row.uploadRow,
    });
  }

  if (!deduped.length) {
    return { rows: [], error: "No valid legacy URLs after deduplication." };
  }

  return { rows: deduped };
}
