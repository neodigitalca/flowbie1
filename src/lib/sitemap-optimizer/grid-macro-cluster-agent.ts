import { packGridClustersIfOverTarget } from "@/lib/sitemap-optimizer/grid-compression-pack";
import {
  effectiveGridCompression,
  shouldClusterRedirectMapBySharedNewUrl,
  shouldUsePrefilledGridGroups,
  targetGridParentTagCount,
  type GridCompressionLevel,
} from "@/lib/sitemap-optimizer/grid-compression-policy";
import { runGridClusterByTag } from "@/lib/sitemap-optimizer/grid-cluster-by-tag";
import { finalizeGridClusterResult } from "@/lib/sitemap-optimizer/grid-finalize-clusters";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import { repackGridClustersByCompression } from "@/lib/sitemap-optimizer/grid-repack-clusters-by-compression";
import {
  clusterRedirectMapForFamilies,
  clusterRedirectMapForOneToOne,
  rowsHavePrefilledGridTags,
  tryClusterByPrefilledGridGroup,
  tryClusterBySharedNewUrl,
} from "@/lib/sitemap-optimizer/grid-prefilled-group-cluster";
import { runGridTemporalCannibalizationAgent } from "@/lib/sitemap-optimizer/grid-temporal-cannibalization";
import {
  collapseGridTopicTags,
  distinctTopicTagsFromRows,
} from "@/lib/sitemap-optimizer/grid-tag-collapse-agent";
import { applyCompanyNewsTags } from "@/lib/sitemap-optimizer/grid-company-news";
import { runGridUrlTagAgent } from "@/lib/sitemap-optimizer/grid-url-tag-agent";
import type {
  SitemapOptimizerClusterResult,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

export type GridMacroClusterProgress = {
  urlsProcessed: number;
  clustersCreated: number;
  tagsCompleted?: number;
  tagsTotal?: number;
  tagBucketsCompleted?: number;
  tagBucketsTotal?: number;
  /** Shown under Tag URLs while tagging / collapse runs. */
  taggingDetail?: string;
};

function finishGridClusterRun(args: {
  clusters: SitemapOptimizerClusterResult;
  rows: SitemapOptimizerPostRow[];
  maxUrlsPerPost: GridMaxUrlsPerPost;
  onProgress?: (p: GridMacroClusterProgress) => void;
}): { clusters: SitemapOptimizerClusterResult; rows: SitemapOptimizerPostRow[] } {
  const { rows, maxUrlsPerPost, onProgress } = args;
  const finalized = finalizeGridClusterResult(args.clusters, rows, maxUrlsPerPost);
  onProgress?.({
    urlsProcessed: rows.length,
    clustersCreated: finalized.clusters.length,
    tagsCompleted: rows.length,
    tagsTotal: rows.length,
  });
  return { clusters: finalized, rows };
}

function isRedirectMapRows(rows: readonly SitemapOptimizerPostRow[]): boolean {
  return rows.length > 0 && rows.every((r) => Boolean(r.gridRedirectFromUrl?.trim()));
}

/**
 * Tag every URL, then cluster only within matching tag buckets (max N URLs per cluster).
 */
export async function runGridMaxSizeClusterAgent(
  rows: SitemapOptimizerPostRow[],
  maxUrlsPerPost: GridMaxUrlsPerPost,
  apiKey: string,
  signal?: AbortSignal,
  onProgress?: (p: GridMacroClusterProgress) => void,
  compression: GridCompressionLevel = "none",
): Promise<{ clusters: SitemapOptimizerClusterResult; rows: SitemapOptimizerPostRow[] }> {
  compression = effectiveGridCompression(maxUrlsPerPost, compression);
  rows = applyCompanyNewsTags(rows);
  onProgress?.({
    urlsProcessed: 0,
    clustersCreated: 0,
    tagsCompleted: 0,
    tagsTotal: rows.length,
    taggingDetail: "Starting URL tagging…",
  });

  if (maxUrlsPerPost === 1 && isRedirectMapRows(rows)) {
    onProgress?.({
      urlsProcessed: 0,
      clustersCreated: 0,
      tagsCompleted: 0,
      tagsTotal: rows.length,
      taggingDetail: "Detecting time-sliced URL series (Gemini)…",
    });
    const temporalExempt = await runGridTemporalCannibalizationAgent(rows, apiKey, signal);
    const packed = clusterRedirectMapForFamilies(rows, maxUrlsPerPost, temporalExempt);
    onProgress?.({
      urlsProcessed: packed.rows.length,
      clustersCreated: packed.clusters.clusters.length,
      tagsCompleted: packed.rows.length,
      tagsTotal: packed.rows.length,
      taggingDetail: `${packed.clusters.clusters.length} redirect families (1:1 + temporal merge)`,
    });
    return finishGridClusterRun({
      clusters: packed.clusters,
      rows: packed.rows,
      maxUrlsPerPost,
      onProgress,
    });
  }

  if (maxUrlsPerPost === 1) {
    const { clusters: redirectClusters, rows: clusteredRows } = clusterRedirectMapForOneToOne(rows);
    const destinationCount = redirectClusters.clusters.length;
    const grouped =
      destinationCount < clusteredRows.length
        ? `Grouped ${clusteredRows.length} redirects → ${destinationCount} content plan(s) (deduped destinations & cannibal families)`
        : "1:1 · one plan per old → new pair";
    onProgress?.({
      urlsProcessed: clusteredRows.length,
      clustersCreated: destinationCount,
      tagsCompleted: clusteredRows.length,
      tagsTotal: clusteredRows.length,
      taggingDetail: `Skipped AI tagging · ${grouped}`,
    });
    return finishGridClusterRun({
      clusters: redirectClusters,
      rows: clusteredRows,
      maxUrlsPerPost,
      onProgress,
    });
  }

  const useCompressionClustering = compression !== "none";
  const prefilledTags = rowsHavePrefilledGridTags(rows);

  let taggedRows = prefilledTags
    ? rows
    : await runGridUrlTagAgent(
        rows,
        apiKey,
        signal,
        (tagProgress) => {
          onProgress?.({
            urlsProcessed: tagProgress.tagsCompleted,
            clustersCreated: 0,
            tagsCompleted: tagProgress.tagsCompleted,
            tagsTotal: tagProgress.tagsTotal,
            taggingDetail: `Tagging URLs ${tagProgress.tagsCompleted} / ${tagProgress.tagsTotal}`,
          });
        },
        compression,
      );

  const distinctBeforeCollapse = distinctTopicTagsFromRows(taggedRows).length;
  const parentTagTarget = targetGridParentTagCount(compression, rows.length, maxUrlsPerPost);
  const needsTagCollapse =
    useCompressionClustering && distinctBeforeCollapse > parentTagTarget;

  if (!prefilledTags) {
    onProgress?.({
      urlsProcessed: rows.length,
      clustersCreated: 0,
      tagsCompleted: rows.length,
      tagsTotal: rows.length,
      taggingDetail: "Collapsing topic tags (AI)…",
    });
    taggedRows = await collapseGridTopicTags(
      taggedRows,
      apiKey,
      signal,
      compression,
      maxUrlsPerPost,
    );
  } else if (needsTagCollapse) {
    onProgress?.({
      urlsProcessed: rows.length,
      clustersCreated: 0,
      tagsCompleted: rows.length,
      tagsTotal: rows.length,
      taggingDetail: `Broadening ${distinctBeforeCollapse} CSV topic tags (AI)…`,
    });
    taggedRows = await collapseGridTopicTags(
      taggedRows,
      apiKey,
      signal,
      compression,
      maxUrlsPerPost,
    );
  } else {
    onProgress?.({
      urlsProcessed: rows.length,
      clustersCreated: 0,
      tagsCompleted: rows.length,
      tagsTotal: rows.length,
      taggingDetail: prefilledTags
        ? "Topic tags from CSV — already broad enough"
        : undefined,
    });
  }

  const prefilledClusters = shouldUsePrefilledGridGroups(compression)
    ? tryClusterByPrefilledGridGroup(taggedRows)
    : null;
  if (prefilledClusters) {
    return finishGridClusterRun({
      clusters: prefilledClusters,
      rows: taggedRows,
      maxUrlsPerPost,
      onProgress,
    });
  }

  if (
    !useCompressionClustering &&
    shouldClusterRedirectMapBySharedNewUrl(compression, maxUrlsPerPost) &&
    isRedirectMapRows(taggedRows)
  ) {
    onProgress?.({
      urlsProcessed: taggedRows.length,
      clustersCreated: 0,
      tagsCompleted: taggedRows.length,
      tagsTotal: taggedRows.length,
      taggingDetail: "Detecting time-sliced URL series (Gemini)…",
    });
    const temporalExempt = await runGridTemporalCannibalizationAgent(taggedRows, apiKey, signal);
    const packed = clusterRedirectMapForFamilies(taggedRows, maxUrlsPerPost, temporalExempt);
    return finishGridClusterRun({
      clusters: packed.clusters,
      rows: packed.rows,
      maxUrlsPerPost,
      onProgress,
    });
  }

  if (
    !useCompressionClustering &&
    shouldClusterRedirectMapBySharedNewUrl(compression, maxUrlsPerPost)
  ) {
    const sharedDestClusters = tryClusterBySharedNewUrl(taggedRows);
    if (sharedDestClusters) {
      return finishGridClusterRun({
        clusters: sharedDestClusters,
        rows: taggedRows,
        maxUrlsPerPost,
        onProgress,
      });
    }
  }

  let clusters: SitemapOptimizerClusterResult;
  if (useCompressionClustering) {
    clusters = repackGridClustersByCompression(taggedRows, maxUrlsPerPost, compression);
    clusters = packGridClustersIfOverTarget(
      clusters,
      taggedRows,
      maxUrlsPerPost,
      compression,
    );
    onProgress?.({
      urlsProcessed: taggedRows.length,
      clustersCreated: clusters.clusters.length,
      tagsCompleted: taggedRows.length,
      tagsTotal: taggedRows.length,
      tagBucketsCompleted: clusters.clusters.length,
      tagBucketsTotal: clusters.clusters.length,
    });
  } else {
    clusters = await runGridClusterByTag(
      taggedRows,
      maxUrlsPerPost,
      apiKey,
      signal,
      (clusterProgress) => {
        onProgress?.({
          urlsProcessed: taggedRows.length,
          clustersCreated: clusterProgress.clustersCreated,
          tagsCompleted: taggedRows.length,
          tagsTotal: taggedRows.length,
          tagBucketsCompleted: clusterProgress.tagBucketsCompleted,
          tagBucketsTotal: clusterProgress.tagBucketsTotal,
        });
      },
    );
  }

  return finishGridClusterRun({
    clusters,
    rows: taggedRows,
    maxUrlsPerPost,
    onProgress,
  });
}

/** @deprecated Use runGridMaxSizeClusterAgent */
export const runGridMacroClusterAgent = runGridMaxSizeClusterAgent;
