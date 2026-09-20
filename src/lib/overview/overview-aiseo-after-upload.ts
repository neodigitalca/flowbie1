import type { Dispatch, SetStateAction } from "react";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import { applyElementorOptimization } from "@/lib/elementor-api";
import {
  buildOverviewBulkSeoItem,
  resolveOverviewBindingForRow,
  uploadOverviewSeoApiItemAvoidingBatchV1,
} from "@/lib/overview/overview-bulk-seo-payload";
import { isAnswerOnlyHarnessBody } from "@/lib/overview/overview-blog-overview-prepend";
import { buildOverviewRowWpUploadProofFiles } from "@/lib/overview/overview-wp-upload-harness-artifacts";
import { mergeGeneratedFilesByName } from "@/lib/overview/overview-peer-csv-details";
import {
  filterAiseoRowDisplayFiles,
  isAiseoFileSlotRunKind,
} from "@/lib/overview/overview-aiseo-row-artifacts";
import { applyAiseoHtmlToRowsRef } from "@/lib/overview/overview-aiseo-cache-write";
import {
  generatedFilesForUrl,
  storageKeyForUrlGeneratedFiles,
} from "@/lib/content-optimization/content-optimizer-bulk-generator-bindings";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

export function rowUrlHostname(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Row must belong to the connected WordPress site before any upload runs. */
export function rowUrlMatchesWordPressSite(rowUrl: string, site: WordPressSite): boolean {
  const rowHost = rowUrlHostname(rowUrl);
  const siteHost = rowUrlHostname(site.siteUrl ?? "");
  if (!rowHost || !siteHost) return false;
  return rowHost === siteHost;
}

export type OverviewAiseoGeneratedFile = {
  name: string;
  content: string;
  mimeType: string;
};

export type OverviewAiseoRowWpUploadResult = {
  ok: boolean;
  skipped: boolean;
  error?: string;
  postId?: number;
  link?: string;
  generatedFiles: OverviewAiseoGeneratedFile[];
};

export type UploadOverviewAiseoRowParams = {
  site: WordPressSite;
  row: OverviewRow;
  bindings: Record<string, OverviewBinding | undefined>;
  getInventoryMatchForUrl: (
    site: WordPressSite,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
};

export type AiseoAfterRowWriteParams = {
  index: number;
  url: string;
  html: string;
  rowFiles?: OverviewAiseoGeneratedFile[];
};

export type AiseoAfterRowWriteFn = (params: AiseoAfterRowWriteParams) => Promise<void>;

export type UploadAiseoRowAfterWriteDeps = {
  site: WordPressSite;
  rowsRef: { current: OverviewRow[] };
  bindings: Record<string, OverviewBinding | undefined>;
  resolveBindings: UploadOverviewAiseoWrittenRowsParams["resolveBindings"];
  getInventoryMatchForUrl: UploadOverviewAiseoWrittenRowsParams["getInventoryMatchForUrl"];
  batchKey: string;
  setBulkOptimizationState: Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
};

/** Apply HTML to the row and upload to WordPress immediately (per-row, before next row). */
export async function uploadAiseoRowAfterWrite(
  deps: UploadAiseoRowAfterWriteDeps,
  params: AiseoAfterRowWriteParams,
): Promise<OverviewAiseoRowWpUploadResult> {
  const url = params.url.trim();
  if (!url) {
    return { ok: false, skipped: true, generatedFiles: [] };
  }
  applyAiseoHtmlToRowsRef(deps.rowsRef, url, params.html);
  const urlKey = normalizePageUrlKey(url);
  const row =
    deps.rowsRef.current.find(
      (candidate) => normalizePageUrlKey(candidate.url) === urlKey,
    ) ??
    (params.index >= 0 ? deps.rowsRef.current[params.index] : undefined);
  if (!row) {
    return { ok: false, skipped: true, generatedFiles: [] };
  }

  const extra = await deps.resolveBindings([url], deps.site, undefined, { inventoryOnly: true });
  const bindings = { ...deps.bindings, ...extra };
  const result = await uploadOverviewAiseoRowToWordPress({
    site: deps.site,
    row,
    bindings,
    getInventoryMatchForUrl: (s, u) => deps.getInventoryMatchForUrl(s, u),
  });
  const files = mergeGeneratedFilesByName(params.rowFiles ?? [], result.generatedFiles);
  attachAiseoUploadGeneratedFiles(
    deps.batchKey,
    deps.setBulkOptimizationState,
    url,
    files,
    result.ok,
  );
  return result;
}

/** Upload one AISEO row to WordPress and produce wordpress.json + upload-payload JSON proof. */
export async function uploadOverviewAiseoRowToWordPress(
  params: UploadOverviewAiseoRowParams,
): Promise<OverviewAiseoRowWpUploadResult> {
  const uploadedAt = new Date().toISOString();
  const url = params.row.url?.trim() ?? "";
  const invMatch = url ? params.getInventoryMatchForUrl(params.site, url) : undefined;
  const inventoryContent = invMatch?.row?.fields?.content?.trim() ?? "";
  const invHit =
    invMatch?.row?.id != null && Number.isFinite(invMatch.row.id)
      ? {
          row: { id: invMatch.row.id, date_gmt: invMatch.row.date_gmt ?? null },
          subtype: invMatch.subtype,
        }
      : undefined;
  const binding = resolveOverviewBindingForRow(params.row, params.bindings, invHit);

  if (!url || !rowUrlMatchesWordPressSite(url, params.site)) {
    const siteLabel = params.site.name?.trim() || params.site.siteUrl || params.site.id;
    const error = url
      ? `Row URL is not on connected site ${siteLabel}. Upload blocked.`
      : "Row URL missing. Upload blocked.";
    return {
      ok: false,
      skipped: true,
      error,
      generatedFiles: buildOverviewRowWpUploadProofFiles({
        site: params.site,
        row: params.row,
        binding,
        inventoryContent,
        ok: false,
        skipped: true,
        error,
        uploadedAt,
      }),
    };
  }

  if (!binding?.postId) {
    const error = "No WordPress post binding for this row.";
    return {
      ok: false,
      skipped: true,
      error,
      generatedFiles: buildOverviewRowWpUploadProofFiles({
        site: params.site,
        row: params.row,
        binding,
        inventoryContent,
        ok: false,
        skipped: true,
        error,
        uploadedAt,
      }),
    };
  }

  const bodyForUpload =
    params.row.postContentOptimized?.trim() ||
    params.row.postContent?.trim() ||
    inventoryContent.trim();
  if (bodyForUpload && isAnswerOnlyHarnessBody(bodyForUpload)) {
    const error =
      "Post body missing in cache; skipped upload so the live post is not replaced with Answer only.";
    return {
      ok: false,
      skipped: true,
      error,
      postId: binding.postId,
      generatedFiles: buildOverviewRowWpUploadProofFiles({
        site: params.site,
        row: params.row,
        binding,
        inventoryContent,
        ok: false,
        skipped: true,
        error,
        uploadedAt,
      }),
    };
  }

  try {
    if (params.row.contentFormat === "elementor" && params.row.elementorDataJson?.trim()) {
      await applyElementorOptimization(
        params.site,
        binding.postId,
        params.row.elementorDataJson.trim(),
      );
    }

    const item = buildOverviewBulkSeoItem(params.row, binding, {
      forWordPressUpload: true,
      inventoryContent,
    });
    if (!item) {
      const error = "Nothing to upload for this row.";
      return {
        ok: false,
        skipped: true,
        error,
        postId: binding.postId,
        generatedFiles: buildOverviewRowWpUploadProofFiles({
          site: params.site,
          row: params.row,
          binding,
          inventoryContent,
          ok: false,
          skipped: true,
          error,
          uploadedAt,
        }),
      };
    }

    const rowRes = await uploadOverviewSeoApiItemAvoidingBatchV1(params.site, item);
    const generatedFiles = buildOverviewRowWpUploadProofFiles({
      site: params.site,
      row: params.row,
      binding,
      inventoryContent,
      ok: Boolean(rowRes.ok),
      skipped: false,
      error: rowRes.ok ? undefined : rowRes.error || "WordPress rejected the update.",
      link: rowRes.link,
      uploadedAt,
      apiResult: rowRes,
    });

    if (!rowRes.ok) {
      return {
        ok: false,
        skipped: false,
        error: rowRes.error || "WordPress rejected the update.",
        postId: binding.postId,
        generatedFiles,
      };
    }
    return {
      ok: true,
      skipped: false,
      postId: binding.postId,
      link: rowRes.link,
      generatedFiles,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "WordPress update failed.";
    return {
      ok: false,
      skipped: false,
      error,
      postId: binding.postId,
      generatedFiles: buildOverviewRowWpUploadProofFiles({
        site: params.site,
        row: params.row,
        binding,
        inventoryContent,
        ok: false,
        skipped: false,
        error,
        uploadedAt,
      }),
    };
  }
}

export type UploadOverviewAiseoWrittenRowsParams = {
  site: WordPressSite;
  rows: OverviewRow[];
  indices: number[];
  bindings: Record<string, OverviewBinding | undefined>;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
  resolveBindings: (
    urls: string[],
    site: WordPressSite,
    extra?: undefined,
    options?: { inventoryOnly?: boolean },
  ) => Promise<Record<string, OverviewBinding | undefined>>;
  batchKey?: string;
  setBulkOptimizationState?: Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
};

function mergeAiseoUploadRowFiles(
  current: BulkOptimizationState,
  url: string,
  files: OverviewAiseoGeneratedFile[],
): OverviewAiseoGeneratedFile[] {
  const merged = mergeGeneratedFilesByName(generatedFilesForUrl(current.urlGeneratedFiles, url), files);
  if (isAiseoFileSlotRunKind(current.runKind)) {
    return filterAiseoRowDisplayFiles(current.runKind, merged);
  }
  return merged;
}

export function attachAiseoUploadGeneratedFiles(
  batchKey: string,
  setBulkOptimizationState: Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>,
  url: string,
  files: OverviewAiseoGeneratedFile[],
  uploadOk: boolean,
): void {
  if (!url || !files.length) return;
  setBulkOptimizationState((prev) => {
    const current = prev[batchKey];
    const fileKey = storageKeyForUrlGeneratedFiles(current?.urlGeneratedFiles, url, current?.urls);
    const rowFiles = current
      ? mergeAiseoUploadRowFiles(current, url, files)
      : mergeGeneratedFilesByName([], files);

    if (!current) {
      return {
        ...prev,
        [batchKey]: {
          urls: [],
          currentIndex: 0,
          urlStatuses: {},
          currentStep: "",
          runKind: "wpUpload",
          urlGeneratedFiles: {
            [fileKey]: rowFiles,
          },
          currentStepProgress: {
            step: "Upload to WordPress",
            message: uploadOk ? `Uploaded ${url}` : `Upload failed: ${url}`,
          },
        },
      };
    }

    return {
      ...prev,
      [batchKey]: {
        ...current,
        urlStatuses: {
          ...(current.urlStatuses || {}),
          [url]: uploadOk ? "completed" : "error",
        },
        urlGeneratedFiles: {
          ...(current.urlGeneratedFiles || {}),
          [fileKey]: rowFiles,
        },
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "Upload to WordPress",
          message: uploadOk ? `Uploaded ${url}` : `Upload failed: ${url}`,
        },
      },
    };
  });
}

/** Push AISEO-written rows to WordPress after batch; attach wordpress.json proof per row. */
export async function uploadOverviewAiseoWrittenRows(
  params: UploadOverviewAiseoWrittenRowsParams,
): Promise<{ uploaded: number; failed: number; skipped: number }> {
  const { site, rows, indices } = params;
  let uploaded = 0;
  let failed = 0;
  let skipped = 0;
  if (!site.username?.trim() || !site.appPassword?.trim()) return { uploaded, failed, skipped };

  const urls = indices.map((index) => rows[index]?.url).filter(Boolean) as string[];
  const extra = await params.resolveBindings(urls, site, undefined, { inventoryOnly: true });
  const bindings = { ...params.bindings, ...extra };

  for (const index of indices) {
    const row = rows[index];
    if (!row) continue;
    const url = row.url?.trim() ?? "";
    try {
      const result = await uploadOverviewAiseoRowToWordPress({
        site,
        row,
        bindings,
        getInventoryMatchForUrl: (s, u) => params.getInventoryMatchForUrl(s, u),
      });
      if (params.batchKey && params.setBulkOptimizationState && url && result.generatedFiles.length) {
        attachAiseoUploadGeneratedFiles(
          params.batchKey,
          params.setBulkOptimizationState,
          url,
          result.generatedFiles,
          result.ok,
        );
      }
      if (result.skipped) skipped += 1;
      else if (result.ok) uploaded += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  if (params.batchKey && params.setBulkOptimizationState && (uploaded > 0 || failed > 0 || skipped > 0)) {
    params.setBulkOptimizationState((prev) => {
      const current = prev[params.batchKey!];
      if (!current) return prev;
      return {
        ...prev,
        [params.batchKey!]: {
          ...current,
          currentStep: "Upload to WordPress",
          currentStepProgress: {
            ...(current.currentStepProgress || {}),
            step: "Upload to WordPress",
            progress: 100,
            message: `WordPress upload: ${uploaded} ok, ${failed} failed, ${skipped} skipped`,
          },
        },
      };
    });
  }

  return { uploaded, failed, skipped };
}
