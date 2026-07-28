import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { buildCatalogEntries } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import {
  SITEMAP_OPTIMIZER_GRID_URL_TAG_BATCH_CONCURRENCY,
  SITEMAP_OPTIMIZER_GRID_URL_TAG_BATCH_SIZE,
  SITEMAP_OPTIMIZER_GRID_URL_TAG_MAX_TOKENS,
} from "@/lib/sitemap-optimizer/constants";
import { normalizeGridGeoTag, normalizeGridTopicTag } from "@/lib/sitemap-optimizer/grid-tag-key";
import type { GridCompressionLevel } from "@/lib/sitemap-optimizer/grid-compression-policy";
import { parseGridUrlTagBatchJson } from "@/lib/sitemap-optimizer/grid-url-tag-parse";
import type {
  GridUrlIntent,
  SitemapOptimizerCatalogEntry,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

const GRID_TAG_SYSTEM = `You are a senior SEO strategist tagging GSC URLs for a merge grid.

Assign every row exactly one topic tag. URLs with the same theme MUST share the same topicTag so they can consolidate into one new post (3-5 URLs per cluster).

Rules:
- topicTag: stable snake_case id reused across many rows (e.g. physician_practice_profit, cloud_accounting, quickbooks_online, cpp_retirement). Use a SMALL site-wide tag set (roughly 20-60 tags for the whole upload), not one unique tag per URL.
- Never use vague tags alone like business, accounting, or blog.
- Different major intents MUST get different topic tags (QuickBooks vs online backups vs director liability are never the same tag).
- geoTag: city/region slug when the URL/title is clearly local (e.g. yellowknife, alberta); omit or empty string if not local. geoTag does not change topicTag for the same theme.
- intent: informational|commercial|transactional|local|mixed
- tagLabel: short human-readable label (under 50 chars)
- postId must match catalog postId exactly.
- You MUST return one tag object for every catalog postId in this request. Do not omit rows.
Return ONLY valid JSON: { "tags": [ { postId, topicTag, geoTag, intent, tagLabel } ] }`;

export class GridUrlTagCoverageError extends Error {
  readonly missingPostIds: string[];

  constructor(missingPostIds: string[]) {
    super(`Grid tagging incomplete: ${missingPostIds.length} URL(s) missing topic tags.`);
    this.name = "GridUrlTagCoverageError";
    this.missingPostIds = missingPostIds;
  }
}

function chunkCatalog(entries: SitemapOptimizerCatalogEntry[]): SitemapOptimizerCatalogEntry[][] {
  const batches: SitemapOptimizerCatalogEntry[][] = [];
  for (let i = 0; i < entries.length; i += SITEMAP_OPTIMIZER_GRID_URL_TAG_BATCH_SIZE) {
    batches.push(entries.slice(i, i + SITEMAP_OPTIMIZER_GRID_URL_TAG_BATCH_SIZE));
  }
  return batches;
}

type TagMap = Map<
  string,
  { gridTopicTag: string; gridGeoTag: string; gridTagLabel: string; gridIntent: GridUrlIntent }
>;

async function tagOneBatch(
  catalog: SitemapOptimizerCatalogEntry[],
  apiKey: string,
  model: string,
  signal?: AbortSignal,
  compression: GridCompressionLevel = "none",
): Promise<TagMap> {
  const user = JSON.stringify({
    task: "tag_grid_urls",
    requiredTagCount: catalog.length,
    catalog: catalog.map((c) => ({
      postId: c.postId,
      url: c.url,
      title: c.title,
      urlPathTail: c.urlPathTail,
      gscPageClicks: c.gscPageClicks,
      gscPageImpressions: c.gscPageImpressions,
    })),
    outputSchema: {
      tags: [
        {
          postId: "string",
          topicTag: "string",
          geoTag: "string",
          intent: "informational|commercial|transactional|local|mixed",
          tagLabel: "string",
        },
      ],
    },
  });

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model,
    system: GRID_TAG_SYSTEM,
    user,
    maxTokens: SITEMAP_OPTIMIZER_GRID_URL_TAG_MAX_TOKENS,
    temperature: 0.15,
    responseFormat: { type: "json_object" },
    signal,
  });

  const parsed = parseGridUrlTagBatchJson(content);
  const map: TagMap = new Map();
  for (const t of parsed) {
    if (!t.postId) continue;
    map.set(t.postId, {
      gridTopicTag: t.topicTag,
      gridGeoTag: t.geoTag,
      gridTagLabel: t.tagLabel,
      gridIntent: t.intent,
    });
  }
  return map;
}

