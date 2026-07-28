import type { WordPressSite } from "@/components/integrations/types";
import { overviewSitemapSourcesForSite } from "@/lib/overview/overview-sitemap-source";
import type { SiteInventoryBulkRow } from "@/lib/wordpress-api/types";
import type { OverviewParallelInventoryResult } from "@/lib/overview/overview-parallel-inventory-fetch";
import { ensureEntitySiteWarmCache } from "@/lib/local-analysis/entity-site-warm-cache";
import {
  clearBulkGenerationWpInventoryCache,
  getBulkGenerationWpInventoryEntry,
  getBulkGenerationWpInventoryIfReady,
  seedBulkGenerationWpInventoryFromParallel,
  seedBulkGenerationWpInventoryFromBundle,
  setBulkGenerationWpInventoryEntry,
  type BulkGenerationWpInventory,
} from "@/lib/bulk/bulk-generation-inventory-cache-store";

export type { BulkGenerationWpInventory };
export {
  getBulkGenerationWpInventoryIfReady,
  seedBulkGenerationWpInventoryFromParallel,
  seedBulkGenerationWpInventoryFromBundle,
};

export type BulkGenerationLinkable = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  link: string;
  date_gmt: string;
};

export function clearBulkGenerationWpInventory(siteId?: string): void {
  clearBulkGenerationWpInventoryCache(siteId);
}

export function inventoryRowsToWordPressLinkables(rows: SiteInventoryBulkRow[]): BulkGenerationLinkable[] {
  const seen = new Set<string>();
  const out: BulkGenerationLinkable[] = [];
  for (const row of rows) {
    const link = row.url?.trim();
    if (!link) continue;
    const norm = link.toLowerCase().replace(/\/+$/, "");
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push({
      id: row.id ?? 0,
      slug: row.slug ?? "",
      title: row.fields?.title ?? "",
      excerpt: row.fields?.excerpt ?? "",
      link,
      date_gmt: row.date_gmt ?? "",
    });
  }
  return out;
}

/**
 * Reads site prefetch cache first (instant when warm). Falls back to prefetch fetch only on cold miss.
 */
export async function ensureBulkGenerationWpInventory(
  site: WordPressSite,
  onProgress?: (message: string) => void,
): Promise<BulkGenerationWpInventory> {
  const existing = getBulkGenerationWpInventoryEntry(site.id);
  if (existing && !existing.error) {
    return existing;
  }

  if (!site.siteUrl?.trim() || !site.username?.trim() || !site.appPassword?.trim()) {
    const empty: BulkGenerationWpInventory = {
      siteId: site.id,
      rows: [],
      fetchedAt: Date.now(),
      error: "WordPress site credentials are required.",
    };
    setBulkGenerationWpInventoryEntry(empty);
    return empty;
  }

  const sourceCount = overviewSitemapSourcesForSite(site).length;
  const prefetchReady = getBulkGenerationWpInventoryIfReady(site.id);
  if (!prefetchReady) {
    onProgress?.(`Loading WordPress site inventory (${sourceCount} sitemap buckets in parallel)…`);
  }

  const prefetch = await ensureEntitySiteWarmCache(site);
  const cached = getBulkGenerationWpInventoryEntry(site.id);
  if (cached && !cached.error) {
    return cached;
  }

  if (prefetch.error) {
    const failed: BulkGenerationWpInventory = {
      siteId: site.id,
      rows: [],
      fetchedAt: prefetch.fetchedAt,
      error: prefetch.error,
    };
    setBulkGenerationWpInventoryEntry(failed);
    return failed;
  }

  const rows = prefetch.bulkInventoryRows ?? [];
  const result: BulkGenerationWpInventory = {
    siteId: site.id,
    rows,
    fetchedAt: prefetch.fetchedAt,
    ...(rows.length === 0 ? { error: "No inventory rows returned." } : {}),
  };
  setBulkGenerationWpInventoryEntry(result);
  return result;
}

/** Re-export for callers seeding from overview parallel fetch. */
export type { OverviewParallelInventoryResult };
