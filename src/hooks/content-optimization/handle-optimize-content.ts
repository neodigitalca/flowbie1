import { notify } from "@/lib/app-notifications";
import {
  NOTIFY_FAILED_TO_INITIALIZE_OPTIMIZATION_PLEASE,
  NOTIFY_IMAGE_GENERATION_DISABLED_PER_PROMPT_MOD,
  NOTIFY_IMAGE_GENERATION_ENABLED_PER_PROMPT_MODI,
  NOTIFY_PLEASE_ENTER_A_URL_TO_OPTIMIZE,
  notifyUsingAcfKeywordFocusX,
} from "@/lib/notify-messages";
import { getMuteOptimizationToasts } from "./optimization-toast-mute";
import { loadApiKey } from "@/lib/api";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import {
  updateOptimizationProgress,
  setOptimizingState,
  handleOptimizationError,
  savePostData,
  patchOptimizationProgress,
} from "./optimization-helpers";
import type { PendingOptimization } from "./use-optimization-state";
import { getFieldsForPost } from "@/lib/wordpress-api/fields-client";
import { mergeSeoResearchFromAcfIntoContext } from "@/lib/content-generation/ai-driven-acf-reader";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { interpretPromptModifier } from "@/lib/prompt-modifier-interpreter";
import { type HandleOptimizeContentParams } from "./handle-optimize-content-params";
import { loadHandleOptimizePostAndIntent } from "./handle-optimize-content-post-load";
import { hasSubstantiveSeoResearch } from "./bulk-optimization-missing-seo-research";
import { fetchGSCPagePerformance } from "@/lib/wordpress-api/gsc";
import { gscResultFromPagePerformance } from "./bulk-optimization-prefetch-page-gsc";
import { DEATH_STAR_NO_GSC } from "./bulk-optimization-constants";

export type HandleOptimizeContentResult = { optimizationChanges: Record<string, unknown> } | void | undefined;

function requireAcfKeyword(acfFields: Record<string, unknown>, url: string): string {
  const kw = String(acfFields.keyword_focus ?? "").trim();
  if (!kw) {
    throw new Error(`ACF keyword_focus is required for ${url}. Set it in WordPress before optimizing.`);
  }
  return kw;
}

function requireSeoResearch(acfFields: Record<string, unknown>, url: string): void {
  if (!hasSubstantiveSeoResearch(acfFields)) {
    throw new Error(`ACF seo_research is required for ${url}. Run bulk prep or fill the field in WordPress.`);
  }
}

