import { loadApiKey } from "@/lib/api";
import type { KeywordAIAnalysis, KeywordData } from "@/lib/keyword-types";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { type WordPressSite } from "@/components/integrations/types";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import {
  updateOptimizationProgress,
  patchOptimizationProgress,
  mergeHarnessProgressSiteAndBatch,
  saveKeywordResearch,
  saveSeoResearchArtifact,
} from "./optimization-helpers";
import { EXTRA_TEXT_HARNESS_TOTAL_SECTIONS } from "@/lib/content-generation/page-extra-content-generator-prompts";
import { createSiteCache, seedSiteCacheFromLinkablePosts } from "@/lib/wordpress-site-cache";
import { buildWordPressPostsForLinkingFromInventory } from "@/lib/content-generation/extra-text-inventory-links";
import { getBulkOptimizerInventoryFromSession } from "./bulk-optimization-load-inventory-snapshot";
import { snapshotHasInventoryEntries } from "@/lib/wordpress-api/inventory-match";
import { performKeywordResearchFlow, autoSelectOptimizationItems, updateKeywordResearchFile } from "./keyword-research-flow";
import { performAIAnalysis } from "@/lib/content-optimization/keyword-research";
import { generateBlueprintFlow, generateAndUploadFlow } from "./blueprint-content-flow";
import type { PendingOptimization } from "./use-optimization-state";
import { updateBulkStateWithEntity } from "./continue-optimization-entity-helpers";

export type KeywordSource = "gsc" | "urlIntent" | "modifier" | "fallback" | "acfKeyword" | "manual";

export interface ContinueOptimizationTryBodyInput {
  siteId: string;
  site: WordPressSite;
  url: string;
  updateMode: "update" | "draft";
  gscResult: any;
  existingPost: any;
  resolved: any;
  existingTitle: string;
  existingContent: string;
  existingExcerpt: string;
  selectedKeyword: { query: string; clicks: number; impressions: number; ctr: number; position: number };
  clusterKeywords?: string[];
  testMode: boolean;
  secondaryKeywords?: string[];
  optimizationOptions: any;
  inContentImageRequest: any;
  acfFields: any;
  acfContext: any;
  pending: PendingOptimization;
  pendingCleanedTitle: string | undefined;
  promptMod: string;
  primaryKeywordInitial: string;
  keywordSource: KeywordSource;
  hasManualKeyword: boolean;
  useAcfKeyword: boolean;
  useSeoResearchBrief: boolean;
  isTitleMetaOnly: boolean;
  focusCategories: string[];
  finalOptimizationOptions: any;
  extractedEntity: string | "N/A";
  finalTitle: string;
  optimizationStartTime: number;
  fileManager: OptimizationFileManager;
  optimizationFileManagers: Record<string, OptimizationFileManager>;
  setOptimizationFileManagers: (prev: any) => any;
  setOptimizationProgress: (prev: any) => any;
  setPendingOptimization: (prev: any) => any;
  setBulkOptimizationState: (prev: any) => any;
}

