import type { WordPressSite } from "@/components/integrations/types";
import { getStoredSites } from "@/components/integrations/storage";
import { loadApiKey, loadDataForSEOApiKey } from "@/lib/api";
import type { LoadBulkSitemapInventoryResult } from "@/lib/bulk/bulk-sitemap-inventory-session";
import {
  getBulkGenerationWpInventoryIfReady,
  inventoryRowsToWordPressLinkables,
  type BulkGenerationLinkable,
} from "@/lib/bulk/bulk-generation-wp-inventory";
import {
  addKeywordResearchSnapshotToBulkFiles,
  buildSitesToPostFromPosting,
  generateBlueprintAndContent,
  generateRowOutputs,
  prefetchBulkWordPressLinkValidationForRun,
  type BulkHarnessSectionPayload,
  type BulkProcessingOptions,
  type WordPressPostingOptions,
} from "@/lib/bulk-auto-generate";
import { buildBlogImportKeywordResearchStub } from "@/lib/bulk/blog-import-parse";
import { runIntelligentKeywordResearchMerge } from "@/lib/bulk/intelligent-keyword-research-merge";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { BulkFileManager } from "@/lib/bulk-file-manager";
import { loadKnowledgeBaseForBulkIdeas } from "@/lib/kb-for-bulk-ideas";
import { buildPortfolioBlockedHosts } from "@/lib/portfolio-link-blocklist";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import type { PostCreatorUploadedPost } from "@/lib/post-creator/post-creator-agent-harness";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import { fetchSemrushBulkEnrichment } from "@/lib/wordpress-api/semrush";
import { generateSEOSlug } from "@/lib/seo-slug-generator";
import type { KeywordAnalysisComplete, KeywordAnalysisOptions } from "@/lib/keyword-types";
import type { ResolvedPostCreatorSchedule } from "@/lib/post-creator/post-creator-schedule";

export type PostCreatorBulkProgress = {
  rowIndex: number;
  totalRows: number;
  message: string;
  progress?: number;
  uploadedPosts?: PostCreatorUploadedPost[];
  intraRowPhase?: string;
};

export type PostCreatorBulkRunResult = {
  created: number;
  failed: number;
  urls: string[];
  scheduledDates: string[];
  uploadedPosts: PostCreatorUploadedPost[];
};

async function stubAnalyzeKeyword(
  _keyword: string,
  _options: KeywordAnalysisOptions,
): Promise<KeywordAnalysisComplete | null> {
  return null;
}

type IntraRowPhase = "keyword" | "checklist" | "blueprint" | "content" | "upload" | "done";

const INTRA_ROW_PHASE_ORDER: IntraRowPhase[] = ["keyword", "checklist", "blueprint", "content", "upload", "done"];

function phaseIndex(phase: IntraRowPhase): number {
  return INTRA_ROW_PHASE_ORDER.indexOf(phase);
}

function shouldSkipPhase(resumePhase: IntraRowPhase | undefined, target: IntraRowPhase): boolean {
  if (!resumePhase) return false;
  return phaseIndex(resumePhase) > phaseIndex(target);
}

