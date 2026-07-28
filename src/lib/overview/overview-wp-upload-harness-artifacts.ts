import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewBulkSeoApiItem } from "@/lib/overview/overview-bulk-seo-payload";
import type { BulkOverviewSeoResultRow } from "@/lib/wordpress-api/meta";

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
    acf: item.acf,
    gridFocusKeyword: row.focusKeyword?.trim() || null,
    gridTitle: row.aiTitle || row.title || null,
    gridMeta: row.aiMeta || row.metaDescription || null,
  };
}

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
    pageUrl: row.url?.trim() ?? null,
    wordpressSite: site.siteUrl,
    uploadedAt,
    method: res.method ?? "direct_put",
    httpStatus: res.httpStatus ?? null,
    error: res.error ?? null,
    mergeError: res.mergeError ?? null,
    fieldsSent: {
      postTitle: item.postTitle ?? null,
      postExcerpt: item.postExcerpt ?? null,
      acf: Object.keys(item.acf || {}),
    },
    acfFields: item.acf,
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
