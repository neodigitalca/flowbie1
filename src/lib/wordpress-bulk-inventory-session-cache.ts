import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import type { BulkOptimizerInventorySnapshot } from "@/lib/wordpress-api/inventory-match";
import {
  mergeBulkOptimizerInventorySnapshots,
  snapshotHasInventoryEntries,
} from "@/lib/wordpress-api/inventory-match";

const SOURCES: OverviewSitemapSource[] = ["pages", "posts", "sap"];

function cacheKey(siteId: string, source: OverviewSitemapSource): string {
  return `${siteId}:${source}`;
}

const snapshotByKey = new Map<string, BulkOptimizerInventorySnapshot>();

export function setBulkInventorySessionSnapshot(
  siteId: string,
  source: OverviewSitemapSource,
  snapshot: BulkOptimizerInventorySnapshot,
): void {
  if (snapshotHasInventoryEntries(snapshot)) {
    snapshotByKey.set(cacheKey(siteId, source), snapshot);
  }
}

export function getBulkInventorySessionSnapshot(
  siteId: string,
  source: OverviewSitemapSource,
): BulkOptimizerInventorySnapshot | null {
  const snap = snapshotByKey.get(cacheKey(siteId, source));
  return snap && snapshotHasInventoryEntries(snap) ? snap : null;
}

/** First available per-source snapshot (bulk optimizer fallback). */
export function getAnyBulkInventorySessionSnapshot(
  siteId: string,
): BulkOptimizerInventorySnapshot | null {
  for (const source of SOURCES) {
    const snap = getBulkInventorySessionSnapshot(siteId, source);
    if (snap) return snap;
  }
  return null;
}

/** Merge all per-source session snapshots (no network). */
export function getMergedBulkInventorySessionSnapshot(
  siteId: string,
): BulkOptimizerInventorySnapshot | null {
  const snaps = SOURCES.map((source) => getBulkInventorySessionSnapshot(siteId, source)).filter(
    (snap): snap is BulkOptimizerInventorySnapshot => Boolean(snap),
  );
  return mergeBulkOptimizerInventorySnapshots(...snaps);
}

export function clearBulkInventorySessionSnapshot(siteId: string): void {
  for (const source of SOURCES) {
    snapshotByKey.delete(cacheKey(siteId, source));
  }
}
