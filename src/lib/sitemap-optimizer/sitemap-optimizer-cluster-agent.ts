import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { buildCatalogEntries } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import {
  clusterSystemRulesPreamble,
  gscUnderperformerClusterPreamble,
} from "@/lib/sitemap-optimizer/cluster-merge-policy";
import { formatGscBenchmarksForPrompt } from "@/lib/sitemap-optimizer/gsc-site-performance-benchmarks";
import { buildGscSitePerformanceBenchmarks } from "@/lib/sitemap-optimizer/gsc-site-performance-benchmarks";
import { gridMaxSizeClusterSystemPreamble } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import {
  SITEMAP_OPTIMIZER_CLUSTER_BATCH_SIZE,
  SITEMAP_OPTIMIZER_CLUSTER_BATCH_THRESHOLD,
  SITEMAP_OPTIMIZER_MAX_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE,
} from "@/lib/sitemap-optimizer/constants";
import { enforceSeparateGeoClusters } from "@/lib/sitemap-optimizer/enforce-separate-geo-clusters";
import { resolveClusterOverlap } from "@/lib/sitemap-optimizer/resolve-cluster-overlap";
import { runSitemapOptimizerClusterTightenAgent } from "@/lib/sitemap-optimizer/sitemap-optimizer-cluster-tighten-agent";
import { runSitemapOptimizerClusterValidateAgent } from "@/lib/sitemap-optimizer/sitemap-optimizer-cluster-validate-agent";
import { ensureAllPostIdsInClusterResult } from "@/lib/sitemap-optimizer/ensure-cluster-catalog-coverage";
import { parseClusterResultJson } from "@/lib/sitemap-optimizer/sitemap-optimizer-parse";
import { countClusterCoverage } from "@/lib/sitemap-optimizer/sitemap-optimizer-cluster-coverage";
import type {
  SitemapOptimizerCatalogEntry,
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

/** Skip LLM reconcile when batch-merge already yields a modest cluster count (avoids collapsing dozens of groups to a handful). */
const RECONCILE_SKIP_MAX_CLUSTERS = 80;
/** If reconcile cuts merge groups by more than this fraction vs pre-reconcile, keep pre-reconcile. */
const RECONCILE_MIN_CLUSTER_RETENTION = 0.65;

function buildClusterSystem(preamble: string): string {
  return `${preamble}
- Each postId must appear in at most one cluster OR in singletons, never both.
- **memberPostIds must be copied character-for-character from allowedPostIds** (from catalog.postId). Never invent ids.
- Invalid merge: one real post plus a suggested shorter title only. That post stays a singleton.
- Return ONLY valid JSON (no markdown fences).`;
}

const CLUSTER_SYSTEM_WORDPRESS = buildClusterSystem(clusterSystemRulesPreamble());
function clusterSystemForGrid(maxUrlsPerPost: GridMaxUrlsPerPost): string {
  return buildClusterSystem(gridMaxSizeClusterSystemPreamble(maxUrlsPerPost));
}

export type ClusterAgentSubphase = "batch" | "reconcile" | "validate" | "tighten" | "finalize";

export type ClusterAgentProgress = {
  urlsProcessed: number;
  clustersCreated: number;
  clusterBatchCompleted?: number;
  clusterBatchTotal?: number;
  subphase?: ClusterAgentSubphase;
};

export type ClusterAgentOptions = {
  runMode?: "wordpress" | "grid_csv";
  /** Grid: max URLs per cluster (3–5). */
  gridMaxUrlsPerPost?: GridMaxUrlsPerPost;
  /** GSC triage underperformers: AI picks group sizes (2–8 typical). */
  gscPerformanceMode?: boolean;
  /** Entity SAP: hard cap on legacy URLs per replacement cluster. */
  entityMaxRedirectsPerReplacement?: number;
  onProgress?: (progress: ClusterAgentProgress) => void;
};

function allowedPostIdsFromCatalog(catalog: SitemapOptimizerCatalogEntry[]): string[] {
  return catalog.map((c) => c.postId);
}

function chunkCatalog(entries: SitemapOptimizerCatalogEntry[]): SitemapOptimizerCatalogEntry[][] {
  const batches: SitemapOptimizerCatalogEntry[][] = [];
  for (let i = 0; i < entries.length; i += SITEMAP_OPTIMIZER_CLUSTER_BATCH_SIZE) {
    batches.push(entries.slice(i, i + SITEMAP_OPTIMIZER_CLUSTER_BATCH_SIZE));
  }
  return batches;
}

async function clusterOneBatch(
  catalog: SitemapOptimizerCatalogEntry[],
  apiKey: string,
  model: string,
  system: string,
  task: string,
  signal?: AbortSignal,
  memberLimits?: {
    minMembersPerCluster: number;
    maxMembersPerCluster: number;
    preferredMaxPerCluster: number;
  },
): Promise<SitemapOptimizerClusterResult> {
  const limits = memberLimits ?? {
    minMembersPerCluster: SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE,
    maxMembersPerCluster: SITEMAP_OPTIMIZER_MAX_MERGE_GROUP_SIZE,
    preferredMaxPerCluster: SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE,
  };
  const user = JSON.stringify({
    task,
    minMembersPerCluster: limits.minMembersPerCluster,
    maxMembersPerCluster: limits.maxMembersPerCluster,
    preferredMaxPerCluster: limits.preferredMaxPerCluster,
    allowedPostIds: allowedPostIdsFromCatalog(catalog),
    catalog,
    outputSchema: {
      clusters: [
        {
          clusterId: "string",
          label: "string",
          intent: "informational|commercial|transactional|local|mixed",
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
    system,
    user,
    maxTokens: 8000,
    temperature: 0.2,
    responseFormat: { type: "json_object" },
    signal,
  });

  return parseClusterResultJson(content);
}

function mergeClusterResults(parts: SitemapOptimizerClusterResult[]): SitemapOptimizerClusterResult {
  const clusters = parts.flatMap((p) => p.clusters);
  const singletonSet = new Set(parts.flatMap((p) => p.singletons));
  const assigned = new Set<string>();
  for (const c of clusters) {
    for (const id of c.memberPostIds) assigned.add(id);
  }
  for (const id of assigned) singletonSet.delete(id);
  return { clusters, singletons: [...singletonSet] };
}

async function reconcileBatchClusters(
  partial: SitemapOptimizerClusterResult,
  apiKey: string,
  model: string,
  system: string,
  signal?: AbortSignal,
): Promise<SitemapOptimizerClusterResult> {
  if (partial.clusters.length <= 1) return partial;

  const allowedPostIds = [
    ...new Set(
      partial.clusters.flatMap((c) => c.memberPostIds).concat(partial.singletons),
    ),
  ];

  const user = JSON.stringify({
    task: "reconcile_batch_clusters",
    instruction:
      "Merge only true duplicate-intent clusters across batches. Do not create umbrella clusters. Split geo/topic mixes. Use only allowedPostIds.",
    allowedPostIds,
    partial,
    outputSchema: {
      clusters: [{ clusterId: "", label: "", intent: "", memberPostIds: [], confidence: "", rationale: "" }],
      singletons: [],
    },
  });

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model,
    system,
    user,
    maxTokens: 6000,
    temperature: 0.15,
    responseFormat: { type: "json_object" },
    signal,
  });

  const parsed = parseClusterResultJson(content);
  const candidate = parsed.clusters.length > 0 ? parsed : partial;
  const allowed = [
    ...new Set(
      partial.clusters.flatMap((c) => c.memberPostIds).concat(partial.singletons),
    ),
  ];
  const reconciled = ensureAllPostIdsInClusterResult(allowed, candidate);
  const before = countClusterCoverage(
    ensureAllPostIdsInClusterResult(allowed, partial),
  );
  const retained =
    before.mergeGroups === 0
      ? 1
      : reconciled.clusters.length / before.mergeGroups;
  if (
    before.mergeGroups > 0 &&
    retained < RECONCILE_MIN_CLUSTER_RETENTION
  ) {
    return ensureAllPostIdsInClusterResult(allowed, partial);
  }
  return reconciled;
}

export async function runSitemapOptimizerClusterAgent(
  rows: SitemapOptimizerPostRow[],
  apiKey: string,
  signal?: AbortSignal,
  options?: ClusterAgentOptions,
): Promise<SitemapOptimizerClusterResult> {
  const model = getResearchModel();
  const catalog = buildCatalogEntries(rows);
  const allPostIds = catalog.map((c) => c.postId);
  const gridMax = options?.gridMaxUrlsPerPost ?? 5;
  const gscPerformanceMode = Boolean(options?.gscPerformanceMode);
  const entityRedirectCap = options?.entityMaxRedirectsPerReplacement;
  const useGridSizedClusters =
    !gscPerformanceMode &&
    (options?.runMode === "grid_csv" || options?.gridMaxUrlsPerPost != null);
  const benchmarksText = gscPerformanceMode
    ? formatGscBenchmarksForPrompt(buildGscSitePerformanceBenchmarks(rows))
    : "";
  const system = gscPerformanceMode
    ? buildClusterSystem(`${gscUnderperformerClusterPreamble()}\n\n${benchmarksText}`)
    : useGridSizedClusters
      ? clusterSystemForGrid(gridMax)
      : CLUSTER_SYSTEM_WORDPRESS;
  const memberLimits = gscPerformanceMode
    ? entityRedirectCap != null
      ? {
          minMembersPerCluster: 2,
          maxMembersPerCluster: entityRedirectCap,
          preferredMaxPerCluster: entityRedirectCap,
        }
      : {
          minMembersPerCluster: 2,
          maxMembersPerCluster: SITEMAP_OPTIMIZER_MAX_MERGE_GROUP_SIZE,
          preferredMaxPerCluster: SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE,
        }
    : useGridSizedClusters
      ? {
          minMembersPerCluster:
            options?.runMode === "grid_csv" || gridMax === 1
              ? 1
              : SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE,
          maxMembersPerCluster: gridMax,
          preferredMaxPerCluster: gridMax,
        }
      : undefined;
  const task = gscPerformanceMode
    ? "cluster_gsc_underperformers"
    : options?.runMode === "grid_csv"
      ? "cluster_grid_urls_max_per_post"
      : "cluster_posts_for_merge";
  const onProgress = options?.onProgress;
  let urlsProcessed = 0;

  const isGrid = options?.runMode === "grid_csv";
  const emitProgress = (
    partial: SitemapOptimizerClusterResult,
    meta?: Pick<ClusterAgentProgress, "clusterBatchCompleted" | "clusterBatchTotal" | "subphase">,
  ) => {
    const groupsCreated = isGrid
      ? partial.clusters.length + partial.singletons.length
      : partial.clusters.length;
    onProgress?.({
      urlsProcessed,
      clustersCreated: groupsCreated,
      ...meta,
    });
  };

  let result: SitemapOptimizerClusterResult;
  let clusterBatchTotal = 1;
  if (catalog.length <= SITEMAP_OPTIMIZER_CLUSTER_BATCH_THRESHOLD) {
    result = await clusterOneBatch(catalog, apiKey, model, system, task, signal, memberLimits);
    urlsProcessed = catalog.length;
    emitProgress(result, {
      clusterBatchCompleted: 1,
      clusterBatchTotal: 1,
      subphase: "batch",
    });
  } else {
    const batches = chunkCatalog(catalog);
    clusterBatchTotal = batches.length;
    const parts: SitemapOptimizerClusterResult[] = [];
    for (let i = 0; i < batches.length; i += 1) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const batch = batches[i]!;
      const part = await clusterOneBatch(batch, apiKey, model, system, task, signal, memberLimits);
      parts.push(part);
      urlsProcessed += batch.length;
      const mergedSoFar = mergeClusterResults(parts);
      emitProgress(mergedSoFar, {
        clusterBatchCompleted: i + 1,
        clusterBatchTotal: batches.length,
        subphase: "batch",
      });
    }
    const merged = mergeClusterResults(parts);
    if (options?.runMode === "grid_csv") {
      result = merged;
    } else if (merged.clusters.length <= RECONCILE_SKIP_MAX_CLUSTERS) {
      result = merged;
    } else {
      emitProgress(merged, { subphase: "reconcile" });
      result = await reconcileBatchClusters(merged, apiKey, model, system, signal);
    }
  }

  result = ensureAllPostIdsInClusterResult(allPostIds, result);

  if (options?.runMode === "grid_csv") {
    emitProgress(result, { subphase: "finalize" });
    return result;
  }

  emitProgress(result, {
    clusterBatchCompleted: clusterBatchTotal,
    clusterBatchTotal,
    subphase: "validate",
  });
  const validated = await runSitemapOptimizerClusterValidateAgent(result, rows, apiKey, signal);
  emitProgress(validated, {
    clusterBatchCompleted: clusterBatchTotal,
    clusterBatchTotal,
    subphase: "tighten",
  });
  const tightened = await runSitemapOptimizerClusterTightenAgent(validated, rows, apiKey, signal);
  const geoSafe = enforceSeparateGeoClusters(tightened, catalog);
  const finalResult = resolveClusterOverlap(geoSafe);
  const covered = ensureAllPostIdsInClusterResult(allPostIds, finalResult);

  emitProgress(covered, {
    clusterBatchCompleted: clusterBatchTotal,
    clusterBatchTotal,
    subphase: "finalize",
  });

  return covered;
}

/** Cluster a catalog subset only (grid: within one tag bucket). */
export async function runClusterAgentForCatalogSubset(
  catalog: SitemapOptimizerCatalogEntry[],
  apiKey: string,
  gridMaxUrlsPerPost: GridMaxUrlsPerPost,
  signal?: AbortSignal,
  task = "cluster_within_tag",
): Promise<SitemapOptimizerClusterResult> {
  const model = getResearchModel();
  const system = clusterSystemForGrid(gridMaxUrlsPerPost);
  const limits = {
    minMembersPerCluster: 1,
    maxMembersPerCluster: gridMaxUrlsPerPost,
    preferredMaxPerCluster: gridMaxUrlsPerPost,
  };
  const result = await clusterOneBatch(catalog, apiKey, model, system, task, signal, limits);
  const allowed = catalog.map((c) => c.postId);
  return ensureAllPostIdsInClusterResult(allowed, result);
}
