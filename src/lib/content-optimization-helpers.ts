// Re-exports from split modules (all sub-500 lines). Do not add logic here.
export { extractGeographicEntityWithAI } from "@/lib/content-optimization/entity";
export { cleanTitleForNonEntity, cleanTitleForNonEntityAsync } from "@/lib/content-optimization/title-cleaning";
export {
  removeCompanyNameFromKeyword,
  generateLocalKeywordForEntityPage,
  generateLocalKeywordsForEntityPagesBatch,
  selectBestKeywordForEntityPage,
} from "@/lib/content-optimization/keyword-entity";
export type { EntityKeywordBatchItem } from "@/lib/content-optimization/keyword-entity";
export {
  getAutoSelectHelpers,
  findRelatedGSCKeywords,
  type AutoSelectHelpers,
} from "@/lib/content-optimization/auto-select-gsc";
export {
  performKeywordResearch,
  performAIAnalysis,
  analyzeEntityWithAI,
  type KeywordSelection,
} from "@/lib/content-optimization/keyword-research";
export { generateOptimizedBlueprint } from "@/lib/content-optimization/blueprint";
export {
  createMockKeywordData,
  createMockAIAnalysis,
  createMockBlueprint,
} from "@/lib/content-optimization/mocks";
export {
  extractImagesFromContent,
  extractMediaFromContent,
  matchImagesToSections,
  matchMediaToSections,
  isValidImageUrl,
  isValidMediaUrl,
  isMediaAssetUrl,
} from "@/lib/content-optimization/images-extract";
export type { ExtractedMediaItem } from "@/lib/content-optimization/images-extract";
export {
  extractH2Headings,
  insertImageIntoSection,
  insertMediaLinkIntoSection,
} from "@/lib/content-optimization/images-insert";

export { generateAndUploadContent } from "@/lib/content-generation-upload";
export { processGSCQueriesAndAnalyze } from "@/lib/gsc-query-processor";
export type { OptimizationContext } from "@/lib/content-generation-upload";
