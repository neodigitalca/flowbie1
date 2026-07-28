import type { BlogDestinationPolicy } from "@/lib/sitemap-optimizer/blog-destination-policy";
import type { EntityCompressionProfile } from "@/lib/sitemap-optimizer/entity-compression-profile";
import { entityStateFromRedirectPlan } from "@/lib/sitemap-optimizer/build-entity-state-from-redirect-plan";
import { runEntityCompressFamiliesAgent } from "@/lib/sitemap-optimizer/entity-compress-families-agent";
import { runEntityTransformFamiliesAgent } from "@/lib/sitemap-optimizer/entity-transform-families-agent";
import { runGscPerformanceTriage } from "@/lib/sitemap-optimizer/gsc-performance-triage-agent";
import { buildContentSheetRows } from "@/lib/sitemap-optimizer/build-content-sheet-rows";
import {
  markImmatureRowsAsKeep,
  partitionRowsByContentMaturity,
} from "@/lib/sitemap-optimizer/content-maturity-gate";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerContentSheetRow,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

export type EntityCompressionPipelineResult = {
  clusters: SitemapOptimizerClusterResult;
  merges: SitemapOptimizerMergeRecommendation[];
  contentSheet: SitemapOptimizerContentSheetRow[];
  rows: SitemapOptimizerPostRow[];
};

export async function runEntityCompressionPipeline(args: {
  entityRows: SitemapOptimizerPostRow[];
  profile: EntityCompressionProfile;
  apiKey: string;
  siteName?: string;
  blogDestination: BlogDestinationPolicy;
  analyzedAt: string;
  signal?: AbortSignal;
  onTriageProgress?: (completed: number, total: number) => void;
  onClusterProgress?: (progress: {
    urlsProcessed: number;
    clustersCreated: number;
    subphase?: string;
    clusterBatchCompleted?: number;
    clusterBatchTotal?: number;
  }) => void;
  onMergeProgress?: (completed: number, total: number) => void;
}): Promise<EntityCompressionPipelineResult> {
  const empty: EntityCompressionPipelineResult = {
    clusters: { clusters: [], singletons: [] },
    merges: [],
    contentSheet: [],
    rows: [],
  };

  try {
    return await runEntityCompressionPipelineInner(args);
  } catch {
    return empty;
  }
}

async function runEntityCompressionPipelineInner(args: {
  entityRows: SitemapOptimizerPostRow[];
  profile: EntityCompressionProfile;
  apiKey: string;
  siteName?: string;
  blogDestination: BlogDestinationPolicy;
  analyzedAt: string;
  signal?: AbortSignal;
  onTriageProgress?: (completed: number, total: number) => void;
  onClusterProgress?: (progress: {
    urlsProcessed: number;
    clustersCreated: number;
    subphase?: string;
    clusterBatchCompleted?: number;
    clusterBatchTotal?: number;
  }) => void;
  onMergeProgress?: (completed: number, total: number) => void;
}): Promise<EntityCompressionPipelineResult> {
  const {
    entityRows,
    apiKey,
    blogDestination,
    analyzedAt,
    signal,
    onTriageProgress,
    onClusterProgress,
    onMergeProgress,
  } = args;

  if (!entityRows.length) {
    return {
      clusters: { clusters: [], singletons: [] },
      merges: [],
      contentSheet: [],
      rows: [],
    };
  }

  // Stage 1 — Keep: known immature dates stay; unknown + mature go to GSC triage.
  const { mature, immature } = partitionRowsByContentMaturity(entityRows, analyzedAt);
  const immatureKept = markImmatureRowsAsKeep(immature);

  const triage = await runGscPerformanceTriage(mature, apiKey, {
    signal,
    onProgress: onTriageProgress,
    entityMode: true,
    analyzedAt,
  });

  const allRows = [...immatureKept, ...triage.rows];
  const rowMap = new Map(allRows.map((r) => [r.postId, r]));

  let pipelineClusters: SitemapOptimizerClusterResult = { clusters: [], singletons: [] };
  let merges: SitemapOptimizerMergeRecommendation[] = [];
  let mergeSheet: SitemapOptimizerContentSheetRow[] = [];

  if (triage.consolidateRows.length > 0) {
    // Stage 2 — Compress: families only, full coverage, no duplicate destinations.
    const compressPlan = await runEntityCompressFamiliesAgent(triage.consolidateRows, apiKey, {
      signal,
      onProgress: (completed, total) => {
        onClusterProgress?.({
          urlsProcessed: completed,
          clustersCreated: Math.ceil(completed / 5),
          subphase: "compress",
          clusterBatchCompleted: completed,
          clusterBatchTotal: total,
        });
      },
    });

    // Stage 3 — Transform: titles/meta/SAP; never drops families.
    const redirectPlan = await runEntityTransformFamiliesAgent(
      compressPlan,
      triage.consolidateRows,
      apiKey,
      {
        signal,
        onProgress: (completed, total) => {
          onMergeProgress?.(completed, total);
        },
      },
    );

    const redirectState = entityStateFromRedirectPlan(redirectPlan, rowMap);
    pipelineClusters = redirectState.clusters;
    merges = redirectState.merges;

    mergeSheet = buildContentSheetRows({
      rows: triage.consolidateRows,
      clusters: pipelineClusters,
      merges,
      standaloneProposals: [],
      blogDestination,
      minClusterMembers: 1,
      entityMode: true,
    });
  }

  return {
    clusters: pipelineClusters,
    merges,
    contentSheet: mergeSheet,
    rows: allRows,
  };
}
