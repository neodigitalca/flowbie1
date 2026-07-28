import { useSyncExternalStore } from "react";
import {
  getEntitySiteWarmCacheIfReady,
  getEntitySiteWarmInflightSnapshot,
  isEntitySiteWarmInflight,
  isSitePrefetchRefreshing,
  isSitePrefetchStale,
  subscribeEntitySiteWarmInflight,
} from "@/lib/local-analysis/entity-site-warm-cache";

export function useSitePrefetchState(siteId: string | null | undefined) {
  useSyncExternalStore(subscribeEntitySiteWarmInflight, getEntitySiteWarmInflightSnapshot);
  const bundle = siteId ? getEntitySiteWarmCacheIfReady(siteId) : null;
  const loading = siteId ? isEntitySiteWarmInflight(siteId) : false;
  const refreshing = siteId ? isSitePrefetchRefreshing(siteId) : false;
  return {
    ready: Boolean(bundle),
    loading,
    refreshing,
    fetchedAt: bundle?.fetchedAt ?? null,
    isStale: bundle ? isSitePrefetchStale(bundle) : false,
    counts: bundle?.counts ?? null,
  };
}

/** Cold prefetch only (no glow during stale background refresh). */
export function useEntitySiteWarmLoading(siteId: string | null | undefined): boolean {
  useSyncExternalStore(subscribeEntitySiteWarmInflight, getEntitySiteWarmInflightSnapshot);
  if (!siteId) return false;
  return isEntitySiteWarmInflight(siteId);
}
