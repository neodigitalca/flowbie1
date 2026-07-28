import { fetchWikipediaContent, generateWikipediaCSV } from './wikipedia-api';
import { parseImportedSectionsJson, parseImportedLinksJson, parseKeywordQuestionsJson, parseModifierLinksJson } from './bulk/bulk-csv-parser';
import {
  injectImportedLinksIntoBlueprintAgents,
  injectImportedLinksIntoChecklist,
  type ImportedDraftLink,
} from './bulk/blog-import-draft-links';
import {
  injectEntityWikipediaIntoBlueprintAgents,
  injectEntityWikipediaIntoChecklist,
} from './bulk/entity-wikipedia-prompt';
import {
  injectModifierExternalLinksIntoBlueprintAgents,
  injectModifierExternalLinksIntoChecklist,
  researchModifierExternalLinks,
  type ModifierExternalLink,
} from './bulk/modifier-external-links';
import {
  formatPrefilledBulkRowContractFromCsvRow,
  hasCsvFilledMeta,
  hasCsvFilledTitle,
  hasCsvFilledWikipediaUrl,
} from './bulk/prefilled-bulk-row-contract';
import {
  formatImportedToneForHarnessPrompt,
  resolveImportedBlogToneForRow,
} from './bulk/blog-import-tone';
import { generateChecklistFromSelections, generateBlueprintFromTemplate, type BlogTemplateContext } from './blog-template-builder';
import { getResearchModel } from './optimization-settings-storage';
import { buildImagePrompt } from './image-prompt-builder';
import type { ImageChecklistItem } from './image-checklist-builder';
import { generateSEOImageFilename } from './image-filename-generator';
import type { KeywordData, KeywordAIAnalysis } from './keyword-types';
import { BulkFileManager, type BulkGeneratedFile } from './bulk-file-manager';
import type { WordPressSite } from '@/components/integrations/types';
import {
  createWordPressPost,
  updateWordPressPost,
  uploadWordPressMedia,
  updateWordPressPostMeta,
} from './wordpress-api';
import { fetchGoogleMapsImageForEntity, peekGoogleMapsImageCache } from './content-generation/google-maps-image-api';
import {
  findPeerFeaturedImageForRow,
  type PeerFeaturedImageForRow,
} from './bulk/peer-featured-image-for-row';
import {
  recordPeerFeaturedImageOutcome,
  type PeerFeaturedImageReportCollector,
} from './bulk/peer-featured-image-report';
import type { PeerFeaturedLibraryCsvFile } from './overview/sap-peer-featured-image-search';
import {
  getSapMapsMediaId,
  sapMapsImageFileName,
  sapMapsMediaTitleAlt,
  sapMapsReuseProgressLabel,
  setSapMapsMediaId,
  type SapMapsMediaBank,
} from './bulk/sap-maps-media-bank';
import { entityAdGroupKey } from './local-analysis/sap-entity-ad-groups';
import { insertBankPost } from '@/lib/post-bank-api';
import { insertSapBankPost } from '@/lib/sap-bank-api';
import { markdownToHtml, generateExcerpt } from './markdown-to-html';
import {
  formatWordPressDate,
  resolveBulkWordPressPublishDate,
  resolveHybridEffectiveDestination,
  resolveWordPressPostStatusForSchedule,
  type HybridPostingMode,
} from './wordpress-scheduler';
import { sanitizeWordPressSlugSegment } from './rank-math-redirect-csv';
import { buildSapSlugFromKeywordEntity } from '@/lib/sap-slug-from-keyword-entity';
import { extractEndpointFromEntitySitemapUrl } from './entity-endpoint-extractor';
import { updateACFFields } from './wordpress-acf-origin';
import { getACFFieldsForPost } from '@/lib/wordpress-api/acf-discovery';
import { discoverACFFieldMapping, fallbackFieldMapping } from '@/lib/content-generation/acf-field-mapper';
import { mergeSeoResearchWithMeta, buildAcfPayload } from '@/lib/content-generation/apply-meta-acf-payload';
import { generateOptimizedMetaFields } from '@/lib/meta-field-optimizer';
import {
  applyBulkSeoMetaToAcf,
  buildOptimizedMetaFromKeywordResearch,
} from '@/lib/content-generation/apply-bulk-meta-from-seo-json';
import { OptimizationFileManager } from '@/lib/optimization-file-manager';
import {
  buildFAQSchemaScriptFromEntries,
} from './content-generation/wordpress-uploader';
import {
  generateBulkFaqEntriesInContext,
  napLocationsFromSite,
} from '@/lib/content-generation/bulk-faq-in-context';
import { parseFaqEntries, type FaqEntry } from '@/lib/faq-entries';
import { appendVisibleFaqTableWithIntro, FLO_FAQ_CLASS } from '@/lib/overview/overview-blog-faq-append';
import {
  buildPreBlogSeoResearchSkeleton,
  mergeBlueprintIntoPreBlogSkeleton,
  buildPostMarkdownAcfSeoFaqBundle,
  patchPostLinkInSeoResearchJson,
  resolveFaqEntriesForVisibleTable,
  type PrecomputedAcfSeoBundle,
} from '@/lib/content-generation/bulk-acf-seo-bundle';
import { generateMetaDescription } from '@/lib/content-generation/content-generator';
import { resolveBulkWordPressPostTitle } from '@/lib/bulk/bulk-post-title-agent';
import { sanitizeContentForUpload, convertAllMarkdownToHtml, forceConvertMarkdownLinks } from './content-generation/content-sanitizer';
import { ensureLinksEvery200WordsForHtml } from './content-generation/ensure-links-per-section';
import { ensureSemrushExternalLinksInHtml } from './content-generation/ensure-semrush-external-links';
import { generateSEOSlug } from './seo-slug-generator';
import { loadApiKey } from './api';
import {
  fetchSemrushBulkEnrichment,
  type SemrushBulkEnrichmentResult,
} from './wordpress-api/semrush';
import type { IntelligentKeywordResearchMergeResult } from './bulk/intelligent-keyword-research-merge';
import { buildSemrushKeywordsRagJson } from './semrush-keywords-rag';
import { buildSemrushClusterScatterPlan, buildSemrushScatterContextJson } from './semrush-cluster-scatter';
import { resolveRecommendedAuthor } from './wordpress-api/author-resolver';

// Import from new feature-based modules
import type { CSVRow } from './bulk/bulk-csv-parser';
import { resolveBulkPrimaryKeyword } from './bulk/bulk-primary-keyword';
import { parseCSV, parseBlogIdeasChecklist } from './bulk/bulk-csv-parser';
import { 
  autoSelectKeywords, 
  autoSelectH2Sections, 
  autoSelectPeopleAlsoAsk, 
  autoSelectResearchLinks 
} from './bulk/bulk-blueprint-generator';
import { 
  generateMarkdownContent, 
  generateMarkdownContentHarnessed,
  addEntityLinksToContent,
} from './bulk/bulk-content-generator';
import { 
  generateImageChecklist, 
  generateFeaturedImage 
} from './bulk/bulk-image-generator';
import { generateEntityTitleFromSitemap } from './bulk/bulk-entity-handler';
import type { RunHistoryEntry } from '@/hooks/content-optimization/use-optimization-state';
import { validateAndStripInvalidLinksFromContent, normalizeInternalUrl } from './wordpress-api/validate-internal-links';
import { getValidatedPosts } from './cached-link-validation';
import { createSiteCache, seedSiteCacheFromBulkInventory } from './wordpress-site-cache';
import { clearValidationCache } from './cached-link-validation';
import { extractOriginFromSapTitle } from '@/lib/sap-origin-from-title';
import {
  ensureBulkGenerationWpInventory,
} from '@/lib/bulk/bulk-generation-wp-inventory';

/** Validated link URLs per site (run-scoped). Filled on first upload to each site; cleared when run ends. */
const preValidatedUrlsBySite = new Map<string, Set<string>>();

/**
 * Resolves posting config to the same site list used for WordPress upload.
 */
export function buildSitesToPostFromPosting(
  posting: WordPressPostingOptions | undefined
): Array<{ site: WordPressSite; sitemapType: 'post' | 'entity' }> {
  if (!posting?.enabled) return [];
  if (posting.sites && posting.sites.length > 0) {
    return posting.sites.map((s) => ({ site: s.site, sitemapType: s.sitemapType }));
  }
  if (posting.site) {
    return [{ site: posting.site, sitemapType: posting.sitemapType }];
  }
  return [];
}

/**
 * Prefetch HTTP-200 link validation for all distinct posting sites in parallel (Promise.all).
 * Run without awaiting at bulk start so it overlaps keyword research / checklist / content.
 * Callers await `linkPrefetchPromise` at WordPress upload time.
 */
export function prefetchBulkWordPressLinkValidationForRun(
  sitesToPost: Array<{ site: WordPressSite; sitemapType: 'post' | 'entity' }>,
  onProgress?: (message: string) => void
): Promise<void> {
  const seen = new Set<string>();
  const uniqueSites = sitesToPost
    .map((x) => x.site)
    .filter((site) => {
      if (!site.id || seen.has(site.id)) return false;
      seen.add(site.id);
      return true;
    });
  if (uniqueSites.length === 0) return Promise.resolve();

  clearBulkUploadValidationCache(uniqueSites.map((s) => s.id));

  return Promise.all(
    uniqueSites.map(async (site) => {
      if (!site.username || !site.appPassword) return;
      try {
        onProgress?.(`Validating internal links for ${site.name} (background)...`);
        const inv = await ensureBulkGenerationWpInventory(site, onProgress);
        const cache =
          (inv.rows?.length ?? 0) > 0
            ? seedSiteCacheFromBulkInventory(site, inv.rows ?? [])
            : await createSiteCache(site, undefined, (msg) => onProgress?.(msg));
        const validatedPosts = await getValidatedPosts(
          site.id,
          site.siteUrl,
          cache.posts,
          (msg) => onProgress?.(msg)
        );
        const set = new Set(
          validatedPosts.map((p) => normalizeInternalUrl(site.siteUrl, p.link)).filter(Boolean)
        );
        preValidatedUrlsBySite.set(site.id, set);
      } catch (err) {
        console.warn('[Bulk Upload] Link validation prefetch failed for site:', site.name, err);
      }
    })
  ).then(() => undefined);
}

/**
 * Clears run-scoped link validation cache for the given sites. Call after bulk upload phase ends.
 */
export function clearBulkUploadValidationCache(siteIds: string[]): void {
  for (const id of siteIds) {
    preValidatedUrlsBySite.delete(id);
    clearValidationCache(id);
  }
}

/**
 * GSC / merged research often attach rank_math_* and focus_keyword on keywordData (see DFS export JSON).
 * Use these for WordPress + Rank Math so the live post matches the research file.
 */
export function resolveRankMathFromKeywordResearch(keywordData: KeywordData): {
  seoTitle: string | undefined;
  metaDescription: string | undefined;
  focusKeyword: string | undefined;
} {
  const ext = keywordData as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    seoTitle: str(ext.rank_math_title) || undefined,
    metaDescription: str(ext.rank_math_description) || undefined,
    focusKeyword:
      str(ext.rank_math_focus_keyword) || str(ext.focus_keyword) || undefined,
  };
}

// Re-export types and functions for backward compatibility
export type { CSVRow } from './bulk/bulk-csv-parser';
export { parseCSV, parseCsvStatic, parseBlogIdeasChecklist } from './bulk/bulk-csv-parser';
export { generateEntityTitleFromSitemap } from './bulk/bulk-entity-handler';

export type WordPressPostDestination = 'wordpress' | 'bank' | 'hybrid' | 'local';

/** Default export destinations shown in bulk WordPress posting UI. */
export const BULK_POST_DESTINATION_CHOICES: WordPressPostDestination[] = [
  'wordpress',
  'bank',
  'hybrid',
  'local',
];

/** Blog import tab: WordPress, bank, or local files only (no hybrid). */
export const BLOG_IMPORT_POST_DESTINATION_CHOICES: WordPressPostDestination[] = [
  'wordpress',
  'bank',
  'local',
];

export interface WordPressPostingOptions {
  enabled: boolean;
  site: WordPressSite; // Deprecated: use sites array instead
  sitemapType: 'post' | 'entity'; // Which sitemap to post to
  frequency: 'immediately' | 'daily' | 'weekly' | 'monthly' | 'custom' | 'everyNDays';
  customInterval?: number;
  /** When frequency is `custom`: stagger publish times across the optimized window from Start Time. */
  customStaggerOptimized?: boolean;
  dayOfWeek?: number;
  startDate: Date;
  startTime: string;
  totalRows: number;
  // New: Support for multiple sites
  sites?: Array<{
    site: WordPressSite;
    sitemapType: 'post' | 'entity';
  }>;
  /** When false, ignore per-row CSV `publish_date_gmt` and use frequency schedule only (default true). */
  useCsvPublishDates?: boolean;
  /**
   * `wordpress`: create scheduled posts on the site(s).
   * `bank`: queue in Supabase content bank with `scheduled_date_gmt`.
   * `hybrid`: same schedule; slot-0 anchor UTC month → WordPress, later months → bank (see `hybridAnchorUtc`).
   * `local`: generate files only (JSON, harness HTML, run CSV) — no WordPress or bank upload.
   */
  postDestination?: WordPressPostDestination;
  /** Set for `hybrid` from slot 0’s scheduled instant: UTC `{ year, month }` where `month` is 0–11. */
  hybridAnchorUtc?: { year: number; month: number };
  /** Inventory occupancy for Next available slot gap scheduling. */
  scheduleOccupancy?: import('@/lib/bulk-schedule-gap').ScheduleOccupancy;
  useGapScheduling?: boolean;
  /** Precomputed gap dates per batch slot (set at run start). */
  gapDatesBySlot?: Date[];
  /** When true, save as WordPress/bank draft instead of publish or future. */
  draftOnly?: boolean;
}