export async function runContinueOptimizationTryBody(input: ContinueOptimizationTryBodyInput): Promise<void> {
  const {
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
    primaryKeywordInitial,
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
  } = input;

  let primaryKeyword = primaryKeywordInitial;

  const openRouterApiKey = loadApiKey();
  if (!openRouterApiKey || openRouterApiKey.trim().length === 0) {
    throw new Error("OpenRouter API key not found. Please set it in settings.");
  }

  let keywordData: KeywordData | null = null;
  let aiAnalysis: KeywordAIAnalysis | null = null;
  let paaResult: any = null;
  let paaRawResponse: any = null;
  let relatedKeywords: string[] = [];
  let selectedKeywords: string[] = [];
  let selectedH2Sections: string[] = [];
  let selectedPeopleAlsoAsk: any[] = [];
  let selectedResearchLinks: string[] = [];
  let finalPrimaryKeyword = primaryKeyword;
  let finalSelectedKeywords: string[] = [];

  const isSeoExtraTextOnly = finalOptimizationOptions?.seoExtraTextFieldOnly === true;

  if (isSeoExtraTextOnly) {
    setOptimizationProgress((prev: Record<string, unknown>) =>
      mergeHarnessProgressSiteAndBatch(prev, siteId, {
        step: "SEO extra text only",
        progress: 42,
        message: "Using ACF keyword; skipping full-page blueprint and meta.",
        harnessSections: [],
        harnessPlannedSectionCount: EXTRA_TEXT_HARNESS_TOTAL_SECTIONS,
      }),
    );
    keywordData = {
      keyword: String(primaryKeyword || "").trim(),
      searchVolume: 0,
      difficulty: 0,
      cpc: 0,
      competition: "LOW",
      intent: "informational",
      relatedKeywords: [],
      serpFeatures: [],
    } as KeywordData;
    aiAnalysis = {} as KeywordAIAnalysis;
    paaResult = { items: [] };
    paaRawResponse = null;
    relatedKeywords = [];
    selectedKeywords = [primaryKeyword];
    selectedH2Sections = [];
    selectedPeopleAlsoAsk = [];
    selectedResearchLinks = [];
    finalPrimaryKeyword = primaryKeyword;
    finalSelectedKeywords = [primaryKeyword];
    await updateBulkStateWithEntity(
      site,
      url,
      finalPrimaryKeyword,
      extractedEntity,
      finalTitle,
      setBulkOptimizationState,
    );

    if (useSeoResearchBrief) {
      saveSeoResearchArtifact(fileManager, finalPrimaryKeyword, String(acfContext?.seoResearch ?? ""));
    } else {
      saveKeywordResearch(fileManager, finalPrimaryKeyword, {
        primaryKeyword: finalPrimaryKeyword,
        gscMetrics: selectedKeyword,
        keywordData,
        aiAnalysis,
        peopleAlsoAsk: [],
        relatedGSCKeywords: [],
        selectedKeywords: finalSelectedKeywords,
        selectedH2Sections: [],
        selectedPeopleAlsoAsk: [],
        selectedResearchLinks: [],
      });
      updateKeywordResearchFile(
        fileManager,
        siteId,
        finalSelectedKeywords,
        [],
        [],
        [],
        setOptimizationFileManagers
      );
    }

    if (keywordData && keywordData.keyword !== finalPrimaryKeyword) {
      keywordData = { ...keywordData, keyword: finalPrimaryKeyword };
    }
  } else if (!isTitleMetaOnly) {
    const prefetchedDfs = (pending as {
      prefetchedDfs?: { keywordDataList: KeywordData[]; paaRawResponse: any; paaItems: string[]; primaryKeyword: string };
    }).prefetchedDfs;
    const onDfsComplete = (pending as { onDfsComplete?: () => void }).onDfsComplete;

    if (useSeoResearchBrief) {
      updateOptimizationProgress(
        setOptimizationProgress,
        siteId,
        "Using ACF seo_research...",
        42,
        "Skipping keyword-research pipeline; blueprint/content use the scraped brief."
      );
      keywordData = {
        keyword: String(primaryKeyword || "").trim(),
        searchVolume: 0,
        difficulty: 0,
        cpc: 0,
        competition: "LOW",
        intent: "informational",
        relatedKeywords: [],
        serpFeatures: [],
      };
      aiAnalysis = {} as KeywordAIAnalysis;
      paaResult = { items: [] };
      paaRawResponse = null;
      relatedKeywords = [];
      selectedKeywords = [primaryKeyword];
      selectedH2Sections = [];
      selectedPeopleAlsoAsk = [];
      selectedResearchLinks = [];
      finalPrimaryKeyword = primaryKeyword;
      finalSelectedKeywords = [primaryKeyword];
      await updateBulkStateWithEntity(
      site,
      url,
      finalPrimaryKeyword,
      extractedEntity,
      finalTitle,
      setBulkOptimizationState,
    );
      onDfsComplete?.();
    } else if (prefetchedDfs) {
      keywordData =
        prefetchedDfs.keywordDataList?.[0] ||
        ({
          keyword: prefetchedDfs.primaryKeyword,
          searchVolume: 0,
          difficulty: 0,
          cpc: 0,
          competition: "LOW",
          intent: "informational",
          relatedKeywords: [],
          serpFeatures: [],
        } as KeywordData);
      paaRawResponse = prefetchedDfs.paaRawResponse ?? null;
      const paaItems = Array.isArray(prefetchedDfs.paaItems) ? prefetchedDfs.paaItems : [];
      paaResult = {
        items: paaItems.map((q) => ({ question: q })),
        rawResponse: paaRawResponse,
        extractionLog: [] as string[],
      };
      relatedKeywords = [];
      if (useAcfKeyword) {
        aiAnalysis = {} as any;
        selectedKeywords = [primaryKeyword];
        selectedH2Sections = [];
        selectedPeopleAlsoAsk = paaItems;
        selectedResearchLinks = [];
        finalPrimaryKeyword = primaryKeyword;
        finalSelectedKeywords = [primaryKeyword];
        onDfsComplete?.();
      } else {
        updateOptimizationProgress(setOptimizationProgress, siteId, "Using prefetched research...", 45, "Running AI analysis...");
        aiAnalysis = await performAIAnalysis(
          keywordData,
          site,
          paaRawResponse,
          (progress) => patchOptimizationProgress(setOptimizationProgress, siteId, progress),
          [],
          getResearchModel(siteId)
        );
        onDfsComplete?.();
      }
    } else {
      const shouldSkipKeywordApi = true;

      const researchResult = await performKeywordResearchFlow(
        primaryKeyword,
        selectedKeyword,
        gscResult,
        clusterKeywords,
        site,
        siteId,
        testMode,
        setOptimizationProgress,
        shouldSkipKeywordApi
      );
      keywordData = researchResult.keywordData;
      aiAnalysis = researchResult.aiAnalysis;
      paaResult = researchResult.paaResult;
      paaRawResponse = researchResult.paaRawResponse;
      relatedKeywords = researchResult.relatedKeywords || [];
      onDfsComplete?.();
    }

    if (!useSeoResearchBrief && !(useAcfKeyword && prefetchedDfs)) {
      const selectionResult = await autoSelectOptimizationItems(
        aiAnalysis,
        keywordData,
        primaryKeyword,
        clusterKeywords,
        testMode
      );
      selectedKeywords = selectionResult.selectedKeywords;
      selectedH2Sections = selectionResult.selectedH2Sections;
      selectedPeopleAlsoAsk = selectionResult.selectedPeopleAlsoAsk;
      selectedResearchLinks = selectionResult.selectedResearchLinks;
      finalPrimaryKeyword = primaryKeyword;

      await updateBulkStateWithEntity(
      site,
      url,
      finalPrimaryKeyword,
      extractedEntity,
      finalTitle,
      setBulkOptimizationState,
    );

      finalSelectedKeywords =
        secondaryKeywords && secondaryKeywords.length > 0
          ? [...new Set([...selectedKeywords, ...secondaryKeywords])]
          : selectedKeywords;
    } else if (!useSeoResearchBrief) {
      await updateBulkStateWithEntity(
      site,
      url,
      finalPrimaryKeyword,
      extractedEntity,
      finalTitle,
      setBulkOptimizationState,
    );
      finalSelectedKeywords = [finalPrimaryKeyword];
    }

    if (useSeoResearchBrief) {
      saveSeoResearchArtifact(fileManager, finalPrimaryKeyword, String(acfContext?.seoResearch ?? ""));
    } else {
      saveKeywordResearch(fileManager, finalPrimaryKeyword, {
        primaryKeyword: finalPrimaryKeyword,
        gscMetrics: selectedKeyword,
        keywordData,
        aiAnalysis,
        peopleAlsoAsk: paaResult.items || [],
        relatedGSCKeywords: relatedKeywords || [],
        selectedKeywords: finalSelectedKeywords,
        selectedH2Sections,
        selectedPeopleAlsoAsk,
        selectedResearchLinks,
      });

      updateKeywordResearchFile(
        fileManager,
        siteId,
        finalSelectedKeywords,
        selectedH2Sections,
        selectedPeopleAlsoAsk,
        selectedResearchLinks,
        setOptimizationFileManagers
      );
    }

    if (keywordData && keywordData.keyword !== finalPrimaryKeyword) {
      keywordData = { ...keywordData, keyword: finalPrimaryKeyword };
    }
  } else {
    console.log("[Continue Optimization] Title/meta only - skipping keyword research and blueprint generation");
    updateOptimizationProgress(
      setOptimizationProgress,
      siteId,
      "Optimizing title and meta only...",
      50,
      `Focus: ${focusCategories?.join(", ") || "title & meta"}`
    );
  }

  let wordPressPosts: Array<{
    id: number;
    slug: string;
    title: string;
    excerpt: string;
    link: string;
    date_gmt: string;
  }> = [];
  let wordPressRAGContext = "";
  let wordPressPagesForOfferTable: typeof wordPressPosts = pending.wordPressPagesForOfferTable ?? [];

  if (pending.wordPressPosts && pending.wordPressPosts.length > 0) {
    console.log(`[Continue Optimization] Using ${pending.wordPressPosts.length} provided WordPress posts`);
    wordPressPosts = pending.wordPressPosts;
  } else if (site.username && site.appPassword) {
    const inv = getBulkOptimizerInventoryFromSession(site);
    if (inv && snapshotHasInventoryEntries(inv)) {
      wordPressPosts = buildWordPressPostsForLinkingFromInventory(inv, site.siteUrl);
      if (wordPressPosts.length > 0) {
        seedSiteCacheFromLinkablePosts(site, wordPressPosts);
      }
      console.log(
        `[Continue Optimization] Using sheet inventory: ${wordPressPosts.length} linkable URLs (no WordPress scrape)`,
      );
    } else {
      updateOptimizationProgress(setOptimizationProgress, siteId, "Fetching WordPress posts...", 55, "Loading posts from site cache...");
      const cache = await createSiteCache(site, undefined, (msg, pct) =>
        updateOptimizationProgress(setOptimizationProgress, siteId, msg, pct ?? 55),
      );
      wordPressPosts = cache.posts;
      console.log(`[Continue Optimization] Using site cache: ${wordPressPosts.length} linkable URLs (posts + pages + entities)`);
    }
  }

  if (wordPressPosts.length > 0) {
    console.log(
      `[Continue Optimization] Using ${wordPressPosts.length} linkable URLs from site cache (no HTTP link validation)`
    );
  }

  wordPressRAGContext = "";

  let blueprintResult: any = null;

  if (!isTitleMetaOnly && !isSeoExtraTextOnly) {
    const titleForBlueprint = pendingCleanedTitle || finalTitle || existingTitle;
    const blueprintFlowResult = await generateBlueprintFlow(
      finalSelectedKeywords,
      selectedH2Sections,
      selectedPeopleAlsoAsk,
      selectedResearchLinks,
      titleForBlueprint,
      finalPrimaryKeyword,
      keywordData!,
      paaRawResponse,
      site,
      fileManager,
      siteId,
      wordPressPosts,
      wordPressPagesForOfferTable.length ? wordPressPagesForOfferTable : undefined,
      url,
      existingPost,
      optimizationOptions?.hasEntity,
      testMode,
      setOptimizationProgress,
      undefined,
      existingContent,
    );
    blueprintResult = blueprintFlowResult.blueprintResult;
  } else if (isSeoExtraTextOnly) {
    blueprintResult = {
      title: existingTitle,
      primaryKeyword: finalPrimaryKeyword,
      sections: [],
    };
    console.log("[Continue Optimization] Skipping blueprint (SEO extra text field only).");
  } else {
    let optimizedTitle = existingTitle;
    if (finalOptimizationOptions?.optimizeTitle === true) {
      console.log("[Continue Optimization] Generating optimized title (blueprint skipped)...");
      const { generateOptimizedTitle } = await import("@/lib/title-optimizer");
      const entity = pending.extractedEntity || (pending.acfContext?.origin ?? pending.acfFields?.origin ?? undefined);
      optimizedTitle = await generateOptimizedTitle(existingTitle, finalPrimaryKeyword, siteId, entity);

      console.log("[Continue Optimization] Generated optimized title:", {
        original: existingTitle,
        optimized: optimizedTitle,
        changed: optimizedTitle !== existingTitle,
      });
    }

    blueprintResult = {
      title: optimizedTitle,
      primaryKeyword: finalPrimaryKeyword,
      sections: [],
    };
    console.log("[Continue Optimization] Skipping blueprint generation for title/meta-only optimization");
  }

  setOptimizationFileManagers((prev: any) => ({ ...prev, [siteId]: fileManager }));

  const gscKeywordsContext = undefined;
  const semrushKeywordsContext = undefined;
  const semrushScatterContext = undefined;

  const { changes } = await generateAndUploadFlow(
    blueprintResult,
    existingTitle,
    finalPrimaryKeyword,
    site,
    url,
    updateMode,
    existingPost,
    resolved,
    existingContent,
    existingExcerpt,
    selectedKeyword,
    clusterKeywords,
    wordPressPosts,
    wordPressPagesForOfferTable.length ? wordPressPagesForOfferTable : undefined,
    wordPressRAGContext,
    gscKeywordsContext,
    semrushKeywordsContext,
    semrushScatterContext,
    undefined,
    selectedPeopleAlsoAsk,
    finalOptimizationOptions,
    inContentImageRequest,
    acfFields,
    acfContext,
    pending.acfFullPostSnapshot,
    fileManager,
    siteId,
    setOptimizationProgress,
    setBulkOptimizationState
  );

  if (changes) {
    setPendingOptimization((prev: any) => {
      const pend = prev[siteId];
      if (pend) {
        return {
          ...prev,
          [siteId]: {
            ...pend,
            optimizationChanges: changes,
            url: url,
          },
        };
      }
      return prev;
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  setPendingOptimization((prev: any) => {
    const updated = { ...prev };
    delete updated[siteId];
    return updated;
  });

  setOptimizationFileManagers((prev: any) => ({ ...prev }));

  const finalFileManager = optimizationFileManagers[siteId] || fileManager;
  const fileCount = finalFileManager.getFileCount();
  const totalOptimizationTime = Math.floor((Date.now() - optimizationStartTime) / 1000);
  const minutes = Math.floor(totalOptimizationTime / 60);
  const seconds = totalOptimizationTime % 60;
  const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  updateOptimizationProgress(
    setOptimizationProgress,
    siteId,
    "Complete",
    100,
    `Optimization complete in ${timeString}. ${fileCount} files generated. Click "Download All" below.`
  );
}
