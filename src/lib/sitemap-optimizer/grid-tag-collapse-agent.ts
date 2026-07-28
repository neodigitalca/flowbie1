import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { SITEMAP_OPTIMIZER_GRID_URL_TAG_MAX_TOKENS } from "@/lib/sitemap-optimizer/constants";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import {
  tagCollapseMaxDistinct,
  tagCollapseTargetParentCount,
  targetGridParentTagCount,
  type GridCompressionLevel,
} from "@/lib/sitemap-optimizer/grid-compression-policy";
import { normalizeGridTopicTag } from "@/lib/sitemap-optimizer/grid-tag-key";
import { parseGridTagCollapseJson } from "@/lib/sitemap-optimizer/grid-tag-collapse-parse";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

const GRID_TAG_COLLAPSE_SYSTEM = `You are a senior SEO strategist consolidating topic tags for a GSC URL merge grid.

You receive many granular topicTag values (often one per URL slug). Merge them into a SMALL canonical set (target 25-50 parent tags for the whole site).

Rules:
- toTag: stable snake_case parent id reused by many fromTag values
- fromTag: must match an input tag exactly
- tagLabel: short human label for toTag (under 50 chars)
- Merge synonyms and near-duplicates (e.g. auto_repair_business + auto_shop_success → auto_repair_business)
- Keep major intents separate (QuickBooks vs cloud_accounting vs director_liability vs online_backups)
- Map firm-announcement tags (welcome, partner, award, careers, team, milestone) → toTag "company", tagLabel "Company"
- Every input tag must appear as fromTag in exactly one mapping
Return ONLY valid JSON: { "mappings": [ { fromTag, toTag, tagLabel } ] }`;

export type DistinctTopicTag = {
  topicTag: string;
  tagLabel: string;
  urlCount: number;
};

export function distinctTopicTagsFromRows(rows: readonly SitemapOptimizerPostRow[]): DistinctTopicTag[] {
  const byTag = new Map<string, { tagLabel: string; urlCount: number }>();
  for (const row of rows) {
    const topic = normalizeGridTopicTag(row.gridTopicTag ?? "untagged");
    const existing = byTag.get(topic);
    const label = row.gridTagLabel?.trim() || topic.replace(/_/g, " ");
    if (existing) {
      existing.urlCount += 1;
      if (!existing.tagLabel && label) existing.tagLabel = label;
    } else {
      byTag.set(topic, { tagLabel: label, urlCount: 1 });
    }
  }
  return [...byTag.entries()]
    .map(([topicTag, v]) => ({ topicTag, tagLabel: v.tagLabel, urlCount: v.urlCount }))
    .sort((a, b) => b.urlCount - a.urlCount);
}

function applyCollapseMappings(
  rows: SitemapOptimizerPostRow[],
  mappings: ReturnType<typeof parseGridTagCollapseJson>,
): SitemapOptimizerPostRow[] {
  const toTagLabel = new Map<string, string>();
  const remap = new Map<string, string>();

  for (const m of mappings) {
    remap.set(m.fromTag, m.toTag);
    if (m.tagLabel) toTagLabel.set(m.toTag, m.tagLabel);
  }

  return rows.map((row) => {
    const from = normalizeGridTopicTag(row.gridTopicTag ?? "untagged");
    const to = remap.get(from) ?? from;
    const label = toTagLabel.get(to) ?? row.gridTagLabel ?? to.replace(/_/g, " ");
    return {
      ...row,
      gridTopicTag: to,
      gridTagLabel: label.slice(0, 50),
    };
  });
}

/** Collapse over-granular per-URL tags into a small canonical topic set (one OpenRouter call). */
export async function collapseGridTopicTags(
  rows: SitemapOptimizerPostRow[],
  apiKey: string,
  signal?: AbortSignal,
  compression: GridCompressionLevel = "none",
  maxUrlsPerPost: GridMaxUrlsPerPost = 5,
): Promise<SitemapOptimizerPostRow[]> {
  const distinct = distinctTopicTagsFromRows(rows);
  const maxDistinct = tagCollapseMaxDistinct(compression, rows.length, maxUrlsPerPost);
  if (distinct.length <= maxDistinct) return rows;

  const user = JSON.stringify({
    task: "collapse_grid_topic_tags",
    targetParentTagCount: tagCollapseTargetParentCount(compression, rows.length, maxUrlsPerPost),
    inputTags: distinct,
    outputSchema: {
      mappings: [{ fromTag: "string", toTag: "string", tagLabel: "string" }],
    },
  });

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model: getResearchModel(),
    system: GRID_TAG_COLLAPSE_SYSTEM,
    user,
    maxTokens: SITEMAP_OPTIMIZER_GRID_URL_TAG_MAX_TOKENS,
    temperature: 0.15,
    responseFormat: { type: "json_object" },
    signal,
  });

  const mappings = parseGridTagCollapseJson(content);
  if (mappings.length === 0) return rows;

  const mappedFrom = new Set(mappings.map((m) => m.fromTag));
  const collapsed = applyCollapseMappings(rows, mappings);

  const stillDistinct = distinctTopicTagsFromRows(collapsed);
  const parentTarget = targetGridParentTagCount(compression, rows.length, maxUrlsPerPost);
  if (
    stillDistinct.length > parentTarget * 2 &&
    mappedFrom.size < distinct.length * 0.25
  ) {
    return rows;
  }

  return collapsed;
}