export type BulkHarnessSectionPayload = {
  rowIndex: number;
  sectionIndex: number;
  /** Total blueprint sections for this row (fixed for the whole harness run). */
  totalSections: number;
  title: string;
  phase: 'start' | 'progress' | 'done';
  markdownSlice?: string;
  /** True when OpenRouter finish_reason indicates output length cap. */
  truncated?: boolean;
};

export interface BulkProcessingOptions {
  /** Legacy field; Generator uses OpenRouter only (`openRouterApiKey`). */
  apiKey: string;
  openRouterApiKey: string;
  /** Generator workspace: skip DataForSEO keyword research. */
  openRouterOnly?: boolean;
  /** Blog import: local file sent to OpenRouter at run start. */
  blogImportSourceFile?: File | null;
  blogImportForm?: {
    focusKeyword: string;
    titleOverride: string;
    featuredImageMode: "y" | "n" | "google-maps";
    entity: string;
  };
  selectedModel?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  flowPurpose?: string;
  featuredImageType?: 'ai-generated' | 'google-maps';
  wordPressPosting?: WordPressPostingOptions;
  /**
   * When true, checklist/blueprint use the entity (service-area) template: "near [entity]", We Care About, etc.
   * Set only when posting is enabled and every target site uses entity sitemap (not post/blog sitemap).
   */
  useEntitySitemapTemplate?: boolean;
  /** Started at bulk run start (tandem with research); await at WordPress upload only */
  linkPrefetchPromise?: Promise<void>;
  wordPressPostsByKeyword?: Map<string, Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>>;
  onProgress?: (rowIndex: number, totalRows: number, status: string) => void;
  onRowComplete?: (rowIndex: number, files: BulkGeneratedFile[]) => void;
  onError?: (rowIndex: number, error: Error) => void;
  onAppendHistory?: (entry: RunHistoryEntry) => void;
  /** Per-section harness progress (parallel workers may emit overlapping start/done events). */
  onHarnessSection?: (payload: BulkHarnessSectionPayload) => void;
  /** AI summary of site (posts sitemap scraped + summarized) for aligning service-area content */
  siteSummary?: string;
  /** Other managed client domains - Semrush bulk enrichment must not surface these as approved externals */
  portfolioBlockedHosts?: string[];
  /**
   * Batch slot index (0..n-1) for schedule math. When set, overrides `rowIndex` for `resolveBulkWordPressPublishDate`
   * so prompt permutations match the schedule preview.
   */
  bulkScheduleSlotIndex?: number;
  /** Hybrid-run bundle id merged into bank `source_row` as `flowbie_content_bundle_id`. */
  contentBundleId?: string;
  /**
   * Run-scoped Google Maps media bank: one WP upload per site + location entity.
   * Created at bulk run start and shared across rows.
   */
  sapMapsMediaBank?: SapMapsMediaBank;
  /** Rows per entityAdGroupKey for Maps progress labels (1 upload shared by N SAP pages). */
  sapMapsEntityRowCounts?: Map<string, number>;
  /** Connected peer sites (target sites excluded) searched for reusable featured images. */
  peerSites?: WordPressSite[];
  /** Run-scoped collector for the end-of-run featured image source report. */
  peerFeaturedReport?: PeerFeaturedImageReportCollector;
  /** Fired when a searched peer featured library CSV is ready (added to run files). */
  onPeerFeaturedCsv?: (file: PeerFeaturedLibraryCsvFile) => void;
}

export interface BulkProcessingResult {
  success: boolean;
  totalRows: number;
  completedRows: number;
  failedRows: number;
  files: BulkGeneratedFile[];
  errors: Array<{ rowIndex: number; error: string }>;
}

/** Passed from bulk hook when Semrush + intelligent merge already ran alongside DFS. */
export type PrefetchedBulkKeywordResearch = {
  semrush: SemrushBulkEnrichmentResult;
  primaryExternalCitationUrl: string | null;
  intelligentMerge: IntelligentKeywordResearchMergeResult | null;
};

function safeTrimSemrushOverviewForAcf(overview: unknown): unknown {
  if (overview == null) return undefined;
  try {
    const s = JSON.stringify(overview);
    if (s.length <= 12000) {
      return JSON.parse(s) as unknown;
    }
    return { truncated: true as const, preview: s.slice(0, 12000) };
  } catch {
    return undefined;
  }
}

function mergeSemrushFieldsIntoSeoResearchJson(
  jsonStr: string,
  extras: Record<string, unknown>
): string {
  try {
    const o = JSON.parse(jsonStr) as Record<string, unknown>;
    return JSON.stringify({ ...o, ...extras }, null, 2);
  } catch {
    return jsonStr;
  }
}

/**
 * Process a single row and generate all outputs
 */
