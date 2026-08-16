import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { parseCompactInventoryUrls } from "@/lib/bulk/inventory-json-slim";
import type { LoadBulkSitemapInventoryResult } from "@/lib/bulk/bulk-sitemap-inventory-session";
import type { PromptBulkSitemapInventoryBuckets } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import {
  buildInventoryKeywordSet,
  conflictsWithInventoryKeyword,
} from "@/lib/vertical-benchmark/vertical-benchmark-inventory-cannibal";
import {
  buildPostCreatorInventoryCatalog,
  deriveSlugFromText,
  lookupInventoryByUrl,
  type PostCreatorInventoryCatalog,
} from "@/lib/post-creator/post-creator-cannibalization-tools";

export type PostCreatorRowGateStatus = "ok" | "blocked";

export type PostCreatorRowGateResult = {
  rowIndex: number;
  row: CSVRow;
  status: PostCreatorRowGateStatus;
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
  const catalog = buildPostCreatorInventoryCatalog(inventoryUrls);
  return {
    catalog,
    inventoryUrls,
    keywordInventoryJson: inventoryJsonFromCatalog(catalog),
  };
}

function slugConflict(
  catalog: PostCreatorInventoryCatalog,
  row: CSVRow,
): { blocked: true; reason: string; conflictingUrl: string } | { blocked: false } {
  const keyword = row.keyword?.trim() || row.keyword_focus?.trim() || "";
  const title = row.title?.trim() || "";
  const slugCandidates = [deriveSlugFromText(keyword), deriveSlugFromText(title)].filter(Boolean);
  for (const slug of slugCandidates) {
    if (catalog.slugKeys.has(slug)) {
      const match = lookupInventoryByUrl(catalog, slug, 1)[0];
      if (match) {
        return {
          blocked: true,
          reason: `Slug "${slug}" already exists in site inventory`,
          conflictingUrl: match.url,
        };
      }
    }
  }
  return { blocked: false };
}

export function runDeterministicPostCreatorGate(
  rows: CSVRow[],
  context: PostCreatorInventoryContext,
): PostCreatorRowGateResult[] {
  const keywordSet = buildInventoryKeywordSet(context.keywordInventoryJson);

  return rows.map((row, rowIndex) => {
    const keyword = row.keyword?.trim() || row.keyword_focus?.trim() || "";
    const title = row.title?.trim() || "";

    const slugHit = slugConflict(context.catalog, row);
    if (slugHit.blocked) {
      return {
        rowIndex,
        row,
        status: "blocked",
        reason: slugHit.reason,
        conflictingUrl: slugHit.conflictingUrl,
      };
    }

    if (keyword) {
      const kwHit = conflictsWithInventoryKeyword(keyword, keywordSet);
      if (kwHit.conflicts) {
        const urlMatch = lookupInventoryByUrl(context.catalog, keyword, 1)[0];
        return {
          rowIndex,
          row,
          status: "blocked",
          reason: `Keyword "${keyword}" conflicts with inventory phrase "${kwHit.matched}"`,
          conflictingUrl: urlMatch?.url,
        };
      }
    }

    if (title) {
      const titleHit = conflictsWithInventoryKeyword(title, keywordSet);
      if (titleHit.conflicts) {
        const urlMatch = lookupInventoryByUrl(context.catalog, title, 1)[0];
        return {
          rowIndex,
          row,
          status: "blocked",
          reason: `Title "${title}" conflicts with inventory phrase "${titleHit.matched}"`,
          conflictingUrl: urlMatch?.url,
        };
      }
    }

    return { rowIndex, row, status: "ok", reason: "" };
  });
}

export function assertRowPassedGate(
  row: CSVRow,
  context: PostCreatorInventoryContext,
): void {
  const [result] = runDeterministicPostCreatorGate([row], context);
  if (result?.status === "blocked") {
    throw new Error(result.reason + (result.conflictingUrl ? ` (${result.conflictingUrl})` : ""));
  }
}
