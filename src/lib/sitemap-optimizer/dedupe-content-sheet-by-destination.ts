import { entityContentIntentKey } from "@/lib/sitemap-optimizer/collapse-entity-families-by-intent";
import {
  contentSheetPrimaryUrl,
} from "@/lib/sitemap-optimizer/content-sheet-source-url";
import { normalizeGridDestinationKey } from "@/lib/sitemap-optimizer/grid-merge-group-ids";
import type { SitemapOptimizerContentSheetRow } from "@/lib/sitemap-optimizer/types";

const ACTION_RANK: Record<SitemapOptimizerContentSheetRow["action"], number> = {
  merge: 0,
  new_blog: 1,
  refresh: 2,
  keep: 3,
};

export function contentSheetRowDestinationKey(
  row: SitemapOptimizerContentSheetRow,
): string {
  return normalizeGridDestinationKey(contentSheetPrimaryUrl(row));
}

function mergeWhatToKeep(
  a: SitemapOptimizerContentSheetRow,
  b: SitemapOptimizerContentSheetRow,
): SitemapOptimizerContentSheetRow["whatToKeepFromEach"] {
  const byUrl = new Map<string, NonNullable<SitemapOptimizerContentSheetRow["whatToKeepFromEach"]>[number]>();
  for (const keep of [...(a.whatToKeepFromEach ?? []), ...(b.whatToKeepFromEach ?? [])]) {
    const key = keep.url.trim().toLowerCase();
    if (key && !byUrl.has(key)) byUrl.set(key, keep);
  }
  return [...byUrl.values()];
}

function mergedSourceCount(
  a: SitemapOptimizerContentSheetRow,
  b: SitemapOptimizerContentSheetRow,
): number {
  const urls = new Set<string>();
  for (const keep of [...(a.whatToKeepFromEach ?? []), ...(b.whatToKeepFromEach ?? [])]) {
    const key = keep.url.trim().toLowerCase();
    if (key) urls.add(key);
  }
  if (urls.size > 0) return urls.size;
  return (a.mergeSourceCount ?? 1) + (b.mergeSourceCount ?? 1);
}

function mergeContentSheetRows(
  existing: SitemapOptimizerContentSheetRow,
  incoming: SitemapOptimizerContentSheetRow,
): SitemapOptimizerContentSheetRow {
  const preferExisting = ACTION_RANK[existing.action] <= ACTION_RANK[incoming.action];
  const lead = preferExisting ? existing : incoming;
  const other = preferExisting ? incoming : existing;
  return {
    ...lead,
    mergeSourceCount: mergedSourceCount(existing, incoming),
    whatToKeepFromEach: mergeWhatToKeep(existing, incoming),
    gscClicks: (existing.gscClicks ?? 0) + (incoming.gscClicks ?? 0) || undefined,
    gscImpressions: (existing.gscImpressions ?? 0) + (incoming.gscImpressions ?? 0) || undefined,
    uploadRowIndex: Math.min(
      existing.uploadRowIndex ?? Number.MAX_SAFE_INTEGER,
      incoming.uploadRowIndex ?? Number.MAX_SAFE_INTEGER,
    ),
    rationale: lead.rationale || other.rationale,
  };
}

/** One content sheet row per unique destination URL (newUrl / primary column). */
export function dedupeContentSheetRowsByDestination(
  sheet: readonly SitemapOptimizerContentSheetRow[],
  options?: { maxRedirectsPerReplacement?: number },
): SitemapOptimizerContentSheetRow[] {
  const byDest = new Map<string, SitemapOptimizerContentSheetRow>();
  const maxRedirects = options?.maxRedirectsPerReplacement;

  for (const row of sheet) {
    const key = contentSheetRowDestinationKey(row);
    if (!key) {
      byDest.set(`__missing_dest__:${row.postId}`, row);
      continue;
    }
    const existing = byDest.get(key);
    if (!existing) {
      byDest.set(key, row);
      continue;
    }
    const combined = mergedSourceCount(existing, row);
    if (maxRedirects != null && combined > maxRedirects) {
      const altKey = row.mergeClusterId
        ? `${key}::${row.mergeClusterId}`
        : `${key}::${row.postId}`;
      byDest.set(altKey, row);
      continue;
    }
    byDest.set(key, mergeContentSheetRows(existing, row));
  }

  const out = [...byDest.values()].sort(
    (a, b) => (a.uploadRowIndex ?? Number.MAX_SAFE_INTEGER) - (b.uploadRowIndex ?? Number.MAX_SAFE_INTEGER),
  );

  return out;
}

function countDuplicateDestinationKeys(sheet: readonly SitemapOptimizerContentSheetRow[]): number {
  const counts = new Map<string, number>();
  for (const row of sheet) {
    const key = contentSheetRowDestinationKey(row);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let dupes = 0;
  for (const n of counts.values()) {
    if (n > 1) dupes += 1;
  }
  return dupes;
}

export function countContentSheetDuplicateDestinations(
  sheet: readonly SitemapOptimizerContentSheetRow[],
): number {
  return countDuplicateDestinationKeys(sheet);
}

function contentSheetIntentKey(row: SitemapOptimizerContentSheetRow): string {
  const entity = row.bulkEntityLabel?.trim() ?? "";
  return entityContentIntentKey(row.proposedPrimaryKeyword.trim(), entity);
}

/**
 * Entity SAP sheet: one row per unique keyword + entity (no duplicate new posts).
 * Rows without an entity label pass through; destination dedupe still applies separately.
 */
export function dedupeContentSheetRowsByIntent(
  sheet: readonly SitemapOptimizerContentSheetRow[],
): SitemapOptimizerContentSheetRow[] {
  const byIntent = new Map<string, SitemapOptimizerContentSheetRow>();
  const passthrough: SitemapOptimizerContentSheetRow[] = [];

  for (const row of sheet) {
    if (row.action !== "merge" && row.action !== "new_blog") {
      passthrough.push(row);
      continue;
    }
    const key = contentSheetIntentKey(row);
    if (!key) {
      passthrough.push(row);
      continue;
    }
    const existing = byIntent.get(key);
    if (!existing) {
      byIntent.set(key, row);
      continue;
    }
    byIntent.set(key, mergeContentSheetRows(existing, row));
  }

  return [...byIntent.values(), ...passthrough].sort(
    (a, b) => (a.uploadRowIndex ?? Number.MAX_SAFE_INTEGER) - (b.uploadRowIndex ?? Number.MAX_SAFE_INTEGER),
  );
}