async function tagCatalogSliceWithFullCoverage(
  catalog: SitemapOptimizerCatalogEntry[],
  apiKey: string,
  model: string,
  signal?: AbortSignal,
  compression: GridCompressionLevel = "none",
): Promise<TagMap> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const part = await tagOneBatch(catalog, apiKey, model, signal, compression);
  const missing = catalog.filter((c) => !part.has(c.postId));

  if (missing.length === 0) return part;
  if (catalog.length <= 1) return part;

  const mid = Math.ceil(catalog.length / 2);
  const left = await tagCatalogSliceWithFullCoverage(
    catalog.slice(0, mid),
    apiKey,
    model,
    signal,
    compression,
  );
  const right = await tagCatalogSliceWithFullCoverage(
    catalog.slice(mid),
    apiKey,
    model,
    signal,
    compression,
  );

  const merged: TagMap = new Map(part);
  for (const [id, tag] of left) merged.set(id, tag);
  for (const [id, tag] of right) merged.set(id, tag);
  return merged;
}

export type GridUrlTagProgress = {
  tagsCompleted: number;
  tagsTotal: number;
};

async function tagBatchesWithConcurrency(
  batches: SitemapOptimizerCatalogEntry[][],
  apiKey: string,
  model: string,
  signal: AbortSignal | undefined,
  compression: GridCompressionLevel,
  onProgress?: (p: GridUrlTagProgress) => void,
  tagsTotal?: number,
): Promise<TagMap> {
  const tagByPostId: TagMap = new Map();
  const n = batches.length;
  if (!n) return tagByPostId;

  let next = 0;
  let completedRows = 0;

  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const idx = next;
      next += 1;
      if (idx >= n) return;
      const batch = batches[idx]!;
      const part = await tagCatalogSliceWithFullCoverage(batch, apiKey, model, signal, compression);
      for (const [id, tag] of part) tagByPostId.set(id, tag);
      completedRows += batch.length;
      onProgress?.({ tagsCompleted: completedRows, tagsTotal: tagsTotal ?? completedRows });
    }
  }

  const workers = Math.min(Math.max(1, SITEMAP_OPTIMIZER_GRID_URL_TAG_BATCH_CONCURRENCY), n);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return tagByPostId;
}

/** Tag every grid row (batched OpenRouter, parallel batches). Mutates rows in place. */
export async function runGridUrlTagAgent(
  rows: SitemapOptimizerPostRow[],
  apiKey: string,
  signal?: AbortSignal,
  onProgress?: (p: GridUrlTagProgress) => void,
  compression: GridCompressionLevel = "none",
): Promise<SitemapOptimizerPostRow[]> {
  const catalog = buildCatalogEntries(rows);
  const model = getResearchModel();
  const batches = chunkCatalog(catalog);

  const tagByPostId = await tagBatchesWithConcurrency(
    batches,
    apiKey,
    model,
    signal,
    compression,
    onProgress,
    rows.length,
  );

  const stillMissing = rows.filter((r) => !tagByPostId.has(r.postId)).map((r) => r.postId);
  if (stillMissing.length > 0) {
    throw new GridUrlTagCoverageError(stillMissing);
  }

  return rows.map((row) => {
    const tag = tagByPostId.get(row.postId)!;
    return {
      ...row,
      gridTopicTag: normalizeGridTopicTag(tag.gridTopicTag),
      gridGeoTag: normalizeGridGeoTag(tag.gridGeoTag),
      gridTagLabel: tag.gridTagLabel,
      gridIntent: tag.gridIntent,
    };
  });
}
