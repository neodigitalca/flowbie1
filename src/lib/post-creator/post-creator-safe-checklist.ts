import type { WordPressSite } from "@/components/integrations/types";
import { getStoredSites } from "@/components/IntegrationsTab";
import { loadApiKey } from "@/lib/api";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { LoadBulkSitemapInventoryResult } from "@/lib/bulk/bulk-sitemap-inventory-session";
import {
  buildPromptBulkKwConnectedSiteContext,
  selectPromptBulkLowHangingKeywords,
} from "@/lib/bulk/prompt-bulk-kw-research-agent";
import { scrapePromptBulkSiteKwJson } from "@/lib/bulk/prompt-bulk-site-kw-scrape";
import { parseTitleTemplate } from "@/lib/title-template-parser";
import type {
  PostCreatorEntityMode,
  PostCreatorExecutionPayload,
  PostCreatorKeywordSource,
} from "@/lib/tasks-types";
import { runPostCreatorBulkIdeasOnce } from "@/lib/post-creator/post-creator-bulk-ideas-once";
import type { PostCreatorBlockedRow } from "@/lib/post-creator/post-creator-cannibalization-agent";
import {
  buildContentBucketFiles,
  loadPostCreatorInventoryBuckets,
  type PostCreatorContentBucketFile,
} from "@/lib/post-creator/post-creator-inventory-bucket";

export type PostCreatorSafeChecklistArgs = {
  site: WordPressSite;
  payload: PostCreatorExecutionPayload;
  onProgress?: (message: string, progress?: number) => void;
  onContentBucketReady?: (files: PostCreatorContentBucketFile[]) => void;
  isCancelled?: () => Promise<boolean>;
};

export type PostCreatorChecklistArgs = PostCreatorSafeChecklistArgs;

export type PostCreatorSafeChecklistResult = {
  rows: CSVRow[];
  inventory: LoadBulkSitemapInventoryResult;
  blockedRows: PostCreatorBlockedRow[];
  bucketFiles: PostCreatorContentBucketFile[];
};

export type PostCreatorChecklistResult = {
  rows: CSVRow[];
  inventory: LoadBulkSitemapInventoryResult | null;
};

function parseListString(list: string): string[] {
  if (!list?.trim()) return [];
  return list
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function applyRowMetadata(
  rows: CSVRow[],
  payload: PostCreatorExecutionPayload,
): CSVRow[] {
  const entityMode: PostCreatorEntityMode = payload.entityMode ?? "blank";
  const entityValue = payload.entityValue?.trim() || "";
  const titleTemplate = payload.titleTemplate?.trim() || "";
  const featuredImage = payload.featuredImage !== false;

  if (entityMode === "manual" && entityValue) {
    const entityValues = parseListString(entityValue);
    rows.forEach((row, index) => {
      if (entityValues.length > 0) {
        row.entity = entityValues[Math.min(index, entityValues.length - 1)] || "";
      }
    });
  }

  if (titleTemplate) {
    rows.forEach((row, index) => {
      const variables: Record<string, string> = {
        Keyword: row.keyword || "",
        Entity: row.entity || "",
        Location: "",
        Number: String(index + 1),
      };
      const templateTitle = parseTitleTemplate(titleTemplate, variables);
      if (templateTitle?.trim()) row.title = templateTitle.trim();
    });
  }

  rows.forEach((row) => {
    row.featuredImage = featuredImage ? row.featuredImage || "y" : "n";
  });

  return rows;
}

function buildManualRows(
  payload: PostCreatorExecutionPayload,
  postCount: number,
): CSVRow[] {
  const keyword = payload.keywordValue?.trim() || "blog topic";
  return Array.from({ length: postCount }, (_, i) => ({
    keyword: postCount === 1 ? keyword : `${keyword} ${i + 1}`.trim(),
    title: "",
    entity: payload.entityValue?.trim() || undefined,
    featuredImage: payload.featuredImage !== false ? "y" : "n",
  }));
}

export async function buildPostCreatorSafeChecklistRows(
  args: PostCreatorSafeChecklistArgs,
): Promise<PostCreatorSafeChecklistResult> {
  const { site, payload, onProgress, onContentBucketReady, isCancelled } = args;
  const postCount = Math.max(1, Math.min(31, Math.floor(Number(payload.postCount ?? 1) || 1)));
  const keywordSource: PostCreatorKeywordSource = payload.keywordSource ?? "prompt";

  const openRouterKey = loadApiKey()?.trim() || "";
  if (!openRouterKey) throw new Error("Add an OpenRouter API key in Settings.");

  if (await isCancelled?.()) throw new Error("Cancelled");

  const stored = getStoredSites().find((s) => s.id === site.id) ?? site;

  if (!stored.username?.trim() || !stored.appPassword?.trim()) {
    throw new Error("WordPress credentials are required for post creation.");
  }

  const { inventory } = await loadPostCreatorInventoryBuckets(stored, (msg) => onProgress?.(msg, 0.1));
  const bucketFiles = buildContentBucketFiles(inventory, stored.siteUrl);
  onContentBucketReady?.(bucketFiles);

  if (await isCancelled?.()) throw new Error("Cancelled");

  let rows: CSVRow[];

  if (keywordSource === "manual") {
    rows = buildManualRows(payload, postCount);
  } else if (keywordSource === "gsc") {
    onProgress?.("Loading GSC keywords…", 0.15);
    const kwScrape = await scrapePromptBulkSiteKwJson(stored);
    const gscExactKeywords = await selectPromptBulkLowHangingKeywords({
      apiKey: openRouterKey,
      siteId: stored.id,
      keywordsJsonText: kwScrape.keywordsJsonText,
      numberOfBlogs: postCount,
      topic: payload.optionalPrompt,
      modifier: payload.optionalPrompt,
      inventoryUrlCount: inventory.totalRows,
      connectedSite: buildPromptBulkKwConnectedSiteContext(stored),
    });
    rows = await runPostCreatorBulkIdeasOnce({
      site: stored,
      inventory,
      payload,
      postCount,
      apiKey: openRouterKey,
      gscExactKeywords,
      siteKwJsonText: kwScrape.keywordsJsonText,
      onProgress: (msg) => onProgress?.(msg, 0.25),
    });
  } else {
    rows = await runPostCreatorBulkIdeasOnce({
      site: stored,
      inventory,
      payload,
      postCount,
      apiKey: openRouterKey,
      onProgress: (msg) => onProgress?.(msg, 0.25),
    });
  }

  rows = applyRowMetadata(rows, payload);

  if (rows.length < postCount) {
    throw new Error(`OpenRouter returned ${rows.length}/${postCount} blog ideas.`);
  }

  onProgress?.(`${rows.length} blog ideas ready`, 0.9);

  return {
    rows: rows.slice(0, postCount),
    inventory,
    blockedRows: [],
    bucketFiles,
  };
}

/** @deprecated Use buildPostCreatorSafeChecklistRows */
export async function buildPostCreatorChecklistRows(
  args: PostCreatorSafeChecklistArgs,
): Promise<Omit<PostCreatorSafeChecklistResult, "blockedRows" | "bucketFiles"> & { inventory: LoadBulkSitemapInventoryResult | null }> {
  const result = await buildPostCreatorSafeChecklistRows(args);
  return {
    rows: result.rows,
    inventory: result.inventory,
  };
}
