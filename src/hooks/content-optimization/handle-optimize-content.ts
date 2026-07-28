import { notify } from "@/lib/app-notifications";
import { NOTIFY_APPLYING_SEM_CHECKLIST, NOTIFY_FAILED_TO_INITIALIZE_OPTIMIZATION_PLEASE, NOTIFY_IMAGE_GENERATION_DISABLED_PER_PROMPT_MOD, NOTIFY_IMAGE_GENERATION_ENABLED_PER_PROMPT_MODI, NOTIFY_OPTIMIZING_WITHOUT_GSC, NOTIFY_PLEASE_ENTER_A_URL_TO_OPTIMIZE, NOTIFY_SKIPPED_PROMPT_MODIFIER, NOTIFY_STAGING_NO_GSC, notifyUsingAcfKeywordFocusX, notifyUsingManualKeywordOverrideX } from "@/lib/notify-messages";
import { getMuteOptimizationToasts } from "./optimization-toast-mute";
import { loadApiKey } from "@/lib/api";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import {
  updateOptimizationProgress,
  setOptimizingState,
  handleOptimizationError,
  savePostData,
} from "./optimization-helpers";
import { handleNoGSCData, handleTestModeACF } from "./handle-optimize-helpers";
import { runSEMFixOnly } from "./sem-fix-only";
import type { PendingOptimization } from "./use-optimization-state";
import { getFieldsForPost } from "@/lib/wordpress-api/fields-client";
import {
  readACFFieldsAgentically,
  mergeSeoResearchFromAcfIntoContext,
} from "@/lib/content-generation/ai-driven-acf-reader";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { interpretPromptModifier } from "@/lib/prompt-modifier-interpreter";
import {
  type HandleOptimizeContentParams,
  deriveKeywordHintFromSuggestedAction,
} from "./handle-optimize-content-params";
import { loadHandleOptimizePostAndIntent } from "./handle-optimize-content-post-load";

export type HandleOptimizeContentResult = { optimizationChanges: Record<string, unknown> } | void | undefined;