export async function handleOptimizeContent(params: HandleOptimizeContentParams): Promise<HandleOptimizeContentResult> {
  const {
    site,
    url,
    wordPressPosts = [],
    updateMode,
    optimizationOptions,
    inContentImageRequest: initialInContentImageRequest,
    resolvedPost,
    setIsOptimizingContent,
    setOptimizationProgress,
    setOptimizationFileManagers,
    setPendingOptimization,
    continueOptimizationRef,
    setGscPerformancePreview,
  } = params;

  let inContentImageRequest = initialInContentImageRequest;

  if (!url?.trim()) {
    if (!getMuteOptimizationToasts()) notify.error(NOTIFY_PLEASE_ENTER_A_URL_TO_OPTIMIZE);
    return;
  }

  try {
    setOptimizingState(setIsOptimizingContent, site.id, true);
    setGscPerformancePreview?.((prev) => ({
      ...prev,
      [site.id]: { ...(prev[site.id] || {}), [url]: null },
    }));
    updateOptimizationProgress(setOptimizationProgress, site.id, "load", 0, "Loading page and ACF…");
    patchOptimizationProgress(setOptimizationProgress, site.id, { pageUrl: url.trim() });
  } catch (stateError) {
    console.error("[Optimize Content] Error setting initial state:", stateError);
    if (!getMuteOptimizationToasts()) notify.error(NOTIFY_FAILED_TO_INITIALIZE_OPTIMIZATION_PLEASE);
    return;
  }

  try {
    const openRouterApiKey = loadApiKey();
    if (!openRouterApiKey?.trim()) {
      throw new Error("OpenRouter API key not found. Please set it in settings.");
    }

    const researchModel = getResearchModel(site.id);
    const fileManager = new OptimizationFileManager();
    setOptimizationFileManagers((prev: Record<string, OptimizationFileManager>) => ({
      ...prev,
      [site.id]: fileManager,
    }));

    const { resolved, existingPost, existingTitle, existingContent, existingExcerpt, acfPrefetch } =
      await loadHandleOptimizePostAndIntent({
        site,
        url,
        resolvedPost,
        optimizationOptions,
        setOptimizationProgress,
        researchModel,
        openRouterApiKey,
      });

    if (!resolved?.id) {
      throw new Error(`No WordPress post id for ${url}. Load sitemap inventory in Content Optimizer, then retry.`);
    }

    savePostData(fileManager, existingPost, existingPost.id?.toString() || "post");

    updateOptimizationProgress(setOptimizationProgress, site.id, "load", 0.35, "Reading ACF fields…");

    let acfFields: Record<string, unknown> = {};
    if (acfPrefetch?.fields) {
      acfFields = acfPrefetch.fields;
    } else {
      const postTypeEndpoint =
        resolved.endpoint || (resolved.subtype === "post" ? "posts" : resolved.subtype) || "posts";
      const acfResult = await getFieldsForPost(site, resolved.id, resolved.subtype || "post", postTypeEndpoint);
      if (!acfResult.success || !acfResult.fields) {
        throw new Error(acfResult.error || `Failed to read ACF for ${url}`);
      }
      acfFields = acfResult.fields;
    }

    const acfKeyword = requireAcfKeyword(acfFields, url);
    requireSeoResearch(acfFields, url);

    let acfContext = mergeSeoResearchFromAcfIntoContext(acfFields, {
      keywordFocus: acfKeyword,
    });

    const promptModifierKey = Object.keys(acfFields).find((k) =>
      /prompt_modifier|prompt_mod|seo_prompt_modifier/i.test(k),
    );
    const promptModifier = promptModifierKey ? String(acfFields[promptModifierKey] ?? "").trim() : "";

    if (promptModifier) {
      updateOptimizationProgress(setOptimizationProgress, site.id, "load", 0.7, "Reading prompt modifier…");
      const interpretedModifier = await interpretPromptModifier(promptModifier, site.id);
      if (interpretedModifier?.shouldAddImages && !inContentImageRequest) {
        inContentImageRequest = { imageType: "infographic", userPrompt: "" };
        if (!getMuteOptimizationToasts()) notify.info(NOTIFY_IMAGE_GENERATION_ENABLED_PER_PROMPT_MODI);
      }
      if (interpretedModifier?.shouldSkipImages) {
        inContentImageRequest = undefined;
        if (optimizationOptions) optimizationOptions.optimizeFeaturedImage = false;
        if (!getMuteOptimizationToasts()) notify.info(NOTIFY_IMAGE_GENERATION_DISABLED_PER_PROMPT_MOD);
      }
    }

    updateOptimizationProgress(setOptimizationProgress, site.id, "load", 1, `Keyword: "${acfKeyword}"`);

    if (!getMuteOptimizationToasts()) {
      notify.info(notifyUsingAcfKeywordFocusX(acfKeyword), { duration: 3000 });
    }

    const mockKeyword = {
      query: acfKeyword,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    };

    let gscResult: typeof DEATH_STAR_NO_GSC | ReturnType<typeof gscResultFromPagePerformance> = DEATH_STAR_NO_GSC;
    try {
      const pagePerf = await fetchGSCPagePerformance(site.siteUrl, url);
      gscResult = gscResultFromPagePerformance(pagePerf);
    } catch (error) {
      console.warn("[Optimize Content] Page GSC prefetch failed:", error);
    }

    const pendingEntry: PendingOptimization = {
      site,
      url,
      updateMode,
      gscResult,
      existingPost,
      resolved,
      existingTitle,
      existingContent,
      existingExcerpt,
      wordPressPosts,
      optimizationOptions: {
        ...optimizationOptions,
        useAcfKeyword: true,
        optimizeContent: true,
        optimizeMeta: true,
        optimizeExtraText: true,
      },
      inContentImageRequest,
      acfFields,
      acfContext,
    };

    setPendingOptimization((prev: Record<string, PendingOptimization>) => ({
      ...prev,
      [site.id]: pendingEntry,
    }));

    updateOptimizationProgress(setOptimizationProgress, site.id, "plan", 0, "Starting plan…");

    if (!continueOptimizationRef.current) {
      throw new Error("Optimization handler is not ready.");
    }

    await continueOptimizationRef.current(
      site.id,
      mockKeyword,
      [],
      undefined,
      false,
      undefined,
      pendingEntry,
    );
  } catch (error) {
    handleOptimizationError(error, site.id, setIsOptimizingContent, setOptimizationProgress);
    throw error;
  }
}
