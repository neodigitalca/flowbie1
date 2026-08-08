import { notify, notifyHeaderError } from "@/lib/app-notifications";
import { getMuteOptimizationToasts } from "./optimization-toast-mute";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { saveSelectedKeyword, updateOptimizationProgress } from "./optimization-helpers";
import type { PendingOptimization } from "./use-optimization-state";
import {
  extractAndCleanEntity,
  updateBulkStateWithEntity,
} from "./continue-optimization-entity-helpers";
import { runContinueOptimizationTryBody } from "./continue-optimization-try-body";
import { clearSiteCache } from "@/lib/wordpress-site-cache";
import { clearValidationCache } from "@/lib/cached-link-validation";
import { clearRelevanceCache } from "@/lib/content-generation/ai-link-relevance-filter";

export type ContinueOptimizationFn = (
  siteId: string,
  selectedKeyword: { query: string; clicks: number; impressions: number; ctr: number; position: number },
  clusterKeywords?: string[],
  setIsKeywordSelectionOpen?: (prev: any) => any,
  testMode?: boolean,
  secondaryKeywords?: string[],
  pendingOverride?: PendingOptimization,
) => Promise<void>;

interface ContinueOptimizationParams {
  siteId: string;
  selectedKeyword: { query: string; clicks: number; impressions: number; ctr: number; position: number };
  clusterKeywords?: string[];
  setIsKeywordSelectionOpen?: (prev: any) => any;
  testMode: boolean;
  secondaryKeywords?: string[];
  pendingOverride?: PendingOptimization;
  pendingOptimization: Record<string, PendingOptimization>;
  optimizationFileManagers: Record<string, OptimizationFileManager>;
  setPendingOptimization: (prev: any) => any;
  setOptimizationFileManagers: (prev: any) => any;
  setOptimizationProgress: (prev: any) => any;
  setIsOptimizingContent: (prev: any) => any;
  setBulkOptimizationState: (prev: any) => any;
}

export async function continueOptimizationWithKeyword(params: ContinueOptimizationParams): Promise<void> {
  const {
    siteId,
    selectedKeyword,
    clusterKeywords,
    setIsKeywordSelectionOpen,
    secondaryKeywords,
    pendingOverride,
    pendingOptimization,
    optimizationFileManagers,
    setPendingOptimization,
    setOptimizationFileManagers,
    setOptimizationProgress,
    setIsOptimizingContent,
    setBulkOptimizationState,
  } = params;

  if (!selectedKeyword?.query?.trim()) {
    throw new Error("Selected keyword is invalid.");
  }

  const pending = pendingOverride ?? pendingOptimization[siteId];
  if (!pending) {
    throw new Error("Optimization data not found. Please try again.");
  }

  const {
    site,
    url,
    updateMode,
    gscResult,
    existingPost,
    resolved,
    existingTitle,
    existingContent,
    existingExcerpt,
    optimizationOptions,
    inContentImageRequest,
    acfFields,
    acfContext,
    cleanedTitle: pendingCleanedTitle,
  } = pending;

  const primaryKeyword = String(acfFields?.keyword_focus ?? acfContext?.keywordFocus ?? selectedKeyword.query).trim();
  if (!primaryKeyword) {
    throw new Error(`ACF keyword_focus is required for ${url}.`);
  }

  const finalOptimizationOptions = {
    ...optimizationOptions,
    optimizeContent: true,
    optimizeTitle: false,
    optimizeMeta: true,
    optimizeExcerpt: false,
    optimizeExtraText: optimizationOptions?.optimizeExtraText !== false,
    useAcfKeyword: true,
  };

  const { entity: extractedEntity, cleanedTitle: entityCleanedTitle } = await extractAndCleanEntity(
    optimizationOptions?.hasEntity,
    existingTitle,
    url,
    primaryKeyword,
    pendingCleanedTitle,
    site,
    existingPost?.postTypeEndpoint ?? resolved?.endpoint ?? null,
  );

  const finalTitle = entityCleanedTitle || existingTitle || primaryKeyword;

  await updateBulkStateWithEntity(site, url, primaryKeyword, extractedEntity, finalTitle, setBulkOptimizationState);

  setPendingOptimization((prev: Record<string, PendingOptimization>) => {
    const p = prev[siteId];
    if (!p) return prev;
    return {
      ...prev,
      [siteId]: { ...p, cleanedTitle: finalTitle, extractedEntity },
    };
  });

  if (setIsKeywordSelectionOpen) {
    setIsKeywordSelectionOpen((prev: Record<string, boolean>) => ({ ...prev, [siteId]: false }));
  }

  const optimizationStartTime = Date.now();

  let fileManager = optimizationFileManagers[siteId];
  if (!fileManager) {
    fileManager = new OptimizationFileManager();
    setOptimizationFileManagers((prev: Record<string, OptimizationFileManager>) => ({ ...prev, [siteId]: fileManager }));
  }

  saveSelectedKeyword(fileManager, primaryKeyword, selectedKeyword);

  let runFailed = false;
  try {
    await runContinueOptimizationTryBody({
      siteId,
      site,
      url,
      updateMode,
      gscResult,
      existingPost,
      resolved,
      existingTitle,
      existingContent,
      existingExcerpt,
      selectedKeyword,
      clusterKeywords,
      secondaryKeywords,
      optimizationOptions,
      inContentImageRequest,
      acfFields,
      acfContext,
      pending,
      pendingCleanedTitle,
      primaryKeyword,
      finalOptimizationOptions,
      extractedEntity,
      finalTitle,
      optimizationStartTime,
      fileManager,
      optimizationFileManagers,
      setOptimizationFileManagers,
      setOptimizationProgress,
      setPendingOptimization,
      setBulkOptimizationState,
    });
  } catch (error) {
    runFailed = true;
    const errorMessage = error instanceof Error ? error.message : "Failed to optimize content";
    if (!getMuteOptimizationToasts()) notifyHeaderError("Optimization failed", errorMessage);
    setPendingOptimization((prev: Record<string, PendingOptimization>) => {
      const updated = { ...prev };
      delete updated[siteId];
      return updated;
    });
    setOptimizationProgress((prev: Record<string, unknown>) => {
      const prevEntry = (prev[siteId] || {}) as Record<string, unknown>;
      return {
        ...prev,
        [siteId]: {
          ...prevEntry,
          error: errorMessage,
          message: errorMessage,
        },
      };
    });
    throw error;
  } finally {
    const batchKey = `${siteId}-batch`;
    let bulkBusy = false;
    setIsOptimizingContent((prev: Record<string, boolean>) => {
      bulkBusy = Boolean(prev[batchKey]);
      const updated = { ...prev };
      if (!bulkBusy) delete updated[siteId];
      return updated;
    });

    if (!bulkBusy && !runFailed) {
      clearSiteCache(siteId);
      clearValidationCache(siteId);
      clearRelevanceCache(siteId);
    }
  }
}