export async function handleOptimizeContent(params: HandleOptimizeContentParams): Promise<HandleOptimizeContentResult> {
  const {
    site,
    url,
    wordPressPosts = [],
    updateMode,
    setGscQueriesForSelection,
    setIsKeywordSelectionOpen,
    setGscClusterAnalysis,
    setIsAnalyzingClusters,
    skipOnNoGSC,
    optimizationOptions,
    inContentImageRequest: initialInContentImageRequest,
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
  } = params;
  
  let inContentImageRequest = initialInContentImageRequest;

  const isTestMode = testMode === true || optimizationOptions?.testMode === true;

  if (!url || !url.trim()) {
    if (!getMuteOptimizationToasts()) notify.error(NOTIFY_PLEASE_ENTER_A_URL_TO_OPTIMIZE);
    return;
  }

  try {
    setOptimizingState(setIsOptimizingContent, site.id, true);
    setGscPerformancePreview?.((prev) => ({
      ...prev,
      [site.id]: { ...(prev[site.id] || {}), [url]: null },
    }));
    updateOptimizationProgress(setOptimizationProgress, site.id, 'Starting optimization...', 8, undefined, {
      resetMicroLog: true,
    });
  } catch (stateError) {
    console.error('[Optimize Content] Error setting initial state:', stateError);
    if (!getMuteOptimizationToasts()) notify.error(NOTIFY_FAILED_TO_INITIALIZE_OPTIMIZATION_PLEASE);
    return;
  }

  try {
    const openRouterApiKey = loadApiKey();
    if (!openRouterApiKey || openRouterApiKey.trim().length === 0) {
      throw new Error('OpenRouter API key not found. Please set it in settings.');
    }

    const researchModel = getResearchModel(site.id);

    // Research for optimization comes from ACF `seo_research` only (no live GSC / DataForSEO / Semrush in Content Optimizer).
    let fileManager = new OptimizationFileManager();
    setOptimizationFileManagers((prev: any) => ({ ...prev, [site.id]: fileManager }));

    const {
      resolved,
      existingPost,
      existingTitle,
      existingContent,
      existingExcerpt,
      urlDerivedIntent,
      acfPrefetch,
    } = await loadHandleOptimizePostAndIntent({
      site,
      url,
      resolvedPost,
      optimizationOptions,
      setOptimizationProgress,
      researchModel,
      openRouterApiKey,
    });

    savePostData(fileManager, existingPost, existingPost.id?.toString() || 'post');

    const manualKeyword = (optimizationOptions?.manualKeyword ?? '').trim();
    const sheetKeyword = (resolvedPost?.focusKeyword ?? '').trim();
    const usedSheetBody = Boolean((resolvedPost?.content ?? '').trim());
    const sheetOrManualKeyword = manualKeyword || sheetKeyword;

    // Handle test mode
    if (isTestMode) {
      await handleTestModeACF(site, resolved, existingPost, setOptimizationProgress, setIsOptimizingContent);
      return;
    }

    // Read ACF fields and resolve AI-driven semantic context (no static key names)
    let acfFields: Record<string, any> = {};
    let acfContext: Awaited<ReturnType<typeof readACFFieldsAgentically>> | undefined;
    let interpretedModifier: Awaited<ReturnType<typeof interpretPromptModifier>> | null = null;
    const useAcfKeyword = optimizationOptions?.useAcfKeyword === true;

    try {
      if (usedSheetBody) {
        updateOptimizationProgress(
          setOptimizationProgress,
          site.id,
          'Using sheet inventory...',
          12,
          sheetOrManualKeyword
            ? `Sheet keyword: "${sheetOrManualKeyword}"`
            : 'Sheet body (no WordPress ACF)',
        );
        if (sheetOrManualKeyword) {
          acfFields = { keyword_focus: sheetOrManualKeyword };
          acfContext = { keywordFocus: sheetOrManualKeyword } as typeof acfContext;
        }
      } else {
      updateOptimizationProgress(setOptimizationProgress, site.id, 'Reading ACF fields...', 12, 'Fetching ACF fields from WordPress...');

      if (acfPrefetch) {
        acfFields = acfPrefetch.fields || {};
      } else if (resolved) {
        const postTypeEndpoint = resolved?.endpoint ||
          (resolved?.subtype === 'post' ? 'posts' : resolved?.subtype) ||
          'posts';

        const acfResult = await getFieldsForPost(
          site,
          resolved.id,
          resolved.subtype || 'post',
          postTypeEndpoint
        );

        if (acfResult.success && acfResult.fields) {
          acfFields = acfResult.fields;
        } else {
          console.warn('[Optimize Content] Failed to read ACF fields or no fields found:', acfResult.error);
        }
      }

      const apiKey = loadApiKey();
      if (Object.keys(acfFields).length > 0) {
        // bulk strict mode: do NOT call readACFFieldsAgentically (removes AI-driven ACF reader errors).
        if (useAcfKeyword) {
          acfContext = { keywordFocus: String(acfFields["keyword_focus"] ?? '').trim() } as any;
        } else if (apiKey) {
          updateOptimizationProgress(setOptimizationProgress, site.id, 'Interpreting ACF fields (AI-driven)...', 13, 'Mapping ACF to semantic context...');
          acfContext = await readACFFieldsAgentically(acfFields, {
            apiKey,
            siteUrl: site.siteUrl,
            postType: resolved?.subtype || 'post',
            model: getResearchModel(site.id),
          });
        }
      }
      // Preserve prompt_modifier behavior without relying on AI-driven ACF reader.
      const promptModifier =
          (useAcfKeyword
            ? (() => {
                const key = Object.keys(acfFields || {}).find((k) => /prompt_modifier|prompt_mod|seo_prompt_modifier/i.test(k));
                return key ? String(acfFields[key] ?? '').trim() : '';
              })()
            : acfContext?.promptModifier?.trim()) || '';

      if (promptModifier) {
        updateOptimizationProgress(setOptimizationProgress, site.id, 'Interpreting prompt modifier...', 14, 'Analyzing optimization instructions...');
        interpretedModifier = await interpretPromptModifier(promptModifier, site.id);
      }
      }
    } catch (acfError) {
      console.warn('[Optimize Content] Error reading ACF fields, proceeding with full optimization:', acfError);
      // Continue with full optimization if ACF read fails
    }

    acfContext = mergeSeoResearchFromAcfIntoContext(acfFields, acfContext);

    // Research is optional — never stop Optimize Content for missing seo_research.

    // Apply interpreted actions from seo_prompt_modifier
    if (interpretedModifier) {
      // Handle skip instruction
      if (interpretedModifier.shouldSkipOptimization) {
        if (!getMuteOptimizationToasts()) {
          console.log("[Optimize] Skipped per modifier:", interpretedModifier.interpretedInstruction);
          notify.info(NOTIFY_SKIPPED_PROMPT_MODIFIER);
        }
        updateOptimizationProgress(setOptimizationProgress, site.id, 'Optimization skipped', 100, interpretedModifier.interpretedInstruction);
        setOptimizingState(setIsOptimizingContent, site.id, false);
        return;
      }

      // Handle image instructions
      if (interpretedModifier.shouldAddImages && !inContentImageRequest) {
        // Enable image generation if not already set
        inContentImageRequest = { imageType: 'infographic', userPrompt: '' };
        console.log('[Optimize Content] Enabled image generation based on prompt modifier');
        if (!getMuteOptimizationToasts()) notify.info(NOTIFY_IMAGE_GENERATION_ENABLED_PER_PROMPT_MODI);
      }

      if (interpretedModifier.shouldSkipImages) {
        // Disable image generation
        inContentImageRequest = undefined;
        // Also disable in optimization options if present
        if (optimizationOptions) {
          optimizationOptions.optimizeFeaturedImage = false;
        }
        console.log('[Optimize Content] Disabled image generation based on prompt modifier');
        if (!getMuteOptimizationToasts()) notify.info(NOTIFY_IMAGE_GENERATION_DISABLED_PER_PROMPT_MOD);
      }
    }

    // Highest priority: explicit manual keyword or sheet/CSV focus keyword.
    if (usedSheetBody && !sheetOrManualKeyword) {
      throw new Error(
        `Sheet focus keyword is required for ${url}. Set focusKeyword on the Content sheet row, then retry.`,
      );
    }
    if (sheetOrManualKeyword) {
      if (!getMuteOptimizationToasts()) {
        notify.info(notifyUsingManualKeywordOverrideX(sheetOrManualKeyword), { duration: 3000 });
      }
      updateOptimizationProgress(
        setOptimizationProgress,
        site.id,
        manualKeyword ? 'Using manual keyword override...' : 'Using sheet focus keyword...',
        25,
        `Using keyword: "${sheetOrManualKeyword}"`
      );

      await handleNoGSCData({
        site,
        url,
        urlDerivedIntent: null,
        existingTitle,
        existingContent,
        existingExcerpt,
        existingPost,
        resolved,
        wordPressPosts,
        updateMode,
        optimizationOptions: {
          ...optimizationOptions,
          manualKeyword: sheetOrManualKeyword,
          useAcfKeyword: false,
        },
        inContentImageRequest,
        acfFields: { ...acfFields, keyword_focus: sheetOrManualKeyword },
        acfContext: { ...(acfContext || {}), keywordFocus: sheetOrManualKeyword } as typeof acfContext,
        fileManager,
        setPendingOptimization,
        setIsKeywordSelectionOpen,
        setIsAnalyzingClusters,
        setOptimizationProgress,
        continueOptimizationRef,
        keywordHint: sheetOrManualKeyword,
        focusCategories: undefined,
        semTaskContext: undefined,
      });
      return;
    }

    // User explicitly chose to use the ACF keyword_focus field as the primary keyword.
    if (optimizationOptions?.useAcfKeyword) {
      let acfKeyword = String(acfFields["keyword_focus"] ?? "").trim();

      if (!acfKeyword) {
        updateOptimizationProgress(
          setOptimizationProgress,
          site.id,
          "Writing focus keyword…",
          20,
          "OpenRouter writing missing keyword_focus",
        );
        const { writeMissingFocusKeywordWithAi } = await import("./write-missing-focus-keyword-ai");
        acfKeyword = await writeMissingFocusKeywordWithAi({
          url,
          title: existingTitle,
          meta: String(acfFields["rank_math_description"] ?? acfFields["meta_description"] ?? "").trim(),
          siteId: site.id,
        });
        acfFields["keyword_focus"] = acfKeyword;
        if (acfContext && typeof acfContext === "object") {
          (acfContext as { keywordFocus?: string }).keywordFocus = acfKeyword;
        } else {
          acfContext = { keywordFocus: acfKeyword } as typeof acfContext;
        }
      }
      if (!getMuteOptimizationToasts()) {
        notify.info(notifyUsingAcfKeywordFocusX(acfKeyword), { duration: 3000 });
      }

      updateOptimizationProgress(
        setOptimizationProgress,
        site.id,
        "Using ACF keyword...",
        25,
        `Using ACF keyword_focus: "${acfKeyword}"`
      );

      await handleNoGSCData({
        site,
        url,
        urlDerivedIntent: null,
        existingTitle,
        existingContent,
        existingExcerpt,
        existingPost,
        resolved,
        wordPressPosts,
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
        keywordHint: acfKeyword,
        focusCategories: undefined,
        semTaskContext: undefined,
      });
      return;
    }

    // Minimal SEM "Fix it" path: API → OpenRouter (checklist) → upload back. No GSC, DataForSEO, or blueprint.
    if (skipOnNoGSC && semTaskContext) {
      if (!getMuteOptimizationToasts()) notify.info(NOTIFY_APPLYING_SEM_CHECKLIST);
      const semResult = await runSEMFixOnly({
        site,
        url,
        existingPost,
        resolved,
        existingTitle,
        existingContent,
        existingExcerpt,
        semTaskContext: {
          suggestedAction: semTaskContext.suggestedAction,
          checklist: semTaskContext.checklist ?? [],
          promptModifier: semTaskContext.promptModifier,
          focusCategories: semTaskContext.focusCategories,
        },
        acfFields,
        acfContext,
        setOptimizationProgress,
        setPendingOptimization,
        setIsOptimizingContent,
      });
      return semResult ? { optimizationChanges: semResult.optimizationChanges } : undefined;
    }

    // When skipOnNoGSC is true: SEM fix flow OR retry after GSC already returned no keywords. Never skip GSC on first attempt (bulk always pings GSC first).
    if (skipOnNoGSC) {
      const focusCategories = semTaskContext?.focusCategories || [];
      if (!getMuteOptimizationToasts()) {
        notify.info(NOTIFY_OPTIMIZING_WITHOUT_GSC);
      }
      const keywordHint = semTaskContext?.suggestedAction
        ? deriveKeywordHintFromSuggestedAction(semTaskContext.suggestedAction)
        : undefined;
      updateOptimizationProgress(setOptimizationProgress, site.id, 'Optimizing selectively (no GSC)...', 25, keywordHint ? `Task focus: ${keywordHint}` : `Focus areas: ${focusCategories.join(', ') || 'all'}`);
      await handleNoGSCData({
        site,
        url,
        urlDerivedIntent,
        existingTitle,
        existingContent,
        existingExcerpt,
        existingPost,
        resolved,
        wordPressPosts,
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
      });
      return;
    }

    // Staging site: skip GSC entirely (new sites have no data).
    if (optimizationOptions?.stagingSite) {
      console.log('[Optimize Content] Staging site mode – skipping GSC');
      if (!getMuteOptimizationToasts()) notify.info(NOTIFY_STAGING_NO_GSC);
      updateOptimizationProgress(setOptimizationProgress, site.id, 'Staging site – optimizing with AI...', 25, 'Skipping GSC');
      await handleNoGSCData({
        site,
        url,
        urlDerivedIntent,
        existingTitle,
        existingContent,
        existingExcerpt,
        existingPost,
        resolved,
        wordPressPosts,
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
        keywordHint: undefined,
        focusCategories: undefined,
        semTaskContext: undefined,
      });
      return;
    }

    fileManager = optimizationFileManagers[site.id] || fileManager;
    if (!optimizationFileManagers[site.id]) {
      setOptimizationFileManagers((prev: any) => ({ ...prev, [site.id]: fileManager }));
    }

    const keywordHintForPipeline = semTaskContext?.suggestedAction
      ? deriveKeywordHintFromSuggestedAction(semTaskContext.suggestedAction)
      : undefined;
    const focusCategoriesForPipeline = semTaskContext?.focusCategories;

    await handleNoGSCData({
      site,
      url,
      urlDerivedIntent,
      existingTitle,
      existingContent,
      existingExcerpt,
      existingPost,
      resolved,
      wordPressPosts,
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
      keywordHint: keywordHintForPipeline,
      focusCategories: focusCategoriesForPipeline,
      semTaskContext,
      skipGscStubFile: true,
    });

  } catch (error) {
    handleOptimizationError(
      error,
      site.id,
      setIsOptimizingContent,
      setOptimizationProgress,
      setIsAnalyzingClusters
    );
    throw error;
  }
}
