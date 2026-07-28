import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

/** Minimum age before a URL is eligible for consolidation / replacement. */
export const SITEMAP_OPTIMIZER_CONTENT_MATURITY_DAYS = 90;

export const MATURITY_KEEP_RATIONALE_IMMATURE =
  "Published within 90 days; allow time to mature.";

/** @deprecated Unknown publish dates are triaged, not auto-kept. Kept for legacy breakdown rows. */
export const MATURITY_KEEP_RATIONALE_UNKNOWN =
  "Publish date unknown; not eligible for consolidation.";

const MS_PER_DAY = 86_400_000;

function parsePublishedAtGmt(value: string | undefined): Date | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysSincePublish(
  publishedAtGmt: string | undefined,
  analyzedAt: string,
): number | null {
  const published = parsePublishedAtGmt(publishedAtGmt);
  const analyzed = parsePublishedAtGmt(analyzedAt);
  if (!published || !analyzed) return null;
  return Math.floor((analyzed.getTime() - published.getTime()) / MS_PER_DAY);
}

/**
 * Eligible for GSC triage / consolidation when publish date is unknown or age >= maturity days.
 * Only known dates under 90 days are held as immature keeps.
 */
export function isContentMatureForConsolidation(
  row: SitemapOptimizerPostRow,
  analyzedAt: string,
): boolean {
  const published = parsePublishedAtGmt(row.publishedAtGmt);
  if (!published) return true;
  const analyzed = parsePublishedAtGmt(analyzedAt) ?? new Date();
  const ageMs = analyzed.getTime() - published.getTime();
  return ageMs >= SITEMAP_OPTIMIZER_CONTENT_MATURITY_DAYS * MS_PER_DAY;
}

export function maturityKeepRationale(_row: SitemapOptimizerPostRow): string {
  return MATURITY_KEEP_RATIONALE_IMMATURE;
}

export function isImmatureKeepRationale(rationale: string | undefined): boolean {
  const r = (rationale ?? "").trim();
  return r === MATURITY_KEEP_RATIONALE_IMMATURE || r === MATURITY_KEEP_RATIONALE_UNKNOWN;
}

export function partitionRowsByContentMaturity(
  rows: readonly SitemapOptimizerPostRow[],
  analyzedAt: string,
): {
  mature: SitemapOptimizerPostRow[];
  immature: SitemapOptimizerPostRow[];
} {
  const mature: SitemapOptimizerPostRow[] = [];
  const immature: SitemapOptimizerPostRow[] = [];
  for (const row of rows) {
    if (isContentMatureForConsolidation(row, analyzedAt)) mature.push(row);
    else immature.push(row);
  }
  return { mature, immature };
}

export function markImmatureRowsAsKeep(
  rows: readonly SitemapOptimizerPostRow[],
): SitemapOptimizerPostRow[] {
  return rows.map((row) => ({
    ...row,
    gscDisposition: "keep" as const,
    gscTriageRationale: maturityKeepRationale(row),
  }));
}
