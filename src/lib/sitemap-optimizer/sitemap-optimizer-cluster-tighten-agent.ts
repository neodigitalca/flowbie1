import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { buildCatalogEntries } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import { clusterSystemRulesPreamble } from "@/lib/sitemap-optimizer/cluster-merge-policy";
import {
  SITEMAP_OPTIMIZER_MAX_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_TIGHTEN_CLUSTER_THRESHOLD,
} from "@/lib/sitemap-optimizer/constants";
import { parseClusterResultJson } from "@/lib/sitemap-optimizer/sitemap-optimizer-parse";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

const TIGHTEN_SYSTEM = `${clusterSystemRulesPreamble()}
- You are **splitting oversized or overly broad** draft clusters.
- Break umbrella groups into **tight** clusters (${SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE}-${SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE} members) or move non-matching posts to singletons.
- Never return a cluster with more than ${SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE} members unless URLs are near-duplicate for the same city and topic.
- Return ONLY valid JSON (no markdown fences).`;

function oversizedClusters(clusters: SitemapOptimizerCluster[]): SitemapOptimizerCluster[] {
  return clusters.filter((c) => c.memberPostIds.length > SITEMAP_OPTIMIZER_TIGHTEN_CLUSTER_THRESHOLD);
}

export async function runSitemapOptimizerClusterTightenAgent(
  result: SitemapOptimizerClusterResult,
  rows: SitemapOptimizerPostRow[],
  apiKey: string,
  signal?: AbortSignal,
): Promise<SitemapOptimizerClusterResult> {
  const toSplit = oversizedClusters(result.clusters);
  if (toSplit.length === 0) return result;

  const catalog = buildCatalogEntries(rows);
  const catalogById = new Map(catalog.map((c) => [c.postId, c]));
  const allowedPostIds = [...new Set(rows.map((r) => r.postId))];
  const tightClusters = result.clusters.filter(
    (c) => c.memberPostIds.length <= SITEMAP_OPTIMIZER_TIGHTEN_CLUSTER_THRESHOLD,
  );

  const model = getResearchModel();
  const user = JSON.stringify({
    task: "tighten_oversized_merge_clusters",
    instruction: `Split each oversizedCluster into smaller same-intent groups or singletons. Max ${SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE} per cluster unless near-duplicates.`,
    allowedPostIds,
    oversizedClusters: toSplit.map((c) => ({
      ...c,
      members: c.memberPostIds
        .map((id) => catalogById.get(id))
        .filter((m) => m != null),
    })),
    keepClusters: tightClusters,
    outputSchema: {
      clusters: [
        {
          clusterId: "string",
          label: "string",
          intent: "string",
          memberPostIds: ["postId"],
          confidence: "high|medium|low",
          rationale: "string",
        },
      ],
      singletons: ["postId"],
    },
  });

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model,
    system: TIGHTEN_SYSTEM,
    user,
    maxTokens: 8000,
    temperature: 0.15,
    responseFormat: { type: "json_object" },
    signal,
  });

  const parsed = parseClusterResultJson(content);
  const mergedClusters = [...tightClusters, ...parsed.clusters];
  const singletonSet = new Set([...result.singletons, ...parsed.singletons]);

  const assigned = new Set<string>();
  for (const c of mergedClusters) {
    for (const id of c.memberPostIds) assigned.add(id);
  }
  for (const id of assigned) singletonSet.delete(id);
  for (const id of allowedPostIds) {
    if (!assigned.has(id)) singletonSet.add(id);
  }

  return {
    clusters: mergedClusters.filter(
      (c) => c.memberPostIds.length >= SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE,
    ),
    singletons: [...singletonSet],
  };
}
