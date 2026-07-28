import { notify, notifyHeaderError } from "@/lib/app-notifications";
import { getMuteOptimizationToasts } from "./optimization-toast-mute";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import {
  saveSelectedKeyword,
} from "./optimization-helpers";
import type { PendingOptimization } from "./use-optimization-state";
import { effectiveHasEntityForContentOptimizer } from "@/lib/entity-endpoint-extractor";
import {
  extractAndCleanEntity,
  updateBulkStateWithEntity,
} from "./continue-optimization-entity-helpers";
import { runContinueOptimizationTryBody } from "./continue-optimization-try-body";

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
  /** When set, used instead of pendingOptimization[siteId] (avoids stale React state after setPending). */
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
  } = params;

  if (!selectedKeyword || typeof selectedKeyword !== 'object') {
    throw new Error('Invalid keyword selected. Please try again.');
  }

  if (!selectedKeyword.query || typeof selectedKeyword.query !== 'string' || selectedKeyword.query.trim().length === 0) {
    throw new Error('Selected keyword is invalid. Please select a valid keyword.');
  }

  const pending = pendingOverride ?? pendingOptimization[siteId];
  if (!pending) {
    throw new Error('Optimization data not found. Please try again.');
  }

  const { site, url, urlDerivedIntent: pendingUrlIntent, updateMode, gscResult, existingPost, resolved, existingTitle, existingContent, existingExcerpt, optimizationOptions, inContentImageRequest, acfFields, acfContext, cleanedTitle: pendingCleanedTitle, focusCategories: pendingFocus, semTaskContext } = pending;

  /** Non-empty ACF `seo_research` - sole external research for Content Optimizer (no live GSC/DFS/Semrush). */
  const useSeoResearchBrief = !!(acfContext?.seoResearch && String(acfContext.seoResearch).trim());
  // Use focus from task when top-level focus wasn't set (avoids race and ensures checklist drives options)
  const focusCategories = (pendingFocus && pendingFocus.length > 0)
    ? pendingFocus
    : (semTaskContext?.focusCategories ?? []);

  const postTypeEndpoint = existingPost?.postTypeEndpoint ?? resolved?.endpoint ?? null;
  const effectiveEntityMode = effectiveHasEntityForContentOptimizer(
    site,
    postTypeEndpoint,
    optimizationOptions?.hasEntity,
  );

  // Determine what to optimize based on focus categories (SEM task list)
  const isSemTask = !!semTaskContext;
  const isPageSubtype = resolved?.subtype === 'page';
  if (isPageSubtype) {
    console.log('[Continue Optimization] Page sitemap detected - title optimization disabled');
  }
  // Hardcode: never optimize title/meta/excerpt.
  // Content-only optimization keeps WordPress title + SEO meta untouched.
  const shouldOptimizeTitle = false;
  const shouldOptimizeMeta = false;
  const shouldOptimizeContent = !isSemTask || !focusCategories.length || focusCategories.some(cat =>
    cat.includes('Content') || cat.includes('keyword optimization')
  );
  const shouldOptimizeSchema = !isSemTask || !focusCategories.length || focusCategories.some(cat =>
    cat.includes('Schema') || cat.includes('FAQ')
  );
  const shouldOptimizeLinks = !isSemTask || !focusCategories.length || focusCategories.some(cat =>
    cat.includes('link') || cat.includes('Broken')
  );

  const seoExtraTextFieldOnly = optimizationOptions?.seoExtraTextFieldOnly === true;

  // CRITICAL: Override optimizationOptions with calculated values from focus categories (or task checklist)
  // This ensures SEM task list checklist drives what gets fixed – no double list
  // Overview bulk SEO extra text: never force meta/content; only the extra ACF text field.
  const finalOptimizationOptions = seoExtraTextFieldOnly
    ? {
        ...optimizationOptions,
        optimizeTitle: false,
        optimizeMeta: false,
        optimizeExcerpt: false,
        optimizeContent: false,
        optimizeFeaturedImage: false,
        optimizeExtraText: true,
        optimizeExtraImage: false,
        hasEntity: false,
        contentOnlyUpload: true,
        useAcfKeyword: optimizationOptions?.useAcfKeyword !== false,
        manualKeyword: optimizationOptions?.manualKeyword ?? '',
        bulkFaqMinimum4: false,
        stagingSite: optimizationOptions?.stagingSite,
        seoExtraTextFieldOnly: true,
      }
    : isSemTask && focusCategories.length > 0
    ? {
        ...optimizationOptions,
        optimizeTitle: false,
        optimizeMeta: true,
        optimizeExcerpt: false,
        optimizeContent: shouldOptimizeContent,
        optimizeFeaturedImage: optimizationOptions?.optimizeFeaturedImage || false,
        contentOnlyUpload:
          optimizationOptions?.contentOnlyUpload === true || optimizationOptions?.useAcfKeyword === true,
      }
    : {
        ...optimizationOptions,
        optimizeTitle: false,
        optimizeMeta: true,
        optimizeExcerpt: false,
        contentOnlyUpload:
          optimizationOptions?.contentOnlyUpload === true || optimizationOptions?.useAcfKeyword === true,
        // preserve caller's optimizeContent/featured-image intent
      };

  // Skip full pipeline if only title/meta optimization needed
  const isTitleMetaOnly = isSemTask && focusCategories && focusCategories.length > 0 && 
    focusCategories.every(cat => cat.includes('Title') || cat.includes('meta description')) &&
    !shouldOptimizeContent && !shouldOptimizeSchema && !shouldOptimizeLinks;

  const manualKeywordOverride = (optimizationOptions?.manualKeyword ?? '').trim();
  const hasManualKeyword = manualKeywordOverride.length > 0;

  let primaryKeyword: string;
  let keywordSource: 'acfKeyword' | 'manual';

  if (hasManualKeyword) {
    primaryKeyword = manualKeywordOverride;
    keywordSource = 'manual';
  } else {
    const acfKw = String(acfFields?.keyword_focus ?? acfContext?.keywordFocus ?? '').trim();
    if (!acfKw) {
      throw new Error(`ACF keyword_focus is required for ${url}. Set it in WordPress before optimizing.`);
    }
    primaryKeyword = acfKw;
    keywordSource = 'acfKeyword';
  }

  const { entity: extractedEntity, cleanedTitle: entityCleanedTitle } = await extractAndCleanEntity(
    optimizationOptions?.hasEntity,
    existingTitle,
    url,
    primaryKeyword,
    pendingCleanedTitle,
    site,
    postTypeEndpoint,
  );

  let finalTitle = entityCleanedTitle || existingTitle || primaryKeyword;

  await updateBulkStateWithEntity(
    site,
    url,
    primaryKeyword,
    extractedEntity,
    finalTitle,
    setBulkOptimizationState,
  );

  // Update pending optimization (keyed by site id, same as gsc-processing / bulk)
  setPendingOptimization((prev: any) => {
    const pending = prev[siteId];
    if (pending) {
      return {
        ...prev,
        [siteId]: {
          ...pending,
          cleanedTitle: finalTitle,
          extractedEntity: extractedEntity
        }
      };
    }
    return prev;
  });

  if (setIsKeywordSelectionOpen) {
    setIsKeywordSelectionOpen((prev: any) => ({ ...prev, [siteId]: false }));
  }

  const optimizationStartTime = Date.now();

  let fileManager = optimizationFileManagers[siteId];
    if (!fileManager) {
    fileManager = new OptimizationFileManager();
    setOptimizationFileManagers((prev: any) => ({ ...prev, [siteId]: fileManager }));
  }

  if (!useSeoResearchBrief) {
    saveSelectedKeyword(fileManager, primaryKeyword, selectedKeyword);
  }

  const promptMod = acfContext?.promptModifier ?? "";
  const useAcfKeyword = keywordSource === "acfKeyword";

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
      testMode,
      secondaryKeywords,
      optimizationOptions,
      inContentImageRequest,
      acfFields,
      acfContext,
      pending,
      pendingCleanedTitle,
      promptMod,
      primaryKeywordInitial: primaryKeyword,
      keywordSource,
      hasManualKeyword,
      useAcfKeyword,
      useSeoResearchBrief,
      isTitleMetaOnly,
      focusCategories,
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
    console.error('[Optimize Content] Error continuing with selected keyword:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to optimize content';
    if (!getMuteOptimizationToasts()) notifyHeaderError("Optimization failed", errorMessage);
    setPendingOptimization((prev: any) => {
      const updated = { ...prev };
      delete updated[siteId];
      return updated;
    });
    setOptimizationFileManagers((prev: any) => {
      const updated = { ...prev };
      delete updated[siteId];
      return updated;
    });

    try {
      const { clearSiteCache } = await import('@/lib/wordpress-site-cache');
      const { clearValidationCache } = await import('@/lib/cached-link-validation');
      const { clearRelevanceCache } = await import('@/lib/content-generation/ai-link-relevance-filter');
      clearSiteCache(siteId);
      clearValidationCache(siteId);
      clearRelevanceCache(siteId);
    } catch (cacheError) {
      console.warn('[Optimize Content] Error clearing cache:', cacheError);
    }
    
    // IMPORTANT: Propagate failure to the caller (bulk runner).
    // Bulk runner marks a target as "completed/HIT" only when this throws is absent.
    throw error;
  } finally {
    const batchKey = `${siteId}-batch`;
    // Use the live optimizing flag for `${siteId}-batch`, not leftover bulkOptimizationState.
    // Overview harnesses (In Content Image, FAQ, etc.) leave batch state after finish; that used to
    // skip clearing siteId and leave the Optimize button stuck on "OPTIMIZING..." after Complete.
    let bulkBusy = false;
    setIsOptimizingContent((prev: any) => {
      bulkBusy = Boolean(prev[batchKey]);
      const updated = { ...prev };
      if (!bulkBusy) {
        delete updated[siteId];
      }
      return updated;
    });

    if (!bulkBusy) {
      setOptimizationProgress((prev: any) => {
        const updated = { ...prev };
        delete updated[siteId];
        return updated;
      });

      try {
        const { clearSiteCache } = require('@/lib/wordpress-site-cache');
        const { clearValidationCache } = require('@/lib/cached-link-validation');
        const { clearRelevanceCache } = require('@/lib/content-generation/ai-link-relevance-filter');
        clearSiteCache(siteId);
        clearValidationCache(siteId);
        clearRelevanceCache(siteId);
      } catch (cacheError) {
        console.warn('[Optimize Content] Error clearing cache:', cacheError);
      }
    }
  }
}
