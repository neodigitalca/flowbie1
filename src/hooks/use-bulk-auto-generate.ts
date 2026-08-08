import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { buildBulkRunContentCsv } from '@/lib/bulk-run-content-csv';
import { notify, notifyHeaderError } from "@/lib/app-notifications";
import { NOTIFY_DATAFORSEO_API_KEY_IS_REQUIRED, NOTIFY_FETCHING_WORDPRESS_POSTS, NOTIFY_INTERNAL_ERROR_ROW_INDEX_MAPPING_DOES_NO, NOTIFY_INVALID_TARGET_SITE_EXAMPLE_COM_IS_NOT_A, NOTIFY_LOADING_WORDPRESS_SITE_INVENTORY_ONE_REQ, NOTIFY_OPENROUTER_API_KEY_IS_REQUIRED, NOTIFY_PROCESSING_CANCELLED_BY_USER, notifyBulkProcessingCompleteXFilesGenerat, notifyBulkProcessingFailedX, notifyLoadedXLinkableUrlsFromSiteInvento, notifyRowXFailedX, notifyRowXXCompletedXFilesGenerated, notifyWordpressFetchFailedX, notifyWordpressSiteNotFoundX } from "@/lib/notify-messages";
import {
  parseCsvStatic,
  generateRowOutputs,
  generateBlueprintAndContent,
  clearBulkUploadValidationCache,
  addKeywordResearchSnapshotToBulkFiles,
  buildSitesToPostFromPosting,
  prefetchBulkWordPressLinkValidationForRun,
  type CSVRow,
  type BulkProcessingOptions,
  type BulkHarnessSectionPayload,
  type WordPressPostingOptions,
  type WordPressPostDestination,
} from '@/lib/bulk-auto-generate';
import { reduceHarnessSectionList } from '@/lib/bulk/harness-sections-reducer';
import { fetchSemrushBulkEnrichment } from '@/lib/wordpress-api/semrush';
import { generateSEOSlug } from '@/lib/seo-slug-generator';
import { runIntelligentKeywordResearchMerge } from '@/lib/bulk/intelligent-keyword-research-merge';
import { getResearchModel } from '@/lib/optimization-settings-storage';
import { enrichCsvRowsFromSheet } from '@/lib/bulk/bulk-csv-enrich';
import { BulkFileManager, type BulkGeneratedFile } from '@/lib/bulk-file-manager';
import { useKeywordResearch } from './use-keyword-research';
import type { KeywordData, KeywordAIAnalysis } from '@/lib/keyword-types';
import type { StoredFile } from '@/components/KnowledgeBaseTab';
import { reassembleChunkedFiles } from '@/lib/utils';
import { fetchWikipediaContent, generateWikipediaCSV, type WikipediaFetchOptions } from '@/lib/wikipedia-api';
import {
  ensureBulkGenerationWpInventory,
  inventoryRowsToWordPressLinkables,
} from '@/lib/bulk/bulk-generation-wp-inventory';
import { getStoredSites } from '@/components/integrations/storage';
import { buildPortfolioBlockedHosts } from '@/lib/portfolio-link-blocklist';
import type { ConnectedSiteSummary, WordPressSite } from '@/components/integrations/types';
import { getPublicSiteUrl } from '@/lib/wordpress-site-public-url';
import { clearGoogleMapsImageSessionCache } from '@/lib/content-generation/google-maps-image-api';
import {
  countSapMapsRowsByEntity,
  createSapMapsMediaBank,
} from '@/lib/bulk/sap-maps-media-bank';
import {
  createPeerFeaturedImageReportCollector,
  formatPeerFeaturedImageReportMarkdown,
  peerFeaturedImageReportHasContent,
  PEER_FEATURED_IMAGE_REPORT_FILENAME,
} from '@/lib/bulk/peer-featured-image-report';
import type { PeerFeaturedLibraryCsvFile } from '@/lib/overview/sap-peer-featured-image-search';

const KB_FILES_STORAGE_KEY = 'kb_files';
const KB_PROFILES_STORAGE_KEY = 'kb_profiles';

interface KnowledgeProfile {
  id: string;
  name: string;
  content: string;
}

/**
 * Load knowledge base files and text from localStorage
 * Returns knowledgeFiles array and activeKnowledgeBaseText string
 */
function loadKnowledgeBaseFromStorage(): {
  knowledgeFiles: Array<{ name: string; content: string }>;
  activeKnowledgeBaseText: string;
} {
  try {
    // Load knowledge files
    const storedFilesString = localStorage.getItem(KB_FILES_STORAGE_KEY) || '[]';
    const storedFiles = JSON.parse(storedFilesString) as StoredFile[];
    
    // Convert StoredFile[] to Array<{ name: string; content: string }>
    const knowledgeFiles = storedFiles.map(file => ({
      name: file.name,
      content: file.content,
    }));

    // Load knowledge profiles and combine their content
    const storedProfilesString = localStorage.getItem(KB_PROFILES_STORAGE_KEY) || '[]';
    const profiles = JSON.parse(storedProfilesString) as KnowledgeProfile[];
    const manualText = profiles.map(p => p.content).filter(Boolean).join('\n\n---\n\n');

    // Reassemble chunked files (handles CSV chunks, etc.)
    const fileContents = reassembleChunkedFiles(storedFiles);

    // Combine manual text and file contents (same pattern as Index.tsx)
    const activeKnowledgeBaseText = [manualText, fileContents].filter(Boolean).join('\n\n---\n\n');

    return {
      knowledgeFiles,
      activeKnowledgeBaseText,
    };
  } catch (error) {
    console.error('Error loading knowledge base from storage:', error);
    return {
      knowledgeFiles: [],
      activeKnowledgeBaseText: '',
    };
  }
}

