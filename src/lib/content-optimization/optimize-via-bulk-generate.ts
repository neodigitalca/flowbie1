import { type WordPressSite } from "@/components/integrations/types";
import type { KeywordAIAnalysis, KeywordData } from "@/lib/keyword-types";
import { BulkFileManager } from "@/lib/bulk-file-manager";
import {
  generateBlueprintAndContent,
  type BulkHarnessSectionPayload,
  type BulkProcessingOptions,
} from "@/lib/bulk-auto-generate";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import {
  buildOptimizeSelectionsFromStoredBrief,
  type PageGscResultLike,
} from "@/lib/content-optimization/seo-research-brief-for-optimize";
import { updateOptimizationProgress } from "@/hooks/content-optimization/optimization-helpers";
import type { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { generateImplementationReport } from "@/lib/implementation-report-generator";
import { extractH2Titles } from "@/lib/content-optimization/optimize-output-verification";
import { resolveSapEntityForOptimize } from "@/hooks/content-optimization/continue-optimization-entity-helpers";

export type OptimizeViaBulkGenerateInput = {
  siteId: string;
  site: WordPressSite;
  url: string;
  updateMode: "update" | "draft";
  primaryKeyword: string;
  title: string;
  seoResearchRaw: string;
  entity?: string;
  origin?: string;
  metaDescription?: string;
  promptModifier?: string;
  keywordFocus?: string;
  selectedKeyword: { query: string; clicks: number; impressions: number; ctr: number; position: number };
  gscResult: PageGscResultLike | null | undefined;
  clusterKeywords?: string[];
  secondaryKeywords?: string[];
  existingPost: { id?: number; slug?: string; link?: string };
  existingTitle: string;
  existingContent: string;
  existingExcerpt: string;
  wordPressPosts: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>;
  wordPressPagesForOfferTable?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>;
  openRouterApiKey: string;
  isSapRun: boolean;
  optimizationOptions: Record<string, unknown>;
  fileManager: OptimizationFileManager;
  setOptimizationProgress: (prev: unknown) => unknown;
};

export type OptimizeViaBulkGenerateResult = {
  changes?: {
    titleChanged?: boolean;
    metaChanged?: boolean;
    contentChanged?: boolean;
    title?: string;
    meta?: string;
  };
};

/** Build a bulk CSV row from optimize inventory + stored research (no existing HTML). */
export function optimizeRowToCsvRow(args: {
  url: string;
  title: string;
  primaryKeyword: string;
  seoResearchRaw: string;
  entity?: string;
  origin?: string;
  metaDescription?: string;
  promptModifier?: string;
  keywordFocus?: string;
}): CSVRow {
  const entity = args.entity?.trim();
  const origin = args.origin?.trim() || (entity && entity !== "N/A" ? entity : undefined);
  return {
    keyword: args.primaryKeyword.trim(),
    keyword_focus: args.keywordFocus?.trim() || args.primaryKeyword.trim(),
    title: args.title.trim() || args.url,
    meta_description: args.metaDescription?.trim() || undefined,
    destination_url: args.url,
    seo_research: args.seoResearchRaw,
    entity: entity && entity !== "N/A" ? entity : undefined,
    origin,
    prompt_modifier: args.promptModifier?.trim() || undefined,
    sitemap_type: entity && entity !== "N/A" ? "entity" : undefined,
  };
}

function mergeBulkFilesIntoOptimization(
  bulkFileManager: BulkFileManager,
  optimizationFileManager: OptimizationFileManager,
): void {
  for (const file of bulkFileManager.getAllFiles()) {
    optimizationFileManager.addFile(file.fileName, file.content, file.mimeType);
  }
}

function findGeneratedMarkdown(files: ReturnType<BulkFileManager["getAllFiles"]>): string {
  const mdCandidates = files.filter(
    (f) => f.mimeType === "text/markdown" || f.fileName.toLowerCase().endsWith(".md"),
  );
  const contentMd = mdCandidates.find((f) => f.fileName.toLowerCase().includes("content"));
  return (contentMd ?? mdCandidates[mdCandidates.length - 1])?.content ?? "";
}

function optimizeProgressStep(message: string): "plan" | "write" {
  const lower = message.toLowerCase();
  if (
    lower.includes("harness")
    || lower.includes("markdown")
    || lower.includes("upload")
    || lower.includes("wordpress")
    || lower.includes("faq")
    || lower.includes("featured image")
  ) {
    return "write";
  }
  return "plan";
}

function findGeneratedBlueprint(
  files: ReturnType<BulkFileManager["getAllFiles"]>,
): { title?: string; agents?: unknown[] } | undefined {
  const blueprintFile = files.find((f) => f.fileName.toLowerCase().includes("blueprint"));
  if (!blueprintFile?.content?.trim()) return undefined;
  try {
    return JSON.parse(blueprintFile.content) as { title?: string; agents?: unknown[] };
  } catch {
    return undefined;
  }
}

export async function runOptimizeViaBulkGenerate(
  input: OptimizeViaBulkGenerateInput,
): Promise<OptimizeViaBulkGenerateResult> {
  const postId = Number(input.existingPost.id);
  if (!Number.isFinite(postId) || postId <= 0) {
    throw new Error("Missing WordPress post ID for optimize upload");
  }
  if (!input.seoResearchRaw.trim()) {
    throw new Error("Stored SEO research brief is required before optimize generate");
  }

  const sapEntity = input.isSapRun
    ? (
      input.entity?.trim() && input.entity !== "N/A"
        ? input.entity.trim()
        : resolveSapEntityForOptimize({
          site: input.site,
          url: input.url,
          title: input.title || input.existingTitle,
          keyword: input.primaryKeyword,
          acfContext: input.origin ? { origin: input.origin } : undefined,
        })
    )
    : undefined;

  const {
    keywordData,
    aiAnalysis,
    paaRawResponse,
  } = buildOptimizeSelectionsFromStoredBrief({
    primaryKeyword: input.primaryKeyword,
    selectedKeyword: input.selectedKeyword,
    gscResult: input.gscResult,
    seoResearchBrief: input.seoResearchRaw,
    clusterKeywords: input.clusterKeywords,
    secondaryKeywords: input.secondaryKeywords,
    sapEntity,
  });

  const csvRow = optimizeRowToCsvRow({
    url: input.url,
    title: input.title,
    primaryKeyword: input.primaryKeyword,
    seoResearchRaw: input.seoResearchRaw,
    entity: sapEntity,
    origin: input.origin,
    metaDescription: input.metaDescription,
    promptModifier: input.promptModifier,
    keywordFocus: input.keywordFocus,
  });

  const bulkFileManager = new BulkFileManager();
  const preserveTitle = input.existingTitle.trim() || input.title.trim();
  const preserveSlug = String(input.existingPost.slug ?? "").trim() || undefined;

  const options: BulkProcessingOptions = {
    apiKey: input.openRouterApiKey,
    openRouterApiKey: input.openRouterApiKey,
    sequentialHarnessSections: Boolean(sapEntity),
    useEntitySitemapTemplate: input.isSapRun,
    skipWikipediaLookup: false,
    updateTargetPostId: postId,
    optimizePreserveTitle: preserveTitle,
    optimizePreserveSlug: preserveSlug,
    forceFreshTopicFanout: true,
    forbiddenLiveH2s: input.existingContent?.trim()
      ? extractH2Titles(input.existingContent)
      : undefined,
    wordPressPosting: {
      enabled: true,
      site: input.site,
      sitemapType: input.isSapRun ? "entity" : "post",
      draftOnly: input.updateMode === "draft",
    },
    wordPressPagesForOfferTable: input.wordPressPagesForOfferTable,
    onProgress: (_rowIndex, _totalRows, message) => {
      const stepId = optimizeProgressStep(message);
      updateOptimizationProgress(
        input.setOptimizationProgress,
        input.siteId,
        stepId,
        stepId === "write" ? 0.35 : 0.55,
        message,
      );
    },
    onHarnessSection: (payload: BulkHarnessSectionPayload) => {
      updateOptimizationProgress(
        input.setOptimizationProgress,
        input.siteId,
        "write",
        Math.min(0.95, (payload.sectionIndex + 1) / Math.max(payload.totalSections, 1)),
        payload.title,
      );
    },
  };

  updateOptimizationProgress(input.setOptimizationProgress, input.siteId, "plan", 0.7, "Generating checklist…");

  await generateBlueprintAndContent(
    0,
    csvRow,
    keywordData,
    aiAnalysis,
    [],
    paaRawResponse,
    options,
    bulkFileManager,
    [],
    "",
    { name: input.site.name, siteUrl: input.site.siteUrl },
    input.wordPressPosts,
  );

  mergeBulkFilesIntoOptimization(bulkFileManager, input.fileManager);

  const generatedFiles = bulkFileManager.getAllFiles();
  const markdownContent = findGeneratedMarkdown(generatedFiles);
  const blueprintResult = findGeneratedBlueprint(generatedFiles);
  let originalContentMarkdown = input.existingContent;
  try {
    if (originalContentMarkdown.includes("<") && originalContentMarkdown.includes(">")) {
      originalContentMarkdown = htmlToMarkdown(originalContentMarkdown);
    }
  } catch {
    // keep raw
  }

  try {
    await generateImplementationReport(
      {
        originalTitle: input.existingTitle,
        newTitle: preserveTitle,
        originalExcerpt: input.existingExcerpt,
        newExcerpt: input.existingExcerpt,
        originalContent: originalContentMarkdown,
        newContent: markdownContent,
        primaryKeyword: input.primaryKeyword,
        clusterKeywords: input.clusterKeywords,
        selectedKeyword: input.selectedKeyword,
        blueprintResult: blueprintResult ?? { title: preserveTitle },
        updateMode: input.updateMode,
        url: input.url,
      },
      input.fileManager,
      { skipMetaDescriptionSection: true },
    );
  } catch (err) {
    console.warn("[Optimize via bulk] Implementation report failed (non-fatal):", err);
  }

  return {
    changes: {
      contentChanged: Boolean(markdownContent.trim()),
    },
  };
}

export type { KeywordData, KeywordAIAnalysis };
