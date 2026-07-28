import { type WordPressSite } from "@/components/integrations/types";
import { processGSCQueriesAndAnalyze } from "@/lib/content-optimization-helpers";
import { updateOptimizationProgress } from "./optimization-helpers";
import { deriveKeywordFromModifier, firstNonBlocklistedQuery, isBlocklistedPrimaryKeyword, isSearchOperatorOrRawQuery, keywordMatchesUrlIntent, shortenToShortTail } from "@/lib/gsc-simple-keyword-recommendation";
import { loadApiKey } from "@/lib/api";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { buildFullPostPayload, extractPrimaryKeywordFromFullPostViaAI } from "@/lib/wordpress-primary-keyword-from-post";
import type React from "react";
import type { AIDrivenACFContext } from "@/lib/content-generation/ai-driven-acf-reader";
import type { PendingOptimization } from "./use-optimization-state";
import type { ContinueOptimizationFn } from "./continue-optimization";

export interface ProcessGSCAndShowSelectionParams {
  gscResult: any;
  site: WordPressSite;
  url: string;
  /** FIRST step: AI-derived page intent from URL. Overrides generic prompt_modifier/ACF. */
  urlDerivedIntent?: string | null;
  existingTitle: string;
  existingPost: any;
  resolved: any;
  existingContent: string;
  existingExcerpt: string;
  wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>;
  updateMode: 'update' | 'draft';
  optimizationOptions?: any;
  inContentImageRequest?: any;
  acfFields?: Record<string, any>;
  acfContext?: AIDrivenACFContext;
  focusCategories?: string[]; // SEM task focus (from task checklist)
  semTaskContext?: { suggestedAction: string; checklist?: string[]; promptModifier?: string; focusCategories?: string[] };
  setGscQueriesForSelection: (prev: any) => any;
  setIsKeywordSelectionOpen: (prev: any) => any;
  setGscClusterAnalysis: (prev: any) => any;
  setIsAnalyzingClusters: (prev: any) => any;
  setPendingOptimization: (prev: any) => any;
  setOptimizationProgress: (prev: any) => any;
  continueOptimizationRef: React.MutableRefObject<ContinueOptimizationFn | null>;
}

