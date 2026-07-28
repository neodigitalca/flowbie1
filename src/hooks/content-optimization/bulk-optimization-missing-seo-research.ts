import pLimit from "p-limit";
import { notify } from "@/lib/app-notifications";
import { notifyFilledSeoResearchFromSerpForXUrl, notifySeoResearchCouldNotLoadSerpJsonFo, notifySeoResearchErrorForX, notifySeoResearchNoSerpFileReturnedForX } from "@/lib/notify-messages";
import {
  getSeoResearchFromAcf,
  mergeSeoResearchFromAcfIntoContext,
} from "@/lib/content-generation/ai-driven-acf-reader";
import { buildMergedSeoContentBrief } from "@/lib/overview-seo-content-brief";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import {
  mcp_DataForSEO_serp_organic_live_advanced,
} from "@/lib/mcp-tools";

/** Caps parallel MCP / DataForSEO SERP calls during bulk content run research. */
const BULK_SERP_RESEARCH_CONCURRENCY = 8;

/** Throttle React updates during concurrent research (progress + urlSerpResearchReady). */
const BULK_SERP_RESEARCH_PROGRESS_EVERY = 5;

function serpDumpFilenameUrl(filename: string): string {
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  if (base) return `${base}/api/dataforseo/serp-dump/${encodeURIComponent(filename)}`;
  return `/api/dataforseo/serp-dump/${encodeURIComponent(filename)}`;
}

/**
 * True when ACF already has usable `seo_research` (skip live SERP fetch).
 * Empty strings, `{}`, `[]`, and JSON objects/arrays with no entries are not substantive.
 */
export function hasSubstantiveSeoResearch(acfRow: Record<string, unknown> | undefined): boolean {
  const raw = getSeoResearchFromAcf(acfRow).trim();
  if (!raw) return false;
  try {
    const j = JSON.parse(raw) as unknown;
    if (j === null || j === undefined) return false;
    if (Array.isArray(j)) return j.length > 0;
    if (typeof j === "object") return Object.keys(j as Record<string, unknown>).length > 0;
    return true;
  } catch {
    return true;
  }
}

/**
 * DataForSEO SERP → merged `SeoContentBriefV1` JSON (same shape as Overview grid `seoResearch`).
 * GSC / Semrush are omitted (bulk content run uses no live GSC).
 */
export async function fetchDataForSeoSerpBriefJson(opts: {
  keyword: string;
  pageUrl: string;
  muteToasts?: boolean;
}): Promise<string | null> {
  const { keyword, pageUrl, muteToasts } = opts;
  const k = keyword.trim();
  if (!k) return null;

  try {
    const json = await mcp_DataForSEO_serp_organic_live_advanced({
      keyword: k,
      location_name: "United States",
      language_code: "en",
      depth: 10,
      people_also_ask_click_depth: 4,
    });
    const storedFile =
      (json && (json.stored_file || json.storedFile || json.storedFilename)) || null;

    if (!storedFile || typeof storedFile !== "string") {
      if (!muteToasts) notify.warning(notifySeoResearchNoSerpFileReturnedForX(k));
      return null;
    }

    const serpRes = await fetch(serpDumpFilenameUrl(storedFile));
    const serpDumpJson = serpRes.ok ? await serpRes.json().catch(() => null) : null;
    if (!serpDumpJson || typeof serpDumpJson !== "object") {
      if (!muteToasts) {
        notify.warning(
          `SEO research: could not load SERP JSON for "${k}".` +
            (serpRes.ok ? "" : ` (HTTP ${serpRes.status})`),
        );
      }
      return null;
    }

    const merged = buildMergedSeoContentBrief({
      serpDumpJson,
      pageUrl: pageUrl.trim(),
      focusKeyword: k,
      gscPageUrl: pageUrl.trim(),
      gscQueries: [],
      semrushOverviewJson: null,
    });
    const brief = JSON.stringify(merged, null, 2);
    return brief;
  } catch (e) {
    console.warn("[Bulk Optimization] fetchDataForSeoSerpBriefJson:", e);
    if (!muteToasts) notify.warning(notifySeoResearchErrorForX(k));
    return null;
  }
}

function bulkCancelled(batchKey: string, setBulkOptimizationState: (fn: (prev: any) => any) => void): boolean {
  let cancelled = false;
  setBulkOptimizationState((prev: any) => {
    const current = prev[batchKey];
    if (current?.cancelRequested) cancelled = true;
    return prev;
  });
  return cancelled;
}

/** Mark URLs that already have substantive ACF `seo_research` in the prefetch cache (bulk SERP column). */
export function seedBulkUrlSerpResearchReadyFromAcfCache(opts: {
  urls: string[];
  batchKey: string;
  prefetchedAcfFieldsCache: Map<number, Record<string, any>>;
  setBulkOptimizationState: (fn: (prev: any) => any) => void;
}): void {
  const { urls, batchKey, prefetchedAcfFieldsCache, setBulkOptimizationState } = opts;
  const next: Record<string, boolean> = {};
  for (let i = 0; i < urls.length; i++) {
    const row = prefetchedAcfFieldsCache.get(i) ?? {};
    if (hasSubstantiveSeoResearch(row)) next[urls[i]] = true;
  }
  setBulkOptimizationState((prev: any) => {
    const current = prev[batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [batchKey]: {
        ...current,
        urlSerpResearchReady: { ...(current.urlSerpResearchReady || {}), ...next },
      },
    };
  });
}

