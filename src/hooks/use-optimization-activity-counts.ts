import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import { getEditorialCountsRange, getLocalDayKey, type EditorialCountsRange } from "@/lib/quarter-bounds";
import { fetchOptimizationActivityCounts } from "@/lib/wordpress-api/optimization-activity-counts";
import type { OptimizationActivityTileStats } from "@/lib/wordpress-api/types";
import { OPTIMIZATION_TILE_COUNTS_ENABLED } from "@/lib/wordpress-optimization-tile-counts";
import { optimizationPeriodCapForPackage } from "@/lib/wordpress-optimization-package";

const CACHE_PREFIX = "flowbie-optimization-activity:v2";

type CachedPayload = {
  totalOptimized: number;
};

function cacheKey(siteId: string, after: string, before: string): string {
  return `${CACHE_PREFIX}:${siteId}:${after}:${before}`;
}

function readCache(siteId: string, after: string, before: string): CachedPayload | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(siteId, after, before));
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.totalOptimized !== "number" || !Number.isFinite(o.totalOptimized)) return null;
    return { totalOptimized: o.totalOptimized };
  } catch {
    return null;
  }
}

function writeCache(siteId: string, after: string, before: string, payload: CachedPayload): void {
  try {
    sessionStorage.setItem(cacheKey(siteId, after, before), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function clearSiteCacheForRange(siteId: string, after: string, before: string): void {
  try {
    sessionStorage.removeItem(cacheKey(siteId, after, before));
  } catch {
    /* ignore */
  }
}

function siteHasCredentials(s: WordPressSite): boolean {
  return Boolean(s.siteUrl?.trim() && s.username?.trim() && s.appPassword?.trim());
}

function siteUsesOptimizationPackage(s: WordPressSite): boolean {
  return Boolean(s.optimizationPackage && optimizationPeriodCapForPackage(s.optimizationPackage));
}

function canPreserveOptimizationTotals(
  tile: OptimizationActivityTileStats | undefined,
  range: EditorialCountsRange,
  cap: number,
): tile is OptimizationActivityTileStats {
  return Boolean(
    tile &&
    !tile.errorTitle &&
    tile.cap === cap &&
    tile.countsPeriodAfterIso === range.after &&
    tile.countsPeriodEndExclusiveIso === range.before &&
    typeof tile.totalOptimized === "number" &&
    Number.isFinite(tile.totalOptimized) &&
    tile.totalOptimized > 0,
  );
}

function loadingTile(
  site: WordPressSite,
  range: EditorialCountsRange,
  cap: number,
  previous?: OptimizationActivityTileStats | undefined,
): OptimizationActivityTileStats {
  if (canPreserveOptimizationTotals(previous, range, cap)) {
    const prev = previous!;
    const total = prev.totalOptimized!;
    const remaining =
      typeof prev.remaining === "number" && Number.isFinite(prev.remaining)
        ? prev.remaining
        : Math.max(0, cap - total);
    return {
      quarterLabel: range.quarterLabel,
      loading: true,
      totalOptimized: total,
      cap,
      remaining,
      countsPeriodAfterIso: range.after,
      countsPeriodEndExclusiveIso: range.before,
      countsPeriodMode: range.mode,
    };
  }

  return {
    quarterLabel: range.quarterLabel,
    loading: true,
    totalOptimized: null,
    cap,
    remaining: null,
    countsPeriodAfterIso: range.after,
    countsPeriodEndExclusiveIso: range.before,
    countsPeriodMode: range.mode,
  };
}

function tileFromCache(
  range: EditorialCountsRange,
  cap: number,
  cached: CachedPayload,
): OptimizationActivityTileStats {
  const total = cached.totalOptimized;
  const remaining = Math.max(0, cap - total);
  return {
    quarterLabel: range.quarterLabel,
    loading: false,
    totalOptimized: total,
    cap,
    remaining,
    countsPeriodAfterIso: range.after,
    countsPeriodEndExclusiveIso: range.before,
    countsPeriodMode: range.mode,
  };
}

export function useOptimizationActivityCounts(sites: WordPressSite[]): {
  bySiteId: Record<string, OptimizationActivityTileStats>;
  dayKey: string;
  refreshAllOptimizationCounts: () => Promise<void>;
  refreshOptimizationForSite: (siteId: string) => Promise<void>;
  isRefreshingAllOptimizationCounts: boolean;
} {
  const [tick, setTick] = useState(0);
  const [isRefreshingAllOptimizationCounts, setIsRefreshingAllOptimizationCounts] = useState(false);
  const [bySiteId, setBySiteId] = useState<Record<string, OptimizationActivityTileStats>>({});

  const dayKey = useMemo(() => {
    void tick;
    return getLocalDayKey(new Date());
  }, [tick]);
  const dayKeyRef = useRef(dayKey);
  dayKeyRef.current = dayKey;

  useEffect(() => {
    const now = Date.now();
    const nextMid = new Date();
    nextMid.setDate(nextMid.getDate() + 1);
    nextMid.setHours(0, 0, 0, 0);
    const ms = Math.max(5_000, nextMid.getTime() - now);
    const t = window.setTimeout(() => setTick((x) => x + 1), ms);
    return () => window.clearTimeout(t);
  }, [tick]);

  useEffect(() => {
    let last = dayKeyRef.current;
    const id = window.setInterval(() => {
      const nk = getLocalDayKey(new Date());
      if (nk !== last) {
        last = nk;
        setTick((x) => x + 1);
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const sitesRef = useRef(sites);
  sitesRef.current = sites;

  const sitesKey = sites
    .map((s) => `${s.id}:${s.optimizationPackage ?? ""}:${s.editorialCountsPeriodStartYmd?.trim() ?? ""}`)
    .join(",");

  const fetchFromNetwork = useCallback(async (site: WordPressSite) => {
    const cap = optimizationPeriodCapForPackage(site.optimizationPackage);
    if (!cap) return;
    const range = getEditorialCountsRange(site.editorialCountsPeriodStartYmd, new Date());
    try {
      const result = await fetchOptimizationActivityCounts({
        siteUrl: site.siteUrl,
        username: site.username,
        appPassword: site.appPassword,
        after: range.after,
        before: range.before,
        entitySitemapUrl: site.entitySitemapUrl,
        manualEndpoint: site.manualEndpoint,
      });
      if (result.ok && typeof result.totalOptimized === "number") {
        writeCache(site.id, range.after, range.before, { totalOptimized: result.totalOptimized });
        const total = result.totalOptimized;
        setBySiteId((prev) => ({
          ...prev,
          [site.id]: {
            quarterLabel: range.quarterLabel,
            loading: false,
            totalOptimized: total,
            cap,
            remaining: Math.max(0, cap - total),
            countsPeriodAfterIso: range.after,
            countsPeriodEndExclusiveIso: range.before,
            countsPeriodMode: range.mode,
          },
        }));
      } else {
        const err = result.error || "Could not load optimization counts.";
        setBySiteId((prev) => {
          const old = prev[site.id];
          if (canPreserveOptimizationTotals(old, range, cap)) {
            return {
              ...prev,
              [site.id]: {
                ...old,
                loading: false,
                errorTitle: err,
              },
            };
          }
          return {
            ...prev,
            [site.id]: {
              quarterLabel: range.quarterLabel,
              loading: false,
              errorTitle: err,
              totalOptimized: null,
              cap,
              remaining: null,
              countsPeriodAfterIso: range.after,
              countsPeriodEndExclusiveIso: range.before,
              countsPeriodMode: range.mode,
            },
          };
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load optimization counts.";
      setBySiteId((prev) => {
        const old = prev[site.id];
        if (canPreserveOptimizationTotals(old, range, cap)) {
          return {
            ...prev,
            [site.id]: {
              ...old,
              loading: false,
              errorTitle: msg,
            },
          };
        }
        return {
          ...prev,
          [site.id]: {
            quarterLabel: range.quarterLabel,
            loading: false,
            errorTitle: msg,
            totalOptimized: null,
            cap,
            remaining: null,
            countsPeriodAfterIso: range.after,
            countsPeriodEndExclusiveIso: range.before,
            countsPeriodMode: range.mode,
          },
        };
      });
    }
  }, []);

  const runFetch = useCallback(async () => {
    void tick;
    void sitesKey;
    if (!OPTIMIZATION_TILE_COUNTS_ENABLED) {
      setBySiteId({});
      return;
    }
    const list = sitesRef.current.filter((s) => siteHasCredentials(s) && siteUsesOptimizationPackage(s));

    setBySiteId((prev) => {
      const next: Record<string, OptimizationActivityTileStats> = { ...prev };
      for (const s of list) {
        const cap = optimizationPeriodCapForPackage(s.optimizationPackage)!;
        const range = getEditorialCountsRange(s.editorialCountsPeriodStartYmd, new Date());
        const cached = readCache(s.id, range.after, range.before);
        if (cached) {
          next[s.id] = tileFromCache(range, cap, cached);
        } else {
          next[s.id] = loadingTile(s, range, cap, prev[s.id]);
        }
      }
      const keep = new Set(list.map((s) => s.id));
      for (const id of Object.keys(next)) {
        if (!keep.has(id)) {
          delete next[id];
        }
      }
      return next;
    });

    await Promise.all(
      list.map(async (site) => {
        const range = getEditorialCountsRange(site.editorialCountsPeriodStartYmd, new Date());
        if (readCache(site.id, range.after, range.before)) {
          return;
        }
        await fetchFromNetwork(site);
      }),
    );
  }, [tick, sitesKey, fetchFromNetwork]);

  useEffect(() => {
    void runFetch();
  }, [runFetch]);

  const refreshAllOptimizationCounts = useCallback(async () => {
    if (!OPTIMIZATION_TILE_COUNTS_ENABLED) return;
    const list = sitesRef.current.filter((s) => siteHasCredentials(s) && siteUsesOptimizationPackage(s));
    if (list.length === 0) return;
    for (const site of list) {
      const range = getEditorialCountsRange(site.editorialCountsPeriodStartYmd, new Date());
      clearSiteCacheForRange(site.id, range.after, range.before);
    }
    setBySiteId((prev) => {
      const next: Record<string, OptimizationActivityTileStats> = { ...prev };
      for (const s of list) {
        const cap = optimizationPeriodCapForPackage(s.optimizationPackage)!;
        const range = getEditorialCountsRange(s.editorialCountsPeriodStartYmd, new Date());
        next[s.id] = loadingTile(s, range, cap, prev[s.id]);
      }
      const keep = new Set(list.map((s) => s.id));
      for (const id of Object.keys(next)) {
        if (!keep.has(id)) {
          delete next[id];
        }
      }
      return next;
    });
    setIsRefreshingAllOptimizationCounts(true);
    try {
      await Promise.all(list.map((site) => fetchFromNetwork(site)));
    } finally {
      setIsRefreshingAllOptimizationCounts(false);
    }
  }, [fetchFromNetwork]);

  const refreshOptimizationForSite = useCallback(
    async (siteId: string) => {
      if (!OPTIMIZATION_TILE_COUNTS_ENABLED) return;
      const site = sitesRef.current.find((s) => s.id === siteId);
      if (!site || !siteHasCredentials(site) || !siteUsesOptimizationPackage(site)) return;
      const range = getEditorialCountsRange(site.editorialCountsPeriodStartYmd, new Date());
      clearSiteCacheForRange(site.id, range.after, range.before);
      const cap = optimizationPeriodCapForPackage(site.optimizationPackage)!;
      setBySiteId((prev) => ({
        ...prev,
        [site.id]: loadingTile(site, range, cap, prev[site.id]),
      }));
      await fetchFromNetwork(site);
    },
    [fetchFromNetwork],
  );

  return {
    bySiteId,
    dayKey,
    refreshAllOptimizationCounts,
    refreshOptimizationForSite,
    isRefreshingAllOptimizationCounts,
  };
}