async function processPostCreatorRow(
  rowIndex: number,
  row: CSVRow,
  options: BulkProcessingOptions,
  fileManager: BulkFileManager,
  connectedSite: { name: string; siteUrl: string },
  wordPressPosts: BulkGenerationLinkable[],
  resumeFromPhase?: IntraRowPhase,
  onArtifact?: (input: {
    stepKey: string;
    stepLabel: string;
    name: string;
    mime: string;
    content: string;
    resumePayload?: Record<string, unknown>;
  }) => Promise<void>,
): Promise<void> {
  const openRouterApiKey = options.openRouterApiKey || loadApiKey() || "";
  const selectedModel = options.selectedModel || getResearchModel();

  if (shouldSkipPhase(resumeFromPhase, "upload")) {
    return;
  }

  const baseUrl = getPublicSiteUrl(connectedSite as WordPressSite).replace(/\/+$/, "") || "";
  const seedEarly = row.keyword?.trim() || row.keyword_focus?.trim() || "";
  const slugEarly = seedEarly
    ? await generateSEOSlug(row.title || seedEarly, seedEarly, row.entity, openRouterApiKey)
    : "";
  const pageUrlEarly = baseUrl && slugEarly ? `${baseUrl}/${slugEarly}` : "";

  const semrushPromise = shouldSkipPhase(resumeFromPhase, "keyword")
    ? Promise.resolve(null)
    : fetchSemrushBulkEnrichment({
        pageUrl: pageUrlEarly,
        seedKeyword: seedEarly,
        portfolioBlockedHosts: options.portfolioBlockedHosts,
      });

  let keywordResearchFromRow: Awaited<ReturnType<typeof generateRowOutputs>>["research"] | null = null;
  if (!shouldSkipPhase(resumeFromPhase, "keyword")) {
    const { files: initialFiles, research } = await generateRowOutputs(
      rowIndex,
      row,
      options,
      fileManager,
      stubAnalyzeKeyword,
    );
    void initialFiles;
    keywordResearchFromRow = research;
  }

  const stub = buildBlogImportKeywordResearchStub(row);
  let finalKeywordData = keywordResearchFromRow?.result?.keywordData ?? stub.keywordData;
  let finalAiAnalysis = keywordResearchFromRow?.aiAnalysis ?? stub.aiAnalysis;
  const semrushResult = shouldSkipPhase(resumeFromPhase, "keyword") ? null : await semrushPromise;

  if (!shouldSkipPhase(resumeFromPhase, "keyword")) {
    const mergeResult = await runIntelligentKeywordResearchMerge(row, finalKeywordData, semrushResult, {
      apiKey: openRouterApiKey,
      model: selectedModel,
    });

    const volumeDataForSnapshot = keywordResearchFromRow?.keywordsVolumeData ?? [];
    addKeywordResearchSnapshotToBulkFiles(rowIndex, row, fileManager, options, Date.now(), {
      keywordData: finalKeywordData,
      aiAnalysis: finalAiAnalysis,
      keywordsVolumeData: volumeDataForSnapshot,
      paaRawResponse: keywordResearchFromRow?.paaRawResponse ?? null,
      primaryKeyword: row.keyword?.trim() || stub.primaryKeyword,
      semrush: semrushResult,
      intelligentMerge: mergeResult.merge,
      primaryExternalCitationUrl: mergeResult.primaryExternalCitationUrl,
    });
    const keywordJson = fileManager
      .getAllFiles()
      .find((f) => f.rowIndex === rowIndex && f.fileName.includes("keyword"));
    if (keywordJson && onArtifact) {
      await onArtifact({
        stepKey: `post.${rowIndex}.keyword`,
        stepLabel: "Keyword research ready",
        name: keywordJson.fileName,
        mime: "application/json",
        content: keywordJson.content,
        resumePayload: { phase: "bulk", rowIndex, intraRowPhase: "checklist" },
      });
    }
  }

  if (shouldSkipPhase(resumeFromPhase, "content")) {
    return;
  }

  const volumeDataForBlueprint = keywordResearchFromRow?.keywordsVolumeData ?? [];

  const { activeKnowledgeBaseText } = loadKnowledgeBaseForBulkIdeas();
  const knowledgeFiles: Array<{ name: string; content: string }> = [];

  const optionsWithHarness: BulkProcessingOptions = {
    ...options,
    onHarnessSection: (payload: BulkHarnessSectionPayload) => {
      options.onHarnessSection?.(payload);
      if (payload.phase === "start") {
        options.onProgress?.(
          rowIndex,
          0,
          `Harness ${payload.sectionIndex + 1}/${payload.totalSections}: ${payload.title}…`,
        );
      }
    },
  };

  await generateBlueprintAndContent(
    rowIndex,
    row,
    finalKeywordData,
    finalAiAnalysis,
    volumeDataForBlueprint,
    keywordResearchFromRow?.paaRawResponse ?? null,
    optionsWithHarness,
    fileManager,
    knowledgeFiles,
    activeKnowledgeBaseText,
    connectedSite,
    wordPressPosts,
    {
      semrush: semrushResult,
      primaryExternalCitationUrl: mergeResult.primaryExternalCitationUrl,
      intelligentMerge: mergeResult.merge,
    },
  );
}

function parseWordPressArtifact(content: string): PostCreatorUploadedPost | null {
  try {
    const parsed = JSON.parse(content) as {
      link?: string;
      post_url?: string;
      postId?: number;
      title?: string;
      scheduledDate?: string;
      date_gmt?: string;
      scheduled_date_gmt?: string;
    };
    const url = parsed.link?.trim() || parsed.post_url?.trim();
    if (!url) return null;
    return {
      url,
      postId: typeof parsed.postId === "number" ? parsed.postId : undefined,
      title: parsed.title?.trim() || undefined,
      scheduledFor:
        parsed.scheduledDate?.trim() ||
        parsed.date_gmt?.trim() ||
        parsed.scheduled_date_gmt?.trim() ||
        undefined,
    };
  } catch {
    return null;
  }
}

