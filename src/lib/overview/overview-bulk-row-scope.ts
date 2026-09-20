import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

/** URL keys for rows currently visible in the grid (filters + sort applied). */
export function overviewBulkScopeUrlKeysFromRows(rows: readonly OverviewRow[]): Set<string> {
  return new Set(rows.map((row) => normalizePageUrlKey(row.url)));
}

/**
 * Bulk operations: checked rows only. Zero checked rows means every visible row.
 */
export function resolveOverviewBulkScopeUrlKeys(
  selectedUrlKeys: ReadonlySet<string>,
  displayRows: readonly OverviewRow[],
): Set<string> {
  if (selectedUrlKeys.size > 0) return new Set(selectedUrlKeys);
  return overviewBulkScopeUrlKeysFromRows(displayRows);
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

/** Map visible grid order to `rows` indices so bulk runs start on the first displayed row. */
export function overviewBulkRowIndicesForDisplayOrder(
  rows: { url: string }[],
  displayRows: { url: string }[],
  scopeKeys: Set<string>,
): number[] {
  const indices: number[] = [];
  const seen = new Set<number>();
  for (const displayRow of displayRows) {
    const url = displayRow.url?.trim();
    if (!url || !overviewRowInBulkScope(url, scopeKeys)) continue;
    const index = rows.findIndex(
      (candidate) => normalizePageUrlKey(candidate.url) === normalizePageUrlKey(url),
    );
    if (index < 0 || seen.has(index)) continue;
    seen.add(index);
    indices.push(index);
  }
  return indices;
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
