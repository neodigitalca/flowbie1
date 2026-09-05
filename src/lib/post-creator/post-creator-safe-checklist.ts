import type { WordPressSite } from "@/components/integrations/types";
import { getStoredSites } from "@/components/integrations/storage";
import { resolveOpenRouterApiKeyForHarness } from "@/lib/openrouter-api-key-resolve";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { LoadBulkSitemapInventoryResult } from "@/lib/bulk/bulk-sitemap-inventory-session";
import { scrapePromptBulkSiteKwJson } from "@/lib/bulk/prompt-bulk-site-kw-scrape";
import { runPostCreatorInventoryFirstIdeation } from "@/lib/post-creator/post-creator-inventory-ideation";
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
import {
  POST_CREATOR_MAX_POST_COUNT,
  resolvePostCreatorPostCount,
} from "@/lib/post-creator/post-creator-post-count";
import type { PostCreatorServerPreflight } from "@/lib/post-creator/post-creator-server-preflight";

export type PostCreatorSafeChecklistArgs = {
  site: WordPressSite;
  payload: PostCreatorExecutionPayload;
  preflight?: PostCreatorServerPreflight;
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
  const { site, payload, preflight, onProgress, onContentBucketReady, isCancelled } = args;
  const postCount = resolvePostCreatorPostCount(payload);
  const prefilledRows = Array.isArray(payload.prefilledImportRows)
    ? payload.prefilledImportRows.filter((row) => row && typeof row === "object")
    : [];

  const stored = getStoredSites().find((s) => s.id === site.id) ?? site;

  if (prefilledRows.length > 0) {
    if (!stored.username?.trim() || !stored.appPassword?.trim()) {
      throw new Error("WordPress credentials are required for post creation.");
    }
    onProgress?.(`${prefilledRows.length} imported blog draft(s) ready`, 0.9);
    return {
      rows: prefilledRows.slice(0, Math.min(POST_CREATOR_MAX_POST_COUNT, prefilledRows.length)),
      inventory: null,
      blockedRows: [],
      bucketFiles: [],
    };
  }

  const keywordSource: PostCreatorKeywordSource = payload.keywordSource ?? "gsc";

  const openRouterKey = await resolveOpenRouterApiKeyForHarness();

  if (await isCancelled?.()) throw new Error("Cancelled");

  if (!stored.username?.trim() || !stored.appPassword?.trim()) {
    throw new Error("WordPress credentials are required for post creation.");
  }

  let inventory: LoadBulkSitemapInventoryResult;
  let bucketFiles: PostCreatorContentBucketFile[];
  let bucketJson: string;
  let siteKwJsonText: string;

  if (preflight) {
    inventory = preflight.inventory;
    bucketFiles = preflight.bucketFiles;
    bucketJson = preflight.bucketJson;
    siteKwJsonText = preflight.siteKwJsonText;
    onProgress?.("Using server content bucket artifacts…", 0.1);
  } else {
    const loaded = await loadPostCreatorInventoryBuckets(stored, (msg) => onProgress?.(msg, 0.1));
    inventory = loaded.inventory;
    bucketFiles = buildContentBucketFiles(inventory, stored.siteUrl);
    bucketJson = inventory.buckets.posts?.json ?? "";
    const kwScrape = await scrapePromptBulkSiteKwJson(stored);
    siteKwJsonText = kwScrape.keywordsJsonText;
  }

  onContentBucketReady?.(bucketFiles);

  if (await isCancelled?.()) throw new Error("Cancelled");

  let rows: CSVRow[];

  if (keywordSource === "manual") {
    rows = buildManualRows(payload, postCount);
  } else if (keywordSource === "gsc") {
    if (!preflight) {
      onProgress?.("Loading GSC keywords…", 0.15);
    }
    const rawRows = await runPostCreatorInventoryFirstIdeation({
      apiKey: openRouterKey,
      siteId: stored.id,
      siteName: stored.name,
      postCount,
      optionalPrompt: payload.optionalPrompt,
      bucketJson,
      siteKwJsonText,
      onProgress: (msg) => onProgress?.(msg, 0.25),
    });
    rows = rawRows.slice(0, postCount);
  } else {
    rows = await runPostCreatorBulkIdeasOnce({
      site: stored,
      inventory,
      payload,
      postCount,
      apiKey: openRouterKey,
      siteKwJsonText,
      onProgress: (msg) => onProgress?.(msg, 0.25),
    });
    rows = rows.slice(0, postCount);
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
