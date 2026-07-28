import { isEntityInventoryRow } from "@/lib/sitemap-optimizer/entity-compression-profile";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

export type EntityEditorialPartition = {
  entityRows: SitemapOptimizerPostRow[];
  editorialRows: SitemapOptimizerPostRow[];
};

export function partitionEntityAndEditorialRows(
  rows: readonly SitemapOptimizerPostRow[],
  entityEndpoint: string,
): EntityEditorialPartition {
  const ep = entityEndpoint.trim().toLowerCase();
  if (!ep) {
    return { entityRows: [], editorialRows: [...rows] };
  }

  const entityRows: SitemapOptimizerPostRow[] = [];
  const editorialRows: SitemapOptimizerPostRow[] = [];

  for (const row of rows) {
    if (isEntityInventoryRow(row, ep)) {
      entityRows.push(row);
    } else {
      editorialRows.push(row);
    }
  }

  return { entityRows, editorialRows };
}