import { buildBulkBaseRows } from '@/lib/bulk-processing-order';
import { buildWordPressPostingFromSelection } from '@/lib/build-wordpress-bulk-posting';
import {
  applyRowSitemapToPosting,
  buildCustomModePrefetchSites,
  resolveRowSitemapType,
  resolveSiteSitemapMode,
} from '@/lib/bulk/bulk-sitemap-mode';
import type { BulkRowSitemapType } from '@/lib/bulk/bulk-sitemap-mode';
import { resolveBulkWordPressPublishDate, type ScheduleFrequency } from '@/lib/wordpress-scheduler';
import {
  buildBlogImportKeywordResearchStub,
  rowHasImportedBlogSections,
} from '@/lib/bulk/blog-import-parse';
import { resolveBlogImportRowViaOpenRouter } from '@/lib/bulk/blog-import-openrouter-run';
import { loadApiKey } from '@/lib/api';

export type BulkHarnessSectionUi = {
  sectionIndex: number;
  title: string;
  status: 'waiting' | 'generating' | 'done';
  markdown?: string;
  truncated?: boolean;
};

export interface UseBulkAutoGenerateProps {
  apiKey?: string; // DataForSEO API key
  openRouterApiKey?: string; // OpenRouter API key
  selectedModel?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  flowPurpose?: string;
  featuredImageType?: 'ai-generated' | 'google-maps';
  connectedSite?: ConnectedSiteSummary;
  /** Bulk WordPress form state - posting options are built from this and the current row preview (no hidden defaults). */
  inputMode?: 'csv' | 'prompt';
  selectedBlogIndices?: Set<number>;
  generatedRows?: CSVRow[];
  selectedWordPressSites?: Set<string>;
  siteConfigs?: Record<string, { sitemapType: 'post' | 'entity' | 'custom' }>;
  scheduleFrequency?: ScheduleFrequency;
  customInterval?: number;
  dayOfWeek?: number;
  startDateOption?: 'immediate' | 'custom';
  customStartDate?: Date;
  startTime?: string;
  useCsvPublishDates?: boolean;
  wordpressDraftOnly?: boolean;
  bulkPostDestination?: WordPressPostDestination;
  /** Legacy OpenRouter-only mode (unused in Blog Generator). */
  skipDataForSeoApiKey?: boolean;
  blogImportSourceFile?: File | null;
  blogImportForm?: {
    focusKeyword: string;
    titleOverride: string;
    featuredImageMode: "y" | "n" | "google-maps";
    entity: string;
  };
}