export function applyBriefToCaches(
  i: number,
  brief: string,
  prefetchedAcfFieldsCache: Map<number, Record<string, any>>,
  prefetchedPendingCache: Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>,
): void {
  const prevRow = prefetchedAcfFieldsCache.get(i) ?? {};
  const mergedRow = { ...prevRow, seo_research: brief };
  prefetchedAcfFieldsCache.set(i, mergedRow);

  const pend = prefetchedPendingCache.get(i);
  if (pend?.pending) {
    const p = pend.pending as Record<string, any>;
    const prevAf =
      p.acfFields && typeof p.acfFields === "object" ? (p.acfFields as Record<string, any>) : {};
    p.acfFields = { ...prevAf, ...mergedRow };
    p.acfContext = mergeSeoResearchFromAcfIntoContext(p.acfFields, p.acfContext);
  }
}

/**
 * After ACF prefetch: for each URL with `keyword_focus` but empty `seo_research`, run DataForSEO SERP
 * and write merged JSON into caches so Content Optimizer does not skip and `acfContext.seoResearch` is set.
 */
export async function fillMissingBulkSeoResearchFromSerp(opts: {
  urls: string[];
  batchKey: string;
  isAcfKeywordMode: boolean;
  seoExtraTextFieldOnly: boolean;
  muteToasts: boolean;
  prefetchedAcfFieldsCache: Map<number, Record<string, any>>;
  prefetchedPendingCache: Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>;
  setBulkOptimizationState: (fn: (prev: any) => any) => void;
  /** Process only indices in [start, end). */
  indexRange?: { start: number; end: number };
  /** Test hook: override SERP brief fetcher (default `fetchDataForSeoSerpBriefJson`). */
  fetchBrief?: (opts: {
    keyword: string;
    pageUrl: string;
    muteToasts?: boolean;
  }) => Promise<string | null>;
}): Promise<void> {
  const {
    urls,
    batchKey,
    isAcfKeywordMode,
    seoExtraTextFieldOnly,
    muteToasts,
    prefetchedAcfFieldsCache,
    prefetchedPendingCache,
    setBulkOptimizationState,
    fetchBrief = fetchDataForSeoSerpBriefJson,
    indexRange,
  } = opts;

  if (!isAcfKeywordMode || seoExtraTextFieldOnly) return;

  type Job = { index: number; url: string; keyword: string };
  const work: Job[] = [];

  const rangeStart = indexRange?.start ?? 0;
  const rangeEnd = indexRange?.end ?? urls.length;

  for (let i = rangeStart; i < rangeEnd; i++) {
    const url = urls[i];
    if (!url) continue;
    const acfCachedKw = String(prefetchedAcfFieldsCache.get(i)?.["keyword_focus"] ?? "").trim();
    const cachedPrimaryKeyword = acfCachedKw;
    const acfRow = prefetchedAcfFieldsCache.get(i) ?? {};
    if (hasSubstantiveSeoResearch(acfRow)) continue;
    if (!cachedPrimaryKeyword) {
      // Never skip: keyword will be derived by SERP warmup from URL when warmIndex runs.
      continue;
    }
    work.push({ index: i, url, keyword: cachedPrimaryKeyword });
  }

  if (work.length === 0) return;

  if (bulkCancelled(batchKey, setBulkOptimizationState)) return;

  const workTotal = work.length;
  let filled = 0;
  let completed = 0;
  const pendingUrlReady: Record<string, boolean> = {};

  const flushProgress = (done: number) => {
    const urlPatch =
      Object.keys(pendingUrlReady).length > 0 ? { ...pendingUrlReady } : null;
    if (urlPatch) {
      for (const k of Object.keys(urlPatch)) delete pendingUrlReady[k];
    }
    setBulkOptimizationState((prev: any) => {
      const current = prev[batchKey];
      if (!current) return prev;
      return {
        ...prev,
        [batchKey]: {
          ...current,
          currentStep: "SEO research…",
          currentStepProgress: {
            step: "SEO research…",
            progress: Math.min(15, Math.round((done / Math.max(1, workTotal)) * 15)),
            message: `Filling empty seo_research (${done}/${workTotal})`,
          },
          ...(urlPatch && Object.keys(urlPatch).length > 0
            ? {
                urlSerpResearchReady: {
                  ...(current.urlSerpResearchReady || {}),
                  ...urlPatch,
                },
              }
            : {}),
        },
      };
    });
  };

  flushProgress(0);

  const limit = pLimit(BULK_SERP_RESEARCH_CONCURRENCY);

  await Promise.all(
    work.map((job) =>
      limit(async () => {
        if (bulkCancelled(batchKey, setBulkOptimizationState)) return;

        const brief = await fetchBrief({
          keyword: job.keyword,
          pageUrl: job.url,
          muteToasts,
        });

        if (bulkCancelled(batchKey, setBulkOptimizationState)) return;

        if (brief) {
          applyBriefToCaches(job.index, brief, prefetchedAcfFieldsCache, prefetchedPendingCache);
          filled += 1;
          pendingUrlReady[job.url] = true;
        }

        completed += 1;
        if (
          completed % BULK_SERP_RESEARCH_PROGRESS_EVERY === 0 ||
          completed === workTotal ||
          Object.keys(pendingUrlReady).length >= BULK_SERP_RESEARCH_PROGRESS_EVERY
        ) {
          flushProgress(completed);
        }
      }),
    ),
  );

  if (Object.keys(pendingUrlReady).length > 0) {
    flushProgress(completed);
  }

  if (filled > 0 && !muteToasts) {
    notify.success(notifyFilledSeoResearchFromSerpForXUrl(filled));
  }
}