export async function runPostCreatorBulkRows(args: {
  site: WordPressSite;
  rows: CSVRow[];
  wordPressPosting: WordPressPostingOptions | undefined;
  schedule: ResolvedPostCreatorSchedule;
  inventoryContext?: LoadBulkSitemapInventoryResult;
  startRowIndex?: number;
  priorUploadedPosts?: PostCreatorUploadedPost[];
  resumeIntraRowPhase?: string;
  onProgress?: (p: PostCreatorBulkProgress) => void;
  onFilesChanged?: (files: import("@/lib/bulk-file-manager").BulkGeneratedFile[]) => void;
  onHarnessSection?: (payload: BulkHarnessSectionPayload) => void;
  isCancelled?: () => Promise<boolean>;
  onArtifact?: (input: {
    stepKey: string;
    stepLabel: string;
    name: string;
    mime: string;
    content: string;
    resumePayload?: Record<string, unknown>;
  }) => Promise<void>;
}): Promise<PostCreatorBulkRunResult> {
  const {
    site,
    rows,
    wordPressPosting,
    schedule,
    inventoryContext,
    startRowIndex = 0,
    priorUploadedPosts = [],
    resumeIntraRowPhase,
    onProgress,
    onFilesChanged,
    onHarnessSection,
    isCancelled,
    onArtifact,
  } = args;
  const dataForSeoKey = loadDataForSEOApiKey()?.trim() || "";
  const openRouterKey = loadApiKey()?.trim() || "";
  if (!openRouterKey) throw new Error("Add an OpenRouter API key in Settings.");
  if (!dataForSeoKey) throw new Error("Add a DataForSEO API key in Settings.");

  const fileManager = new BulkFileManager();
  fileManager.setOnMutation(() => {
    onFilesChanged?.(fileManager.getAllFiles());
  });
  const connectedSite = { name: site.name, siteUrl: site.siteUrl };

  const wpInventory = getBulkGenerationWpInventoryIfReady(site.id);
  const wordPressPosts = wpInventory?.rows?.length
    ? inventoryRowsToWordPressLinkables(wpInventory.rows)
    : [];

  const storedSites = getStoredSites();
  const portfolioBlockedHosts = buildPortfolioBlockedHosts(storedSites, {
    excludeSiteId: site.id,
    excludeSiteUrl: site.siteUrl,
  });

  let linkPrefetchPromise: Promise<void> | undefined;
  const sitesToPost = buildSitesToPostFromPosting(wordPressPosting);
  if (wordPressPosting?.enabled && sitesToPost.length > 0) {
    linkPrefetchPromise = prefetchBulkWordPressLinkValidationForRun(sitesToPost);
  }

  const featuredImageType = schedule.featuredImage ? "ai-generated" : "google-maps";

  const bulkOptions: BulkProcessingOptions = {
    apiKey: dataForSeoKey,
    openRouterApiKey: openRouterKey,
    selectedModel: getResearchModel(site.id),
    featuredImageType,
    wordPressPosting,
    linkPrefetchPromise,
    portfolioBlockedHosts: portfolioBlockedHosts.length > 0 ? portfolioBlockedHosts : undefined,
    onProgress: (rowIndex, _total, status) => {
      onProgress?.({
        rowIndex,
        totalRows: rows.length,
        message: status,
        progress: rows.length > 0 ? (rowIndex + 0.5) / rows.length : undefined,
      });
    },
    onError: (rowIndex, error) => {
      onProgress?.({
        rowIndex,
        totalRows: rows.length,
        message: error.message,
      });
    },
    onHarnessSection: (payload) => {
      onHarnessSection?.(payload);
    },
  };

  let created = priorUploadedPosts.length;
  let failed = 0;
  const urls: string[] = priorUploadedPosts.map((p) => p.url);
  const scheduledDates: string[] = priorUploadedPosts
    .map((p) => p.scheduledFor)
    .filter((d): d is string => Boolean(d));
  const uploadedPosts: PostCreatorUploadedPost[] = [...priorUploadedPosts];

  for (let i = startRowIndex; i < rows.length; i++) {
    if (await isCancelled?.()) throw new Error("Cancelled");
    const rowResumePhase =
      i === startRowIndex && resumeIntraRowPhase
        ? (resumeIntraRowPhase as IntraRowPhase)
        : undefined;
    onProgress?.({
      rowIndex: i,
      totalRows: rows.length,
      message: `Post ${i + 1}/${rows.length}: ${rows[i]?.keyword || "starting"}…`,
      progress: i / rows.length,
      uploadedPosts,
      intraRowPhase: rowResumePhase ?? "keyword",
    });
    try {
      await processPostCreatorRow(
        i,
        rows[i]!,
        bulkOptions,
        fileManager,
        connectedSite,
        wordPressPosts,
        rowResumePhase,
        onArtifact,
      );
      created += 1;
      const rowFiles = fileManager.getAllFiles().filter((f) => f.rowIndex === i);
      const wpFile = rowFiles.find(
        (f) => f.fileName.includes("wordpress") || f.content.includes('"link"') || f.content.includes('"post_url"'),
      );
      if (wpFile?.content) {
        const parsed = parseWordPressArtifact(wpFile.content);
        if (parsed) {
          uploadedPosts.push(parsed);
          urls.push(parsed.url);
          if (parsed.scheduledFor) scheduledDates.push(parsed.scheduledFor);
        }
      }
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "Post failed";
      onProgress?.({
        rowIndex: i,
        totalRows: rows.length,
        message: `Post ${i + 1}/${rows.length} failed: ${message}`,
        uploadedPosts,
      });
    }
    onFilesChanged?.(fileManager.getAllFiles());
  }

  return { created, failed, urls, scheduledDates, uploadedPosts };
}