export async function generateRowOutputs(
  rowIndex: number,
  row: CSVRow,
  options: BulkProcessingOptions,
  fileManager: BulkFileManager,
  analyzeKeywordFn: (keyword: string, location: { location: string; language: string }) => Promise<void>
): Promise<BulkGeneratedFile[]> {
  const timestamp = Date.now();
  const generatedFiles: BulkGeneratedFile[] = [];

  try {
    // Step 1: Fetch Wikipedia content only when entity is set and CSV did not already provide wikipedia_url
    if (row.entity && row.entity.trim() && !hasCsvFilledWikipediaUrl(row)) {
      options.onProgress?.(rowIndex, 0, `Fetching Wikipedia content for "${row.entity}"...`);

      try {
        // First verify the entity exists on Wikipedia
        const { checkWikipediaPageExists } = await import('./wikipedia-api');
        const entityCheck = await checkWikipediaPageExists(row.entity.trim());
        
        if (!entityCheck.exists) {
          console.warn(`[Bulk Generator] Entity "${row.entity}" does not exist on Wikipedia. Skipping Wikipedia content fetch.`);
          options.onProgress?.(rowIndex, 0, `Entity "${row.entity}" not found on Wikipedia, skipping...`);
        } else {
          // Fetch Wikipedia content with retry logic
          let wikipediaChunks: any[] = [];
          let retries = 3;
          let lastError: Error | null = null;
          
          while (retries > 0) {
            try {
              const { fetchWikipediaContent } = await import('./wikipedia-api');
              wikipediaChunks = await fetchWikipediaContent(row.entity.trim());
              break; // Success
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              retries--;
              
              if (retries === 0) {
                console.error(`[Bulk Generator] Failed to fetch Wikipedia content for "${row.entity}" after retries:`, lastError);
                // Don't throw - continue without Wikipedia content
                options.onProgress?.(rowIndex, 0, `Failed to fetch Wikipedia content for "${row.entity}", continuing without it...`);
              } else {
                // Wait before retry (exponential backoff)
                const delay = 1000 * (4 - retries);
                options.onProgress?.(rowIndex, 0, `Retrying Wikipedia fetch for "${row.entity}" (${4 - retries}/3)...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }
          
          if (wikipediaChunks.length > 0) {
            const { generateWikipediaCSV } = await import('./wikipedia-api');
            const wikipediaCSV = generateWikipediaCSV(wikipediaChunks);
            const wikipediaFileName = BulkFileManager.generateFileName(row, 'wikipedia', timestamp);
            const wikipediaFileId = BulkFileManager.createFileId(rowIndex, 'wikipedia', timestamp);
            
            const wikipediaFile: BulkGeneratedFile = {
              id: wikipediaFileId,
              rowIndex,
              fileName: wikipediaFileName,
              content: wikipediaCSV,
              mimeType: 'text/csv',
              status: 'completed',
              timestamp,
              rowData: row,
            };
            
            fileManager.addFile(wikipediaFile);
            generatedFiles.push(wikipediaFile);
            options.onProgress?.(rowIndex, 0, `Wikipedia content fetched for "${row.entity}" (${wikipediaChunks.length} chunks)`);
          } else if (entityCheck.exists) {
            console.warn(`[Bulk Generator] Wikipedia page exists for "${row.entity}" but no content chunks were extracted.`);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Bulk Generator] Error fetching Wikipedia content for "${row.entity}":`, errorMessage);
        // Continue without Wikipedia content - don't fail the entire generation
        options.onProgress?.(rowIndex, 0, `Error fetching Wikipedia content for "${row.entity}", continuing without it...`);
      }
    } else if (hasCsvFilledWikipediaUrl(row)) {
      options.onProgress?.(rowIndex, 0, `Using CSV wikipedia_url; skipping Wikipedia KB fetch`);
    }

    const skipKeywordResearch = Boolean(options.openRouterOnly);

    if (skipKeywordResearch) {
      options.onProgress?.(rowIndex, 0, 'OpenRouter generation...');
    } else {
      options.onProgress?.(rowIndex, 0, 'Running keyword research...');

      // Step 2: Run keyword research
      await analyzeKeywordFn(row.keyword, {
        location: 'United States',
        language: 'en',
      });
    }

    // Wait for keyword research to complete (this is handled by the hook)
    // Note: This is a simplified version. In practice, we'll need to integrate
    // with the keyword research hook to get the actual results.
    // This will be handled in the useBulkAutoGenerate hook.

    return generatedFiles;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    options.onError?.(rowIndex, error instanceof Error ? error : new Error(errorMessage));
    throw error;
  }
}

/**
 * Writes full DataForSEO / keyword-research payload to the bulk file list as soon as research completes,
 * before Semrush enrichment, checklist, or blueprint (so the UI can show downloads immediately).
 */
export function addKeywordResearchSnapshotToBulkFiles(
  rowIndex: number,
  row: CSVRow,
  fileManager: BulkFileManager,
  options: Pick<BulkProcessingOptions, 'onProgress'>,
  timestamp: number,
  payload: {
    keywordData: KeywordData;
    aiAnalysis: KeywordAIAnalysis;
    keywordsVolumeData: KeywordData[];
    paaRawResponse: unknown;
    primaryKeyword?: string;
    semrush?: SemrushBulkEnrichmentResult | null;
    intelligentMerge?: IntelligentKeywordResearchMergeResult | null;
    primaryExternalCitationUrl?: string | null;
  }
): BulkGeneratedFile {
  const fileName = BulkFileManager.generateFileName(row, 'dfs_research', timestamp);
  const id = BulkFileManager.createFileId(rowIndex, 'dfs-research', timestamp);
  const body = {
    generatedAt: new Date().toISOString(),
    primaryKeyword: payload.primaryKeyword ?? row.keyword,
    dataforseo: {
      keywordData: payload.keywordData,
      aiAnalysis: payload.aiAnalysis,
      keywordsVolumeData: payload.keywordsVolumeData,
      paaRawResponse: payload.paaRawResponse,
    },
    semrush: payload.semrush ?? null,
    intelligentMerge: payload.intelligentMerge ?? null,
    primaryExternalCitationUrl: payload.primaryExternalCitationUrl ?? null,
    keywordData: payload.keywordData,
    aiAnalysis: payload.aiAnalysis,
    keywordsVolumeData: payload.keywordsVolumeData,
    paaRawResponse: payload.paaRawResponse,
  };
  let content: string;
  try {
    content = JSON.stringify(body, null, 2);
  } catch {
    content = JSON.stringify(
      {
        generatedAt: body.generatedAt,
        primaryKeyword: body.primaryKeyword,
        error: 'Could not stringify full DFS snapshot (payload too large or circular)',
        keywordData: payload.keywordData,
      },
      null,
      2
    );
  }
  const file: BulkGeneratedFile = {
    id,
    rowIndex,
    fileName,
    content,
    mimeType: 'application/json',
    status: 'completed',
    timestamp,
    rowData: row,
  };
  fileManager.addFile(file);
  options.onProgress?.(rowIndex, 0, 'Keyword research JSON (DataForSEO + Semrush) ready - download above');
  return file;
}

/**
 * Generate blueprint and content for a row
 * This function is called after keyword research is complete
 */
/**
 * Populate ACF fields from DFS data for new posts (skipping GSC)
 */
function populateACFFieldsFromDFS(
  row: CSVRow,
  keywordData: KeywordData,
  aiAnalysis: KeywordAIAnalysis,
  keywordsWithVolumeData: any[]
): Partial<CSVRow> {
  const acfFields: Partial<CSVRow> = {};
  
  // Set date_modifier to today's date if not already set
  if (!row.date_modifier) {
    acfFields.date_modifier = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  // Set prompt_modifier from row.modifier if not already set
  if (!row.prompt_modifier && row.modifier) {
    acfFields.prompt_modifier = row.modifier;
  }
  
  // ACF origin: prefer hyperlocal phrase from title ("… in Place, City"), then entity
  if (!row.origin?.trim()) {
    const fromTitle = extractOriginFromSapTitle(row.title);
    if (fromTitle) {
      acfFields.origin = fromTitle;
    } else if (row.entity && row.entity.trim() && row.entity.trim() !== 'N/A') {
      acfFields.origin = row.entity.trim();
    }
  }
  
  // Set service_area_fields from entity or keyword data if available
  // This could be expanded to include more service area data from DFS
  if (!row.service_area_fields) {
    const serviceAreaParts: string[] = [];
    if (row.entity && row.entity.trim() && row.entity.trim() !== 'N/A') {
      serviceAreaParts.push(row.entity.trim());
    }
    if (keywordData?.keyword) {
      serviceAreaParts.push(keywordData.keyword);
    }
    if (serviceAreaParts.length > 0) {
      acfFields.service_area_fields = serviceAreaParts.join(', ');
    }
  }
  
  return acfFields;
}

export async function generateBlueprintAndContent(
  rowIndex: number,
  row: CSVRow,
  keywordData: KeywordData,
  aiAnalysis: KeywordAIAnalysis,
  keywordsWithVolumeData: any[],
  paaRawResponse: any,
  options: BulkProcessingOptions,
  fileManager: BulkFileManager,
  knowledgeFiles: Array<{ name: string; content: string }> = [],
  activeKnowledgeBaseText: string = '',
  connectedSite?: { name: string; siteUrl: string },
  wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>,
  prefetchedResearch?: PrefetchedBulkKeywordResearch | null
): Promise<BulkGeneratedFile[]> {
  const timestamp = Date.now();
  const generatedFiles: BulkGeneratedFile[] = [];
  let semrushKeywordsContext: string | undefined;
  let semrushScatterContext: string | undefined;
  let semrushExternalUrlsForSanitize: string[] = [];
  let semrushSnapshotForAcf: SemrushBulkEnrichmentResult | undefined;
  let semrushCitationForAcf: string | null = null;
  let intelligentMergeForAcf: IntelligentKeywordResearchMergeResult | null = null;

  // Populate ACF fields from DFS data (for new posts, skipping GSC)
  const acfFieldsFromDFS = populateACFFieldsFromDFS(row, keywordData, aiAnalysis, keywordsWithVolumeData);
  // Merge ACF fields: existing row values take precedence, then DFS data
  let enrichedRow: CSVRow = {
    ...row,
    ...acfFieldsFromDFS,
    // Preserve existing ACF fields if they exist
    date_modifier: row.date_modifier || acfFieldsFromDFS.date_modifier,
    prompt_modifier: row.prompt_modifier || acfFieldsFromDFS.prompt_modifier,
    service_area_fields: row.service_area_fields || acfFieldsFromDFS.service_area_fields,
    origin: row.origin || acfFieldsFromDFS.origin,
  };

  const sitesToPostForTemplate = buildSitesToPostFromPosting(options.wordPressPosting);
  const useEntitySitemapTemplate =
    Boolean(options.wordPressPosting?.enabled) &&
    sitesToPostForTemplate.length > 0 &&
    sitesToPostForTemplate.every(
      (s) => s.sitemapType === 'entity' && Boolean(s.site.entitySitemapUrl?.trim())
    );
  const entityForLocalTemplate =
    useEntitySitemapTemplate &&
    enrichedRow.entity?.trim() &&
    enrichedRow.entity.trim() !== 'N/A'
      ? enrichedRow.entity.trim()
      : undefined;
  const entityWikiUrl = enrichedRow.wikipedia_url?.trim() || undefined;
  const entityWikiTitle = enrichedRow.wikipedia_title?.trim() || undefined;
  const bulkOptions: BulkProcessingOptions = { ...options, useEntitySitemapTemplate };

try {
    // CRITICAL FIX: Merge PAA questions from paaRawResponse into aiAnalysis
    // The AI analyzer returns empty peopleAlsoAsk because PAA is extracted separately
    // We need to populate it here so autoSelectPeopleAlsoAsk works correctly
    if (paaRawResponse?.tasks?.[0]?.result?.[0]?.items) {
      const paaItems = paaRawResponse.tasks[0].result[0].items;
      if (Array.isArray(paaItems) && paaItems.length > 0) {
        aiAnalysis.peopleAlsoAsk = paaItems
          .filter((item: any) => item.type === 'people_also_ask' && item.items)
          .flatMap((item: any) => item.items || [])
          .slice(0, 10)
          .map((item: any) => ({
            question: item.title || '',
            snippet: item.snippet || ''
          }))
          .filter((paa: any) => paa.question);
        console.log('[Bulk Auto-Generate] Merged PAA questions into aiAnalysis:', {
          paaItemsCount: paaItems.length,
          aiAnalysisPAACount: aiAnalysis.peopleAlsoAsk.length
        });
      }
    }

    // Semrush keyword enrichment (bulk hook prefetches in parallel with DFS when provided)
    try {
      const baseUrl = connectedSite?.siteUrl?.replace(/\/+$/, '') || '';
      const seed =
        row.keyword?.trim() ||
        row.keyword_focus?.trim() ||
        keywordData.keyword?.trim() ||
        '';
      const slug = seed ? generateSEOSlug(seed) : '';
      const pageUrl = baseUrl && slug ? `${baseUrl}/${slug}` : '';
      const portfolioBlockedHosts =
        options.portfolioBlockedHosts && options.portfolioBlockedHosts.length > 0
          ? options.portfolioBlockedHosts
          : undefined;

      const semrush: SemrushBulkEnrichmentResult =
        prefetchedResearch?.semrush != null
          ? prefetchedResearch.semrush
          : await fetchSemrushBulkEnrichment({
              pageUrl,
              seedKeyword: seed,
              portfolioBlockedHosts,
            });

      semrushExternalUrlsForSanitize = semrush.externalSemrushUrls ?? [];
      const ragJson = buildSemrushKeywordsRagJson(semrush);
      if (ragJson.trim()) {
        semrushKeywordsContext = ragJson;
      }
      const clusterScatter =
        !semrush.skipped &&
        ((semrush.urlOrganicKeywords?.length ?? 0) > 0 || (semrush.phraseRelatedKeywords?.length ?? 0) > 0)
          ? buildSemrushClusterScatterPlan({
              acfKeyword: seed || keywordData.keyword || '',
              urlOrganicKeywords: semrush.urlOrganicKeywords ?? [],
              phraseRelatedKeywords: semrush.phraseRelatedKeywords ?? [],
            })
          : undefined;
      const scatterJson = buildSemrushScatterContextJson(clusterScatter);
      if (scatterJson) {
        semrushScatterContext = scatterJson;
      }
      const semrushFileName = BulkFileManager.generateFileName(row, 'sem_rush', timestamp);
      const semrushFileId = BulkFileManager.createFileId(rowIndex, 'sem_rush', timestamp);
      const semrushFile: BulkGeneratedFile = {
        id: semrushFileId,
        rowIndex,
        fileName: semrushFileName,
        content: JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            pageUrl,
            seedKeyword: seed,
            semrush,
            externalSemrushUrls: semrush.externalSemrushUrls ?? [],
            clusterScatter: clusterScatter ?? undefined,
            primaryExternalCitationUrl: prefetchedResearch?.primaryExternalCitationUrl ?? null,
            intelligentMerge: prefetchedResearch?.intelligentMerge ?? null,
          },
          null,
          2
        ),
        mimeType: 'application/json',
        status: 'completed',
        timestamp,
        rowData: row,
      };
      fileManager.addFile(semrushFile);
      generatedFiles.push(semrushFile);
      options.onProgress?.(rowIndex, 0, 'Semrush enrichment JSON ready - download above');

      semrushSnapshotForAcf = semrush;
      semrushCitationForAcf = prefetchedResearch?.primaryExternalCitationUrl ?? null;
      intelligentMergeForAcf = prefetchedResearch?.intelligentMerge ?? null;
    } catch (e) {
      console.warn('[Bulk Auto-Generate] Semrush enrichment failed (non-fatal):', e);
    }
    
    // Auto-select items using blueprint generator module (Local Analysis CSV / blog import may supply verbatim H2s)
    const importedSections = parseImportedSectionsJson(
      enrichedRow.imported_sections_json ?? row.imported_sections_json
    );
    const useVerbatimImportedH2 = importedSections != null && importedSections.length > 0;

    let importedToneProfile: Awaited<
      ReturnType<typeof resolveImportedBlogToneForRow>
    >['profile'] = null;
    if (useVerbatimImportedH2) {
      options.onProgress?.(rowIndex, 0, 'Analyzing imported draft tone & voice...');
      const toneResolved = await resolveImportedBlogToneForRow({
        row: enrichedRow,
        apiKey: options.openRouterApiKey,
        model: options.selectedModel,
      });
      importedToneProfile = toneResolved.profile;
      if (toneResolved.toneJson) {
        enrichedRow = { ...enrichedRow, imported_tone_json: toneResolved.toneJson };
      }
      if (importedToneProfile) {
        const toneFileName = BulkFileManager.generateFileName(enrichedRow, 'import_tone', timestamp);
        const toneFile: BulkGeneratedFile = {
          id: BulkFileManager.createFileId(rowIndex, 'import-tone', timestamp),
          rowIndex,
          fileName: toneFileName,
          content: JSON.stringify(importedToneProfile, null, 2),
          mimeType: 'application/json',
          status: 'completed',
          timestamp,
          rowData: enrichedRow,
        };
        fileManager.addFile(toneFile);
        generatedFiles.push(toneFile);
      }
    }
    const verbatimFromRow = parseKeywordQuestionsJson(
      enrichedRow.keyword_questions_json ?? row.keyword_questions_json
    );
    const useVerbatimQuestionH2 =
      !useVerbatimImportedH2 && verbatimFromRow != null && verbatimFromRow.length > 0;

    const selectedKeywords = autoSelectKeywords(aiAnalysis, keywordsWithVolumeData);
    const selectedH2Sections =
      useVerbatimQuestionH2 || useVerbatimImportedH2 ? [] : autoSelectH2Sections(aiAnalysis);
    const selectedPeopleAlsoAsk = useVerbatimImportedH2
      ? importedSections!.map((s) => s.h2)
      : useVerbatimQuestionH2 && verbatimFromRow
        ? verbatimFromRow
        : autoSelectPeopleAlsoAsk(aiAnalysis);
    const importedDraftLinks: ImportedDraftLink[] =
      parseImportedLinksJson(enrichedRow.imported_links_json ?? row.imported_links_json) ?? [];

    const modifierUrls =
      parseModifierLinksJson(enrichedRow.modifier_links_json ?? row.modifier_links_json)?.map(
        (link) => link.url,
      ) ?? [];
    let modifierExternalLinks: ModifierExternalLink[] = [];
    if (modifierUrls.length > 0) {
      options.onProgress?.(rowIndex, 0, 'Research external links...');
      modifierExternalLinks = await researchModifierExternalLinks(modifierUrls);
      semrushExternalUrlsForSanitize = [
        ...new Set([...semrushExternalUrlsForSanitize, ...modifierExternalLinks.map((link) => link.url)]),
      ];
      const modifierLinksFileName = BulkFileManager.generateFileName(enrichedRow, 'modifier_external_links', timestamp);
      const modifierLinksFile: BulkGeneratedFile = {
        id: BulkFileManager.createFileId(rowIndex, 'modifier-external-links', timestamp),
        rowIndex,
        fileName: modifierLinksFileName,
        content: JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            modifier_links_json: enrichedRow.modifier_links_json ?? row.modifier_links_json,
            links: modifierExternalLinks,
          },
          null,
          2,
        ),
        mimeType: 'application/json',
        status: 'completed',
        timestamp,
        rowData: enrichedRow,
      };
      fileManager.addFile(modifierLinksFile);
      generatedFiles.push(modifierLinksFile);
    }

    const selectedResearchLinks = [
      ...new Set([
        ...(entityWikiUrl ? [entityWikiUrl] : []),
        ...autoSelectResearchLinks(aiAnalysis),
        ...importedDraftLinks.map((link) => link.url),
        ...modifierExternalLinks.map((link) => link.url),
      ]),
    ];

    const prefilledRowContract = formatPrefilledBulkRowContractFromCsvRow(enrichedRow);

    // Generate checklist
    options.onProgress?.(rowIndex, 0, 'Generating checklist...');
    let checklist = await generateChecklistFromSelections(
      selectedKeywords,
      selectedH2Sections,
      enrichedRow.title,
      keywordData,
      {
        apiKey: options.openRouterApiKey,
        model: options.selectedModel || getResearchModel(),
        temperature: options.temperature || 1.0,
        maxTokens: options.maxTokens || 4000,
        topP: options.topP || 0.9,
        userPrompt: enrichedRow.prompt_modifier || enrichedRow.modifier, // Use prompt_modifier if available, fallback to modifier
        entity: entityForLocalTemplate,
        serpData: paaRawResponse,
        selectedPeopleAlsoAsk,
        selectedResearchLinks,
        connectedSite,
        wordPressPosts,
        runExternalResearch: true,
        locationName: "United States",
        languageCode: "en",
        verbatimQuestionH2Outline: useVerbatimQuestionH2,
        verbatimImportedH2Outline: useVerbatimImportedH2,
        importedSectionBriefs: useVerbatimImportedH2 ? importedSections! : undefined,
        importedToneProfile: importedToneProfile ?? undefined,
        importedDraftLinks: importedDraftLinks.length ? importedDraftLinks : undefined,
        modifierExternalLinks: modifierExternalLinks.length ? modifierExternalLinks : undefined,
        wikipediaUrl: entityWikiUrl,
        wikipediaTitle: entityWikiTitle,
        prefilledRowContract: prefilledRowContract || undefined,
      }
    );
    checklist = injectImportedLinksIntoChecklist(checklist, importedDraftLinks);
    checklist = injectModifierExternalLinksIntoChecklist(checklist, modifierExternalLinks);
    if (entityForLocalTemplate && entityWikiUrl) {
      checklist = injectEntityWikipediaIntoChecklist(checklist, {
        entity: entityForLocalTemplate,
        wikipediaUrl: entityWikiUrl,
        wikipediaTitle: entityWikiTitle,
      });
    }

    if (checklist.length === 0) {
      throw new Error('Failed to generate checklist');
    }

    const checklistFileName = BulkFileManager.generateFileName(enrichedRow, 'blog_checklist', timestamp);
    const checklistFileId = BulkFileManager.createFileId(rowIndex, 'blog-checklist', timestamp);
    const checklistFile: BulkGeneratedFile = {
      id: checklistFileId,
      rowIndex,
      fileName: checklistFileName,
      content: JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          title: enrichedRow.title,
          lines: checklist,
        },
        null,
        2
      ),
      mimeType: 'application/json',
      status: 'completed',
      timestamp,
      rowData: row,
    };
    fileManager.addFile(checklistFile);
    generatedFiles.push(checklistFile);
    options.onProgress?.(rowIndex, 0, 'Blog checklist JSON ready - download above');

    const flowPurposeStr = options.flowPurpose || `Comprehensive guide about ${keywordData.keyword}`;
    const outlineTextForImage = `Blog checklist outline:\n${checklist.join('\n')}`;

    const entityForImage =
      enrichedRow.entity && enrichedRow.entity.trim() && enrichedRow.entity.trim() !== 'N/A'
        ? enrichedRow.entity.trim()
        : row.entity && row.entity.trim() && row.entity.trim() !== 'N/A'
          ? row.entity.trim()
          : undefined;
    const featuredImageTypeFromRow = row.featuredImage === 'google-maps' ? 'google-maps' : 'ai-generated';
    const featuredImageType =
      featuredImageTypeFromRow === 'google-maps' ? featuredImageTypeFromRow : options.featuredImageType || 'ai-generated';
    const useGoogleMaps = featuredImageType === 'google-maps' && !!entityForImage;
    if (featuredImageType === 'google-maps' && !entityForImage) {
      throw new Error(
        `Google Maps image requested but no entity found for row ${rowIndex + 1}. Add an entity to the row or use AI-generated images.`
      );
    }
    const useAiImagePath = row.featuredImage !== 'n' && !useGoogleMaps;

    const imageChecklistLlmOptions = {
      apiKey: options.openRouterApiKey,
      model: options.selectedModel || getResearchModel(),
      temperature: options.temperature || 1.0,
      maxTokens: options.maxTokens || 4000,
      topP: options.topP || 0.9,
    };

    // Parallel: blueprint LLM + image checklist LLM + SEO research skeleton (outline-based; image checklist skipped when no AI image)
    options.onProgress?.(rowIndex, 0, 'Blueprint + image outline + SEO draft (parallel)...');
    const baseUserPrompt = enrichedRow.prompt_modifier || enrichedRow.modifier;
    const tonePromptAppend =
      importedToneProfile != null
        ? `\n\n${formatImportedToneForHarnessPrompt(importedToneProfile)}`
        : "";
    const context: BlogTemplateContext = {
      flowTitle: enrichedRow.title,
      flowPurpose: flowPurposeStr,
      keywordData,
      userPrompt: baseUserPrompt
        ? `${baseUserPrompt.trim()}${tonePromptAppend}`
        : tonePromptAppend.trim() || undefined,
      prefilledRowContract: prefilledRowContract || undefined,
    };

    const metaTitleForBulk = enrichedRow.title || keywordData.keyword;
    const metaContextBulk = `Blog post title: "${metaTitleForBulk}". Primary keyword: "${keywordData.keyword}".`;
    const csvMetaDescription = hasCsvFilledMeta(enrichedRow)
      ? enrichedRow.meta_description!.trim()
      : "";

    const [blueprintResultRaw, precomputedImageChecklist, preBlogSeoSkeleton, precomputedMetaDescription] = await Promise.all([
      generateBlueprintFromTemplate(checklist, context, {
        apiKey: options.openRouterApiKey,
        model: options.selectedModel || getResearchModel(),
        temperature: options.temperature || 1.0,
        maxTokens: options.maxTokens || 8000,
        topP: options.topP || 0.9,
        connectedSite,
        entity: entityForLocalTemplate,
        importedDraftLinks: importedDraftLinks.length ? importedDraftLinks : undefined,
        modifierExternalLinks: modifierExternalLinks.length ? modifierExternalLinks : undefined,
        wikipediaUrl: entityWikiUrl,
        wikipediaTitle: entityWikiTitle,
      }),
      useAiImagePath
        ? generateImageChecklist(enrichedRow.title, flowPurposeStr, outlineTextForImage, imageChecklistLlmOptions)
        : Promise.resolve([] as ImageChecklistItem[]),
      Promise.resolve(
        buildPreBlogSeoResearchSkeleton({
          keywordData,
          enrichedRow,
          semrushKeywordsContext,
          semrushScatterContext,
          flowTitle: enrichedRow.title,
        })
      ),
      csvMetaDescription
        ? Promise.resolve(csvMetaDescription)
        : generateMetaDescription(
            metaContextBulk,
            keywordData.keyword,
            options.openRouterApiKey,
            connectedSite?.id,
            metaTitleForBulk,
            false
          ),
    ]);
    const blueprintAgentsWithImports = injectImportedLinksIntoBlueprintAgents(
      blueprintResultRaw.agents,
      importedDraftLinks,
    );
    const blueprintAgentsWithModifierLinks = injectModifierExternalLinksIntoBlueprintAgents(
      blueprintAgentsWithImports,
      modifierExternalLinks,
    );
    const blueprintResult = {
      ...blueprintResultRaw,
      agents:
        entityForLocalTemplate && entityWikiUrl
          ? injectEntityWikipediaIntoBlueprintAgents(blueprintAgentsWithModifierLinks, {
              entity: entityForLocalTemplate,
              wikipediaUrl: entityWikiUrl,
              wikipediaTitle: entityWikiTitle,
            })
          : blueprintAgentsWithModifierLinks,
    };
    mergeBlueprintIntoPreBlogSkeleton(preBlogSeoSkeleton, blueprintResult.title, blueprintResult.purpose);

    if (blueprintResult.agents.length === 0) {
      throw new Error('No agents generated from template');
    }

    // Final validation: Ensure all agents have [LINK] feature with 3-5 links specification
    const agentsWithoutLinks = blueprintResult.agents.filter((agent) => {
      const features = Array.isArray(agent.features) ? agent.features : [];
      const hasLinkFeature = features.some(
        (f: string) => typeof f === 'string' && f.toLowerCase().trim().startsWith('[link]')
      );
      return !hasLinkFeature;
    });

    if (agentsWithoutLinks.length > 0) {
      console.error(
        `[Bulk Generate] ⚠️ ${agentsWithoutLinks.length} agent(s) missing [LINK] feature after generation. This should not happen - validation should have caught this.`
      );
      // The validation in generateBlueprintFromTemplate should have caught this, but log it anyway
    } else {
      console.log(`[Bulk Generate] ✅ All ${blueprintResult.agents.length} agents have [LINK] features`);
    }

    // Create blueprint JSON file
    const blueprintFileName = BulkFileManager.generateFileName(row, 'blueprint', timestamp);
    const blueprintFileId = BulkFileManager.createFileId(rowIndex, 'blueprint', timestamp);

    const blueprintFile: BulkGeneratedFile = {
      id: blueprintFileId,
      rowIndex,
      fileName: blueprintFileName,
      content: JSON.stringify(
        {
          title: blueprintResult.title || enrichedRow.title,
          purpose: blueprintResult.purpose,
          agents: blueprintResult.agents,
          keyword: keywordData.keyword,
          entity: enrichedRow.entity,
          acfFields: {
            date_modifier: enrichedRow.date_modifier,
            prompt_modifier: enrichedRow.prompt_modifier,
            service_area_fields: enrichedRow.service_area_fields,
            origin: enrichedRow.origin,
          },
        },
        null,
        2
      ),
      mimeType: 'application/json',
      status: 'completed',
      timestamp,
      rowData: enrichedRow, // Use enriched row with ACF fields
    };

    fileManager.addFile(blueprintFile);
    generatedFiles.push(blueprintFile);

    const flowTitleForBlueprint = blueprintResult.title || enrichedRow.title;
    const flowPurposeResolved = blueprintResult.purpose || flowPurposeStr;

    const bulkPrimaryKwResolved = resolveBulkPrimaryKeyword(
      row,
      enrichedRow,
      keywordData,
      blueprintResult.title,
    );
    const rankMetaForTitle = resolveRankMathFromKeywordResearch(keywordData);
    let bulkResolvedPostTitle: string;
    if (hasCsvFilledTitle(enrichedRow)) {
      options.onProgress?.(rowIndex, 0, 'Using CSV title; skipping title rewrite');
      bulkResolvedPostTitle = enrichedRow.title.trim();
    } else {
      options.onProgress?.(rowIndex, 0, 'Finalizing post title...');
      bulkResolvedPostTitle = await resolveBulkWordPressPostTitle({
        apiKey: options.openRouterApiKey || loadApiKey(),
        focusKeyword: bulkPrimaryKwResolved,
        candidates: {
          researchSeoTitle: rankMetaForTitle.seoTitle,
          csvTitle: enrichedRow.title,
          blueprintTitle: blueprintResult.title,
        },
      });
    }

    const siteBundleList = buildSitesToPostFromPosting(options.wordPressPosting);
    const primarySiteForAcf = siteBundleList[0]?.site;

    let markdownContent: string;
    let precomputedAcfSeoBundle: PrecomputedAcfSeoBundle | null = null;

    const runMarkdownPipeline = async (): Promise<string> => {
      const useLegacyMonolithic =
        typeof import.meta !== 'undefined' &&
        import.meta.env?.VITE_BULK_LEGACY_BULK_MARKDOWN === 'true';

      let md: string;
      if (useLegacyMonolithic) {
        options.onProgress?.(rowIndex, 0, 'Generating blog content...');
        md = await generateMarkdownContent(
          blueprintResult,
          enrichedRow,
          keywordData,
          knowledgeFiles,
          activeKnowledgeBaseText,
          bulkOptions,
          connectedSite,
          wordPressPosts,
          options.siteSummary,
          semrushKeywordsContext,
          semrushScatterContext,
          semrushExternalUrlsForSanitize
        );
      } else {
        options.onProgress?.(rowIndex, 0, 'Generating blog content (harness: one section at a time)...');
        md = await generateMarkdownContentHarnessed(
          blueprintResult,
          enrichedRow,
          keywordData,
          knowledgeFiles,
          activeKnowledgeBaseText,
          bulkOptions,
          rowIndex,
          connectedSite,
          wordPressPosts,
          options.siteSummary,
          semrushKeywordsContext,
          semrushScatterContext,
          semrushExternalUrlsForSanitize
        );
      }

      if (!md || md.trim().length === 0) {
        throw new Error('Markdown content generation returned empty result');
      }

      md = await addEntityLinksToContent(md, enrichedRow, rowIndex, knowledgeFiles, bulkOptions, options.onProgress);
      
      const contentFileName = BulkFileManager.generateFileName(row, 'content', timestamp);
      const contentFileId = BulkFileManager.createFileId(rowIndex, 'content', timestamp);

      const contentFile: BulkGeneratedFile = {
        id: contentFileId,
        rowIndex,
        fileName: contentFileName,
        content: md,
        mimeType: 'text/markdown',
        status: 'completed',
        timestamp,
        rowData: enrichedRow, // Use enriched row with ACF fields
      };

      fileManager.addFile(contentFile);
      generatedFiles.push(contentFile);
      options.onProgress?.(rowIndex, 0, 'Markdown content generated successfully');
      return md;
    };

    const scheduleFaqBundlePromise = (): Promise<PrecomputedAcfSeoBundle | null> => {
      const ph = primarySiteForAcf
        ? `${String(primarySiteForAcf.siteUrl).replace(/\/$/, '')}/`
        : '';
      if (!options.wordPressPosting?.enabled || !primarySiteForAcf || !markdownContent?.trim() || !ph) {
        return Promise.resolve(null);
      }
      const rankMeta = resolveRankMathFromKeywordResearch(keywordData);
      const csvMeta = enrichedRow.meta_description?.trim() || "";
      const excerpt =
        csvMeta ||
        precomputedMetaDescription?.trim() ||
        rankMeta.metaDescription ||
        generateExcerpt(markdownContent);
      const primaryKw = bulkPrimaryKwResolved;
      const postTitle = bulkResolvedPostTitle;
      return buildPostMarkdownAcfSeoFaqBundle({
        preBlogSkeleton: preBlogSeoSkeleton,
        markdownContent,
        enrichedRow,
        keywordData,
        blueprintTitle: blueprintResult.title,
        excerpt,
        site: primarySiteForAcf,
        postTitle,
        primaryKw,
        rankMeta,
        openRouterApiKey: options.openRouterApiKey || loadApiKey(),
        placeholderPostUrl: ph,
        onProgress: (msg) => options.onProgress?.(rowIndex, 0, msg),
      }).catch((e: unknown) => {
        console.warn('[Bulk] Precomputed ACF/FAQ bundle failed:', e);
        return null;
      });
    };

    // Peer-first featured image reuse (peer sites only, never the target site).
    // SAP entity rows match by place entity on peer entity sitemaps; blog rows
    // match by keyword (word order ignored) on peer blog posts.
    let peerFeaturedImage: PeerFeaturedImageForRow | null = null;
    const peerTargetSite = options.wordPressPosting?.sites?.[0]?.site;
    const peerRowLabel = (enrichedRow.title || keywordData.keyword || '').trim();
    const peerMatchKey = useGoogleMaps
      ? entityForImage!
      : (keywordData.keyword || enrichedRow.keyword || '').trim();
    if (row.featuredImage === 'n') {
      if (options.peerFeaturedReport) {
        recordPeerFeaturedImageOutcome(options.peerFeaturedReport, {
          action: 'none',
          rowIndex,
          rowLabel: peerRowLabel,
        });
      }
    } else if ((useAiImagePath || useGoogleMaps) && options.peerSites?.length && peerTargetSite) {
      try {
        peerFeaturedImage = await findPeerFeaturedImageForRow({
          peerSites: options.peerSites,
          targetSite: peerTargetSite,
          mode: useGoogleMaps ? 'entity' : 'blog',
          matchKey: peerMatchKey,
          apiKey: options.openRouterApiKey,
          model: options.selectedModel,
          onPeerCsvReady: options.onPeerFeaturedCsv,
          onProgress: (msg) => options.onProgress?.(rowIndex, 0, msg),
        });
      } catch (error) {
        // A committed peer hit whose download/prepare failed: hard error, no Maps/AI fallback.
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        options.onError?.(rowIndex, new Error(`Peer featured image failed: ${errorMessage}`));
        throw new Error(`Peer featured image failed: ${errorMessage}`);
      }
      if (peerFeaturedImage) {
        const imageFileId = BulkFileManager.createFileId(rowIndex, 'image', timestamp);
        const imageFile: BulkGeneratedFile = {
          id: imageFileId,
          rowIndex,
          fileName: peerFeaturedImage.fileName,
          content: peerFeaturedImage.dataUrl,
          mimeType: peerFeaturedImage.mimeType,
          status: 'completed',
          timestamp,
          rowData: row,
        };
        fileManager.addFile(imageFile);
        generatedFiles.push(imageFile);
        options.onProgress?.(
          rowIndex,
          0,
          `Featured image reused from ${peerFeaturedImage.sourceSiteName} (${peerFeaturedImage.sourcePageUrl})`,
        );
        if (options.peerFeaturedReport) {
          recordPeerFeaturedImageOutcome(options.peerFeaturedReport, {
            action: 'found',
            rowIndex,
            rowLabel: peerRowLabel,
            matchKey: peerMatchKey,
            mode: useGoogleMaps ? 'entity' : 'blog',
            sourceSiteName: peerFeaturedImage.sourceSiteName,
            sourcePageUrl: peerFeaturedImage.sourcePageUrl,
            sourceImageUrl: peerFeaturedImage.sourceImageUrl,
            matchedKeyword: peerFeaturedImage.matchedKeyword,
            score: peerFeaturedImage.score,
          });
        }
      }
    }
    if (row.featuredImage !== 'n' && !peerFeaturedImage && options.peerFeaturedReport) {
      recordPeerFeaturedImageOutcome(options.peerFeaturedReport, {
        action: 'generated',
        rowIndex,
        rowLabel: peerRowLabel,
        matchKey: peerMatchKey,
        mode: useGoogleMaps ? 'entity' : 'blog',
        generator: useGoogleMaps ? 'google-maps' : 'ai',
      });
    }

    if (useAiImagePath && !peerFeaturedImage) {
      options.onProgress?.(rowIndex, 0, 'Blog content first, then featured image + FAQ (parallel)...');
      try {
        markdownContent = await runMarkdownPipeline();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error generating markdown content:', error);
        options.onError?.(rowIndex, new Error(`Markdown generation failed: ${errorMessage}`));
        throw new Error(`Failed to generate markdown content: ${errorMessage}`);
      }

      const imagePromise = generateFeaturedImage(
        flowTitleForBlueprint,
        flowPurposeResolved,
        outlineTextForImage,
        precomputedImageChecklist,
        {
          apiKey: options.openRouterApiKey,
          model: options.selectedModel || getResearchModel(),
        }
      ).catch((error: unknown) => {
        console.error('Error generating featured image:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        options.onError?.(rowIndex, new Error(`Image generation failed: ${errorMessage}`));
        return null;
      });

      try {
        const [imageResult, faqBundle] = await Promise.all([imagePromise, scheduleFaqBundlePromise()]);
        precomputedAcfSeoBundle = faqBundle;

        if (imageResult) {
          try {
            let imageBase64 = imageResult.imageBase64;
            let mimeType = 'image/png';
            if (imageBase64.includes(',')) {
              imageBase64 = imageBase64.split(',')[1];
            }

            const imageFileName = await generateSEOImageFilename(
              flowTitleForBlueprint,
              options.openRouterApiKey,
              options.selectedModel || getResearchModel(),
              'featured'
            );

            const fileNameWithoutExt = imageFileName.replace(/\.(png|jpg|jpeg)$/i, '');
            const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
            const finalImageFileName = `${fileNameWithoutExt}.${extension}`;

            const imageFileId = BulkFileManager.createFileId(rowIndex, 'image', timestamp);
            const imageFile: BulkGeneratedFile = {
              id: imageFileId,
              rowIndex,
              fileName: finalImageFileName,
              content: `data:${mimeType};base64,${imageBase64}`,
              mimeType,
              status: 'completed',
              timestamp,
              rowData: row,
            };

            fileManager.addFile(imageFile);
            generatedFiles.push(imageFile);

            const featuredImageChecklistFileName = BulkFileManager.generateFileName(
              enrichedRow,
              'featured-image-checklist',
              timestamp
            );
            const featuredImageChecklistFileId = BulkFileManager.createFileId(
              rowIndex,
              'featured-image-checklist',
              timestamp
            );

            const featuredImageChecklistFile: BulkGeneratedFile = {
              id: featuredImageChecklistFileId,
              rowIndex,
              fileName: featuredImageChecklistFileName,
              content: JSON.stringify(
                {
                  title: flowTitleForBlueprint,
                  purpose: flowPurposeResolved,
                  keyword: keywordData.keyword,
                  entity: enrichedRow.entity,
                  imageChecklist: precomputedImageChecklist.map((item) => ({
                    title: item.title,
                    description: item.description,
                  })),
                  imagePrompt:
                    buildImagePrompt(
                      {
                        flowTitle: flowTitleForBlueprint,
                        flowPurpose: flowPurposeResolved,
                        finalOutput: outlineTextForImage,
                      },
                      {
                        includeText: false,
                        includePeople: false,
                        includeAnimals: false,
                        includeCars: false,
                        isInfographic: false,
                        aspectRatio: '16:9',
                        style: 'professional',
                        colorScheme: 'vibrant',
                      }
                    ) +
                    '\n\nImage Generation Checklist:\n' +
                    precomputedImageChecklist
                      .map((item, idx) => `${idx + 1}. ${item.title}\n   ${item.description}`)
                      .join('\n'),
                  metadata: {
                    aspectRatio: '16:9',
                    style: 'professional',
                    colorScheme: 'vibrant',
                    generatedAt: new Date().toISOString(),
                  },
                },
                null,
                2
              ),
              mimeType: 'application/json',
              status: 'completed',
              timestamp,
              rowData: enrichedRow,
            };

            fileManager.addFile(featuredImageChecklistFile);
            generatedFiles.push(featuredImageChecklistFile);
            options.onProgress?.(rowIndex, 0, 'Featured image checklist JSON generated');
          } catch (error) {
            console.error('Error persisting featured image files:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            options.onError?.(rowIndex, new Error(`Featured image file write failed: ${errorMessage}`));
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error generating featured image:', error);
        options.onError?.(rowIndex, new Error(`Featured image pipeline failed: ${errorMessage}`));
      }
    } else {
      try {
        markdownContent = await runMarkdownPipeline();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error generating markdown content:', error);
        options.onError?.(rowIndex, new Error(`Markdown generation failed: ${errorMessage}`));
        throw new Error(`Failed to generate markdown content: ${errorMessage}`);
      }

      if (row.featuredImage !== 'n' && markdownContent && useGoogleMaps && entityForImage && !peerFeaturedImage) {
        const mapsImagePromise = (async () => {
          try {
            const entityKey = entityAdGroupKey(entityForImage);
            const sharedPageCount = options.sapMapsEntityRowCounts?.get(entityKey);
            const alreadyCached = peekGoogleMapsImageCache(entityForImage) != null;
            options.onProgress?.(
              rowIndex,
              0,
              sapMapsReuseProgressLabel(entityForImage, sharedPageCount, alreadyCached),
            );

            const mapsPayload = await fetchGoogleMapsImageForEntity(entityForImage);
            if (!mapsPayload?.imageBase64) {
              throw new Error('No image data returned from Google Maps API');
            }

            const imageBase64 = mapsPayload.imageBase64;
            const mimeType = mapsPayload.mimeType || 'image/jpeg';
            const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
            const finalImageFileName = sapMapsImageFileName(entityForImage, extension);

            const imageFileId = BulkFileManager.createFileId(rowIndex, 'image', timestamp);
            const imageFile: BulkGeneratedFile = {
              id: imageFileId,
              rowIndex,
              fileName: finalImageFileName,
              content: `data:${mimeType};base64,${imageBase64}`,
              mimeType,
              status: 'completed',
              timestamp,
              rowData: row,
            };

            fileManager.addFile(imageFile);
            generatedFiles.push(imageFile);
            options.onProgress?.(
              rowIndex,
              0,
              alreadyCached
                ? `Featured image ready (Google Maps reused; ${sharedPageCount ?? 1} SAP pages share this location)`
                : 'Featured image generated (Google Maps - no checklist needed)',
            );
          } catch (error) {
            console.error('Error generating featured image:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            options.onError?.(rowIndex, new Error(`Image generation failed: ${errorMessage}`));
          }
        })();

        const [, faqBundle] = await Promise.all([mapsImagePromise, scheduleFaqBundlePromise()]);
        precomputedAcfSeoBundle = faqBundle;
      } else {
        precomputedAcfSeoBundle = await scheduleFaqBundlePromise();
      }
    }

    // WordPress upload (if enabled)
    if (options.wordPressPosting?.enabled && markdownContent) {
      // Determine which sites to post to
      const sitesToPost: Array<{ site: WordPressSite; sitemapType: 'post' | 'entity' }> = [];
      
      if (options.wordPressPosting.sites && options.wordPressPosting.sites.length > 0) {
        // Use multiple sites if provided
        sitesToPost.push(...options.wordPressPosting.sites);
      } else if (options.wordPressPosting.site) {
        // Fall back to single site for backward compatibility
        sitesToPost.push({
          site: options.wordPressPosting.site,
          sitemapType: options.wordPressPosting.sitemapType,
        });
      }

      if (sitesToPost.length === 0) {
        const msg =
          'WordPress upload skipped: posting was enabled but no target sites were resolved. Check Integrations (saved site + app password) and bulk WordPress settings.';
        console.warn('[WordPress]', msg);
        options.onError?.(rowIndex, new Error(msg));
        return generatedFiles;
      }

      const scheduleSlotIndex = options.bulkScheduleSlotIndex ?? rowIndex;
      const postingMode: HybridPostingMode = (options.wordPressPosting.postDestination ?? 'wordpress') as HybridPostingMode;

      // Scheduled date for this row (shared across all sites): CSV `publish_date_gmt` when valid, else frequency-based
      const scheduleOpts = {
        frequency: options.wordPressPosting.frequency,
        customInterval: options.wordPressPosting.customInterval,
        customStaggerOptimized: options.wordPressPosting.customStaggerOptimized,
        dayOfWeek: options.wordPressPosting.dayOfWeek,
        startDate: options.wordPressPosting.startDate,
        startTime: options.wordPressPosting.startTime,
        totalRows: options.wordPressPosting.totalRows,
        useGapScheduling: options.wordPressPosting.useGapScheduling,
        scheduleOccupancy: options.wordPressPosting.scheduleOccupancy,
      };
      const gapSlotDate = options.wordPressPosting.gapDatesBySlot?.[scheduleSlotIndex];
      const useCsvPublishDates = options.wordPressPosting.useCsvPublishDates !== false;
      let scheduledDate: Date;
      let bulkPublishDateSource: import('@/lib/wordpress-scheduler').BulkPublishDateSource;
      if (useCsvPublishDates) {
        const resolved = resolveBulkWordPressPublishDate({
          rowPublishDateGmt: enrichedRow.publish_date_gmt ?? row.publish_date_gmt,
          rowIndex: scheduleSlotIndex,
          schedule: scheduleOpts,
          useCsvPublishDates: true,
        });
        if (resolved.source === 'csv') {
          scheduledDate = resolved.date;
          bulkPublishDateSource = resolved.source;
        } else if (gapSlotDate) {
          scheduledDate = gapSlotDate;
          bulkPublishDateSource = 'calculated';
        } else {
          scheduledDate = resolved.date;
          bulkPublishDateSource = resolved.source;
        }
      } else if (gapSlotDate) {
        scheduledDate = gapSlotDate;
        bulkPublishDateSource = 'calculated';
      } else {
        const resolved = resolveBulkWordPressPublishDate({
          rowPublishDateGmt: enrichedRow.publish_date_gmt ?? row.publish_date_gmt,
          rowIndex: scheduleSlotIndex,
          schedule: scheduleOpts,
          useCsvPublishDates: false,
        });
        scheduledDate = resolved.date;
        bulkPublishDateSource = resolved.source;
      }
      const effectiveDestination = resolveHybridEffectiveDestination(
        postingMode,
        scheduledDate,
        options.wordPressPosting.hybridAnchorUtc
      );

      // Convert markdown to HTML (shared across all sites)
      let htmlContent = await markdownToHtml(markdownContent);
      // Ensure links from connected site (like bulk optimizer) - add internal links every ~200 words
      if (wordPressPosts && wordPressPosts.length > 0 && sitesToPost.length > 0) {
        const firstSite = sitesToPost[0].site;
        try {
          options.onProgress?.(rowIndex, 0, 'Adding internal links from connected site...');
          htmlContent = await ensureLinksEvery200WordsForHtml({
            htmlContent,
            wordPressPosts,
            currentPageUrl: undefined, // New post, no self-link
            siteUrl: firstSite.siteUrl,
            apiKey: options.openRouterApiKey || loadApiKey(),
            siteId: firstSite.id,
            setProgress: (opts) => options.onProgress?.(rowIndex, 0, opts.message || 'Adding links...'),
          });
        } catch (err) {
          console.warn('[Bulk Upload] Ensure links failed, continuing with existing:', err);
        }
      }
      // Safety net: convert ALL remaining markdown to HTML before upload - no exceptions
      htmlContent = convertAllMarkdownToHtml(htmlContent);
      // Final pass: force any remaining [text](url) to HTML (entity/Wikipedia links must never slip through)
      htmlContent = forceConvertMarkdownLinks(htmlContent);
      if (semrushExternalUrlsForSanitize.length) {
        htmlContent = ensureSemrushExternalLinksInHtml(htmlContent, semrushExternalUrlsForSanitize);
      }
      const rankMeta = resolveRankMathFromKeywordResearch(keywordData);
      // Prefer CSV meta when filled; then generator meta; then research / body
      const csvMeta = enrichedRow.meta_description?.trim() || "";
      const excerpt =
        csvMeta ||
        precomputedMetaDescription?.trim() ||
        rankMeta.metaDescription ||
        generateExcerpt(markdownContent);

      const bulkPrimaryKw = bulkPrimaryKwResolved;

      // Upload featured image once per location entity (Maps) or once per row (AI) — skipped for post bank
      let featuredImageId: number | undefined;
      const imageFile = generatedFiles.find(f => f.fileName.endsWith('.png') || f.fileName.endsWith('.jpg') || f.fileName.endsWith('.jpeg'));
      if (effectiveDestination !== 'bank' && imageFile && imageFile.content) {
        try {
          const mapsEntity =
            useGoogleMaps && entityForImage ? entityForImage : undefined;
          const mapsTitleAlt = mapsEntity ? sapMapsMediaTitleAlt(mapsEntity) : undefined;
          const bank = options.sapMapsMediaBank;
          const firstSite = sitesToPost[0]?.site;
          const bankedId =
            mapsEntity && bank && firstSite?.id
              ? getSapMapsMediaId(bank, firstSite.id, mapsEntity)
              : undefined;

          if (bankedId != null) {
            featuredImageId = bankedId;
            const sharedPageCount = options.sapMapsEntityRowCounts?.get(entityAdGroupKey(mapsEntity!));
            options.onProgress?.(
              rowIndex,
              0,
              sapMapsReuseProgressLabel(mapsEntity!, sharedPageCount, true) + ` - Media ID ${featuredImageId}`,
            );
          } else {
            options.onProgress?.(rowIndex, 0, 'Uploading featured image to WordPress...');
            let imageBase64 = imageFile.content;
            if (imageBase64.startsWith('data:')) {
              imageBase64 = imageBase64.split(',')[1];
            }
            const mediaTitle = mapsTitleAlt ?? (enrichedRow.title || blueprintResult.title);
            const mediaResult = await uploadWordPressMedia(
              sitesToPost[0].site.siteUrl,
              sitesToPost[0].site.username,
              sitesToPost[0].site.appPassword,
              imageBase64,
              imageFile.fileName,
              mediaTitle,
              mapsTitleAlt,
            );
            if (mediaResult.success && mediaResult.mediaId) {
              featuredImageId = mediaResult.mediaId;
              if (mapsEntity && bank && firstSite?.id) {
                setSapMapsMediaId(bank, firstSite.id, mapsEntity, featuredImageId);
              }
              options.onProgress?.(rowIndex, 0, `Featured image uploaded: Media ID ${featuredImageId}`);
            }
          }
        } catch (error) {
          console.error('Failed to upload featured image:', error);
        }
      }

      await options.linkPrefetchPromise?.catch(() => {});

      const needsEntityWiki = sitesToPost.some((s) => s.sitemapType === 'entity');
      let entityWikiForSanitize: { url: string; label: string } | undefined;
      if (
        needsEntityWiki &&
        enrichedRow.entity?.trim() &&
        enrichedRow.entity.trim() !== 'N/A'
      ) {
        const url = enrichedRow.wikipedia_url?.trim();
        if (url) {
          entityWikiForSanitize = { url, label: enrichedRow.entity.trim() };
        }
      }

      // Fallback: prefetch missed or failed for a site
      for (let siteIndex = 0; siteIndex < sitesToPost.length; siteIndex++) {
        const { site } = sitesToPost[siteIndex];
        if (!preValidatedUrlsBySite.has(site.id) && site.username && site.appPassword) {
          options.onProgress?.(rowIndex, 0, `Validating links for ${site.name} (fallback)...`);
          try {
            const cache = await createSiteCache(site, undefined, (msg) => options.onProgress?.(rowIndex, 0, msg));
            const validatedPosts = await getValidatedPosts(
              site.id,
              site.siteUrl,
              cache.posts,
              (msg) => options.onProgress?.(rowIndex, 0, msg)
            );
            const set = new Set(validatedPosts.map((p) => normalizeInternalUrl(site.siteUrl, p.link)).filter(Boolean));
            preValidatedUrlsBySite.set(site.id, set);
          } catch (err) {
            console.warn('[Bulk Upload] Link validation fallback failed, proceeding without preValidatedUrls:', err);
          }
        }
      }

      // Post to all selected sites
      for (let siteIndex = 0; siteIndex < sitesToPost.length; siteIndex++) {
        const { site, sitemapType } = sitesToPost[siteIndex];
        
        try {
          const bankPhaseLabel = sitemapType === 'entity' ? 'SAP bank' : 'Post Bank';
          options.onProgress?.(
            rowIndex,
            0,
            effectiveDestination === 'bank'
              ? `Preparing ${bankPhaseLabel} for ${site.name}...`
              : `Uploading to WordPress (${site.name})...`
          );

          // Always attempt upload for each row. (We no longer skip when an entity label appears in the entity
          // sitemap - titles/slugs differ per post; users asked to never skip scheduled rows for that reason.)

          // Determine entity endpoint based on sitemapType
          let entityEndpoint: string;
          if (sitemapType === 'entity' && site.entitySitemapUrl) {
            entityEndpoint = extractEndpointFromEntitySitemapUrl(site.entitySitemapUrl);
          } else {
            entityEndpoint = 'posts';
          }

          // Upload featured image to this site if not already uploaded (or re-upload for each site)
          let siteFeaturedImageId = featuredImageId;
          if (effectiveDestination !== 'bank' && imageFile && imageFile.content && siteIndex > 0) {
            try {
              const mapsEntity =
                useGoogleMaps && entityForImage ? entityForImage : undefined;
              const mapsTitleAlt = mapsEntity ? sapMapsMediaTitleAlt(mapsEntity) : undefined;
              const bank = options.sapMapsMediaBank;
              const bankedId =
                mapsEntity && bank && site.id
                  ? getSapMapsMediaId(bank, site.id, mapsEntity)
                  : undefined;

              if (bankedId != null) {
                siteFeaturedImageId = bankedId;
              } else {
                let imageBase64 = imageFile.content;
                if (imageBase64.startsWith('data:')) {
                  imageBase64 = imageBase64.split(',')[1];
                }
                const mediaTitle = mapsTitleAlt ?? (enrichedRow.title || blueprintResult.title);
                const mediaResult = await uploadWordPressMedia(
                  site.siteUrl,
                  site.username,
                  site.appPassword,
                  imageBase64,
                  imageFile.fileName,
                  mediaTitle,
                  mapsTitleAlt,
                );
                if (mediaResult.success && mediaResult.mediaId) {
                  siteFeaturedImageId = mediaResult.mediaId;
                  if (mapsEntity && bank && site.id) {
                    setSapMapsMediaId(bank, site.id, mapsEntity, siteFeaturedImageId);
                  }
                }
              }
            } catch (error) {
              console.error(`Failed to upload featured image to ${site.name}:`, error);
            }
          }

          const postTitle = bulkResolvedPostTitle;

          let slug: string | undefined;
          const lockedSlug = sanitizeWordPressSlugSegment(enrichedRow.target_slug ?? "");
          if (lockedSlug.length >= 2) {
            slug = lockedSlug;
          } else if (sitemapType === "entity") {
            const kw = (bulkPrimaryKw || enrichedRow.keyword || "").trim();
            const ent =
              enrichedRow.entity?.trim() && enrichedRow.entity.trim() !== "N/A"
                ? enrichedRow.entity.trim()
                : "";
            slug = buildSapSlugFromKeywordEntity(kw, ent);
            if (!slug || slug.length < 2) slug = undefined;
          } else {
            try {
              const keyword = (
                bulkPrimaryKw ||
                enrichedRow.title ||
                blueprintResult.title ||
                ''
              ).trim();
              const entitySlug =
                enrichedRow.entity && enrichedRow.entity.trim() && enrichedRow.entity.trim() !== 'N/A'
                  ? enrichedRow.entity.trim()
                  : undefined;
              slug = await generateSEOSlug(postTitle, keyword || postTitle, entitySlug, loadApiKey());
              if (!slug || slug.length < 2) slug = undefined;
            } catch {
              slug = undefined;
            }
          }

          const wpPostStatus = options.wordPressPosting.draftOnly
            ? ('draft' as const)
            : resolveWordPressPostStatusForSchedule(scheduledDate);
          const contractDestination = enrichedRow.destination_url?.trim();

          let authorId: number | undefined;
          try {
            authorId = await resolveRecommendedAuthor({
              site,
              postTypeEndpoint: entityEndpoint,
              apiKey: options.openRouterApiKey || loadApiKey(),
              siteId: site.id,
            });
          } catch {
            authorId = undefined;
          }

          // Sanitize: remove invalid internal links (not in WordPress list), non-Wikipedia external
          const isEntityUpload = sitemapType === 'entity' && !!site.entitySitemapUrl;
          const sanitizedHtmlContent = sanitizeContentForUpload(
            htmlContent,
            site.siteUrl,
            wordPressPosts,
            isEntityUpload && entityWikiForSanitize ? entityWikiForSanitize.url : undefined,
            semrushExternalUrlsForSanitize,
            isEntityUpload && entityWikiForSanitize ? entityWikiForSanitize.label : undefined,
          );

          const preValidatedUrls = preValidatedUrlsBySite.get(site.id);
          const { html: validatedHtml } = await validateAndStripInvalidLinksFromContent(
            sanitizedHtmlContent,
            undefined,
            site.siteUrl,
            (msg) => options.onProgress?.(rowIndex, 0, msg),
            undefined,
            preValidatedUrls ?? undefined
          );
          let contentForUpload = validatedHtml;

          // Content Opt parity: stitch backend FAQ Q/A into flo-faq table before first publish.
          {
            const earlyEntries = resolveFaqEntriesForVisibleTable(
              precomputedAcfSeoBundle?.faqEntries
            );
            const openRouterApiKeyEarly = (options.openRouterApiKey || loadApiKey() || '').trim();
            if (
              earlyEntries.length &&
              openRouterApiKeyEarly &&
              contentForUpload.trim() &&
              !contentForUpload.toLowerCase().includes(`class="${FLO_FAQ_CLASS}"`)
            ) {
              try {
                options.onProgress?.(rowIndex, 0, 'Appending FAQ table to post body...');
                const appended = await appendVisibleFaqTableWithIntro({
                  sourceHtml: contentForUpload,
                  entries: earlyEntries,
                  apiKey: openRouterApiKeyEarly,
                  focusKeyword: bulkPrimaryKw || keywordData.keyword,
                  pageTitle: postTitle,
                });
                if (appended?.html) {
                  contentForUpload = appended.html;
                }
              } catch (faqBodyErr) {
                console.warn('[Bulk Upload] Pre-create FAQ table append failed:', faqBodyErr);
              }
            }
          }

          if (effectiveDestination === 'bank') {
            const bankLabel = sitemapType === 'entity' ? 'SAP bank' : 'Post Bank';
            options.onProgress?.(rowIndex, 0, `Saving to Supabase ${bankLabel} (${site.name})...`);
            const baseUrl = String(site.siteUrl).replace(/\/$/, '');
            const provisionalLink =
              contractDestination ||
              (slug ? `${baseUrl}/${slug}/` : `${baseUrl}/`);
            const optimizedMetaBootstrap = buildOptimizedMetaFromKeywordResearch(
              rankMeta,
              postTitle,
              excerpt,
              bulkPrimaryKw,
              provisionalLink,
              site.siteUrl
            );
            let sourceRow: Record<string, unknown> | undefined;
            try {
              sourceRow = JSON.parse(JSON.stringify(enrichedRow)) as Record<string, unknown>;
            } catch {
              sourceRow = { keyword: enrichedRow.keyword, title: enrichedRow.title };
            }
            const bundleId = options.contentBundleId?.trim();
            if (bundleId) {
              sourceRow = { ...sourceRow, flowbie_content_bundle_id: bundleId };
            }
            const bankPayload = {
              siteId: site.id,
              siteDisplayName: site.name,
              title: postTitle,
              htmlContent: contentForUpload,
              markdownContent,
              excerpt,
              slug,
              scheduledDateGmt: options.wordPressPosting.draftOnly
                ? undefined
                : scheduledDate.toISOString(),
              wordpressStatus: (options.wordPressPosting.draftOnly ? 'draft' : 'future') as const,
              postTypeEndpoint: entityEndpoint,
              sitemapType,
              acfPayload: { rank_math_meta: optimizedMetaBootstrap },
              keyword: bulkPrimaryKw || undefined,
              entity: enrichedRow.entity?.trim() || undefined,
              sourceRow,
            };
            const ins =
              sitemapType === 'entity'
                ? await insertSapBankPost(bankPayload)
                : await insertBankPost(bankPayload);
            if (!ins.ok) {
              options.onError?.(rowIndex, new Error(ins.error || `${bankLabel} insert failed`));
            } else {
              options.onProgress?.(rowIndex, 0, `Saved to Supabase ${bankLabel} (${site.name})`);
            }
            continue;
          }

          // Create WordPress post with sanitized + validated content (bad links stripped, never blocked)
          // Always send date_gmt. Past slots (e.g. "1st this month" mid-month) must backdate;
          // omitting date_gmt made WordPress stamp "now" and look like the batch started today.
          const postResult = await createWordPressPost(
            site.siteUrl,
            site.username,
            site.appPassword,
            postTitle,
            contentForUpload,
            excerpt,
            wpPostStatus,
            options.wordPressPosting.draftOnly
              ? undefined
              : formatWordPressDate(scheduledDate),
            siteFeaturedImageId,
            undefined, // categories
            undefined, // tags
            undefined, // postType
            entityEndpoint,
            slug,
            authorId
          );

          if (postResult.success && postResult.postId) {
            // Update ACF fields after successful post creation (discover field names like wordpress-uploader)
            const entity = enrichedRow.entity && enrichedRow.entity.trim() && enrichedRow.entity.trim() !== 'N/A'
              ? enrichedRow.entity.trim()
              : undefined;
            let acfUpdatedList: string[] | undefined;
            const postTypeForAcf = sitemapType === 'entity' ? entityEndpoint : 'post';

            const postLink =
              contractDestination ||
              (typeof postResult.link === 'string' && postResult.link.trim()
                ? postResult.link.trim()
                : `${String(site.siteUrl).replace(/\/$/, '')}/?p=${postResult.postId}`);

            const optimizedMetaBootstrap = buildOptimizedMetaFromKeywordResearch(
              rankMeta,
              postTitle,
              excerpt,
              bulkPrimaryKw,
              postLink,
              site.siteUrl
            );

            try {
              await updateWordPressPostMeta(
                site.siteUrl,
                site.username,
                site.appPassword,
                postResult.postId,
                postTypeForAcf,
                entityEndpoint,
                {
                  rank_math_title: optimizedMetaBootstrap.rank_math_title,
                  rank_math_description: optimizedMetaBootstrap.rank_math_description,
                  rank_math_focus_keyword: optimizedMetaBootstrap.rank_math_focus_keyword,
                }
              );
            } catch (rmErr) {
              console.warn('[Bulk Upload] Rank Math post meta sync failed (non-fatal):', rmErr);
            }

            /** Hoisted so research JSON + bulk ACF SEO apply share the same merged string. */
            let seoResearchJson = '';
            try {
              options.onProgress?.(rowIndex, 0, `Discovering ACF fields for post ${postResult.postId}...`);
              const acfResult = await getACFFieldsForPost(
                site,
                postResult.postId,
                postTypeForAcf,
                entityEndpoint
              );
              const existingAcfFields = acfResult.success && acfResult.fields ? acfResult.fields : {};
              const openRouterApiKey = options.openRouterApiKey || loadApiKey();
              const fbMapping = fallbackFieldMapping(existingAcfFields as Record<string, unknown>);
              const discoveredMapping = await discoverACFFieldMapping(
                existingAcfFields,
                postTypeForAcf,
                openRouterApiKey || '',
                site.siteUrl
              );
              const fieldMapping = { ...fbMapping, ...discoveredMapping };
              const fieldNames = {
                dateModifier: fieldMapping.dateModifier || 'date_modifier',
                faq: fieldMapping.faq || 'faq',
                promptModifier: fieldMapping.promptModifier || 'prompt_modifier',
                origin: fieldMapping.origin || 'origin',
                keywordFocus: fieldMapping.keywordFocus || 'keyword_focus',
                seoResearch: fieldMapping.seoResearch || 'seo_research',
              };

              let faqForAcf = '';
              const semrushSeoExtras: Record<string, unknown> = {};
              if (semrushCitationForAcf) {
                semrushSeoExtras.semrush_primary_external_url = semrushCitationForAcf;
              }
              semrushSeoExtras.research_intent =
                intelligentMergeForAcf?.primaryIntent ?? keywordData.intent;
              {
                const ovAcf = safeTrimSemrushOverviewForAcf(semrushSnapshotForAcf?.keywordOverview);
                if (ovAcf !== undefined) {
                  semrushSeoExtras.semrush_keyword_overview = ovAcf;
                }
              }

              let visibleFaqEntries: FaqEntry[] | undefined;

              if (precomputedAcfSeoBundle) {
                seoResearchJson = patchPostLinkInSeoResearchJson(
                  precomputedAcfSeoBundle.seoResearchJson,
                  postLink,
                  site.siteUrl,
                  postTitle,
                  excerpt,
                  bulkPrimaryKw,
                  rankMeta
                );
                seoResearchJson = mergeSemrushFieldsIntoSeoResearchJson(
                  seoResearchJson,
                  semrushSeoExtras
                );
                faqForAcf = precomputedAcfSeoBundle.faqForAcf;
                visibleFaqEntries = resolveFaqEntriesForVisibleTable(
                  precomputedAcfSeoBundle.faqEntries
                );
              } else {
                const seoResearchObj: Record<string, unknown> = {
                  primary_keyword: bulkPrimaryKw || keywordData.keyword,
                  title: enrichedRow.title || blueprintResult.title,
                  generatedAt: new Date().toISOString(),
                  post_link: postLink,
                  seo_title: optimizedMetaBootstrap.rank_math_title,
                  meta_description: optimizedMetaBootstrap.rank_math_description,
                  focus_keyword: optimizedMetaBootstrap.rank_math_focus_keyword,
                  optimizedMeta: {
                    rank_math_title: optimizedMetaBootstrap.rank_math_title,
                    rank_math_description: optimizedMetaBootstrap.rank_math_description,
                    rank_math_focus_keyword: optimizedMetaBootstrap.rank_math_focus_keyword,
                    rank_math_canonical_url: optimizedMetaBootstrap.rank_math_canonical_url,
                    rank_math_robots: optimizedMetaBootstrap.rank_math_robots,
                  },
                  ...semrushSeoExtras,
                };
                if (semrushKeywordsContext?.trim()) {
                  try {
                    seoResearchObj.semrush_keywords = JSON.parse(semrushKeywordsContext);
                  } catch {
                    seoResearchObj.semrush_keywords_raw = semrushKeywordsContext.slice(0, 8000);
                  }
                }
                if (semrushScatterContext?.trim()) {
                  try {
                    seoResearchObj.semrush_scatter = JSON.parse(semrushScatterContext);
                  } catch {
                    seoResearchObj.semrush_scatter_raw = semrushScatterContext.slice(0, 8000);
                  }
                }

                if (enrichedRow.faq && enrichedRow.faq.trim()) {
                  const parsed = parseFaqEntries(enrichedRow.faq.trim());
                  if (parsed.length > 0) {
                    visibleFaqEntries = parsed;
                    const napLocs = napLocationsFromSite(site);
                    faqForAcf = buildFAQSchemaScriptFromEntries(
                      parsed,
                      bulkPrimaryKw,
                      entity,
                      site.siteUrl,
                      napLocs
                    );
                    seoResearchObj.faq_entries = parsed.map((e) => ({
                      question: e.question,
                      answer: e.answer.slice(0, 2000),
                    }));
                  }
                } else if (bulkPrimaryKw && markdownContent && openRouterApiKey?.trim()) {
                  const napLocs = napLocationsFromSite(site);
                  options.onProgress?.(
                    rowIndex,
                    0,
                    `Generating in-context FAQ for ACF...`
                  );
                  const briefForFaq = JSON.stringify(seoResearchObj).slice(0, 24000);
                  const entries = await generateBulkFaqEntriesInContext({
                    markdownContent,
                    postTitle,
                    pageMeta: excerpt,
                    primaryKeyword: bulkPrimaryKw,
                    postUrl: postLink,
                    seoResearchBrief: briefForFaq,
                    site,
                    apiKey: openRouterApiKey,
                    siteId: site.id,
                    pairCount: 4,
                  });
                  if (entries.length > 0) {
                    visibleFaqEntries = entries;
                    faqForAcf = buildFAQSchemaScriptFromEntries(
                      entries,
                      bulkPrimaryKw,
                      entity,
                      site.siteUrl,
                      napLocs
                    );
                    seoResearchObj.faq_entries = entries.map((e) => ({
                      question: e.question,
                      answer: e.answer.slice(0, 2000),
                    }));
                  }
                }

                visibleFaqEntries = resolveFaqEntriesForVisibleTable(visibleFaqEntries);

                if (faqForAcf) {
                  seoResearchObj.faq_schema_ld_json = faqForAcf;
                }

                seoResearchJson = mergeSeoResearchWithMeta(
                  JSON.stringify(seoResearchObj),
                  optimizedMetaBootstrap,
                  bulkPrimaryKw
                );
              }

              // Safety: append only if first publish still lacks flo-faq (e.g. no precomputed bundle).
              const bodyHasFloFaq = contentForUpload
                .toLowerCase()
                .includes(`class="${FLO_FAQ_CLASS}"`);
              if (
                !bodyHasFloFaq &&
                visibleFaqEntries?.length &&
                openRouterApiKey?.trim() &&
                contentForUpload.trim()
              ) {
                try {
                  options.onProgress?.(rowIndex, 0, 'Appending FAQ table to post body...');
                  const appended = await appendVisibleFaqTableWithIntro({
                    sourceHtml: contentForUpload,
                    entries: visibleFaqEntries,
                    apiKey: openRouterApiKey,
                    focusKeyword: bulkPrimaryKw || keywordData.keyword,
                    pageTitle: postTitle,
                  });
                  if (appended?.html) {
                    contentForUpload = appended.html;
                    await updateWordPressPost(
                      site.siteUrl,
                      site.username,
                      site.appPassword,
                      postResult.postId,
                      postTitle,
                      contentForUpload,
                      excerpt,
                      undefined,
                      postTypeForAcf,
                      siteFeaturedImageId,
                      undefined,
                      undefined,
                      slug,
                      entityEndpoint
                    );
                  }
                } catch (faqBodyErr) {
                  console.warn('[Bulk Upload] Visible FAQ table append failed:', faqBodyErr);
                }
              }

              const acfMetaFields: Record<string, string> = {};
              acfMetaFields[fieldNames.dateModifier] = new Date().toISOString().split('T')[0];
              if (enrichedRow.prompt_modifier && enrichedRow.prompt_modifier.trim()) {
                acfMetaFields[fieldNames.promptModifier] = enrichedRow.prompt_modifier.trim();
              }
              if (enrichedRow.service_area_fields && enrichedRow.service_area_fields.trim()) {
                acfMetaFields['service_area_fields'] = enrichedRow.service_area_fields.trim();
              }
              const titleForAcfOrigin = (enrichedRow.title ?? postTitle ?? '').trim();
              const originFromTitle = extractOriginFromSapTitle(titleForAcfOrigin);
              if (enrichedRow.origin && enrichedRow.origin.trim() && enrichedRow.origin.trim() !== 'N/A') {
                acfMetaFields[fieldNames.origin] = enrichedRow.origin.trim();
              } else if (originFromTitle) {
                acfMetaFields[fieldNames.origin] = originFromTitle;
              } else if (entity) {
                acfMetaFields[fieldNames.origin] = entity;
              }

              const runAcfPhase = async (
                phaseLabel: string,
                fields: Record<string, string>
              ): Promise<void> => {
                const keys = Object.keys(fields);
                if (keys.length === 0) return;
                options.onProgress?.(
                  rowIndex,
                  0,
                  `ACF ${phaseLabel} for post ${postResult.postId}: ${keys.join(', ')}`
                );
                const acfUpdateResult = await updateACFFields(
                  site.siteUrl,
                  site.username,
                  site.appPassword,
                  postResult.postId,
                  fields,
                  postTypeForAcf,
                  entityEndpoint
                );
                if (acfUpdateResult.success) {
                  acfUpdatedList = [...(acfUpdatedList ?? []), ...acfUpdateResult.updated];
                  console.log(
                    `[Bulk Upload] ACF ${phaseLabel} OK [${acfUpdateResult.updated.join(', ')}] post ${postResult.postId}`
                  );
                  options.onProgress?.(rowIndex, 0, `ACF ${phaseLabel} saved: ${acfUpdateResult.updated.join(', ')}`);
                } else {
                  const errMsg =
                    acfUpdateResult.error ||
                    (acfUpdateResult.failed?.length
                      ? acfUpdateResult.failed.map((f) => `${f.field}: ${f.error}`).join('; ')
                      : 'Unknown error');
                  console.warn(`[Bulk Upload] ACF ${phaseLabel} failed for post ${postResult.postId}:`, acfUpdateResult);
                  options.onProgress?.(rowIndex, 0, `ACF ${phaseLabel} failed: ${errMsg}`);
                }
              };

              options.onProgress?.(rowIndex, 0, `Staged ACF updates for post ${postResult.postId}...`);
              if (bulkPrimaryKw) {
                await runAcfPhase('keyword', { [fieldNames.keywordFocus]: bulkPrimaryKw });
              }
              await runAcfPhase('research', { [fieldNames.seoResearch]: seoResearchJson });
              if (faqForAcf) {
                await runAcfPhase('faq', { [fieldNames.faq]: faqForAcf });
              }
              await runAcfPhase('dates_origin', acfMetaFields);

              let seoResearchJsonForDownload = seoResearchJson;

              if (postLink && seoResearchJson) {
                let aiMetaSucceeded = false;
                try {
                  options.onProgress?.(
                    rowIndex,
                    0,
                    `Optimizing meta for post ${postResult.postId}...`
                  );
                  const optimizedMetaFinal = await generateOptimizedMetaFields(
                    markdownContent,
                    postTitle,
                    excerpt,
                    bulkPrimaryKw,
                    {},
                    site.siteUrl,
                    postLink,
                    false,
                    site.id,
                    undefined,
                    seoResearchJson
                  );
                  await updateWordPressPostMeta(
                    site.siteUrl,
                    site.username,
                    site.appPassword,
                    postResult.postId,
                    postTypeForAcf,
                    entityEndpoint,
                    {
                      rank_math_title: optimizedMetaFinal.rank_math_title,
                      rank_math_description: optimizedMetaFinal.rank_math_description,
                      rank_math_focus_keyword: optimizedMetaFinal.rank_math_focus_keyword,
                    }
                  );
                  const acfAiFields = buildAcfPayload(
                    fieldMapping,
                    optimizedMetaFinal,
                    bulkPrimaryKw,
                    { ...existingAcfFields, [fieldNames.seoResearch]: seoResearchJson },
                    seoResearchJson,
                    { includeSeoResearchInPayload: true }
                  );
                  if (Object.keys(acfAiFields).length > 0) {
                    await runAcfPhase('ai_meta', acfAiFields);
                  }
                  const mergedResearch = acfAiFields[fieldNames.seoResearch];
                  if (typeof mergedResearch === 'string' && mergedResearch.trim()) {
                    seoResearchJsonForDownload = mergedResearch;
                  } else {
                    seoResearchJsonForDownload = mergeSeoResearchWithMeta(
                      seoResearchJson,
                      optimizedMetaFinal,
                      bulkPrimaryKw
                    );
                  }
                  aiMetaSucceeded = true;

                  const plainExcerpt = String(optimizedMetaFinal.rank_math_description || '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 500);
                  if (plainExcerpt) {
                    try {
                      await updateWordPressPost(
                        site.siteUrl,
                        site.username,
                        site.appPassword,
                        postResult.postId,
                        postTitle,
                        contentForUpload,
                        plainExcerpt,
                        undefined,
                        postTypeForAcf,
                        siteFeaturedImageId,
                        undefined,
                        undefined,
                        slug,
                        entityEndpoint
                      );
                    } catch (exErr) {
                      console.warn('[Bulk Upload] Excerpt sync after AI meta failed (non-fatal):', exErr);
                    }
                  }

                  const metaFm = new OptimizationFileManager();
                  const name = OptimizationFileManager.generateFilename(
                    'acf-seo-optimization',
                    bulkPrimaryKw || keywordData.keyword || 'post',
                    'json'
                  );
                  metaFm.addFile(
                    name,
                    JSON.stringify(
                      {
                        postId: postResult.postId,
                        postLink,
                        primaryKeyword: bulkPrimaryKw || keywordData.keyword || '',
                        acfFieldsWritten: acfAiFields,
                        optimizedMeta: optimizedMetaFinal,
                        source: 'bulk_prompt_generator_ai_meta',
                        updatedAt: new Date().toISOString(),
                      },
                      null,
                      2
                    ),
                    'application/json'
                  );
                  for (const f of metaFm.getFiles()) {
                    const mergeId = BulkFileManager.createFileId(rowIndex, `acf-seo-${siteIndex}`, timestamp);
                    const mergedFile: BulkGeneratedFile = {
                      id: mergeId,
                      rowIndex,
                      fileName: f.name,
                      content: f.content,
                      mimeType: f.mimeType || 'application/json',
                      status: 'completed',
                      timestamp,
                      rowData: row,
                    };
                    fileManager.addFile(mergedFile);
                    generatedFiles.push(mergedFile);
                  }
                } catch (aiMetaErr) {
                  console.warn('[Bulk Upload] AI meta optimization failed, using research JSON meta:', aiMetaErr);
                }

                if (!aiMetaSucceeded) {
                  try {
                    options.onProgress?.(
                      rowIndex,
                      0,
                      `SEO → ACF (research JSON fallback) for post ${postResult.postId}...`
                    );
                    const metaFm = new OptimizationFileManager();
                    const bulkMetaRes = await applyBulkSeoMetaToAcf({
                      postId: postResult.postId,
                      site,
                      postLink,
                      primaryKeyword: bulkPrimaryKw || keywordData.keyword || '',
                      optimizedMeta: optimizedMetaBootstrap,
                      fieldMapping,
                      existingAcfFields,
                      postTypeSubtype: postTypeForAcf,
                      postTypeEndpoint: entityEndpoint,
                      priorSeoResearchJson: seoResearchJson,
                      fileManager: metaFm,
                      setProgress: (p) => {
                        options.onProgress?.(rowIndex, 0, p.message || p.step || 'SEO ACF');
                      },
                    });
                    if (bulkMetaRes.success) {
                      for (const f of metaFm.getFiles()) {
                        const mergeId = BulkFileManager.createFileId(rowIndex, `acf-seo-${siteIndex}`, timestamp);
                        const mergedFile: BulkGeneratedFile = {
                          id: mergeId,
                          rowIndex,
                          fileName: f.name,
                          content: f.content,
                          mimeType: f.mimeType || 'application/json',
                          status: 'completed',
                          timestamp,
                          rowData: row,
                        };
                        fileManager.addFile(mergedFile);
                        generatedFiles.push(mergedFile);
                      }
                    }
                  } catch (seoAcfErr) {
                    console.warn('[Bulk Upload] applyBulkSeoMetaToAcf failed:', seoAcfErr);
                  }
                }
              }

              if (siteIndex === 0) {
                const researchSlug = (enrichedRow.title || blueprintResult.title || 'post')
                  .replace(/[^a-zA-Z0-9]+/g, '-')
                  .toLowerCase();
                const researchFileName = `seo-research-${researchSlug}-${timestamp}.json`;
                const researchFileId = BulkFileManager.createFileId(rowIndex, 'seo-research', timestamp);
                const seoResearchFile: BulkGeneratedFile = {
                  id: researchFileId,
                  rowIndex,
                  fileName: researchFileName,
                  content: JSON.stringify(JSON.parse(seoResearchJsonForDownload), null, 2),
                  mimeType: 'application/json',
                  status: 'completed',
                  timestamp,
                  rowData: row,
                };
                fileManager.addFile(seoResearchFile);
                generatedFiles.push(seoResearchFile);
              }
            } catch (acfError) {
              const errMsg = acfError instanceof Error ? acfError.message : String(acfError);
              console.warn(`[Bulk Upload] Error updating ACF fields for post ${postResult.postId}:`, acfError);
              options.onProgress?.(rowIndex, 0, `ACF update failed: ${errMsg}`);
            }

            // Create wordpress-post JSON file for this site
            const siteNameSlug = site.name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
            const wordPressPostFileName = `wordpress-post-${siteNameSlug}-${enrichedRow.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${timestamp}.json`;
            const wordPressPostFileId = BulkFileManager.createFileId(rowIndex, `wordpress-post-${siteIndex}`, timestamp);

            const wordPressPostFile: BulkGeneratedFile = {
              id: wordPressPostFileId,
              rowIndex,
              fileName: wordPressPostFileName,
              content: JSON.stringify({
                postId: postResult.postId,
                title: postTitle,
                link: postResult.link,
                status: postResult.status,
                scheduledDate: scheduledDate.toISOString(),
                date_gmt: formatWordPressDate(scheduledDate),
                publishDateSource: bulkPublishDateSource,
                endpoint: entityEndpoint,
                sitemapType: sitemapType,
                siteName: site.name,
                siteUrl: site.siteUrl,
              }, null, 2),
              mimeType: 'application/json',
              status: 'completed',
              timestamp,
              rowData: row,
            };

            fileManager.addFile(wordPressPostFile);
            generatedFiles.push(wordPressPostFile);

            options.onProgress?.(
              rowIndex,
              0,
              `WordPress post created on ${site.name}: ${postResult.postId} (scheduled for ${formatWordPressDate(scheduledDate)}${
                bulkPublishDateSource === 'csv' ? ', from CSV publish_date_gmt' : ''
              })`,
            );
            options.onAppendHistory?.({
              ts: Date.now(),
              entityOrTitle: enrichedRow.entity?.trim() || enrichedRow.title || undefined,
              site: site.name,
              step: 'upload',
              message: `Post created on ${site.name}: ID ${postResult.postId}${acfUpdatedList?.length ? `, ACF updated: ${acfUpdatedList.join(', ')}` : ''}`,
              outcome: 'ok',
              postId: postResult.postId,
              permalink: postResult.link,
              acfUpdated: acfUpdatedList,
              mode: sitemapType,
            });
          } else {
            throw new Error(postResult.error || `WordPress post creation failed on ${site.name}`);
          }
        } catch (error) {
          console.error(`WordPress upload error for ${site.name}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          options.onError?.(rowIndex, new Error(`WordPress upload failed on ${site.name}: ${errorMessage}`));
          options.onAppendHistory?.({
            ts: Date.now(),
            entityOrTitle: enrichedRow.entity?.trim() || enrichedRow.title || undefined,
            site: site.name,
            step: 'upload',
            message: `Upload failed on ${site.name}: ${errorMessage}`,
            outcome: 'fail',
            error: errorMessage,
            mode: sitemapType,
          });
          // Continue with other sites even if one fails
        }
      }
    }
return generatedFiles;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to generate blueprint: ${errorMessage}`);
  }
}
