import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import {
  buildOverviewBulkSeoItem,
  buildOverviewUploadPayloadBundle,
  type OverviewBulkSeoApiItem,
} from "@/lib/overview/overview-bulk-seo-payload";
import type { BulkOverviewSeoResultRow } from "@/lib/wordpress-api/meta";
import type { OptimizationFileManager } from "@/lib/optimization-file-manager";

export type OverviewWpUploadProofFile = {
  name: string;
  content: string;
  mimeType: string;
};

function stubBindingForProof(row: OverviewRow, binding?: OverviewBinding): OverviewBinding {
  if (binding?.postId) return binding;
  const postId = row.postId != null && Number.isFinite(row.postId) && row.postId > 0 ? row.postId : 0;
  return {
    postId,
    subtype: (binding?.subtype ?? row.postType ?? "post").trim() || "post",
    date_gmt: binding?.date_gmt ?? (row.wpDateGmt?.trim() || undefined),
  };
}

/** wordpress.json + upload-payload proof for one grid row (AISEO and research). */
export function buildOverviewRowWpUploadProofFiles(params: {
  site: WordPressSite;
  row: OverviewRow;
  binding?: OverviewBinding;
  inventoryContent: string;
  ok: boolean;
  skipped: boolean;
  error?: string;
  link?: string;
  uploadedAt: string;
  apiResult?: {
    ok: boolean;
    error?: string;
    mergeError?: string;
    method?: string;
    httpStatus?: number;
    link?: string;
  };
}): OverviewWpUploadProofFile[] {
  const url = params.row.url?.trim() ?? "";
  const binding = stubBindingForProof(params.row, params.binding);
  const bundle = buildOverviewUploadPayloadBundle(params.row, binding, {
    forWordPressUpload: true,
    inventoryContent: params.inventoryContent,
  });
  const item =
    bundle?.item ??
    buildOverviewBulkSeoItem(params.row, binding, {
      forWordPressUpload: true,
      inventoryContent: params.inventoryContent,
    });
  const payloadJson =
    bundle?.payloadJson ??
    JSON.stringify(
      {
        pageUrl: url,
        postId: binding.postId || null,
        postType: binding.subtype,
        wordpressSite: params.site.siteUrl,
        wordpressSiteId: params.site.id,
        wordpressSiteName: params.site.name,
        skipped: params.skipped,
        error: params.error ?? null,
      },
      null,
      2,
    );

  const wordpressDoc =
    item != null
      ? buildWpUploadWordPressDocument({
          ok: params.ok,
          site: params.site,
          row: params.row,
          item,
          res: {
            postId: item.postId,
            ok: params.ok,
            error: params.error,
            mergeError: params.apiResult?.mergeError,
            method: params.apiResult?.method,
            httpStatus: params.apiResult?.httpStatus,
            link: params.link ?? params.apiResult?.link,
          },
          uploadedAt: params.uploadedAt,
        })
      : {
          success: params.ok,
          skipped: params.skipped,
          pageUrl: url || null,
          wordpressSite: params.site.siteUrl,
          wordpressSiteId: params.site.id,
          wordpressSiteName: params.site.name,
          uploadedAt: params.uploadedAt,
          error: params.error ?? null,
        };

  if (params.skipped) {
    wordpressDoc.skipped = true;
    if (params.error) wordpressDoc.skipReason = params.error;
  }

  return wpUploadHarnessGeneratedFiles(url, payloadJson, JSON.stringify(wordpressDoc, null, 2));
}

function sanitizeFileSlug(url: string): string {
  return (
    url
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "")
      .split("/")
      .pop()
      ?.replace(/[^a-z0-9._-]+/gi, "_")
      .slice(0, 60) || "page"
  );
}

