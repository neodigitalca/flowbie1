import { flushSync } from "react-dom";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import {
  buildOverviewUploadPayloadBundle,
  overviewBindingForRow,
  type BuildOverviewBulkSeoItemOptions,
  type OverviewUploadPayloadBundle,
  type SemrushUploadScope,
} from "@/lib/overview/overview-bulk-seo-payload";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import {
  bulkUpdateOverviewSeo,
  type BulkOverviewSeoResultRow,
  type BulkOverviewSeoResponse,
} from "@/lib/wordpress-api/meta";
import {
  applyWpUploadBatchProgress,
  finalizeWpUploadHarnessSections,
  finishWpUploadBatchHarness,
  setWpUploadBatchPrepMessage,
  type WpUploadHarnessSetters,
} from "@/lib/overview/overview-wp-upload-harness-run";
import type { OverviewWordPressUploadFailureRow } from "@/lib/overview/overview-wordpress-export-csv";
import { overviewRowInBulkScope } from "@/lib/overview/overview-bulk-row-scope";
import { semrushIssueLabelFromFilename } from "@/lib/overview/parse-semrush-error-csv";
import { overviewBulkPageRanges } from "@/lib/overview/overview-bulk-page-size";
import { OVERVIEW_WP_API_BATCH_SIZE } from "@/lib/overview/overview-batch-pipeline-progress";
import {
  initOverviewBulkHarnessPagination,
  setOverviewBulkHarnessPageState,
} from "@/lib/overview/overview-bulk-page-state";

export type WpUploadEligibleRow = {
  index: number;
  row: OverviewRow;
  bundle: OverviewUploadPayloadBundle;
};

export type WpUploadRowResult = {
  index: number;
  url: string;
  ok: boolean;
  error?: string;
  mergeError?: string;
  postId: number | null;
};

export type RunOverviewWpUploadBatchParams = {
  site: WordPressSite;
  eligible: WpUploadEligibleRow[];
  harnessSetters: WpUploadHarnessSetters;
  batchKey: string;
  onRowStart?: (index: number, row: OverviewRow) => void;
  onRowComplete?: (result: WpUploadRowResult) => void;
};

export type BuildWpUploadEligibleRowsOptions = {
  resolveBinding?: (row: OverviewRow) => OverviewBinding | undefined;
};

export function buildWpUploadEligibleRows(
  rows: OverviewRow[],
  bindings: Record<string, OverviewBinding | undefined>,
  bulkScopeUrlKeys: Set<string>,
  semrushCsvFileName: string | null = null,
  options?: BuildWpUploadEligibleRowsOptions,
): WpUploadEligibleRow[] {
  const uploadOptions: BuildOverviewBulkSeoItemOptions = semrushCsvFileName
    ? { semrushScope: semrushIssueLabelFromFilename(semrushCsvFileName) as SemrushUploadScope }
    : { forWordPressUpload: true };
  const eligible: WpUploadEligibleRow[] = [];
  rows.forEach((row, index) => {
    if (!overviewRowInBulkScope(row.url, bulkScopeUrlKeys)) {
      return;
    }
    const binding =
      options?.resolveBinding?.(row) ?? overviewBindingForRow(row, bindings);
    if (!binding?.postId) return;
    const bundle = buildOverviewUploadPayloadBundle(row, binding, uploadOptions);
    if (!bundle) return;
    eligible.push({ index, row, bundle });
  });
  return eligible;
}

export function rowHasUploadableGridFields(row: OverviewRow): boolean {
  const title = (row.aiTitle || row.title || "").trim();
  const meta = (row.aiMeta || row.metaDescription || "").trim();
  const focus = (row.focusKeyword ?? "").trim();
  const faq = (row.faq ?? "").trim();
  const date = (row.dateModifier ?? "").trim();
  const seo = (row.seoResearch ?? "").trim();
  return Boolean(title || meta || focus || faq || date || seo);
}

