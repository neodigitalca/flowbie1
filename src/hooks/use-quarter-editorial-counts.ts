import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import { getEditorialCountsRange, getLocalDayKey, type EditorialCountsRange } from "@/lib/quarter-bounds";
import { isEntitySitemapDisabled } from "@/lib/entity-endpoint-extractor";
import { fetchQuarterEditorialCounts } from "@/lib/wordpress-api/post-quarter-counts";
import type { QuarterEditorialCountsResult, QuarterEditorialTileStats } from "@/lib/wordpress-api/types";

const CACHE_PREFIX = "neo-pulse-quarter-editorial:v2";

type CachedQuarterPayload = Pick<
  QuarterEditorialCountsResult,
  | "postsPublished"
  | "postsScheduled"
  | "entityPublished"
  | "entityScheduled"
  | "entityConfigured"
  | "entityCountsAvailable"
  | "entityCollection"
>;

function cacheKey(siteId: string, after: string, before: string): string {
  return `${CACHE_PREFIX}:${siteId}:${after}:${before}`;
}

function parseCached(raw: string): CachedQuarterPayload | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof o.postsPublished !== "number" ||
      typeof o.postsScheduled !== "number" ||
      typeof o.entityConfigured !== "boolean" ||
      typeof o.entityCountsAvailable !== "boolean"
    ) {
      return null;
    }
    if (o.entityCountsAvailable) {
      if (typeof o.entityPublished !== "number" || typeof o.entityScheduled !== "number") {
        return null;
      }
    }
    return {
      postsPublished: o.postsPublished,
      postsScheduled: o.postsScheduled,
      entityPublished:
        typeof o.entityPublished === "number" ? o.entityPublished : null,
      entityScheduled:
        typeof o.entityScheduled === "number" ? o.entityScheduled : null,
      entityConfigured: o.entityConfigured,
      entityCountsAvailable: o.entityCountsAvailable,
      entityCollection:
        typeof o.entityCollection === "string" ? o.entityCollection : undefined,
    };
  } catch {
    /* ignore */
  }
  return null;
}

function readCache(
  siteId: string,
  after: string,
  before: string,
): CachedQuarterPayload | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(siteId, after, before));
    if (!raw) return null;
    return parseCached(raw);
  } catch {
    return null;
  }
}