export function buildWpUploadPayloadDocument(
  item: OverviewBulkSeoApiItem,
  row: OverviewRow,
  pageUrl: string,
): Record<string, unknown> {
  return {
    pageUrl,
    postId: item.postId,
    postType: item.postType,
    postTypeEndpoint: item.postTypeEndpoint,
    postTitle: item.postTitle ?? null,
    postExcerpt: item.postExcerpt ?? null,
    postContent: item.postContent ?? null,
    acf: item.acf,
    gridFocusKeyword: row.focusKeyword?.trim() || null,
    gridTitle: row.aiTitle || row.title || null,
    gridMeta: row.aiMeta || row.metaDescription || null,
  };
}

/** Minimal wordpress.json proof (same shape as post-creator upload artifact). */
export function buildWpUploadWordPressDocument(params: {
  ok: boolean;
  site: WordPressSite;
  row: OverviewRow;
  item: OverviewBulkSeoApiItem;
  res: BulkOverviewSeoResultRow;
  uploadedAt: string;
}): Record<string, unknown> {
  const { ok, site, row, item, res, uploadedAt } = params;
  return {
    success: ok,
    postId: item.postId,
    link: res.link ?? row.url?.trim() ?? null,
    pageUrl: row.url?.trim() ?? null,
    title: item.postTitle ?? row.title ?? null,
    wordpressSite: site.siteUrl,
    wordpressSiteId: site.id,
    wordpressSiteName: site.name,
    uploadedAt,
    error: ok ? null : res.error ?? null,
    postContentChars: item.postContent?.length ?? 0,
  };
}

export function jsonHarnessMarkdown(doc: Record<string, unknown>): string {
  return "```json\n" + JSON.stringify(doc, null, 2) + "\n```";
}

export function wpUploadHarnessGeneratedFiles(
  url: string,
  payloadJson: string,
  wordpressJson: string,
): Array<{ name: string; content: string; mimeType: string }> {
  const slug = sanitizeFileSlug(url);
  return [
    {
      name: `upload-payload-${slug}.json`,
      content: payloadJson,
      mimeType: "application/json",
    },
    {
      name: "wordpress.json",
      content: wordpressJson,
      mimeType: "application/json",
    },
  ];
}

/** Per-row WordPress upload proof files shown in Details → Generated files. */
export function isWordPressUploadProofFileName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed === "wordpress.json" || trimmed.startsWith("upload-payload-");
}

/** Standard wordpress.json + upload-payload proof on OptimizationFileManager (content optimizer + AISEO). */
export function attachWordPressUploadProofToFileManager(params: {
  fileManager: OptimizationFileManager;
  site: WordPressSite;
  pageUrl: string;
  item: OverviewBulkSeoApiItem;
  row?: OverviewRow;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  uploadedAt?: string;
  apiResult?: BulkOverviewSeoResultRow;
  flushGeneratedFiles?: () => void;
}): void {
  const uploadedAt = params.uploadedAt ?? new Date().toISOString();
  const row: OverviewRow =
    params.row ??
    ({
      url: params.pageUrl,
      title: params.item.postTitle ?? "",
      metaDescription: params.item.postExcerpt ?? "",
      aiTitle: "",
      aiMeta: "",
      status: "idle",
    } as OverviewRow);

  const payloadJson = JSON.stringify(
    buildWpUploadPayloadDocument(params.item, row, params.pageUrl),
    null,
    2,
  );

  const wordpressDoc = buildWpUploadWordPressDocument({
    ok: params.ok,
    site: params.site,
    row,
    item: params.item,
    res: {
      postId: params.item.postId,
      ok: params.ok,
      error: params.error,
      mergeError: params.apiResult?.mergeError,
      method: params.apiResult?.method,
      httpStatus: params.apiResult?.httpStatus,
      link: params.apiResult?.link,
    },
    uploadedAt,
  });
  if (params.skipped) {
    wordpressDoc.skipped = true;
    if (params.error) wordpressDoc.skipReason = params.error;
  }

  const wordpressJson = JSON.stringify(wordpressDoc, null, 2);
  for (const file of wpUploadHarnessGeneratedFiles(params.pageUrl, payloadJson, wordpressJson)) {
    params.fileManager.removeFile(file.name);
    params.fileManager.addFile(file.name, file.content, file.mimeType);
  }
  params.flushGeneratedFiles?.();
}
