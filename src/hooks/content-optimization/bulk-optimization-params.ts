import type React from "react";
import type { WordPressSite } from "@/components/integrations/types";
import type { OptimizationFileManager } from "@/lib/optimization-file-manager";

export type PrefilledOverviewTarget = {
  postId: number;
  postType?: string;
  postTypeEndpoint?: string;
  keyword?: string;
  content?: string;
  /** Cached Overview grid / ACF seo_research — never re-fetch SERP when set. */
  seoResearch?: string;
};

export interface HandleOptimizeMultipleContentParams {
  site: WordPressSite;
  urls: string[];
  wordPressPosts?: Array<{
    id: number;
    slug: string;
    title: string;
    excerpt: string;
    link: string;
    date_gmt: string;
  }>;
  updateMode: "update" | "draft";
  setGscQueriesForSelection: (prev: any) => any;
  setIsKeywordSelectionOpen: (prev: any) => any;
  setGscClusterAnalysis: (prev: any) => any;
  setIsAnalyzingClusters: (prev: any) => any;
  optimizationOptions?: {
    optimizeTitle?: boolean;
    optimizeMeta?: boolean;
    optimizeExcerpt?: boolean;
    optimizeContent?: boolean;
    optimizeFeaturedImage?: boolean;
    optimizeExtraText?: boolean;
    optimizeExtraImage?: boolean;
    hasEntity?: boolean;
    stagingSite?: boolean;
    useAcfKeyword?: boolean;
    bulkFaqMinimum4?: boolean;
    contentOnlyUpload?: boolean;
    seoExtraTextFieldOnly?: boolean;
    /** Overview sitemap bucket that loaded inventory (posts | pages | sap). */
    inventorySitemapSource?: "posts" | "pages" | "sap";
    /** Multi-site Both: download entity sitemap CSV in batch prep without SAP optimization mode. */
    prepEntitySitemap?: boolean;
  };
  inContentImageRequest?: { imageType: string; userPrompt?: string };
  setIsOptimizingContent: (prev: any) => any;
  setOptimizationProgress: (prev: any) => any;
  setBulkOptimizationState: (prev: any) => any;
  optimizationFileManagers: Record<string, OptimizationFileManager>;
  continueOptimizationRef: React.MutableRefObject<
    | ((
        siteId: string,
        selectedKeyword: any,
        clusterKeywords?: string[],
        setIsKeywordSelectionOpen?: (prev: any) => any,
        testMode?: boolean
      ) => Promise<void>)
    | null
  >;
  muteToasts?: boolean;
  /** Overview / grid: focus keywords already known; skip redundant ACF grep when inventory matches. */
  prefilledUrlKeywords?: Record<string, string>;
  /** Overview grid: post IDs and types already hydrated; skip bind-style prep when complete. */
  prefilledOverviewTargets?: Record<string, PrefilledOverviewTarget>;
  /** Agent runs: skip URLs already optimized and uploaded before refresh. */
  resumeCompletedUrls?: string[];
  /** Agent runs: inventory snapshot loaded during task URL resolution. */
  prefetchedBulkInventorySnapshot?: import("@/lib/wordpress-api/inventory-match").BulkOptimizerInventorySnapshot;
  /** Agent runs: skip live prep refetch; require warm site cache + prefetched snapshot. */
  useSiteWarmCacheOnly?: boolean;
  /** Agent runs: called after each URL completes optimization + WordPress upload. */
  onBulkUrlComplete?: (info: {
    url: string;
    index: number;
    total: number;
    uploaded: boolean;
  }) => void | Promise<void>;
  /** Agent runs: isolated bulk state key (defaults to `${site.id}-batch`). */
  batchKey?: string;
}