function writeCache(siteId: string, after: string, before: string, payload: CachedQuarterPayload): void {
  try {
    sessionStorage.setItem(cacheKey(siteId, after, before), JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

function clearSiteCacheForRange(siteId: string, after: string, before: string): void {
  try {
    sessionStorage.removeItem(cacheKey(siteId, after, before));
  } catch {
    /* ignore */
  }
}

function resultToTilePartial(
  r: CachedQuarterPayload,
  range: EditorialCountsRange,
): Omit<QuarterEditorialTileStats, "loading"> {
  return {
    quarterLabel: range.quarterLabel,
    errorTitle: undefined,
    postsLive: typeof r.postsPublished === "number" ? r.postsPublished : null,
    postsScheduled: typeof r.postsScheduled === "number" ? r.postsScheduled : null,
    entityLive:
      r.entityCountsAvailable && typeof r.entityPublished === "number"
        ? r.entityPublished
        : null,
    entityScheduled:
      r.entityCountsAvailable && typeof r.entityScheduled === "number"
        ? r.entityScheduled
        : null,
    entityConfigured: Boolean(r.entityConfigured),
    entityCountsAvailable: Boolean(r.entityCountsAvailable),
    entityCollectionLabel: r.entityCollection?.trim(),
    countsPeriodAfterIso: range.after,
    countsPeriodEndExclusiveIso: range.before,
    countsPeriodMode: range.mode,
  };
}

function siteHasCredentials(s: WordPressSite): boolean {
  return Boolean(s.siteUrl?.trim() && s.username?.trim() && s.appPassword?.trim());
}

function loadingPlaceholderForSite(site: WordPressSite, range: EditorialCountsRange): QuarterEditorialTileStats {
  const entityUrl = isEntitySitemapDisabled(site) ? "" : site.entitySitemapUrl?.trim() ?? "";
  return {
    quarterLabel: range.quarterLabel,
    loading: true,
    postsLive: null,
    postsScheduled: null,
    entityLive: null,
    entityScheduled: null,
    entityConfigured: Boolean(site.manualEndpoint?.trim() || entityUrl),
    entityCountsAvailable: false,
    countsPeriodAfterIso: range.after,
    countsPeriodEndExclusiveIso: range.before,
    countsPeriodMode: range.mode,
  };
}

function canPreserveCountsOnError(tile: QuarterEditorialTileStats | undefined): boolean {
  return Boolean(
    tile &&
      typeof tile.postsLive === "number" &&
      typeof tile.postsScheduled === "number",
  );
}

/** Keep showing prior quarter totals while refetching when any live/scheduled count was > 0 for the same window. */
function shouldPreserveQuarterTileDuringRefresh(
  old: QuarterEditorialTileStats | undefined,
  range: EditorialCountsRange,
): boolean {
  if (!old) return false;
  if (old.countsPeriodAfterIso !== range.after || old.countsPeriodEndExclusiveIso !== range.before) {
    return false;
  }
  const pl = old.postsLive;
  const ps = old.postsScheduled;
  if (typeof pl === "number" && Number.isFinite(pl) && pl > 0) return true;
  if (typeof ps === "number" && Number.isFinite(ps) && ps > 0) return true;
  if (old.entityConfigured && old.entityCountsAvailable) {
    const el = old.entityLive;
    const es = old.entityScheduled;
    if (typeof el === "number" && Number.isFinite(el) && el > 0) return true;
    if (typeof es === "number" && Number.isFinite(es) && es > 0) return true;
  }
  return false;
}

export function useQuarterEditorialCounts(sites: WordPressSite[]): {
  bySiteId: Record<string, QuarterEditorialTileStats>;
  dayKey: string;
  refreshAllQuarterCounts: () => Promise<void>;
  isRefreshingAllQuarterCounts: boolean;
} {
  const [tick, setTick] = useState(0);
  const [isRefreshingAllQuarterCounts, setIsRefreshingAllQuarterCounts] = useState(false);

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

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const nk = getLocalDayKey(new Date());
      if (nk !== dayKeyRef.current) {
        setTick((x) => x + 1);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const [bySiteId, setBySiteId] = useState<Record<string, QuarterEditorialTileStats>>({});
  const sitesRef = useRef(sites);
  sitesRef.current = sites;

  const sitesKey = sites
    .map((s) => `${s.id}:${s.editorialCountsPeriodStartYmd?.trim() ?? ""}`)
    .join(",");

  const fetchQuarterFromNetwork = useCallback(async (site: WordPressSite) => {
    const range = getEditorialCountsRange(site.editorialCountsPeriodStartYmd, new Date());
    const entitySitemapUrlForFetch = isEntitySitemapDisabled(site) ? undefined : site.entitySitemapUrl;

    try {
      const result = await fetchQuarterEditorialCounts({
        siteUrl: site.siteUrl,
        username: site.username,
        appPassword: site.appPassword,
        after: range.after,
        before: range.before,
        entitySitemapUrl: entitySitemapUrlForFetch,
        manualEndpoint: site.manualEndpoint,
      });

      if (result.ok) {
        const eco = Boolean(result.entityCountsAvailable);
        const cachePayload: CachedQuarterPayload = {
          postsPublished: result.postsPublished ?? 0,
          postsScheduled: result.postsScheduled ?? 0,
          entityConfigured: Boolean(result.entityConfigured),
          entityCountsAvailable: eco,
          entityPublished: eco ? (result.entityPublished ?? 0) : null,
          entityScheduled: eco ? (result.entityScheduled ?? 0) : null,
          entityCollection: result.entityCollection,
        };

        writeCache(site.id, range.after, range.before, cachePayload);

        setBySiteId((prev) => ({
          ...prev,
          [site.id]: {
            loading: false,
            ...resultToTilePartial(cachePayload, range),
          },
        }));
      } else {
        const err = result.error || "Could not load quarter counts.";
        setBySiteId((prev) => {
          const old = prev[site.id];
          if (canPreserveCountsOnError(old)) {
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
              postsLive: null,
              postsScheduled: null,
              entityLive: null,
              entityScheduled: null,
              entityConfigured: Boolean(
                site.manualEndpoint?.trim() || (entitySitemapUrlForFetch?.trim() ?? ""),
              ),
              entityCountsAvailable: false,
              countsPeriodAfterIso: range.after,
              countsPeriodEndExclusiveIso: range.before,
              countsPeriodMode: range.mode,
              errorTitle: err,
            },
          };
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load quarter counts.";
      setBySiteId((prev) => {
        const old = prev[site.id];
        if (canPreserveCountsOnError(old)) {
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
            postsLive: null,
            postsScheduled: null,
            entityLive: null,
            entityScheduled: null,
            entityConfigured: Boolean(
              site.manualEndpoint?.trim() || (entitySitemapUrlForFetch?.trim() ?? ""),
            ),
            entityCountsAvailable: false,
            countsPeriodAfterIso: range.after,
            countsPeriodEndExclusiveIso: range.before,
            countsPeriodMode: range.mode,
            errorTitle: msg,
          },
        };
      });
    }
  }, []);

  const runFetch = useCallback(async () => {
    void tick;
    void sitesKey;
    const list = sitesRef.current.filter(siteHasCredentials);

    setBySiteId((prev) => {
      const next: Record<string, QuarterEditorialTileStats> = { ...prev };
      for (const s of list) {
        const range = getEditorialCountsRange(s.editorialCountsPeriodStartYmd, new Date());
        const cached = readCache(s.id, range.after, range.before);
        if (cached) {
          next[s.id] = {
            loading: false,
            ...resultToTilePartial(cached, range),
          };
        } else if (shouldPreserveQuarterTileDuringRefresh(prev[s.id], range)) {
          next[s.id] = {
            ...prev[s.id]!,
            loading: true,
            errorTitle: undefined,
          };
        } else {
          next[s.id] = loadingPlaceholderForSite(s, range);
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
        await fetchQuarterFromNetwork(site);
      }),
    );
  }, [tick, sitesKey, fetchQuarterFromNetwork]);

  useEffect(() => {
    void runFetch();
  }, [runFetch]);

  const refreshAllQuarterCounts = useCallback(async () => {
    const list = sitesRef.current.filter(siteHasCredentials);
    if (list.length === 0) {
      return;
    }
    for (const site of list) {
      const range = getEditorialCountsRange(site.editorialCountsPeriodStartYmd, new Date());
      clearSiteCacheForRange(site.id, range.after, range.before);
    }
    setBySiteId((prev) => {
      const next: Record<string, QuarterEditorialTileStats> = { ...prev };
      for (const s of list) {
        const range = getEditorialCountsRange(s.editorialCountsPeriodStartYmd, new Date());
        const old = prev[s.id];
        if (shouldPreserveQuarterTileDuringRefresh(old, range)) {
          next[s.id] = {
            ...old!,
            loading: true,
            errorTitle: undefined,
          };
        } else {
          next[s.id] = loadingPlaceholderForSite(s, range);
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
    setIsRefreshingAllQuarterCounts(true);
    try {
      await Promise.all(list.map((site) => fetchQuarterFromNetwork(site)));
    } finally {
      setIsRefreshingAllQuarterCounts(false);
    }
  }, [fetchQuarterFromNetwork]);

  return {
    bySiteId,
    dayKey,
    refreshAllQuarterCounts,
    isRefreshingAllQuarterCounts,
  };
}
