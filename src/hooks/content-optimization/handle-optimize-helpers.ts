import { notify } from "@/lib/app-notifications";
import { NOTIFY_ACF_UPDATED, NOTIFY_EDITING_ACF_FIELDS_ONLY, NOTIFY_OPTIMIZATION_FUNCTION_NOT_READY_PLEASE_T, notifyTestModeErrorUpdatingAcfFieldsX, notifyTestModeFailedToUpdateAcfFieldsX } from "@/lib/notify-messages";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { type WordPressSite } from "@/components/integrations/types";
import type { AIDrivenACFContext } from "@/lib/content-generation/ai-driven-acf-reader";
import { restCollectionMatchesEntitySitemap } from "@/lib/entity-endpoint-extractor";
import { extractKeywordFromContent, extractKeywordFromTitleOnly, inferPrimaryKeywordFromTitleAndMeta, extractHeadingsFromContent, saveGSCData, updateOptimizationProgress, setOptimizingState } from "./optimization-helpers";
import { isCompanyNameKeyword } from "@/lib/gsc-simple-keyword-recommendation";
import type { PendingOptimization } from "./use-optimization-state";
import type { ContinueOptimizationFn } from "./continue-optimization";
import type React from "react";
import type React from "react";

export interface HandleNoGSCDataParams {
  site: WordPressSite;
  url: string;
  /** FIRST step: AI-derived page intent from URL. Overrides ACF/prompt_modifier. */
  urlDerivedIntent?: string | null;
  existingTitle: string;
  existingContent: string;
  existingExcerpt: string;
  existingPost: any;
  resolved: any;
  wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>;
  updateMode: 'update' | 'draft';
  optimizationOptions?: any;
  inContentImageRequest?: any;
  acfFields?: Record<string, any>; // Raw ACF for write path
  acfContext?: AIDrivenACFContext; // AI-driven semantic context for prompt/keyword (no static key names)
  fileManager: OptimizationFileManager;
  setPendingOptimization: (prev: any) => any;
  setIsKeywordSelectionOpen: (prev: any) => any;
  setIsAnalyzingClusters: (prev: any) => any;
  setOptimizationProgress: (prev: any) => any;
  continueOptimizationRef: React.MutableRefObject<ContinueOptimizationFn | null>;
  /** When set (SEM "Fix it"), use as primary keyword instead of extracting from content */
  keywordHint?: string;
  /** Focus categories for selective optimization (SEM task list) */
  focusCategories?: string[];
  /** Full SEM task context for selective optimization */
  semTaskContext?: { suggestedAction: string; checklist?: string[]; promptModifier?: string; focusCategories?: string[] };
  /** When true, skip writing the stub gsc-data file (already saved earlier in the run). */
  skipGscStubFile?: boolean;
}

