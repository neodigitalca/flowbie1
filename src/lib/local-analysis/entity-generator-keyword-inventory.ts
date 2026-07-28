import type { WordPressSite } from "@/components/integrations/types";
import type { PromptBulkSitemapInventoryBuckets } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { SiteInventoryBulkRow } from "@/lib/wordpress-api/types";

export type EntityGeneratorKeywordInventoryRow = { title: string; keyword: string };

const GENERIC_WP_COLLECTIONS = new Set(["posts", "post", "pages", "page"]);

export function isEntitySapInventoryCollection(collection: string | undefined | null): boolean {
  const c = (collection ?? "").trim().toLowerCase();
  return c.length > 0 && !GENERIC_WP_COLLECTIONS.has(c);
}

export function filterSapInventoryRows(rows: SiteInventoryBulkRow[]): SiteInventoryBulkRow[] {
  return rows.filter((r) => isEntitySapInventoryCollection(r.collection));
}

export function filterPostsInventoryRows(rows: SiteInventoryBulkRow[]): SiteInventoryBulkRow[] {
  return rows.filter((r) => {
    const c = (r.collection ?? "").trim().toLowerCase();
    return c === "posts" || c === "post" || c.length === 0;
  });
}

/** Entity Generator: prefer entity sitemap rows; fall back to posts when SAP is empty. */
export function pickEntityGeneratorKeywordInventoryRows(
  _site: WordPressSite,
  rows: SiteInventoryBulkRow[],
): SiteInventoryBulkRow[] {
  const sap = filterSapInventoryRows(rows);
  if (sap.length > 0) return sap;
  return filterPostsInventoryRows(rows);
}

export function mapEntityGeneratorKeywordInventoryPayload(
  rows: SiteInventoryBulkRow[],
  limit = 120,
): EntityGeneratorKeywordInventoryRow[] {
  return rows.slice(0, limit).map((p) => ({
    title: p.fields?.title ?? "",
    keyword: p.fields?.keyword ?? "",
  }));
}

export function entityGeneratorKeywordInventoryCount(
  rows: SiteInventoryBulkRow[] | null | undefined,
  buckets?: PromptBulkSitemapInventoryBuckets,
): { source: "sap" | "posts"; count: number } {
  const sapRows = filterSapInventoryRows(rows ?? []);
  if (sapRows.length > 0) return { source: "sap", count: sapRows.length };
  const sapBucket = buckets?.sap?.rowCount ?? 0;
  if (sapBucket > 0) return { source: "sap", count: sapBucket };
  const postRows = filterPostsInventoryRows(rows ?? []);
  if (postRows.length > 0) return { source: "posts", count: postRows.length };
  const postBucket = buckets?.posts?.rowCount ?? 0;
  return { source: "posts", count: postBucket };
}
