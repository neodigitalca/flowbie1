import { getOverviewRowsSessionCache } from "@/lib/overview/overview-rows-session-cache";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";

const OVERVIEW_GRID_SOURCES: OverviewSitemapSource[] = ["pages", "posts", "sap"];

/** Max row count across cached sitemap sources (stable pagination slot width). */
export function resolveOverviewGridPaginationLayoutTotal(
  siteIds: string[],
  currentCount = 0,
): number {
  let max = currentCount;
  for (const siteId of siteIds) {
    if (!siteId) continue;
    for (const source of OVERVIEW_GRID_SOURCES) {
      max = Math.max(max, getOverviewRowsSessionCache(siteId, source)?.length ?? 0);
    }
  }
  return max;
}
