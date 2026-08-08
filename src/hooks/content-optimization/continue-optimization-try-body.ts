import { loadApiKey } from "@/lib/api";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { type WordPressSite } from "@/components/integrations/types";
import {
  updateOptimizationProgress,
  bindRunProgressReporter,
  saveKeywordResearch,
} from "./optimization-helpers";
import { createSiteCache, seedSiteCacheFromLinkablePosts } from "@/lib/wordpress-site-cache";
import { buildWordPressPostsForLinkingFromInventory } from "@/lib/content-generation/extra-text-inventory-links";
import { getBulkOptimizerInventoryFromSession } from "./bulk-optimization-load-inventory-snapshot";
import { snapshotHasInventoryEntries } from "@/lib/wordpress-api/inventory-match";
import { autoSelectOptimizationItems, performKeywordResearchFlow, updateKeywordResearchFile } from "./keyword-research-flow";
import { generateBlueprintFlow, generateAndUploadFlow } from "./blueprint-content-flow";
import type { PendingOptimization } from "./use-optimization-state";
import { getSeoResearchFromAcf } from "@/lib/content-generation/ai-driven-acf-reader";

export interface ContinueOptimizationTryBodyInput {
  siteId: string;
  site: WordPressSite;
  url: string;
  updateMode: "update" | "draft";
  gscResult: unknown;
  existingPost: unknown;
  resolved: unknown;
  existingTitle: string;
  existingContent: string;
  existingExcerpt: string;
  selectedKeyword: { query: string; clicks: number; impressions: number; ctr: number; position: number };
  clusterKeywords?: string[];
  secondaryKeywords?: string[];
  optimizationOptions: Record<string, unknown>;
  inContentImageRequest: unknown;
  acfFields: Record<string, unknown>;
  acfContext: unknown;
  pending: PendingOptimization;
  pendingCleanedTitle: string | undefined;
  primaryKeyword: string;
  finalOptimizationOptions: Record<string, unknown>;
  extractedEntity: string | "N/A";
  finalTitle: string;
  optimizationStartTime: number;
  fileManager: OptimizationFileManager;
  optimizationFileManagers: Record<string, OptimizationFileManager>;
  setOptimizationFileManagers: (prev: unknown) => unknown;
  setOptimizationProgress: (prev: unknown) => unknown;
  setPendingOptimization: (prev: unknown) => unknown;
  setBulkOptimizationState: (prev: unknown) => unknown;
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
    secondaryKeywords,
    optimizationOptions,
    inContentImageRequest,
    acfFields,
    acfContext,
    pending,
    pendingCleanedTitle,
    primaryKeyword,
    finalOptimizationOptions,
    optimizationStartTime,
    fileManager,
    optimizationFileManagers,
    setOptimizationFileManagers,
    setOptimizationProgress,
    setPendingOptimization,
    setBulkOptimizationState,
    finalTitle,
  } = input;

  const openRouterApiKey = loadApiKey();
  if (!openRouterApiKey?.trim()) {
    throw new Error("OpenRouter API key not found. Please set it in settings.");
  }

  const report = bindRunProgressReporter(setOptimizationProgress, siteId);

  updateOptimizationProgress(setOptimizationProgress, siteId, "plan", 0.1, "Researching keyword…");

  const seoResearchBrief =
    getSeoResearchFromAcf(acfFields).trim() ||
    String((acfContext as { seoResearch?: string } | undefined)?.seoResearch ?? "").trim();

  const {
    keywordData,
    aiAnalysis,
    paaRawResponse,
    relatedKeywords,
  } = await performKeywordResearchFlow(
    primaryKeyword,
    selectedKeyword,
    gscResult,
    clusterKeywords,
    site,
    siteId,
    false,
    setOptimizationProgress,
    false,
    seoResearchBrief,
  );

  const selectedKeywords = [primaryKeyword];
  const finalSelectedKeywords =
    secondaryKeywords?.length
      ? [...new Set([...selectedKeywords, ...secondaryKeywords, ...relatedKeywords])]
      : [...new Set([...selectedKeywords, ...relatedKeywords])];

  saveKeywordResearch(fileManager, primaryKeyword, {
    primaryKeyword,
    gscMetrics: selectedKeyword,
    keywordData,
    aiAnalysis,
    peopleAlsoAsk: aiAnalysis.peopleAlsoAsk ?? [],
    relatedGSCKeywords: relatedKeywords,
    selectedKeywords: finalSelectedKeywords,
    selectedH2Sections: [],
    selectedPeopleAlsoAsk: [],
    selectedResearchLinks: [],
  });

  updateOptimizationProgress(setOptimizationProgress, siteId, "plan", 0.35, "Selecting optimization items…");
  const selectionResult = await autoSelectOptimizationItems(aiAnalysis, keywordData, primaryKeyword, clusterKeywords, false);
  const finalH2 = selectionResult.selectedH2Sections;
  const finalPaa = selectionResult.selectedPeopleAlsoAsk;
  const finalLinks = selectionResult.selectedResearchLinks;
  const finalKwList = selectionResult.selectedKeywords.length ? selectionResult.selectedKeywords : finalSelectedKeywords;

  updateKeywordResearchFile(
    fileManager,
    siteId,
    finalKwList,
    finalH2,
    finalPaa,
    finalLinks,
    setOptimizationFileManagers,
  );

  let wordPressPosts: Array<{
    id: number;
    slug: string;
    title: string;
    excerpt: string;
    link: string;
    date_gmt: string;
  }> = [];
  const wordPressPagesForOfferTable = pending.wordPressPagesForOfferTable ?? [];

  if (pending.wordPressPosts?.length) {
    wordPressPosts = pending.wordPressPosts;
  } else if (site.username && site.appPassword) {
    const inv = getBulkOptimizerInventoryFromSession(site);
    if (inv && snapshotHasInventoryEntries(inv)) {
      wordPressPosts = buildWordPressPostsForLinkingFromInventory(inv, site.siteUrl);
      if (wordPressPosts.length > 0) seedSiteCacheFromLinkablePosts(site, wordPressPosts);
    } else {
      updateOptimizationProgress(setOptimizationProgress, siteId, "plan", 0.5, "Loading link pool…");
      const cache = await createSiteCache(site, undefined, (msg) => {
        updateOptimizationProgress(setOptimizationProgress, siteId, "plan", 0.55, msg);
      });
      wordPressPosts = cache.posts;
    }
  }

  updateOptimizationProgress(setOptimizationProgress, siteId, "plan", 0.65, "Building blueprint…");

  const titleForBlueprint = pendingCleanedTitle || finalTitle || existingTitle;
  const { blueprintResult } = await generateBlueprintFlow(
    finalKwList,
    finalH2,
    finalPaa,
    finalLinks,
    titleForBlueprint,
    primaryKeyword,
    keywordData,
    paaRawResponse,
    site,
    fileManager,
    siteId,
    wordPressPosts,
    wordPressPagesForOfferTable.length ? wordPressPagesForOfferTable : undefined,
    url,
    existingPost,
    optimizationOptions?.hasEntity as boolean | undefined,
    false,
    setOptimizationProgress,
    undefined,
    existingContent,
  );

  setOptimizationFileManagers((prev: Record<string, OptimizationFileManager>) => ({ ...prev, [siteId]: fileManager }));

  updateOptimizationProgress(setOptimizationProgress, siteId, "write", 0, "Generating content and meta…");

  const { changes } = await generateAndUploadFlow(
    blueprintResult,
    existingTitle,
    primaryKeyword,
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
    "",
    undefined,
    undefined,
    undefined,
    undefined,
    finalPaa,
    finalOptimizationOptions,
    inContentImageRequest,
    acfFields,
    acfContext,
    pending.acfFullPostSnapshot,
    fileManager,
    siteId,
    setOptimizationProgress,
    setBulkOptimizationState,
    report,
  );

  if (changes) {
    setPendingOptimization((prev: Record<string, PendingOptimization>) => {
      const pend = prev[siteId];
      if (!pend) return prev;
      return {
        ...prev,
        [siteId]: { ...pend, optimizationChanges: changes, url },
      };
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  setPendingOptimization((prev: Record<string, PendingOptimization>) => {
    const updated = { ...prev };
    delete updated[siteId];
    return updated;
  });

  setOptimizationFileManagers((prev: Record<string, OptimizationFileManager>) => ({ ...prev }));

  const finalFileManager = optimizationFileManagers[siteId] || fileManager;
  const fileCount = finalFileManager.getFileCount();
  const totalOptimizationTime = Math.floor((Date.now() - optimizationStartTime) / 1000);
  const minutes = Math.floor(totalOptimizationTime / 60);
  const seconds = totalOptimizationTime % 60;
  const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  updateOptimizationProgress(
    setOptimizationProgress,
    siteId,
    "done",
    1,
    `Optimization complete in ${timeString}. ${fileCount} files generated.`,
  );
}
