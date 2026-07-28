import { notify } from "@/lib/app-notifications";
import { NOTIFY_USING_TEST_BLUEPRINT_DATA } from "@/lib/notify-messages";
import type { KeywordData } from "@/lib/keyword-types";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { type WordPressSite } from "@/components/integrations/types";
import { generateOptimizedBlueprint, generateAndUploadContent } from "@/lib/content-optimization-helpers";
import { updateOptimizationProgress, patchOptimizationProgress } from "./optimization-helpers";
import type { AIDrivenACFContext } from "@/lib/content-generation/ai-driven-acf-reader";
import type { SemrushClusterScatterPlan } from "@/lib/semrush-cluster-scatter";

export async function generateBlueprintFlow(
  selectedKeywords: string[],
  selectedH2Sections: string[],
  selectedPeopleAlsoAsk: string[],
  selectedResearchLinks: string[],
  titleForBlueprint: string,
  primaryKeyword: string,
  keywordData: KeywordData,
  paaRawResponse: any,
  site: WordPressSite,
  fileManager: OptimizationFileManager,
  siteId: string,
  wordPressPosts: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>,
  wordPressPagesForOfferTable: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }> | undefined,
  url: string,
  existingPost: any,
  hasEntityOverride: boolean | undefined,
  testMode: boolean,
  setOptimizationProgress: (prev: any) => any,
  semrushForBlueprint?: {
    keywordsRag?: string;
    clusterScatter?: SemrushClusterScatterPlan;
    externalUrls?: string[];
    anchorPhrases?: string[];
  },
  existingContent?: string,
): Promise<{ blueprintResult: any; checklist: string[] }> {
  if (testMode) {
    notify.info(NOTIFY_USING_TEST_BLUEPRINT_DATA);
    const { createMockBlueprint } = await import('@/lib/content-optimization-helpers');
    const blueprintResult = createMockBlueprint(primaryKeyword, titleForBlueprint);
    const checklist = [
      `Introduction to ${primaryKeyword}`,
      `Benefits of ${primaryKeyword}`,
      `How to Choose the Right ${primaryKeyword} Provider`
    ];

    const blueprintFileName = OptimizationFileManager.generateFilename('blueprint', primaryKeyword, 'json');
    fileManager.addFile(blueprintFileName, JSON.stringify(blueprintResult, null, 2), 'application/json');

    const checklistFileName = OptimizationFileManager.generateFilename('checklist', primaryKeyword, 'txt');
    fileManager.addFile(checklistFileName, checklist.map((item, index) => `${index + 1}. ${item}`).join('\n'), 'text/plain');

    updateOptimizationProgress(setOptimizationProgress, siteId, 'TEST MODE: Using mock blueprint...', 75, 'Skipping blueprint generation');
    return { blueprintResult, checklist };
  }

  const blueprintResultData = await generateOptimizedBlueprint(
    selectedKeywords,
    selectedH2Sections,
    selectedPeopleAlsoAsk,
    selectedResearchLinks,
    titleForBlueprint,
    primaryKeyword,
    keywordData,
    paaRawResponse,
    site,
    fileManager,
    (progress) => patchOptimizationProgress(setOptimizationProgress, siteId, progress),
    wordPressPosts,
    wordPressPagesForOfferTable,
    url,
    existingPost,
    hasEntityOverride,
    semrushForBlueprint,
    existingContent,
  );

  return {
    blueprintResult: blueprintResultData.blueprintResult,
    checklist: blueprintResultData.checklist
  };
}

export async function generateAndUploadFlow(
  blueprintResult: any,
  existingTitle: string,
  primaryKeyword: string,
  site: WordPressSite,
  url: string,
  updateMode: 'update' | 'draft',
  existingPost: any,
  resolved: any,
  existingContent: string,
  existingExcerpt: string,
  selectedKeyword: any,
  clusterKeywords: string[] | undefined,
  wordPressPosts: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>,
  wordPressPagesForOfferTable: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }> | undefined,
  wordPressRAGContext: string,
  /** Top GSC queries JSON for SEO field inspiration (aligned with Overview export). */
  gscKeywordsContext: string | undefined,
  /** Semrush keyword lists JSON for content RAG (bulk content run). */
  semrushKeywordsContext: string | undefined,
  /** Semrush cluster + zone scatter JSON for content (bulk content run). */
  semrushScatterContext: string | undefined,
  /** Semrush-approved external URLs - kept in HTML at upload; prompt allowlist. */
  semrushExternalUrls: string[] | undefined,
  selectedPeopleAlsoAsk: any[],
  optimizationOptions: any,
  inContentImageRequest: any,
  acfFields: Record<string, any> | undefined,
  acfContext?: AIDrivenACFContext,
  acfFullPostSnapshot?: Record<string, unknown>,
  fileManager: OptimizationFileManager,
  siteId: string,
  setOptimizationProgress: (prev: any) => any,
  setBulkOptimizationState: (prev: any) => any
): Promise<{ excerpt: string | undefined; changes?: { titleChanged?: boolean; metaChanged?: boolean; contentChanged?: boolean; title?: string; meta?: string } }> {
  const defaultOptimizationOptions = {
    optimizeTitle: true,
    optimizeMeta: true,
    optimizeExcerpt: true,
    optimizeContent: true,
    optimizeFeaturedImage: false,
    optimizeExtraText: true,
    optimizeExtraImage: false
  };
  const mergedOptimizationOptions = optimizationOptions
    ? { ...defaultOptimizationOptions, ...optimizationOptions }
    : defaultOptimizationOptions;

  const optimizationContext = {
    site,
    url,
    updateMode,
    existingPost,
    resolved,
    existingTitle,
    existingContent,
    existingExcerpt,
    primaryKeyword,
    selectedKeyword,
    clusterKeywords,
    wordPressPosts,
    wordPressPagesForOfferTable,
    wordPressRAGContext,
    gscKeywordsContext,
    semrushKeywordsContext,
    semrushScatterContext,
    semrushExternalUrls,
    optimizationOptions: mergedOptimizationOptions,
    inContentImageRequest: inContentImageRequest ? { imageType: inContentImageRequest.imageType as any, userPrompt: inContentImageRequest.userPrompt } : undefined,
    selectedPeopleAlsoAsk,
    acfFullPostSnapshot,
  };

  const { result, markdownContent, excerpt, changes } = await generateAndUploadContent(
    blueprintResult,
    existingTitle,
    primaryKeyword,
    site,
    optimizationContext,
    fileManager,
    (progress) => patchOptimizationProgress(setOptimizationProgress, siteId, progress),
    undefined,
    mergedOptimizationOptions,
    acfFields,
    acfContext,
    setOptimizationProgress,
  );

  const batchKey = `${site.id}-batch`;
  // Content-only module: meta/excerpt values are intentionally not persisted in bulk state.

  return { excerpt, changes };
}
