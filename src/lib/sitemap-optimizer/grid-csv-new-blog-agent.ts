import {
  runGridBlogBriefByTopicAgent,
  type GridBlogBriefSectionProgress,
} from "@/lib/sitemap-optimizer/grid-blog-brief-by-topic-agent";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import type { BlogDestinationPolicy } from "@/lib/sitemap-optimizer/blog-destination-policy";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

export {
  planGridBlogBriefSections,
  planGridBlogBriefTopics,
} from "@/lib/sitemap-optimizer/grid-blog-brief-by-topic-agent";

/** Macro grid: one brief per cluster only (K clusters, not per URL). */
export function gridBlogBriefTargets(clusterResult: SitemapOptimizerClusterResult): SitemapOptimizerCluster[] {
  return clusterResult.clusters;
}

/** Briefs batched by topic tag section (one OpenRouter pass per section). */
export async function runGridNewBlogBriefAgent(
  clusterResult: SitemapOptimizerClusterResult,
  rows: SitemapOptimizerPostRow[],
  apiKey: string,
  signal?: AbortSignal,
  onProgress?: (completed: number, total: number) => void,
  onSectionProgress?: (p: GridBlogBriefSectionProgress) => void,
  gridMaxUrlsPerPost?: GridMaxUrlsPerPost,
  blogDestination?: BlogDestinationPolicy,
): Promise<SitemapOptimizerMergeRecommendation[]> {
  return runGridBlogBriefByTopicAgent(
    clusterResult,
    rows,
    apiKey,
    signal,
    (p) => {
      onSectionProgress?.(p);
      onProgress?.(p.blogsCompleted, p.blogsTotal);
    },
    gridMaxUrlsPerPost,
    blogDestination,
  );
}
