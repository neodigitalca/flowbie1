import type { WordPressSite } from "@/components/integrations/types";
import { getBulkGenerationWpInventoryIfReady } from "@/lib/bulk/bulk-generation-wp-inventory";
import { getEntitySiteWarmCacheIfReady } from "@/lib/local-analysis/entity-site-warm-cache";
import type { OverviewInventoryRow } from "@/lib/overview/overview-inventory-csv";
import { buildOverviewInventorySnapshotFromRows } from "@/lib/overview/overview-parallel-inventory-fetch";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { splitOverviewInventoryRowsBySource } from "@/lib/overview/overview-unified-sitemap-inventory";
import type { TaskExecutionTargetBucket } from "@/lib/task-execution-bucket";
import type { BulkOptimizerInventorySnapshot } from "@/lib/wordpress-api/inventory-match";
import {
  getBulkInventorySessionSnapshot,
  setBulkInventorySessionSnapshot,
} from "@/lib/wordpress-bulk-inventory-session-cache";

const BUCKET_SOURCES: OverviewSitemapSource[] = ["pages", "posts", "sap"];

function inventoryRowsHaveRealIds(rows: OverviewInventoryRow[]): boolean {
  return rows.some((r) => Number(r.id) > 0);
}

function warmBulkInventoryRows(site: WordPressSite): OverviewInventoryRow[] | null {
  const bundle = getEntitySiteWarmCacheIfReady(site.id);
  const bulkRows = bundle?.bulkInventoryRows ?? getBulkGenerationWpInventoryIfReady(site.id);
  if (!bulkRows?.length) return null;
  return bulkRows.map((row) => ({ ...row, collection: row.collection })) as OverviewInventoryRow[];
}

function urlsFromSnapshot(snapshot: BulkOptimizerInventorySnapshot, source: OverviewSitemapSource): string[] {
  const urls = new Set<string>();
  if (source === "posts") {
    for (const link of snapshot.postsMaps.byLink.keys()) urls.add(link);
  } else if (source === "pages") {
    for (const link of snapshot.pagesMaps.byLink.keys()) urls.add(link);
  } else {
    for (const maps of Object.values(snapshot.customMapsByCollection ?? {})) {
      for (const link of maps.byLink.keys()) urls.add(link);
    }
  }
  return [...urls];
}

function snapshotForBucket(
  bySource: Partial<Record<OverviewSitemapSource, OverviewInventoryRow[]>>,
  bucket: TaskExecutionTargetBucket,
  siteUrl: string,
): BulkOptimizerInventorySnapshot | null {
  if (bucket === "all") {
    const merged = [...(bySource.posts ?? []), ...(bySource.pages ?? []), ...(bySource.sap ?? [])];
    if (!merged.length) return null;
    return buildOverviewInventorySnapshotFromRows(merged, siteUrl);
  }
  const rows = bySource[bucket as OverviewSitemapSource] ?? [];
  if (!rows.length) return null;
  return buildOverviewInventorySnapshotFromRows(rows, siteUrl);
}

/** Seed bulk optimizer session snapshots from the top-bar site warm cache (read-only). */
export function seedBulkInventorySessionFromSiteWarmCache(site: WordPressSite): boolean {
  const tagged = warmBulkInventoryRows(site);
  if (!tagged?.length) return false;

  const bySource = splitOverviewInventoryRowsBySource(site, tagged);
  let seeded = false;

  for (const bucket of BUCKET_SOURCES) {
    const mergedRows = bySource[bucket] ?? [];
    if (!mergedRows.length) continue;
    if (getBulkInventorySessionSnapshot(site.id, bucket)) {
      seeded = true;
      continue;
    }
    if (!inventoryRowsHaveRealIds(mergedRows)) continue;
    const snapshot = buildOverviewInventorySnapshotFromRows(mergedRows, site.siteUrl);
    setBulkInventorySessionSnapshot(site.id, bucket, snapshot);
    seeded = true;
  }

  return seeded;
}

/** Resolve task execution inventory from warm cache without network calls. */
export function resolveTaskExecutionInventoryFromWarmCache(
  site: WordPressSite,
  bucket: TaskExecutionTargetBucket,
): { urls: string[]; snapshot: BulkOptimizerInventorySnapshot } | null {
  const tagged = warmBulkInventoryRows(site);
  if (!tagged?.length) return null;

  const bySource = splitOverviewInventoryRowsBySource(site, tagged);
  const snapshot = snapshotForBucket(bySource, bucket, site.siteUrl);
  if (!snapshot) return null;

  const source = bucket === "all" ? ("posts" as OverviewSitemapSource) : (bucket as OverviewSitemapSource);
  const urls =
    bucket === "all"
      ? (() => {
          const all = new Set<string>();
          for (const link of snapshot.postsMaps.byLink.keys()) all.add(link);
          for (const link of snapshot.pagesMaps.byLink.keys()) all.add(link);
          for (const maps of Object.values(snapshot.customMapsByCollection ?? {})) {
            for (const link of maps.byLink.keys()) all.add(link);
          }
          return [...all];
        })()
      : urlsFromSnapshot(snapshot, source);

  if (!urls.length) return null;
  return { urls, snapshot };
}