export function useBulkAutoGenerate({
  apiKey,
  openRouterApiKey,
  selectedModel = getResearchModel(),
  temperature = 1.0,
  maxTokens = 4000,
  topP = 0.9,
  flowPurpose,
  featuredImageType = 'ai-generated',
  connectedSite,
  inputMode = 'csv',
  selectedBlogIndices = new Set(),
  generatedRows = [],
  selectedWordPressSites = new Set(),
  siteConfigs = {},
  scheduleFrequency = 'daily',
  customInterval = 1,
  dayOfWeek = 1,
  startDateOption = 'immediate',
  customStartDate = new Date(),
  startTime = '09:00',
  useCsvPublishDates = true,
  wordpressDraftOnly = false,
  bulkPostDestination = 'wordpress',
  skipDataForSeoApiKey = false,
  blogImportSourceFile = null,
  blogImportForm,
}: UseBulkAutoGenerateProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRow, setCurrentRow] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [processingStepLog, setProcessingStepLog] = useState<string[]>([]);
  const [harnessSections, setHarnessSections] = useState<BulkHarnessSectionUi[]>([]);
  const [harnessByRow, setHarnessByRow] = useState<Map<number, BulkHarnessSectionUi[]>>(
    () => new Map(),
  );
  const harnessSectionsRef = useRef<BulkHarnessSectionUi[]>([]);
  /** Fixed blueprint section count for the current row's harness (not `harnessSections.length`, which grows one-at-a-time). */
  const [harnessPlannedSectionCount, setHarnessPlannedSectionCount] = useState<number | null>(null);
  const [fileManager] = useState(() => new BulkFileManager());
  /** Bumps when BulkFileManager mutates so derived file lists re-render without relying only on onProgress. */
  const [filesTick, setFilesTick] = useState(0);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [failedRowIndices, setFailedRowIndices] = useState<Set<number>>(() => new Set());
  const [failedRowMessages, setFailedRowMessages] = useState<Record<number, string>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  /** Sync lock: React `isProcessing` is too late to stop overlapping play starts. */
  const processingInFlightRef = useRef(false);

  const appendProcessingStep = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setProcessingStepLog((prev) => (prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed]));
  }, []);

  const recordRunStatus = useCallback((message: string) => {
    setStatus(message);
  }, []);

  useEffect(() => {
    harnessSectionsRef.current = harnessSections;
  }, [harnessSections]);

  const snapshotHarnessForRow = useCallback((rowIndex: number) => {
    const sections = harnessSectionsRef.current;
    if (sections.length === 0) return;
    setHarnessByRow((prev) => {
      const next = new Map(prev);
      next.set(rowIndex, [...sections]);
      return next;
    });
  }, []);

  const wordPressPosting = useMemo((): WordPressPostingOptions | undefined => {
    const b = buildBulkBaseRows(inputMode, rows, generatedRows, selectedBlogIndices);
    const totalRows = b.ok ? b.baseRows.length : 0;
    return buildWordPressPostingFromSelection({
      selectedSiteIds: selectedWordPressSites,
      siteConfigs,
      scheduleFrequency,
      customInterval,
      dayOfWeek,
      startDateOption,
      customStartDate,
      startTime,
      totalRows,
      useCsvPublishDates,
      postDestination: bulkPostDestination,
      draftOnly: wordpressDraftOnly,
    });
  }, [
    inputMode,
    rows,
    generatedRows,
    selectedBlogIndices,
    selectedWordPressSites,
    siteConfigs,
    scheduleFrequency,
    customInterval,
    dayOfWeek,
    startDateOption,
    customStartDate,
    startTime,
    useCsvPublishDates,
    bulkPostDestination,
    wordpressDraftOnly,
  ]);

  useEffect(() => {
    fileManager.setOnMutation(() => setFilesTick((t) => t + 1));
    return () => fileManager.setOnMutation(undefined);
  }, [fileManager]);

  const stats = useMemo(() => fileManager.getStats(), [fileManager, filesTick]);
  const filesByRow = useMemo(() => fileManager.getFilesByRow(), [fileManager, filesTick]);

  /** After a run ends, offer one CSV with every post body for manual import if upload failed. */
  const runContentCsvAvailable = useMemo(() => {
    if (isProcessing) return false;
    const { rowCount } = buildBulkRunContentCsv(fileManager.getAllFiles());
    return rowCount > 0;
  }, [fileManager, filesTick, isProcessing]);

  const downloadRunContentCsv = useCallback(() => {
    fileManager.downloadRunContentCsv();
  }, [fileManager]);

  // Use keyword research hook for each row
  const {
    analyzeKeyword,
    isAnalyzing,
    isAnalyzingWithAI,
    currentResult,
    aiAnalysis,
    keywordsVolumeData,
    paaRawResponse,
    clearResults,
  } = useKeywordResearch({
    apiKey: skipDataForSeoApiKey ? undefined : apiKey,
    openRouterApiKey,
    selectedModel,
    temperature,
    maxTokens,
    topP,
    connectedSite,
  });

  // Use refs to track current state values for polling loop
  const isAnalyzingRef = useRef(isAnalyzing);
  const isAnalyzingWithAIRef = useRef(isAnalyzingWithAI);
  const currentResultRef = useRef(currentResult);
  const aiAnalysisRef = useRef(aiAnalysis);

  // Update refs when state changes
