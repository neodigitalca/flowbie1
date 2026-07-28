import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { buildCatalogEntries } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import { clusterSystemRulesPreamble } from "@/lib/sitemap-optimizer/cluster-merge-policy";
import {
  SITEMAP_OPTIMIZER_MAX_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE,
} from "@/lib/sitemap-optimizer/constants";
import { enforceSeparateGeoClusters } from "@/lib/sitemap-optimizer/enforce-separate-geo-clusters";
import { parseClusterResultJson } from "@/lib/sitemap-optimizer/sitemap-optimizer-parse";
import { resolveClusterOverlap } from "@/lib/sitemap-optimizer/resolve-cluster-overlap";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

const SWEEP_SYSTEM = `${clusterSystemRulesPreamble()}
- Some overlapping posts were left as singletons after batch clustering.
- Find **tight** groups among singletons only (true cannibalization, same city + same topic).
- Use only postIds from allowedSingletonPostIds. Never use alreadyAssignedPostIds.
- Do not duplicate clusters that already exist in existingClusters.
- Return ONLY valid JSON (no markdown fences).`;

export async function runSitemapOptimizerSingletonPairAgent(
  result: SitemapOptimizerClusterResult,
  rows: SitemapOptimizerPostRow[],
  apiKey: string,
  signal?: AbortSignal,
): Promise<SitemapOptimizerClusterResult> {
  if (result.singletons.length < SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE) {
    return result;
  }

  const catalog = buildCatalogEntries(rows);
  const catalogById = new Map(catalog.map((c) => [c.postId, c]));
  const singletonSet = new Set(result.singletons);
  const singletonCatalog = catalog.filter((c) => singletonSet.has(c.postId));
  if (singletonCatalog.length < SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE) {
    return result;
  }

  const alreadyAssigned = new Set(
    result.clusters.flatMap((c) => c.memberPostIds),
  );

  const model = getResearchModel();
  const user = JSON.stringify({
    task: "pair_singletons_for_merge",
    minMembersPerCluster: SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE,
    maxMembersPerCluster: SITEMAP_OPTIMIZER_MAX_MERGE_GROUP_SIZE,
    preferredMaxPerCluster: SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE,
    allowedSingletonPostIds: singletonCatalog.map((c) => c.postId),
    alreadyAssignedPostIds: [...alreadyAssigned],
    existingClusters: result.clusters.map((c) => ({
      clusterId: c.clusterId,
      memberPostIds: c.memberPostIds,
    })),
    catalog: singletonCatalog,
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
    system: SWEEP_SYSTEM,
    user,
    maxTokens: 8000,
    temperature: 0.2,
    responseFormat: { type: "json_object" },
    signal,
  });

  const parsed = parseClusterResultJson(content);
  const newClusters = parsed.clusters.filter((c) => {
    const ids = c.memberPostIds.filter(
      (id) => singletonSet.has(id) && !alreadyAssigned.has(id) && catalogById.has(id),
    );
    return ids.length >= SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE;
  });

  if (newClusters.length === 0) {
    return result;
  }

  const merged: SitemapOptimizerClusterResult = {
    clusters: [...result.clusters, ...newClusters],
    singletons: parsed.singletons.length > 0 ? parsed.singletons : result.singletons,
  };

  const assigned = new Set(merged.clusters.flatMap((c) => c.memberPostIds));
  const singletons = [...new Set(rows.map((r) => r.postId))].filter((id) => !assigned.has(id));

  const geoSafe = enforceSeparateGeoClusters(
    { clusters: merged.clusters, singletons },
    catalog,
  );
  return resolveClusterOverlap(geoSafe);
}