export async function handleNoGSCData(params: HandleNoGSCDataParams): Promise<void> {
  const {
    site,
    url,
    urlDerivedIntent,
    existingTitle,
    existingContent,
    existingExcerpt,
    existingPost,
    resolved,
    wordPressPosts = [],
    updateMode,
    optimizationOptions,
    inContentImageRequest,
    acfFields,
    acfContext,
    fileManager,
    setPendingOptimization,
    setIsKeywordSelectionOpen,
    setIsAnalyzingClusters,
    setOptimizationProgress,
    continueOptimizationRef,
    keywordHint,
    focusCategories,
    semTaskContext,
    skipGscStubFile,
  } = params;

  const postTypeEndpoint = existingPost?.postTypeEndpoint ?? resolved?.endpoint;
  const isEntityPage = restCollectionMatchesEntitySitemap(site, postTypeEndpoint);
  const isSemTask = !!semTaskContext;

  // ACF-only mode: use manual keyword or `keyword_focus` verbatim - no URL intent, title/meta AI, or slug fallbacks.
  if (optimizationOptions?.useAcfKeyword === true) {
    const acfKw = String(acfFields?.keyword_focus ?? acfContext?.keywordFocus ?? '').trim();

    
    if (!acfKw) {
      throw new Error('ACF keyword mode requires keyword_focus');
    }
    const mockKeyword = {
      query: acfKw,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    };
    saveGSCData(
      fileManager,
      { success: false, error: 'No valid search queries found' },
      url,
      'Using ACF keyword_focus (no GSC keyword research)'
    );
    const pendingEntry: PendingOptimization = {
      site,
      url,
      urlDerivedIntent: urlDerivedIntent || undefined,
      updateMode,
      gscResult: { success: false, topKeyword: mockKeyword, queries: [] },
      existingPost,
      resolved,
      existingTitle,
      existingContent,
      existingExcerpt,
      wordPressPosts,
      optimizationOptions,
      inContentImageRequest,
      acfFields,
      acfContext,
      focusCategories,
      semTaskContext,
    };
    setPendingOptimization((prev: any) => ({
      ...prev,
      [site.id]: pendingEntry,
    }));
    setIsKeywordSelectionOpen((prev: any) => ({ ...prev, [site.id]: false }));
    setIsAnalyzingClusters((prev: any) => ({ ...prev, [site.id]: false }));
    const label = 'ACF keyword_focus';
    updateOptimizationProgress(
      setOptimizationProgress,
      site.id,
      'Starting optimization...',
      30,
      `Using ${label}: "${acfKw}"`
    );
    if (continueOptimizationRef.current) {
      await continueOptimizationRef.current(site.id, mockKeyword, [], setIsKeywordSelectionOpen, false, undefined, pendingEntry);
    } else {
      console.error('[handleNoGSCData] continueOptimizationRef missing (ACF-only path)');
    }
    return;
  }

  // 0) Direct hint (e.g. ACF keyword_focus when user explicitly chose it) - highest priority
  const directHint = (keywordHint || '').trim();

  // 1) urlDerivedIntent from FIRST step (read URL with AI) - overrides ACF/prompt_modifier
  const urlIntent = (urlDerivedIntent || '').trim();

  const acfKeywordFocus = (acfContext?.keywordFocus ?? '').trim();
  const hasAcfKeywordFocus = acfKeywordFocus.length > 0;
  const acfIsCompanyName = hasAcfKeywordFocus && isCompanyNameKeyword(acfKeywordFocus, site.name);

  let extractedKeyword = '';
  let keywordSourceLabel: string;

  // If ACF keyword_focus exists, it must win over urlDerivedIntent and SEM keywordHint.
  // Exception: if the hint is truly a manual override (manual keyword path), keep it.
  const isManualKeywordHint =
    !!directHint &&
    !urlIntent &&
    (!focusCategories || focusCategories.length === 0) &&
    !semTaskContext;

  if (directHint && isManualKeywordHint) {
    extractedKeyword = directHint.substring(0, 80);
    keywordSourceLabel = 'Manual keyword (direct)';
  } else {
    extractedKeyword = urlIntent ? urlIntent.substring(0, 80) : '';

    // ACF keyword_focus wins whenever it exists (but NEVER use company/site name as keyword)
    if (hasAcfKeywordFocus && !acfIsCompanyName) {
      extractedKeyword = acfKeywordFocus.substring(0, 80);
    }

    // 3) If no valid ACF keyword (or ACF was company name), infer from page headings + title + meta
    if (!extractedKeyword) {
      const metaFromAcf = acfContext?.metaDescription ?? '';
      const promptModifierFromAcf = acfContext?.promptModifier ?? '';
      const pageHeadings = extractHeadingsFromContent(existingContent || '');
      const inferred = await inferPrimaryKeywordFromTitleAndMeta(
        existingTitle,
        metaFromAcf || undefined,
        existingExcerpt,
        url,
        site.id,
        acfIsCompanyName ? undefined : (acfKeywordFocus || undefined),
        promptModifierFromAcf || undefined,
        pageHeadings.length > 0 ? pageHeadings : undefined
      );
      if (inferred.length > 0) extractedKeyword = inferred;
    }
  }

  // 4) Fallback: keywordHint (SEM) or existing extractors when no keyword found yet
  if (directHint && extractedKeyword === directHint.substring(0, 80)) {
    keywordSourceLabel = isManualKeywordHint ? 'Manual keyword (direct)' : 'keywordHint (SEM)';
  } else if (urlIntent && extractedKeyword === urlIntent.substring(0, 80)) {
    keywordSourceLabel = 'URL intent (AI)';
  } else if ((acfContext?.keywordFocus ?? '').trim().length > 0 && extractedKeyword === (acfContext?.keywordFocus ?? '').trim().substring(0, 80)) {
    keywordSourceLabel = 'ACF keyword_focus';
  } else if (extractedKeyword) {
    keywordSourceLabel = 'title/meta (AI)';
  } else {
    extractedKeyword = isSemTask
      ? await extractKeywordFromTitleOnly(existingTitle, url, site.id)
      : await extractKeywordFromContent(
          existingTitle,
          existingContent,
          url,
          isEntityPage,
          site.name,
          site.id
        );
    keywordSourceLabel = isSemTask ? 'title' : 'content';
  }

  // CRITICAL: Never pass empty keyword – continueOptimizationWithKeyword throws. Use URL slug or safe default.
  if (!extractedKeyword || typeof extractedKeyword !== 'string' || extractedKeyword.trim().length === 0) {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter((s: string) => s.length > 0);
      const slug = pathSegments[pathSegments.length - 1] || 'page';
      extractedKeyword = slug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    } catch {
      extractedKeyword = 'content optimization';
    }
    keywordSourceLabel = 'URL/fallback';
  }

  const mockKeyword = {
    query: extractedKeyword.trim().substring(0, 80),
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0
  };

  if (!skipGscStubFile) {
    saveGSCData(fileManager, { success: false, error: 'No valid search queries found' }, url, isSemTask ? 'SEM task - optimizing selectively based on focus categories' : 'No valid search queries found - proceeding with content-based optimization');
  }

  // Store focus categories and SEM context in pending optimization for selective optimization
  const pendingEntry: PendingOptimization = {
    site,
    url,
    urlDerivedIntent: urlDerivedIntent || undefined,
    updateMode,
    gscResult: { success: false, topKeyword: mockKeyword, queries: [] },
    existingPost,
    resolved,
    existingTitle,
    existingContent,
    existingExcerpt,
    wordPressPosts,
    optimizationOptions,
    inContentImageRequest,
    acfFields,
    acfContext,
    focusCategories,
    semTaskContext,
  };
  setPendingOptimization((prev: any) => ({
    ...prev,
    [site.id]: pendingEntry,
  }));

  setIsKeywordSelectionOpen((prev: any) => ({ ...prev, [site.id]: false }));
  setIsAnalyzingClusters((prev: any) => ({ ...prev, [site.id]: false }));

  const focusNote = focusCategories && focusCategories.length > 0 
    ? ` Focus areas: ${focusCategories.join(', ')}`
    : '';
  updateOptimizationProgress(setOptimizationProgress, site.id, 'Starting optimization...', 30, `Using keyword extracted from ${keywordSourceLabel}: "${extractedKeyword}"${focusNote}`);

  if (continueOptimizationRef.current) {
    await continueOptimizationRef.current(site.id, mockKeyword, [], setIsKeywordSelectionOpen, false, undefined, pendingEntry);
  } else {
    console.error('[Optimize Content] continueOptimizationWithKeyword not yet available');
    notify.error(NOTIFY_OPTIMIZATION_FUNCTION_NOT_READY_PLEASE_T);
  }
}