export async function processGSCAndShowSelection(params: ProcessGSCAndShowSelectionParams): Promise<void> {
  const {
    gscResult,
    site,
    url,
    urlDerivedIntent,
    existingTitle,
    existingPost,
    resolved,
    existingContent,
    existingExcerpt,
    wordPressPosts = [],
    updateMode,
    optimizationOptions,
    inContentImageRequest,
    acfFields,
    acfContext: incomingAcfContext,
    focusCategories,
    semTaskContext,
    setGscQueriesForSelection,
    setIsKeywordSelectionOpen,
    setGscClusterAnalysis,
    setIsAnalyzingClusters,
    setPendingOptimization,
    setOptimizationProgress,
    continueOptimizationRef,
  } = params;

  setIsAnalyzingClusters((prev: any) => ({ ...prev, [site.id]: true }));

  let analysisTimeout: NodeJS.Timeout | null = null;
  let validQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }> = [];

  let clusterAnalysisPromiseResolve: ((analysis: any) => void) | null = null;
  const clusterAnalysisPromise = new Promise<any>((resolve) => {
    clusterAnalysisPromiseResolve = resolve;
  });

  // GSC FIRST: When we have GSC data, pick from GSC queries (URL-relevant). Only use AI extraction when GSC fails.
  const hasGSCData = gscResult?.queries && Array.isArray(gscResult.queries) && gscResult.queries.length > 0;
  let promptModifier: string | undefined;
  if (!hasGSCData) {
    // No GSC – fall back to AI extraction from full post
    try {
      const fullPostPayload = buildFullPostPayload({
        resolved: resolved ?? existingPost ?? null,
        acfFields: acfFields ?? null,
        existingTitle,
        existingContent,
        existingExcerpt,
        pageUrl: url,
      });
      const apiKey = loadApiKey();
      const model = getResearchModel(site.id);
      if (apiKey?.trim() && model?.trim()) {
        const extracted = await extractPrimaryKeywordFromFullPostViaAI(fullPostPayload, { apiKey, model });
        if (extracted?.trim()) promptModifier = extracted.trim();
      }
    } catch (err) {
      console.warn("[GSC Processing] Full-post keyword extraction failed:", err);
    }
  } else {
    console.log("[GSC Processing] GSC first: using GSC queries for keyword (no AI pre-extraction)");
  }
  const metaDescription = (resolved?.rank_math_description ?? existingExcerpt ?? '').trim() || undefined;
  const gscModifierMeta = (promptModifier || metaDescription || existingTitle)
    ? { promptModifier: hasGSCData ? undefined : promptModifier, metaDescription: metaDescription && metaDescription.length > 0 ? metaDescription : undefined, pageTitle: existingTitle || undefined }
    : undefined;

  const acfKeys = acfFields ? Object.keys(acfFields) : [];

  // Fallback when AI fails or times out: prefer a GSC query that matches URL/title intent. Only use meta/modifier when no GSC.
  const createSimpleFallback = (queries: typeof validQueries, sourceText?: string) => {
    // PREFER a query that matches the page topic (URL slug + title) over a generic first-query fallback
    let gscKeyword = '';
    if (queries?.length && url) {
      const intentMatching = queries.filter(q => {
        const qq = (q?.query || '').trim();
        return qq && !isBlocklistedPrimaryKeyword(qq) && !isSearchOperatorOrRawQuery(qq) && keywordMatchesUrlIntent(qq, url, existingTitle || undefined);
      });
      if (intentMatching.length > 0) {
        intentMatching.sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
        gscKeyword = intentMatching[0].query.trim();
      }
    }
    if (!gscKeyword) {
      gscKeyword = firstNonBlocklistedQuery(queries) || queries[0]?.query || "";
    }
    let recommendedKeyword = (queries?.length && gscKeyword)
      ? gscKeyword
      : (sourceText?.trim() ? deriveKeywordFromModifier(sourceText).trim() : "");
    // Ensure short-tail (2-3 words max)
    if (recommendedKeyword && recommendedKeyword.split(/\s+/).length > 3) {
      recommendedKeyword = shortenToShortTail(recommendedKeyword, 3);
    }
    return {
      overallRecommendation: {
        recommendedKeyword: recommendedKeyword || gscKeyword,
        secondaryKeywords: [],
        topCluster: "Recommended",
        reasoning: (queries?.length && gscKeyword) ? "URL/title-intent matched GSC query" : (sourceText ? "Derived from page meta (no GSC)" : "Fallback")
      },
      clusters: [{ name: "Recommended", queries }]
    };
  };

  try {
    analysisTimeout = setTimeout(() => {
      setIsAnalyzingClusters((prev: any) => ({ ...prev, [site.id]: false }));
      const sourceText = (promptModifier || metaDescription || '').trim();
      const fallbackAnalysis = createSimpleFallback(validQueries, sourceText || undefined);
      setGscClusterAnalysis((prev: any) => ({ ...prev, [site.id]: fallbackAnalysis }));
      if (clusterAnalysisPromiseResolve) {
        clusterAnalysisPromiseResolve(fallbackAnalysis);
      }
    }, 60000);

    validQueries = await processGSCQueriesAndAnalyze(
      gscResult,
      site,
      url,
      (clusterAnalysis) => {
        if (analysisTimeout) {
          clearTimeout(analysisTimeout);
          analysisTimeout = null;
        }
        try {
          setGscClusterAnalysis((prev: any) => ({ ...prev, [site.id]: clusterAnalysis }));
          setIsAnalyzingClusters((prev: any) => ({ ...prev, [site.id]: false }));
          if (clusterAnalysisPromiseResolve) {
            clusterAnalysisPromiseResolve(clusterAnalysis);
          }
        } catch (stateError) {
          console.error('[Optimize Content] Error updating state:', stateError);
          setIsAnalyzingClusters((prev: any) => ({ ...prev, [site.id]: false }));
        }
      },
      (error) => {
        if (analysisTimeout) {
          clearTimeout(analysisTimeout);
          analysisTimeout = null;
        }
        console.error('[Optimize Content] Error getting keyword recommendation:', error);
        setIsAnalyzingClusters((prev: any) => ({ ...prev, [site.id]: false }));
        const sourceText = (promptModifier || metaDescription || '').trim();
        const fallbackAnalysis = createSimpleFallback(validQueries, sourceText || undefined);
        if (clusterAnalysisPromiseResolve) {
          clusterAnalysisPromiseResolve(fallbackAnalysis);
        }
      },
      gscModifierMeta,
      existingPost?.postTypeEndpoint ?? resolved?.endpoint ?? null,
    );
  } catch (processError) {
    if (analysisTimeout) {
      clearTimeout(analysisTimeout);
      analysisTimeout = null;
    }
    console.error('[Optimize Content] Error processing GSC queries:', processError);
    setIsAnalyzingClusters((prev: any) => ({ ...prev, [site.id]: false }));
    throw processError;
  }

  if (!Array.isArray(validQueries) || validQueries.length === 0) {
    throw new Error('No valid queries found for keyword selection');
  }

  setGscQueriesForSelection((prev: any) => ({ ...prev, [site.id]: validQueries }));
  const pendingEntry: PendingOptimization = {
    site,
    url,
    urlDerivedIntent: urlDerivedIntent || undefined,
    updateMode,
    gscResult,
    existingPost,
    resolved,
    existingTitle,
    existingContent,
    existingExcerpt,
    wordPressPosts,
    optimizationOptions,
    inContentImageRequest,
    acfFields,
    acfContext: incomingAcfContext,
    focusCategories,
    semTaskContext,
  };
  setPendingOptimization((prev: any) => ({
    ...prev,
    [site.id]: pendingEntry,
  }));

  updateOptimizationProgress(setOptimizationProgress, site.id, 'Selecting keyword for URL intent...', 30, `Matching keyword to page: ${url.split('/').pop() || url}`);

  const clusterAnalysis = await clusterAnalysisPromise;
  let updatedClusterAnalysis = clusterAnalysis;

  const shouldAutoOptimize = optimizationOptions?.autoOptimize === true;

  if (shouldAutoOptimize) {
    updateOptimizationProgress(setOptimizationProgress, site.id, 'Auto-optimizing...', 35, 'Processing keyword recommendation...');

    // GSC keywords take priority when available; urlDerivedIntent is fallback only
    const urlIntent = (urlDerivedIntent || '').trim();
    const gscRecommendedKeyword = updatedClusterAnalysis?.overallRecommendation?.recommendedKeyword;
    const recommendedKeyword = (hasGSCData && gscRecommendedKeyword)
      ? gscRecommendedKeyword
      : (urlIntent || gscRecommendedKeyword);
    const secondaryKeywords = updatedClusterAnalysis?.overallRecommendation?.secondaryKeywords || [];
    let cleanKeyword = '';
    if (recommendedKeyword && typeof recommendedKeyword === 'string' && recommendedKeyword.trim().length > 0) {
      cleanKeyword = recommendedKeyword.trim();
      const sourceText = (promptModifier || metaDescription || '').trim();
      if (isSearchOperatorOrRawQuery(cleanKeyword)) {
        cleanKeyword = sourceText ? deriveKeywordFromModifier(sourceText).trim() : firstNonBlocklistedQuery(validQueries);
      }
      if (cleanKeyword && isBlocklistedPrimaryKeyword(cleanKeyword)) {
        cleanKeyword = sourceText ? deriveKeywordFromModifier(sourceText).trim() : firstNonBlocklistedQuery(validQueries);
      }
    }
    // Ensure short-tail (2-3 words max) for auto-optimize keyword
    if (cleanKeyword && cleanKeyword.split(/\s+/).length > 3) {
      cleanKeyword = shortenToShortTail(cleanKeyword, 3);
    }
    if (cleanKeyword) {
      // Extract secondary keywords (ensure they're strings and not empty)
      const cleanSecondaryKeywords = Array.isArray(secondaryKeywords)
        ? secondaryKeywords
            .filter((kw): kw is string => typeof kw === 'string' && kw.trim().length > 0)
            .map(kw => kw.trim())
            .slice(0, 5) // Limit to 5 secondary keywords
        : [];
      
      console.log(`[Auto-Optimize] Using AI-recommended keyword: "${cleanKeyword}"${cleanSecondaryKeywords.length > 0 ? ` + ${cleanSecondaryKeywords.length} secondary keywords` : ''}`);

      // USE THE AI-RECOMMENDED KEYWORD DIRECTLY - NO FILTERING, NO VALIDATION, NO EXTRACTION
      const selectedQuery = {
        query: cleanKeyword,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0
      };

      // Get related keywords from queries (exclude the primary keyword)
      const clusterKeywords = validQueries
        .map(q => q.query)
        .filter(q => q && q.toLowerCase().trim() !== cleanKeyword.toLowerCase().trim())
        .slice(0, 10) || [];

      
      if (!continueOptimizationRef || !continueOptimizationRef.current) {
        console.error('[Auto-Optimize] continueOptimizationRef or current is null/undefined', { 
          hasRef: !!continueOptimizationRef, 
          hasCurrent: !!(continueOptimizationRef?.current) 
        });
        throw new Error('Optimization continuation function not available');
      }
      
      updateOptimizationProgress(setOptimizationProgress, site.id, 'Keyword selected for URL intent', 40, `Using: "${cleanKeyword}"`);
      try {
        await continueOptimizationRef.current(site.id, selectedQuery, clusterKeywords, setIsKeywordSelectionOpen, false, cleanSecondaryKeywords, pendingEntry);
      } catch (continueError) {
        console.error('[Auto-Optimize] Error in continueOptimizationRef.current:', continueError);
        throw continueError;
      }
      return;
    } else {
      // Fallback: derive from page meta/modifier when available; otherwise first non-blocklisted query (never blocklisted phrase)
      if (validQueries.length > 0) {
        const sourceText = (promptModifier || metaDescription || '').trim();
        const fallbackKeyword = sourceText
          ? deriveKeywordFromModifier(sourceText).trim()
          : (firstNonBlocklistedQuery(validQueries) || validQueries[0]?.query || '').trim();
        if (!fallbackKeyword) {
          throw new Error('No keyword recommendation and derivation/fallback produced empty keyword');
        }
        const selectedQuery = {
          query: fallbackKeyword,
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0
        };
        console.warn(`[Auto-Optimize] No AI recommendation, using fallback: "${fallbackKeyword}"`);
        updateOptimizationProgress(setOptimizationProgress, site.id, 'Continuing optimization...', 40, `Using fallback keyword: ${fallbackKeyword}`);
        if (!continueOptimizationRef || !continueOptimizationRef.current) {
          console.error('[Auto-Optimize] continueOptimizationRef or current is null/undefined (fallback)', {
            hasRef: !!continueOptimizationRef,
            hasCurrent: !!(continueOptimizationRef?.current)
          });
          throw new Error('Optimization continuation function not available');
        }
        try {
          await continueOptimizationRef.current(site.id, selectedQuery, [], setIsKeywordSelectionOpen, false, [], pendingEntry);
        } catch (continueError) {
          console.error('[Auto-Optimize] Error in continueOptimizationRef.current (fallback):', continueError);
          throw continueError;
        }
        return;
      }
      throw new Error('No keyword recommendation and no valid queries available');
    }
  }

  updateOptimizationProgress(setOptimizationProgress, site.id, 'Select keyword...', 35, 'Please review and select a keyword to optimize');
  setIsKeywordSelectionOpen((prev: any) => ({ ...prev, [site.id]: true }));
}