export function urlsMissingPostIdWithGridData(
  rows: OverviewRow[],
  bindings: Record<string, OverviewBinding | undefined>,
): string[] {
  const urls: string[] = [];
  for (const row of rows) {
    const url = row.url?.trim();
    if (!url) continue;
    if (overviewBindingForRow(row, bindings)?.postId) continue;
    if (!rowHasUploadableGridFields(row)) continue;
    urls.push(url);
  }
  return urls;
}

function mapBulkResults(
  bulkRes: BulkOverviewSeoResponse,
): {
  resultByIndex: Map<number, BulkOverviewSeoResultRow>;
  resultByPostId: Map<number, BulkOverviewSeoResultRow>;
} {
  const resultByIndex = new Map<number, BulkOverviewSeoResultRow>();
  const resultByPostId = new Map<number, BulkOverviewSeoResultRow>();
  for (const row of bulkRes.results ?? []) {
    if (typeof row.index === "number") {
      resultByIndex.set(row.index, row);
    }
    if (row.postId != null && Number.isFinite(row.postId)) {
      resultByPostId.set(row.postId, row);
    }
  }
  return { resultByIndex, resultByPostId };
}

function rowResultFromBulk(
  entry: WpUploadEligibleRow,
  localIdx: number,
  uploadResult: BulkOverviewSeoResultRow | undefined,
  fallbackError?: string,
): WpUploadRowResult {
  const url = entry.row.url?.trim() ?? "";
  const postId = entry.bundle.item.postId;
  const res: BulkOverviewSeoResultRow = uploadResult ?? {
    postId,
    ok: false,
    error: fallbackError ?? "No result returned for this row.",
  };
  if (res.ok) {
    return { index: entry.index, url, ok: true, postId };
  }
  const error = res.error?.trim() || fallbackError || "WordPress rejected the update.";
  return {
    index: entry.index,
    url,
    ok: false,
    postId,
    error,
    mergeError: res.mergeError,
  };
}

