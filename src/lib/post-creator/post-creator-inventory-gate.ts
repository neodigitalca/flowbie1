import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import {
  parseCompactInventoryUrls,
  parseContentBucketRichRows,
} from "@/lib/bulk/inventory-json-slim";
import type { LoadBulkSitemapInventoryResult } from "@/lib/bulk/bulk-sitemap-inventory-session";
import type { PromptBulkSitemapInventoryBuckets } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { PostCreatorBlockedRow } from "@/lib/post-creator/post-creator-cannibalization-agent";
import {
  buildPostCreatorInventoryCatalog,
  deriveSlugFromText,
  lookupInventoryByUrl,
  type PostCreatorInventoryCatalog,
} from "@/lib/post-creator/post-creator-cannibalization-tools";
import { normalizeDedupeKey } from "@/lib/vertical-benchmark/vertical-benchmark-bulk-dedupe";

export type PostCreatorRowReviewEntry = {
  rowIndex: number;
  row: CSVRow;
  status: "ok" | "blocked";
  reason: string;
  conflictingUrl?: string;
};

export type PostCreatorInventoryContext = {
  catalog: PostCreatorInventoryCatalog;
  keywordInventoryJson: string;
  inventoryUrls: string[];
};

function collectInventoryUrls(buckets: PromptBulkSitemapInventoryBuckets): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const source of ["posts", "pages", "sap"] as const) {
    const block = buckets[source]?.json ?? "";
    for (const url of parseCompactInventoryUrls(block)) {
      const key = url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(url);
    }
  }
  return out;
}

function collectRichRows(
  buckets: PromptBulkSitemapInventoryBuckets,
): Array<{ url?: string; fields?: { keyword?: string; title?: string } }> {
  const out: Array<{ url?: string; fields?: { keyword?: string; title?: string } }> = [];
  for (const source of ["posts", "pages", "sap"] as const) {
    out.push(...parseContentBucketRichRows(buckets[source]?.json ?? ""));
  }
  return out;
}

function inventoryJsonFromCatalog(catalog: PostCreatorInventoryCatalog): string {
  return JSON.stringify({
    site: { url: "" },
    generatedAt: new Date().toISOString(),
    posts: catalog.rows.map((row) => ({
      url: row.url,
      fields: { title: row.title, meta: "", keyword: row.keyword },
    })),
  });
}

export function buildPostCreatorInventoryContext(
  inventory: LoadBulkSitemapInventoryResult,
): PostCreatorInventoryContext {
  const inventoryUrls = collectInventoryUrls(inventory.buckets);
  const richRows = collectRichRows(inventory.buckets);
  const catalog = buildPostCreatorInventoryCatalog(inventoryUrls, richRows);
  return {
    catalog,
    inventoryUrls,
    keywordInventoryJson: inventoryJsonFromCatalog(catalog),
  };
}

export function buildRowReviewEntries(rows: CSVRow[]): PostCreatorRowReviewEntry[] {
  return rows.map((row, rowIndex) => ({
    rowIndex,
    row,
    status: "ok",
    reason: "",
  }));
}

function rowConflictsWithInventory(
  catalog: PostCreatorInventoryCatalog,
  keyword: string,
  title: string,
): { url: string } | null {
  for (const candidate of [keyword, title]) {
    const text = candidate.trim();
    if (!text) continue;
    const slug = deriveSlugFromText(text);
    if (slug && catalog.slugKeys.has(slug)) {
      const hit = lookupInventoryByUrl(catalog, slug)[0];
      return { url: hit?.url ?? "" };
    }
  }
  return null;
}

export function filterPostCreatorChecklistRows(args: {
  rows: CSVRow[];
  inventory: LoadBulkSitemapInventoryResult;
  postCount: number;
}): { rows: CSVRow[]; blockedRows: PostCreatorBlockedRow[] } {
  const context = buildPostCreatorInventoryContext(args.inventory);
  const catalog = context.catalog;
  const blockedRows: PostCreatorBlockedRow[] = [];
  const accepted: CSVRow[] = [];
  const seenKeywords = new Set<string>();
  const seenTitles = new Set<string>();

  for (const row of args.rows) {
    const keyword = row.keyword?.trim() ?? "";
    const title = row.title?.trim() ?? "";
    const keywordKey = keyword ? normalizeDedupeKey(keyword) : "";
    const titleKey = title ? normalizeDedupeKey(title) : "";

    if (keywordKey && seenKeywords.has(keywordKey)) {
      blockedRows.push({ keyword: keyword || title, reason: "Duplicate keyword in checklist" });
      continue;
    }
    if (titleKey && seenTitles.has(titleKey)) {
      blockedRows.push({ keyword: keyword || title, reason: "Duplicate title in checklist" });
      continue;
    }

    const conflict = rowConflictsWithInventory(catalog, keyword, title);
    if (conflict) {
      blockedRows.push({
        keyword: keyword || title,
        reason: "Already covered in site inventory",
        conflictingUrl: conflict.url || undefined,
      });
      continue;
    }

    if (keywordKey) seenKeywords.add(keywordKey);
    if (titleKey) seenTitles.add(titleKey);
    accepted.push(row);
    if (accepted.length >= args.postCount) break;
  }

  return { rows: accepted, blockedRows };
}
