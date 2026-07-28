import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

/** URL keys for rows currently visible in the grid (filters + sort applied). */
export function overviewBulkScopeUrlKeysFromRows(rows: readonly OverviewRow[]): Set<string> {
  return new Set(rows.map((row) => normalizePageUrlKey(row.url)));
}

export function overviewRowInBulkScope(url: string, scopeKeys: Set<string>): boolean {
  return scopeKeys.has(normalizePageUrlKey(url));
}

export function overviewBulkRowIndices(
  rows: { url: string }[],
  scopeKeys: Set<string>,
): number[] {
  return rows
    .map((row, index) => (overviewRowInBulkScope(row.url, scopeKeys) ? index : -1))
    .filter((index) => index >= 0);
}

export function overviewBulkRowEntries(
  rows: OverviewRow[],
  scopeKeys: Set<string>,
): Array<{ row: OverviewRow; index: number }> {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => overviewRowInBulkScope(row.url, scopeKeys));
}

export function overviewRowsInBulkScope(rows: OverviewRow[], scopeKeys: Set<string>): OverviewRow[] {
  return overviewBulkRowEntries(rows, scopeKeys).map(({ row }) => row);
}