async function uploadPreparedChunk(
  site: WordPressSite,
  chunkPrepared: Array<{ entry: WpUploadEligibleRow; url: string }>,
  harnessSetters: WpUploadHarnessSetters,
  onRowStart: RunOverviewWpUploadBatchParams["onRowStart"],
  onRowComplete: RunOverviewWpUploadBatchParams["onRowComplete"],
  wpBatch: number,
  wpBatchCount: number,
): Promise<{ results: WpUploadRowResult[]; failures: OverviewWordPressUploadFailureRow[] }> {
  const urls = chunkPrepared.map((p) => p.url);
  const localIndexToUrl: Record<number, string> = {};
  for (let localIdx = 0; localIdx < chunkPrepared.length; localIdx += 1) {
    localIndexToUrl[localIdx] = chunkPrepared[localIdx]!.url;
  }

  flushSync(() => {
    for (const { entry } of chunkPrepared) {
      onRowStart?.(entry.index, entry.row);
    }
  });

  const items = chunkPrepared.map(({ entry }) => entry.bundle.item);
  let bulkRes: BulkOverviewSeoResponse;
  try {
    bulkRes = await bulkUpdateOverviewSeo(
      site.siteUrl,
      site.username!,
      site.appPassword!,
      items,
      {
        onProgress: (event) => {
          applyWpUploadBatchProgress(harnessSetters, {
            done: wpBatch,
            total: wpBatchCount,
            wpBatch,
            wpBatchCount,
            batchResults: event.batchResults,
            localIndexToUrl,
          });
        },
      },
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : "WordPress upload failed.";
    bulkRes = {
      success: false,
      results: chunkPrepared.map(({ entry }, localIdx) => ({
        postId: entry.bundle.item.postId,
        index: localIdx,
        ok: false,
        error,
        method: "direct_put",
      })),
      okCount: 0,
      total: chunkPrepared.length,
      error,
    };
  }

  const mergedResults = bulkRes.results ?? [];

  const { resultByIndex, resultByPostId } = mapBulkResults(bulkRes);
  const results: WpUploadRowResult[] = [];
  const failures: OverviewWordPressUploadFailureRow[] = [];
  const successByUrl: Record<string, boolean> = {};
  const errorByUrl: Record<string, string | undefined> = {};

  for (let localIdx = 0; localIdx < chunkPrepared.length; localIdx += 1) {
    const { entry } = chunkPrepared[localIdx]!;
    const uploadResult =
      resultByIndex.get(localIdx) ?? resultByPostId.get(entry.bundle.item.postId);
    const rowResult = rowResultFromBulk(entry, localIdx, uploadResult);
    results.push(rowResult);
    successByUrl[rowResult.url] = rowResult.ok;
    errorByUrl[rowResult.url] = rowResult.error;
    if (!rowResult.ok) {
      failures.push({
        postId: rowResult.postId,
        url: entry.row.url,
        error: rowResult.error ?? "WordPress rejected the update.",
        mergeError: rowResult.mergeError,
      });
    }
  }

  // One progress tick per WP batch (one bulk-update-overview-seo call), not per row.
  applyWpUploadBatchProgress(harnessSetters, {
    done: wpBatch,
    total: wpBatchCount,
    wpBatch,
    wpBatchCount,
    batchResults: mergedResults,
    localIndexToUrl,
  });
  finishWpUploadBatchHarness(urls, successByUrl, errorByUrl, harnessSetters);
  finalizeWpUploadHarnessSections(harnessSetters, failures);

  flushSync(() => {
    for (let localIdx = 0; localIdx < results.length; localIdx += 1) {
      onRowComplete?.(results[localIdx]!);
    }
  });

  return { results, failures };
}

export async function runOverviewWpUploadBatch(
  params: RunOverviewWpUploadBatchParams,
): Promise<{
  results: WpUploadRowResult[];
  stats: { okCount: number; failCount: number; failures: OverviewWordPressUploadFailureRow[] };
}> {
  const { site, eligible, harnessSetters, batchKey, onRowStart, onRowComplete } = params;
  const failures: OverviewWordPressUploadFailureRow[] = [];

  if (!eligible.length) {
    return { results: [], stats: { okCount: 0, failCount: 0, failures } };
  }

  const uploadChunkSize = OVERVIEW_WP_API_BATCH_SIZE;
  const prepared = eligible.map((entry) => ({
    entry,
    url: entry.row.url?.trim() ?? "",
  }));
  const total = prepared.length;

  initOverviewBulkHarnessPagination(batchKey, total, harnessSetters.setBulkOptimizationState);
  setWpUploadBatchPrepMessage(
    batchKey,
    harnessSetters.siteId,
    `Uploading ${total} row(s) to WordPress…`,
    harnessSetters,
  );

  const pageRanges = overviewBulkPageRanges(total, uploadChunkSize);
  const resultByIndex = new Map<number, WpUploadRowResult>();

  for (let pageIdx = 0; pageIdx < pageRanges.length; pageIdx += 1) {
    const { start, end, page, pageCount } = pageRanges[pageIdx]!;
    const chunkPrepared = prepared.slice(start, end);

    if (pageCount > 1) {
      setOverviewBulkHarnessPageState({
        batchKey,
        siteId: harnessSetters.siteId,
        page,
        pageCount,
        start,
        end,
        total,
        setBulkOptimizationState: harnessSetters.setBulkOptimizationState,
        setOptimizationProgress: harnessSetters.setOptimizationProgress,
        step: "Uploading to WordPress",
      });
      setWpUploadBatchPrepMessage(
        batchKey,
        harnessSetters.siteId,
        `Uploading batch ${page}/${pageCount} (${chunkPrepared.length} rows)…`,
        harnessSetters,
      );
    }

    const outcome = await uploadPreparedChunk(
      site,
      chunkPrepared,
      harnessSetters,
      onRowStart,
      onRowComplete,
      page,
      pageCount,
    );
    for (const rowResult of outcome.results) {
      resultByIndex.set(rowResult.index, rowResult);
    }
    failures.push(...outcome.failures);
  }

  const results = Array.from(resultByIndex.values()).sort((a, b) => a.index - b.index);
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  return { results, stats: { okCount, failCount, failures } };
}