isAnalyzingRef.current = isAnalyzing;
  isAnalyzingWithAIRef.current = isAnalyzingWithAI;
  currentResultRef.current = currentResult;
  aiAnalysisRef.current = aiAnalysis;

  /**
   * Load CSV file: Papa static parse first, then optional OpenRouter enrich for missing fields.
   */
  const loadCSV = useCallback(async (file: File): Promise<CSVRow[]> => {
    try {
      const staticRows = await parseCsvStatic(file);
      if (staticRows.length === 0) {
        notifyHeaderError("Bulk generate failed", "CSV file is empty");
        return [];
      }
      setRows(staticRows);
      setTotalRows(staticRows.length);

      const apiKey = openRouterApiKey?.trim() || loadApiKey()?.trim() || "";
      if (apiKey) {
        const sites = getStoredSites();
        const normalizeSiteUrl = (url: string) =>
          url.trim().toLowerCase().replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/, "");
        const matched = connectedSite
          ? sites.find((s) => normalizeSiteUrl(s.siteUrl) === normalizeSiteUrl(connectedSite.siteUrl))
          : undefined;
        const gridLocations = [
          ...new Set(staticRows.map((r) => r.entity?.trim()).filter(Boolean)),
        ] as string[];
        void enrichCsvRowsFromSheet(staticRows, {
          apiKey,
          model: selectedModel || getResearchModel(),
          siteId: matched?.id,
          siteName: matched?.name || connectedSite?.siteUrl || "",
          gridLocations,
          onRowsUpdate: (next) => {
            setRows(next);
            setTotalRows(next.length);
          },
        });
      }
      return staticRows;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load CSV";
      notifyHeaderError("Bulk generate failed", errorMessage);
      return [];
    }
  }, [openRouterApiKey, selectedModel, connectedSite]);

  /**
   * Process a single row completely
   */
  const processRow = useCallback(async (
    rowIndex: number,
    row: CSVRow,
    options: BulkProcessingOptions
  ): Promise<BulkGeneratedFile[]> => {
    const allFiles: BulkGeneratedFile[] = [];

    try {
      clearResults();

      let activeRow = row;
      if (
        options.blogImportSourceFile &&
        options.blogImportForm &&
        !rowHasImportedBlogSections(row)
      ) {
        options.onProgress?.(rowIndex, 0, 'Sending local file to OpenRouter...');
        activeRow = await resolveBlogImportRowViaOpenRouter(
          options.blogImportSourceFile,
          options.blogImportForm,
          options.openRouterApiKey || loadApiKey(),
          options.selectedModel || selectedModel,
        );
      }

      const baseUrl = connectedSite
        ? getPublicSiteUrl(connectedSite).replace(/\/+$/, '') || ''
        : '';
      const seedEarly =
        activeRow.keyword?.trim() ||
        activeRow.keyword_focus?.trim() ||
        '';
      const slugEarly = seedEarly ? generateSEOSlug(seedEarly) : '';
      const pageUrlEarly = baseUrl && slugEarly ? `${baseUrl}/${slugEarly}` : '';
      const portfolioBlockedHosts =
        options.portfolioBlockedHosts && options.portfolioBlockedHosts.length > 0
          ? options.portfolioBlockedHosts
          : undefined;

      const semrushPromise = fetchSemrushBulkEnrichment({
        pageUrl: pageUrlEarly,
        seedKeyword: seedEarly,
        portfolioBlockedHosts,
      });

      // Step 1: Fetch Wikipedia and run keyword research
      const { files: initialFiles, research: keywordResearchFromRow } = await generateRowOutputs(
        rowIndex,
        activeRow,
        options,
        fileManager,
        analyzeKeyword
      );
      allFiles.push(...initialFiles);

      const useOpenRouterOnly = skipDataForSeoApiKey;
      let finalKeywordData: import('@/lib/keyword-types').KeywordData;
      let finalAiAnalysis: import('@/lib/keyword-types').KeywordAIAnalysis;
      let semrushResult: Awaited<ReturnType<typeof fetchSemrushBulkEnrichment>>;
      let intelligentMerge: Awaited<
        ReturnType<typeof runIntelligentKeywordResearchMerge>
      >['merge'];
      let primaryExternalCitationUrl: string | null;
      let volumeDataForBlueprint: import('@/lib/keyword-types').KeywordData[];

      if (useOpenRouterOnly) {
        options.onProgress?.(rowIndex, 0, 'OpenRouter generation...');
        const stub = buildBlogImportKeywordResearchStub(activeRow);
        finalKeywordData = stub.keywordData;
        finalAiAnalysis = stub.aiAnalysis;
        semrushResult = await semrushPromise;
        const mergeResult = await runIntelligentKeywordResearchMerge(activeRow, stub.keywordData, semrushResult, {
          apiKey: openRouterApiKey || loadApiKey(),
          model: selectedModel || getResearchModel(),
        });
        intelligentMerge = mergeResult.merge;
        primaryExternalCitationUrl = mergeResult.primaryExternalCitationUrl;
        volumeDataForBlueprint = [];

        const dfsSnapshotTs = Date.now();
        const dfsFile = addKeywordResearchSnapshotToBulkFiles(
          rowIndex,
          activeRow,
          fileManager,
          options,
          dfsSnapshotTs,
          {
            keywordData: stub.keywordData,
            aiAnalysis: stub.aiAnalysis,
            keywordsVolumeData: [],
            paaRawResponse: null,
            primaryKeyword: stub.primaryKeyword,
            semrush: semrushResult,
            intelligentMerge,
            primaryExternalCitationUrl,
          },
        );
        allFiles.push(dfsFile);
      } else {
        const csvPrimary = activeRow.keyword?.trim() || activeRow.keyword_focus?.trim() || '';
        if (!keywordResearchFromRow?.result?.keywordData || !keywordResearchFromRow.aiAnalysis) {
          const stub = buildBlogImportKeywordResearchStub(activeRow);
          finalKeywordData = stub.keywordData;
          finalAiAnalysis = stub.aiAnalysis;
        } else {
          finalKeywordData = {
            ...keywordResearchFromRow.result.keywordData,
            keyword: csvPrimary || keywordResearchFromRow.result.keywordData.keyword,
          };
          finalAiAnalysis = keywordResearchFromRow.aiAnalysis;
        }
        semrushResult = await semrushPromise;

        options.onProgress?.(rowIndex, 0, 'Merging keyword research with Semrush...');
        const mergeResult = await runIntelligentKeywordResearchMerge(row, finalKeywordData, semrushResult, {
          apiKey: openRouterApiKey,
          model: selectedModel || getResearchModel(),
        });
        intelligentMerge = mergeResult.merge;
        primaryExternalCitationUrl = mergeResult.primaryExternalCitationUrl;
        const rowPaaRawResponse = keywordResearchFromRow.paaRawResponse ?? paaRawResponse;
        volumeDataForBlueprint = keywordResearchFromRow.keywordsVolumeData;

        const dfsSnapshotTs = Date.now();
        const dfsFile = addKeywordResearchSnapshotToBulkFiles(
          rowIndex,
          row,
          fileManager,
          options,
          dfsSnapshotTs,
          {
            keywordData: finalKeywordData,
            aiAnalysis: finalAiAnalysis,
            keywordsVolumeData: volumeDataForBlueprint,
            paaRawResponse: rowPaaRawResponse,
            primaryKeyword: csvPrimary || keywordResearchFromRow?.result?.primaryKeyword || finalKeywordData.keyword,
            semrush: semrushResult,
            intelligentMerge,
            primaryExternalCitationUrl,
          },
        );
        allFiles.push(dfsFile);
      }

      // Step 3: Load knowledge base from localStorage
      let { knowledgeFiles, activeKnowledgeBaseText } = loadKnowledgeBaseFromStorage();

      // Step 3.5: Fetch Wikipedia KB only when CSV did not already provide wikipedia_url
      if (row.entity && row.entity.trim() && !row.wikipedia_url?.trim()) {
        try {
          options.onProgress?.(rowIndex, 0, `Fetching Wikipedia content for entity: ${row.entity}...`);
          
          // Load OpenRouter API key for AI summarization
          const openRouterApiKeyForSummary = options.openRouterApiKey;
          const useAISummarization = !!openRouterApiKeyForSummary && openRouterApiKeyForSummary.trim().length > 0;
          
          // Prepare fetch options with AI summarization
          const fetchOptions: WikipediaFetchOptions | undefined = useAISummarization ? {
            summarizeWithAI: true,
            openRouterApiKey: openRouterApiKeyForSummary,
            onSummarizeProgress: (message) => {
              options.onProgress?.(rowIndex, 0, `Wikipedia AI: ${message}`);
            },
          } : undefined;
          
          const wikipediaChunks = await fetchWikipediaContent(row.entity.trim(), fetchOptions);
          
          if (wikipediaChunks.length > 0) {
            // Convert Wikipedia chunks to CSV format
            const wikipediaCSV = generateWikipediaCSV(wikipediaChunks);
            
            // Add Wikipedia content as a knowledge file
            const wikipediaFileName = `Wikipedia_${row.entity.trim().replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
            knowledgeFiles.push({
              name: wikipediaFileName,
              content: wikipediaCSV,
            });
            
            // Also add to activeKnowledgeBaseText for RAG context
            const wikipediaText = wikipediaChunks
              .map(chunk => {
                const section = chunk.section !== 'Introduction' && chunk.section !== 'Overview'
                  ? `${chunk.section} - ${chunk.text}`
                  : chunk.text;
                return section;
              })
              .join('\n\n---\n\n');
            
            if (activeKnowledgeBaseText) {
              activeKnowledgeBaseText += `\n\n--- Wikipedia Content for ${row.entity} ---\n${wikipediaText}`;
            } else {
              activeKnowledgeBaseText = `--- Wikipedia Content for ${row.entity} ---\n${wikipediaText}`;
            }
            
            options.onProgress?.(rowIndex, 0, `Wikipedia content added to knowledge base for ${row.entity}`);
          }
        } catch (error) {
          console.error(`[Bulk Generate] Error fetching Wikipedia for entity "${row.entity}":`, error);
          // Continue without Wikipedia content - don't fail the entire process
          options.onProgress?.(rowIndex, 0, `Warning: Could not fetch Wikipedia for ${row.entity}, continuing...`);
        }
      } else if (row.wikipedia_url?.trim()) {
        options.onProgress?.(rowIndex, 0, `Using CSV wikipedia_url; skipping Wikipedia KB fetch/summarize`);
      }

      // Step 4: Retrieve WordPress posts for this keyword (if available)
      const keywordLower = activeRow.keyword.toLowerCase().trim();
      const wordPressPosts = options.wordPressPostsByKeyword?.get(keywordLower);

      // Step 5: Generate blueprint and content with knowledge base (including Wikipedia and WordPress posts)
      setHarnessSections([]);
      setHarnessPlannedSectionCount(null);
      options.onProgress?.(rowIndex, 0, 'Generating checklist and blueprint...');
      const optionsWithHarness: BulkProcessingOptions = {
        ...options,
        openRouterOnly: skipDataForSeoApiKey,
        onHarnessSection: (payload: BulkHarnessSectionPayload) => {
          options.onHarnessSection?.(payload);
          setHarnessPlannedSectionCount(payload.totalSections);
          setHarnessSections((prev) => {
            const next = reduceHarnessSectionList(prev, payload);
            return next;
          });
          if (payload.phase === 'start') {
            options.onProgress?.(
              rowIndex,
              0,
              `Harness ${payload.sectionIndex + 1}/${payload.totalSections}: ${payload.title}…`,
            );
          }
        },
      };

      const blueprintFiles = await generateBlueprintAndContent(
        rowIndex,
        activeRow,
        finalKeywordData,
        finalAiAnalysis,
        volumeDataForBlueprint,
        keywordResearchFromRow?.paaRawResponse ?? paaRawResponse,
        optionsWithHarness,
        fileManager,
        knowledgeFiles,
        activeKnowledgeBaseText,
        connectedSite,
        wordPressPosts,
        {
          semrush: semrushResult,
          primaryExternalCitationUrl,
          intelligentMerge,
        }
      );
      allFiles.push(...blueprintFiles);

      return allFiles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      options.onError?.(rowIndex, error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }, [
    fileManager,
    analyzeKeyword,
    keywordsVolumeData,
    paaRawResponse,
    clearResults,
    connectedSite,
    openRouterApiKey,
    selectedModel,
    skipDataForSeoApiKey,
    appendProcessingStep,
  ]);

  /**
   * Process all rows sequentially
   */
  const processAllRows = useCallback(async (
    csvRows: CSVRow[],
    wordPressPostingOverride?: WordPressPostingOptions,
    rowDisplayIndices?: number[]
  ): Promise<void> => {
    if (processingInFlightRef.current) {
      return;
    }
    processingInFlightRef.current = true;
    const effectiveOpenRouterKey = openRouterApiKey?.trim() || loadApiKey()?.trim() || "";
    if (!skipDataForSeoApiKey && (!apiKey || !apiKey.trim())) {
      processingInFlightRef.current = false;
      notify.error(NOTIFY_DATAFORSEO_API_KEY_IS_REQUIRED);
      return;
    }
    if (!effectiveOpenRouterKey) {
      processingInFlightRef.current = false;
      notify.error(NOTIFY_OPENROUTER_API_KEY_IS_REQUIRED);
      return;
    }

    const displayIndices =
      rowDisplayIndices ?? csvRows.map((_, idx) => idx);
    if (displayIndices.length !== csvRows.length) {
      processingInFlightRef.current = false;
      notify.error(NOTIFY_INTERNAL_ERROR_ROW_INDEX_MAPPING_DOES_NO);
      return;
    }

    setIsProcessing(true);
    setRows(csvRows);
    setCurrentRow(0);
    setTotalRows(csvRows.length);
    setHarnessSections([]);
    setHarnessPlannedSectionCount(null);
    setHarnessByRow(new Map());
    setProcessingStepLog([]);
    setFailedRowIndices(new Set());
    setFailedRowMessages({});
    fileManager.clear();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const storedSitesForPortfolio = getStoredSites();
    const normalizeSite = (url: string) =>
      url.trim().toLowerCase().replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');
    const matchedWpSite = connectedSite
      ? storedSitesForPortfolio.find((s) => normalizeSite(s.siteUrl) === normalizeSite(connectedSite.siteUrl))
      : undefined;
    const portfolioBlockedHostsList = buildPortfolioBlockedHosts(storedSitesForPortfolio, {
      excludeSiteId: matchedWpSite?.id,
      excludeSiteUrl: connectedSite?.siteUrl,
    });
    const portfolioBlockedHostsOpt =
      portfolioBlockedHostsList.length > 0 ? portfolioBlockedHostsList : undefined;

    const postingBase = wordPressPostingOverride || wordPressPosting;

    const postingForLoop: WordPressPostingOptions | undefined = (() => {
      const p = postingBase;
      if (!p?.enabled || p.postDestination !== 'hybrid' || csvRows.length === 0) return p;
      const scheduleOpts = {
        frequency: p.frequency,
        customInterval: p.customInterval,
        customStaggerOptimized: p.customStaggerOptimized,
        dayOfWeek: p.dayOfWeek,
        startDate: p.startDate,
        startTime: p.startTime,
        totalRows: csvRows.length,
      };
      const useCsvPublishDates = p.useCsvPublishDates !== false;
      const d0 =
        p.gapDatesBySlot?.[0] ??
        resolveBulkWordPressPublishDate({
          rowPublishDateGmt: csvRows[0]?.publish_date_gmt,
          rowIndex: 0,
          schedule: {
            ...scheduleOpts,
            useGapScheduling: p.useGapScheduling,
            scheduleOccupancy: p.scheduleOccupancy,
          },
          useCsvPublishDates,
        }).date;
      return {
        ...p,
        totalRows: csvRows.length,
        hybridAnchorUtc: { year: d0.getUTCFullYear(), month: d0.getUTCMonth() },
      };
    })();

    const contentBundleId =
      postingForLoop?.enabled && postingForLoop.postDestination === 'hybrid'
        ? crypto.randomUUID()
        : undefined;

    const selectedSiteId = Array.from(selectedWordPressSites)[0];
    const entitySitemapAvailable = Boolean(matchedWpSite?.entitySitemapUrl?.trim());
    const siteSitemapMode = resolveSiteSitemapMode(
      siteConfigs,
      selectedWordPressSites,
      entitySitemapAvailable,
    );
    const rowSitemapFallback: BulkRowSitemapType = entitySitemapAvailable ? 'entity' : 'post';

    let sitesToPostForPrefetch = buildSitesToPostFromPosting(postingForLoop);
    if (siteSitemapMode === 'custom' && postingForLoop?.enabled) {
      sitesToPostForPrefetch = buildCustomModePrefetchSites(
        postingForLoop,
        csvRows,
        rowSitemapFallback,
      );
    }
    let linkPrefetchPromise: Promise<void> | undefined;
    if (postingForLoop?.enabled && sitesToPostForPrefetch.length > 0) {
      linkPrefetchPromise = prefetchBulkWordPressLinkValidationForRun(sitesToPostForPrefetch);
    }

    // Step 1: Fetch WordPress posts for unique keywords (if connectedSite is provided)
    const wordPressPostsByKeyword = new Map<string, Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>>();
    
    if (connectedSite) {
      console.log('[Bulk Generate] Connected site provided:', connectedSite);
      try {
        notify.info(NOTIFY_FETCHING_WORDPRESS_POSTS);
        const sites = getStoredSites();
        console.log('[Bulk Generate] Found', sites.length, 'stored WordPress sites');
        
        // Hard block placeholder domains from ever being used
        const normalizeDomain = (url: string): string =>
          url.trim().toLowerCase().replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

        const connectedDomain = normalizeDomain(connectedSite.siteUrl);
        if (connectedDomain === 'example.com' || connectedDomain.endsWith('.example.com')) {
          notify.error(NOTIFY_INVALID_TARGET_SITE_EXAMPLE_COM_IS_NOT_A);
          setIsProcessing(false);
          return;
        }

        // Match site by connectedSite URL - must be exact match
        const wordPressSite = sites.find(s => {
          const normalize = (url: string) => url.trim().toLowerCase().replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');
          return normalize(s.siteUrl) === normalize(connectedSite.siteUrl);
        });
        
        console.log('[Bulk Generate] WordPress site match:', wordPressSite ? 'Found' : 'Not found', connectedSite.siteUrl);
        
        if (!wordPressSite) {
          console.warn('[WordPress] No matching site found for:', connectedSite.siteUrl);
          notify.warning(notifyWordpressSiteNotFoundX(connectedSite.siteUrl));
        } else if (wordPressSite.username && wordPressSite.appPassword) {
          const uniqueKeywords = new Set(csvRows.map(r => r.keyword.toLowerCase().trim()));
          console.log('[Bulk Generate] WordPress site credentials found, loading shared inventory for', uniqueKeywords.size, 'unique keywords');

          try {
            notify.info(NOTIFY_LOADING_WORDPRESS_SITE_INVENTORY_ONE_REQ);
            const inv = await ensureBulkGenerationWpInventory(wordPressSite, (msg) => notify.info(msg));
            if (inv.error?.trim()) {
              notify.warning(inv.error.trim());
            } else {
              const allLinkables = inventoryRowsToWordPressLinkables(inv.rows ?? []);
              if (allLinkables.length > 0) {
                for (const keyword of uniqueKeywords) {
                  wordPressPostsByKeyword.set(keyword, allLinkables);
                }
                notify.success(notifyLoadedXLinkableUrlsFromSiteInvento(allLinkables.length, uniqueKeywords.size));
              }
            }
          } catch (error) {
            console.error('[WordPress] Inventory fetch error:', error);
            notify.warning(notifyWordpressFetchFailedX(error instanceof Error ? error.message : 'Unknown error'));
          }

        }
      } catch (error) {
        console.error('[WordPress] Fetch error:', error);
        notify.warning(notifyWordpressFetchFailedX(error instanceof Error ? error.message : 'Unknown error'));
        // Continue processing even if WordPress fetch fails
      }
    }

    clearGoogleMapsImageSessionCache();
    const sapMapsMediaBank = createSapMapsMediaBank();
    const sapMapsEntityRowCounts = countSapMapsRowsByEntity(csvRows);

    // Peer featured image reuse: peers = stored sites minus every posting target
    // and the connected site (never search the site being written to).
    const peerExcludedIds = new Set<string>();
    const peerExcludedUrls = new Set<string>();
    for (const entry of postingForLoop?.sites ?? []) {
      if (entry.site?.id) peerExcludedIds.add(entry.site.id);
      if (entry.site?.siteUrl) peerExcludedUrls.add(normalizeSite(entry.site.siteUrl));
    }
    if (postingForLoop?.site?.id) peerExcludedIds.add(postingForLoop.site.id);
    if (postingForLoop?.site?.siteUrl) peerExcludedUrls.add(normalizeSite(postingForLoop.site.siteUrl));
    if (matchedWpSite?.id) peerExcludedIds.add(matchedWpSite.id);
    if (connectedSite?.siteUrl) peerExcludedUrls.add(normalizeSite(connectedSite.siteUrl));
    const peerSitesForRun = storedSitesForPortfolio.filter(
      (s) => !peerExcludedIds.has(s.id) && !peerExcludedUrls.has(normalizeSite(s.siteUrl)),
    );

    const peerFeaturedReport = createPeerFeaturedImageReportCollector();
    const peerFeaturedCsvByName = new Map<string, string>();
    const mergePeerFeaturedCsv = (file: PeerFeaturedLibraryCsvFile) => {
      const existing = peerFeaturedCsvByName.get(file.name);
      if (!existing) {
        peerFeaturedCsvByName.set(file.name, file.content);
        return;
      }
      const merged = existing.split('\n');
      const seen = new Set(merged);
      const incoming = file.content.split('\n');
      for (let li = 1; li < incoming.length; li += 1) {
        const line = incoming[li]!;
        if (line && !seen.has(line)) {
          seen.add(line);
          merged.push(line);
        }
      }
      peerFeaturedCsvByName.set(file.name, merged.join('\n'));
    };

    try {
      let runHadFailure = false;

      for (let i = 0; i < csvRows.length; i++) {
        if (controller.signal.aborted) {
          throw new Error('Processing cancelled');
        }

        const displayRowIndex = displayIndices[i]!;

        const rowSitemapType = resolveRowSitemapType(
          siteSitemapMode,
          csvRows[i]!,
          rowSitemapFallback,
        );
        const rowWordPressPosting = applyRowSitemapToPosting(postingForLoop, rowSitemapType);

        const options: BulkProcessingOptions = {
          apiKey: skipDataForSeoApiKey ? effectiveOpenRouterKey : apiKey!,
          openRouterApiKey: effectiveOpenRouterKey,
          openRouterOnly: skipDataForSeoApiKey,
          blogImportSourceFile,
          blogImportForm,
          selectedModel,
          temperature,
          maxTokens,
          topP,
          flowPurpose,
          featuredImageType,
          wordPressPosting: rowWordPressPosting,
          linkPrefetchPromise,
          wordPressPostsByKeyword: wordPressPostsByKeyword.size > 0 ? wordPressPostsByKeyword : undefined,
          portfolioBlockedHosts: portfolioBlockedHostsOpt,
          bulkScheduleSlotIndex: i,
          contentBundleId,
          sapMapsMediaBank,
          sapMapsEntityRowCounts,
          peerSites: peerSitesForRun.length > 0 ? peerSitesForRun : undefined,
          peerFeaturedReport,
          onPeerFeaturedCsv: mergePeerFeaturedCsv,
          // Inner pipeline passes the *storage* row index (displayRows index). Progress UI must stay batch-based (i).
          onProgress: (_storageRowIndex, _total, statusText) => {
            setCurrentRow(i);
            recordRunStatus(statusText);
          },
          onRowComplete: (_rowIndex, files) => {
            notify.success(notifyRowXXCompletedXFilesGenerated(i + 1, csvRows.length, files.length));
          },
          onError: (_rowIndex, error) => {
            console.warn(`Row ${i + 1} step error (row may still complete):`, error.message);
          },
        };

        setCurrentRow(i);

        try {
          // processRow now clears state internally before processing
          const files = await processRow(displayRowIndex, csvRows[i], options);
          snapshotHarnessForRow(i);
          // Only mark as complete if we got files back (all generation succeeded)
          if (files && files.length > 0) {
            options.onRowComplete?.(i, files);
          }
        } catch (error) {
          snapshotHarnessForRow(i);
          setFailedRowIndices((prev) => new Set(prev).add(i));
          runHadFailure = true;
          const msg = error instanceof Error ? error.message : String(error);
          setFailedRowMessages((prev) => ({ ...prev, [i]: msg }));
          recordRunStatus(`Failed: ${msg}`);
          notify.error(notifyRowXFailedX(i + 1, msg));
          console.error(`Error processing row ${i + 1}:`, error);
        }

        // Small delay between rows to avoid rate limiting
        if (i < csvRows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between rows
        }
      }

      if (!runHadFailure) {
        recordRunStatus('All rows processed');
      }
      const bundleNote =
        contentBundleId != null
          ? ` Content bundle id: ${contentBundleId} (bank rows tagged in source_row).`
          : '';
      notify.success(notifyBulkProcessingCompleteXFilesGenerat(fileManager.getStats().completed, bundleNote));
    } catch (error) {
      if (error instanceof Error && error.message === 'Processing cancelled') {
        notify.warning(NOTIFY_PROCESSING_CANCELLED_BY_USER);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        recordRunStatus(`Failed: ${errorMessage}`);
        notify.error(notifyBulkProcessingFailedX(errorMessage));
      }
    } finally {
      // Surface the searched peer libraries and the featured image source report as run files.
      const runFileTimestamp = Date.now();
      for (const [name, content] of peerFeaturedCsvByName) {
        fileManager.addFile({
          id: `bulk-peer-featured-csv-${name}`,
          rowIndex: 0,
          fileName: name,
          content,
          mimeType: 'text/csv;charset=utf-8',
          status: 'completed',
          timestamp: runFileTimestamp,
          rowData: { keyword: 'peer featured library', title: 'Peer featured library' },
        });
      }
      if (peerFeaturedImageReportHasContent(peerFeaturedReport)) {
        fileManager.addFile({
          id: 'bulk-peer-featured-report',
          rowIndex: 0,
          fileName: PEER_FEATURED_IMAGE_REPORT_FILENAME,
          content: formatPeerFeaturedImageReportMarkdown(peerFeaturedReport),
          mimeType: 'text/markdown',
          status: 'completed',
          timestamp: runFileTimestamp,
          rowData: { keyword: 'featured image sources', title: 'Featured image sources' },
        });
      }
      clearGoogleMapsImageSessionCache();
      if (postingForLoop?.enabled) {
        const siteIds: string[] = postingForLoop.sites?.map((s) => s.site.id).filter(Boolean) ?? [];
        if (siteIds.length === 0 && postingForLoop.site?.id) siteIds.push(postingForLoop.site.id);
        if (siteIds.length > 0) clearBulkUploadValidationCache(siteIds);
      }
      setIsProcessing(false);
      setCurrentRow(0);
      abortControllerRef.current = null;
      processingInFlightRef.current = false;
    }
  }, [apiKey, openRouterApiKey, selectedModel, temperature, maxTokens, topP, flowPurpose, fileManager, processRow, connectedSite, wordPressPosting, siteConfigs, selectedWordPressSites, skipDataForSeoApiKey, blogImportSourceFile, blogImportForm, recordRunStatus, snapshotHarnessForRow]);

  /**
   * Cancel processing
   */
  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      recordRunStatus('Cancelled');
    }
  }, [recordRunStatus]);

  /**
   * Download a file
   */
  const downloadFile = useCallback((file: BulkGeneratedFile) => {
    fileManager.downloadFile(file);
  }, [fileManager]);

  /**
   * Download all files for a row
   */
  const downloadRowFiles = useCallback((rowIndex: number) => {
    fileManager.downloadRowFiles(rowIndex);
  }, [fileManager]);

  /**
   * Download all files
   */
  const downloadAllFiles = useCallback(() => {
    fileManager.downloadAllFiles();
  }, [fileManager]);

  return {
    // State
    isProcessing,
    setIsProcessing,
    currentRow,
    setCurrentRow,
    totalRows,
    setTotalRows,
    status,
    processingStepLog,
    harnessSections,
    harnessByRow,
    harnessPlannedSectionCount,
    rows,
    setRows,
    fileManager,
    
    // Actions
    loadCSV,
    processAllRows,
    cancelProcessing,
    downloadFile,
    downloadRowFiles,
    downloadAllFiles,
    downloadRunContentCsv,
    runContentCsvAvailable,
    
    // Stats (derived; filesTick ensures updates when BulkFileManager changes)
    stats,
    filesByRow,
    failedRowIndices,
    failedRowMessages,
  };
}