export async function handleTestModeACF(
  site: WordPressSite,
  resolved: any,
  existingPost: any,
  setOptimizationProgress: (prev: any) => any,
  setIsOptimizingContent: (prev: any) => any
): Promise<void> {
  notify.info(NOTIFY_EDITING_ACF_FIELDS_ONLY);

  const postId = resolved?.id || existingPost?.id;
  if (!postId) {
    throw new Error('TEST MODE: Could not find post ID to update ACF fields');
  }

  updateOptimizationProgress(setOptimizationProgress, site.id, 'TEST MODE: Editing ACF fields...', 95, 'Updating ACF fields...');

  const { updateACFFields } = await import('@/lib/wordpress-acf-origin');
  const { getFieldsForPost } = await import('@/lib/wordpress-api/fields-client');
  const { discoverACFFieldMapping } = await import('@/lib/content-generation/acf-field-mapper');
  const { loadApiKey } = await import('@/lib/api');
  
  const postTypeEndpoint = resolved?.endpoint || existingPost?.postTypeEndpoint ||
    (resolved?.subtype === 'post' ? 'posts' : resolved?.subtype) || 'posts';

  // AGENTIC: Fetch actual ACF fields and discover field mapping
  const postType = resolved?.subtype || 'post';
  const acfResult = await getFieldsForPost(
    site,
    postId,
    postType,
    postTypeEndpoint
  );

  const existingAcfFields = acfResult.success && acfResult.fields ? acfResult.fields : {};
  
  // Use AI to discover field mapping
  const openRouterApiKey = loadApiKey();
  const fieldMapping = await discoverACFFieldMapping(
    existingAcfFields,
    postType,
    openRouterApiKey || '',
    site.siteUrl
  );

  // Use discovered mapping, with fallbacks for missing fields
  const fieldNames = {
    dateModifier: fieldMapping.dateModifier || 'date_modifier',
    promptModifier: fieldMapping.promptModifier || 'prompt_modifier'
  };

  const todayDate = new Date().toISOString().split('T')[0];
  const testMessage = 'TEST MODE: This post was updated in test mode with keyword "edmonton seo"';

  try {
    const acfUpdateResult = await updateACFFields(
      site.siteUrl,
      site.username,
      site.appPassword,
      postId,
      { 
        [fieldNames.dateModifier]: todayDate, 
        [fieldNames.promptModifier]: testMessage 
      },
      postType,
      postTypeEndpoint
    );

    if (acfUpdateResult.success) {
      console.log("[TEST MODE] ACF update", {
        [fieldNames.dateModifier]: todayDate,
        [fieldNames.promptModifier]: testMessage.substring(0, 80),
      });
      notify.success(NOTIFY_ACF_UPDATED, { duration: 5000 });
      updateOptimizationProgress(setOptimizationProgress, site.id, 'TEST MODE: Complete', 100, 'ACF fields updated successfully');
    } else {
      const errorMessage = acfUpdateResult.failed && acfUpdateResult.failed.length > 0
        ? acfUpdateResult.failed.map((f: any) => `${f.field}: ${f.error}`).join('; ')
        : (acfUpdateResult.error || 'Unknown error');
      notify.error(notifyTestModeFailedToUpdateAcfFieldsX(errorMessage), { duration: 10000 });
      updateOptimizationProgress(setOptimizationProgress, site.id, 'TEST MODE: Error', 0, errorMessage);
    }
  } catch (acfError) {
    console.error('[Optimize Content] TEST MODE: Error updating ACF fields:', acfError);
    notify.error(notifyTestModeErrorUpdatingAcfFieldsX(acfError instanceof Error ? acfError.message : 'Unknown error'), { duration: 8000 });
    updateOptimizationProgress(setOptimizationProgress, site.id, 'TEST MODE: Error', 0, acfError instanceof Error ? acfError.message : 'Unknown error');
  } finally {
    setOptimizingState(setIsOptimizingContent, site.id, false);
  }
}
