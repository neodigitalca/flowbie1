import { useCallback, useRef, useEffect, useState } from "react";
import { type WordPressSite } from "@/components/integrations/types";
import { useOptimizationState, type PendingOptimization, type BulkOptimizationState } from "./content-optimization/use-optimization-state";
import { handleOptimizeContent as handleOptimizeContentModule } from "./content-optimization/handle-optimize-content";
import { continueOptimizationWithKeyword as continueOptimizationWithKeywordModule, type ContinueOptimizationFn } from "./content-optimization/continue-optimization";
import {
  handleOptimizeMultipleContent as handleOptimizeMultipleContentModule,
} from "./content-optimization/bulk-optimization";
import { clearOptimization as clearOptimizationHelper } from "./content-optimization/optimization-helpers";
import type { OptimizationFileManager } from "@/lib/optimization-file-manager";
import type { GscPerformancePreviewByUrl } from "./content-optimization/gsc-preview-types";

// Re-export types for backward compatibility
export type { 
  PendingOptimization, 
  BulkOptimizationState,
} from "./content-optimization/use-optimization-state";

export type { GscPerformancePreviewSnapshot, GscPerformancePreviewByUrl } from "./content-optimization/gsc-preview-types";

export function useContentOptimization() {
  // Use state management hook
  const {
    isOptimizingContent,
    setIsOptimizingContent,
    optimizationProgress,
    setOptimizationProgress,
    optimizationFileManagers,
    setOptimizationFileManagers,
    pendingOptimization,
    setPendingOptimization,
    bulkOptimizationState,
    setBulkOptimizationState,
  } = useOptimizationState();

  const [gscPerformancePreview, setGscPerformancePreview] = useState<
    Record<string, GscPerformancePreviewByUrl>
  >({});

  const continueOptimizationRef = useRef<ContinueOptimizationFn | null>(null);

  // Wrapper for handleOptimizeContent - converts direct parameters to params object
  const handleOptimizeContent = useCallback(async (
    site: WordPressSite, 
    url: string, 
    updateMode: 'update' | 'draft',
    setGscQueriesForSelection: (prev: any) => any,
    setIsKeywordSelectionOpen: (prev: any) => any,
    setGscClusterAnalysis: (prev: any) => any,
    setIsAnalyzingClusters: (prev: any) => any,
    skipOnNoGSC: boolean = false,
    optimizationOptions?: {
      optimizeTitle?: boolean;
      optimizeMeta?: boolean;
      optimizeExcerpt?: boolean;
      optimizeContent?: boolean;
      optimizeFeaturedImage?: boolean;
      featuredImageType?: 'ai-generated' | 'google-maps';
      autoOptimize?: boolean;
      testMode?: boolean;
      hasEntity?: boolean;
      stagingSite?: boolean;
      useAcfKeyword?: boolean;
      manualKeyword?: string;
    },
    inContentImageRequest?: { imageType: string; userPrompt?: string },
    resolvedPost?: {
      id: number;
      subtype: string;
      link?: string;
      slug?: string;
      endpoint?: string;
      title?: string;
      content?: string;
      excerpt?: string;
      focusKeyword?: string;
    },
    testMode: boolean = false,
    semTaskContext?: { suggestedAction: string; checklist?: string[]; promptModifier?: string; focusCategories?: string[] }
  ) => {
    return await handleOptimizeContentModule({
      site,
      url,
      updateMode,
      setGscQueriesForSelection,
      setIsKeywordSelectionOpen,
      setGscClusterAnalysis,
      setIsAnalyzingClusters,
      skipOnNoGSC,
      optimizationOptions,
      inContentImageRequest,
      resolvedPost,
      testMode,
      semTaskContext,
      setIsOptimizingContent,
      setOptimizationProgress,
      setOptimizationFileManagers,
      setPendingOptimization,
      optimizationFileManagers,
      continueOptimizationRef,
      setGscPerformancePreview,
    });
  }, [setIsOptimizingContent, setOptimizationProgress, setOptimizationFileManagers, setPendingOptimization, optimizationFileManagers]);

  // Wrapper for continueOptimizationWithKeyword - converts direct parameters to params object
  const continueOptimizationWithKeyword = useCallback<ContinueOptimizationFn>(async (
    siteId: string, 
    selectedKeyword: { query: string; clicks: number; impressions: number; ctr: number; position: number },
    clusterKeywords?: string[],
    setIsKeywordSelectionOpen?: (prev: any) => any,
    testMode: boolean = false,
    secondaryKeywords?: string[],
    pendingOverride?: PendingOptimization,
  ) => {
    await continueOptimizationWithKeywordModule({
      siteId,
      selectedKeyword,
      clusterKeywords,
      setIsKeywordSelectionOpen,
      testMode,
      secondaryKeywords,
      pendingOverride,
      pendingOptimization,
      optimizationFileManagers,
      setPendingOptimization,
      setOptimizationFileManagers,
      setOptimizationProgress,
      setIsOptimizingContent,
      setBulkOptimizationState,
    });
  }, [pendingOptimization, optimizationFileManagers, setPendingOptimization, setOptimizationFileManagers, setOptimizationProgress, setIsOptimizingContent, setBulkOptimizationState]);

  // Store continueOptimizationWithKeyword in ref for access from handleOptimizeContent
  useEffect(() => {
    continueOptimizationRef.current = continueOptimizationWithKeyword;
  }, [continueOptimizationWithKeyword]);

  // Wrapper for clearOptimization - uses helper function
  const clearOptimization = useCallback((siteId: string) => {
    clearOptimizationHelper(
      setIsOptimizingContent,
      setOptimizationProgress,
      setPendingOptimization,
      siteId
    );
    setGscPerformancePreview((prev) => {
      const next = { ...prev };
      delete next[siteId];
      return next;
    });
  }, [setIsOptimizingContent, setOptimizationProgress, setPendingOptimization]);

  // Wrapper for handleOptimizeMultipleContent - converts direct parameters to params object
  const handleOptimizeMultipleContent = useCallback(async (
    site: WordPressSite,
    urls: string[],
    updateMode: 'update' | 'draft',
    setGscQueriesForSelection: (prev: any) => any,
    setIsKeywordSelectionOpen: (prev: any) => any,
    setGscClusterAnalysis: (prev: any) => any,
    setIsAnalyzingClusters: (prev: any) => any,
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
      manualKeyword?: string;
      seoExtraTextFieldOnly?: boolean;
    },
    inContentImageRequest?: { imageType: string; userPrompt?: string },
    prefilledUrlKeywords?: Record<string, string>,
    prefilledOverviewTargets?: Record<string, import("@/hooks/content-optimization/bulk-optimization-params").PrefilledOverviewTarget>,
  ) => {
    await handleOptimizeMultipleContentModule({
      site,
      urls,
      updateMode,
      setGscQueriesForSelection,
      setIsKeywordSelectionOpen,
      setGscClusterAnalysis,
      setIsAnalyzingClusters,
      optimizationOptions,
      inContentImageRequest,
      setIsOptimizingContent,
      setOptimizationProgress,
      setBulkOptimizationState,
      optimizationFileManagers,
      continueOptimizationRef,
      prefilledUrlKeywords,
      prefilledOverviewTargets,
    });
  }, [setIsOptimizingContent, setOptimizationProgress, setBulkOptimizationState, optimizationFileManagers]);

  const resetBulkBatch = useCallback(
    (batchKey: string) => {
      setBulkOptimizationState((prev) => {
        const next = { ...prev };
        delete next[batchKey];
        return next;
      });
      setOptimizationProgress((prev) => {
        const next = { ...prev };
        delete next[batchKey];
        return next;
      });
      setIsOptimizingContent((prev) => {
        const next = { ...prev };
        delete next[batchKey];
        return next;
      });
    },
    [setBulkOptimizationState, setOptimizationProgress, setIsOptimizingContent],
  );

  return {
    isOptimizingContent,
    optimizationProgress,
    optimizationFileManagers,
    pendingOptimization,
    bulkOptimizationState,
    setBulkOptimizationState,
    setOptimizationProgress,
    setIsOptimizingContent,
    resetBulkBatch,
    gscPerformancePreview,
    setGscPerformancePreview,
    handleOptimizeContent,
    handleOptimizeMultipleContent,
    continueOptimizationWithKeyword,
    setOptimizationFileManagers,
    clearOptimization,
    continueOptimizationRef,
  };
}
