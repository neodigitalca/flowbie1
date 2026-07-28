/**
 * Content Generation Upload Orchestrator
 * Orchestrates content generation, WordPress upload, and optimization workflows
 * Uses entity endpoint logic directly - NO service-area conditionals, NO normalization
 */

import { notify } from "@/lib/app-notifications";
import { NOTIFY_CONTENT_OPTIMIZATION_DISABLED_PROCEEDING, NOTIFY_CONTENT_OPTIMIZED_BUT_IMPLEMENTATION_REP, NOTIFY_FAILED_TO_ENSURE_LINKS_IN_EXTRA_CONTENT_, NOTIFY_FAILED_TO_GENERATE_EXTRA_IMAGE_CONTINUIN, NOTIFY_FAILED_TO_GENERATE_EXTRA_TEXT_CONTINUING, NOTIFY_IMPLEMENTATION_REPORT_GENERATED, NOTIFY_POST_UPLOAD_COMPLETED_BUT_MAY_NOT_HAVE_B, notifyOptimizedXs, notifyViewPostX, notifyXPostInWordpress } from "@/lib/notify-messages";
import { getMuteOptimizationToasts } from "@/hooks/content-optimization/optimization-toast-mute";
import { loadApiKey } from "@/lib/api";
import { htmlToMarkdown } from "@/lib/wordpress-converter";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { generateImplementationReport } from "@/lib/implementation-report-generator";
import { type WordPressSite } from "@/components/integrations/types";
import { getStoredSites } from "@/components/integrations/storage";
import { buildPortfolioBlockedHosts } from "@/lib/portfolio-link-blocklist";
import { generateOptimizedContent } from "@/lib/content-generation/content-generator";
import { handleFeaturedImage } from "@/lib/content-generation/featured-image-handler";
import { uploadToWordPress } from "@/lib/content-generation/wordpress-uploader";
import { optimizeMetaFields } from "@/lib/content-generation/meta-optimizer";
import { updateACFOriginField } from "@/lib/content-generation/acf-origin-updater";
import { cleanTitleForNonEntity } from "@/lib/content-optimization-helpers";
import type { ImageType } from "@/lib/image-section-analyzer";
import { generateExtraTextForPage, generateExtraImageForPage } from "@/lib/content-generation/page-extra-content-generator";
import { EXTRA_TEXT_HARNESS_TOTAL_SECTIONS } from "@/lib/content-generation/page-extra-content-generator-prompts";
import { readACFFieldsAgentically, hasExtraTextField, hasExtraImageField, type AIDrivenACFContext } from "@/lib/content-generation/ai-driven-acf-reader";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { normalizeInternalUrl, extractInternalLinksFromContent } from "@/lib/wordpress-api/validate-internal-links";
import { ensureWhatWeOfferTablePageLinks } from "@/lib/content-generation/what-we-offer-table-page-links";
import { removeInvalidInternalLinks, deduplicateInternalLinksInMarkdown, deduplicateInternalLinksInHtml, ensureNoLinkEndsInPeriod } from "@/lib/content-generation/content-sanitizer";
import {
  ensureLinksEvery200WordsForHtml,
  ensureLinksEvery200Words,
  ensureMinimumLinksInHtml,
  countInternalLinksInMarkdown,
  countInternalLinksInHtmlContent,
  MIN_LINKS_PER_POST,
} from "@/lib/content-generation/ensure-links-per-section";
import { ensureSemrushExternalLinksInHtml } from "@/lib/content-generation/ensure-semrush-external-links";
import { reduceHarnessSectionList } from "@/lib/bulk/harness-sections-reducer";
import {
  mergeHarnessProgressSiteAndBatch,
  mergeOptimizationProgress,
} from "@/hooks/content-optimization/optimization-helpers";

/** WordPress REST API can return content/excerpt as { raw, rendered }. Normalize to string. */
function toStringContent(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'raw' in value && typeof (value as { raw?: string }).raw === 'string')
    return (value as { raw: string }).raw;
  if (typeof value === 'object' && 'rendered' in value && typeof (value as { rendered?: string }).rendered === 'string')
    return (value as { rendered: string }).rendered;
  return String(value);
}

function dedupeTrimmedUrls(urls: string[] | undefined): string[] {
  if (!urls?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const t = typeof u === 'string' ? u.trim() : '';
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export interface OptimizationContext {
  site: WordPressSite;
  url: string; // URL of the page being optimized
  updateMode: 'update' | 'draft';
  existingPost: any;
  resolved: any;
  existingTitle: string;
  existingContent: string;
  existingExcerpt: string;
  primaryKeyword: string;
  selectedKeyword: {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  clusterKeywords?: string[];
  wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>;
  /** Entity SAP: pages bucket for What We Offer table links (title attributes). */
  wordPressPagesForOfferTable?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string; postType?: "post" | "page" }>;
  wordPressRAGContext?: string; // WordPress content as RAG context for AI
  /** JSON string: real Google queries for Rank Math meta inspiration (aligned with Overview). */
  gscKeywordsContext?: string;
  /** JSON string: Semrush url_organic + phrase_related keyword lists (bulk content run). */
  semrushKeywordsContext?: string;
  /** JSON string: Semrush keyword clusters + zone scatter (bulk content run). */
  semrushScatterContext?: string;
  /** Semrush-filtered external URLs - preserved verbatim in HTML; sanitizer allowlist. */
  semrushExternalUrls?: string[];
  optimizationOptions?: {
    optimizeTitle?: boolean;
    optimizeMeta?: boolean;
    optimizeExcerpt?: boolean;
    optimizeContent?: boolean;
    optimizeFeaturedImage?: boolean;
    featuredImageType?: 'ai-generated' | 'google-maps';
    testMode?: boolean;
    hasEntity?: boolean;
    /** When set from overview/bulk SAP runs, enables SAP image bank for featured. */
    inventorySitemapSource?: "posts" | "pages" | "sap";
    optimizeExtraText?: boolean;
    optimizeExtraImage?: boolean;
    stagingSite?: boolean;
    bulkFaqMinimum4?: boolean;
    /** When true: skip focus-keyword/FAQ writes during WP upload but still allow post-upload ACF SEO (optimizeMeta). */
    contentOnlyUpload?: boolean;
    /** Only write the `seo_extra_text` / `extra_text` ACF field; no origin/meta optimizer or other ACF. */
    seoExtraTextFieldOnly?: boolean;
  };
  inContentImageRequest?: { imageType: ImageType; userPrompt?: string }; // Optional in-content image generation request
  selectedPeopleAlsoAsk?: string[]; // PAA questions for FAQ schema generation
  /** From prefetch `getACFFieldsForPost` — lets upload skip a second ACF read when ids match. */
  acfFullPostSnapshot?: Record<string, unknown>;
}

/** Queries by impressions for meta AI (same shape as Overview GSC context). */
export function buildGscKeywordsContextJson(
  pageUrl: string,
  queries: Array<{ query?: string; impressions?: number }> | undefined,
): string | undefined {
  if (!pageUrl?.trim() || !queries?.length) return undefined;
  const sorted = [...queries]
    .filter((q) => q?.query?.trim())
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
  const rows = sorted.map((q) => ({ query: String(q.query).trim() }));
  if (!rows.length) return undefined;
  return JSON.stringify({ gsc_keywords_for_url: pageUrl.trim(), rows });
}

export async function generateAndUploadContent(
  blueprintResult: any,
  existingTitle: string,
  primaryKeyword: string,
  site: WordPressSite,
  context: OptimizationContext,
  fileManager: OptimizationFileManager,
  setProgress: (progress: { step: string; progress: number; message?: string }) => void,
  onContentChunk?: (chunk: string) => void,
  optimizationOptions?: {
    optimizeTitle?: boolean;
    optimizeMeta?: boolean;
    optimizeExcerpt?: boolean;
    optimizeContent?: boolean;
    optimizeFeaturedImage?: boolean;
    featuredImageType?: 'ai-generated' | 'google-maps';
    hasEntity?: boolean;
    inventorySitemapSource?: "posts" | "pages" | "sap";
    optimizeExtraText?: boolean;
    optimizeExtraImage?: boolean;
    stagingSite?: boolean;
    bulkFaqMinimum4?: boolean;
    contentOnlyUpload?: boolean;
    seoExtraTextFieldOnly?: boolean;
  },
  acfFields?: Record<string, any>,
  acfContext?: AIDrivenACFContext,
  /** Raw optimization progress setter for harness section list merges (functional updates). */
  setOptimizationProgressRaw?: (fn: (prev: any) => any) => void,
): Promise<{ result: any; markdownContent: string; excerpt: string; changes?: { titleChanged?: boolean; metaChanged?: boolean; contentChanged?: boolean; title?: string; meta?: string } }> {
  // Defaults when no options passed. Caller's optimizationOptions are respected so content can be updated.
  const DEFAULT_OPTIMIZATION_OPTIONS = {
    // Force content-only optimization by default.
    // Title + RankMath meta fields must never be generated or overwritten.
    optimizeTitle: false,
    optimizeMeta: false,
    optimizeExcerpt: false,
    optimizeContent: true,
    optimizeFeaturedImage: false,
    optimizeExtraText: true,
    optimizeExtraImage: false,
  };

  const opts = { ...DEFAULT_OPTIMIZATION_OPTIONS, ...context.optimizationOptions, ...optimizationOptions };
  const seoExtraTextFieldOnly = opts.seoExtraTextFieldOnly === true;

  // CRITICAL FIX: Explicitly check for true - undefined/false means skip
  // This ensures unchecked boxes (false) and missing properties (undefined) both skip
  const shouldOptimizeContent = opts.optimizeContent === true;
  const shouldOptimizeFeaturedImage = opts.optimizeFeaturedImage === true;
  const shouldOptimizeTitle = opts.optimizeTitle === true;
  const shouldOptimizeMeta = opts.optimizeMeta === true;
  const shouldOptimizeExcerpt = opts.optimizeExcerpt === true;
  const legacyContentOnlyInference =
    opts.optimizeTitle === false &&
    opts.optimizeMeta === false &&
    opts.optimizeExcerpt === false &&
    opts.optimizeContent === true;
  const contentOnlyUpload =
    opts.contentOnlyUpload === true || (opts.contentOnlyUpload !== false && legacyContentOnlyInference);
  const bulkFaqMinimum4 = opts.bulkFaqMinimum4 === true;
  const writeFocusKeywords = !contentOnlyUpload;
  const generateFaqSchema = !contentOnlyUpload;
  const writeMetaDescription = shouldOptimizeExcerpt && !contentOnlyUpload;
  const writeExcerpt = shouldOptimizeExcerpt && !contentOnlyUpload;
  
  // Log optimization options for debugging
  console.log('[Content Generation Upload] Optimization options:', {
    optimizeContent: opts.optimizeContent,
    shouldOptimizeContent,
    optimizeTitle: opts.optimizeTitle,
    shouldOptimizeTitle,
    optimizeMeta: opts.optimizeMeta,
    shouldOptimizeMeta,
    optimizeExcerpt: opts.optimizeExcerpt,
    shouldOptimizeExcerpt,
    optimizeFeaturedImage: opts.optimizeFeaturedImage,
    shouldOptimizeFeaturedImage,
    rawOptions: optimizationOptions
  });

  // Load API key once for use in content generation, in-content images, and featured images
  const openRouterApiKey = loadApiKey();
  if (!openRouterApiKey || openRouterApiKey.trim().length === 0) {
    throw new Error('OpenRouter API key not found. Please set it in settings.');
  }

  // Resolve AI-driven ACF context: use passed acfContext or read agentically from acfFields (no static key names)
  let resolvedAcfContext: AIDrivenACFContext | undefined = acfContext;
  if (!resolvedAcfContext && acfFields && Object.keys(acfFields).length > 0) {
    resolvedAcfContext = await readACFFieldsAgentically(acfFields, {
      apiKey: openRouterApiKey,
      siteUrl: site.siteUrl,
      model: getResearchModel(site.id),
    });
  }

  const uploadStartTime = Date.now();

  // Step 1: Generate optimized content (skip if content optimization is disabled)
  let markdownContent: string;
  let htmlContent: string;
  let excerpt: string;
  let preservedMediaUrls: string[] = [];
  // Content-only module: never generate or overwrite meta/description/excerpt.
  // Keep excerpt empty so UI and upload code can't render or persist it.
  excerpt = '';

  if (!shouldOptimizeContent) {
    // Content optimization disabled - skip main body generation; may still run SEO extra text only.
    console.log('[Content Generation Upload] ⚠️ CONTENT OPTIMIZATION DISABLED - Skipping main content generation', {
      optimizeContent: opts.optimizeContent,
      shouldOptimizeContent,
      seoExtraTextFieldOnly,
    });
    markdownContent = toStringContent(context.existingContent) || '';
    htmlContent = toStringContent(context.existingContent) || '';
    if (seoExtraTextFieldOnly) {
      setProgress({
        step: 'Body unchanged...',
        progress: 40,
        message: 'Main post HTML unchanged; generating SEO extra text only…',
      });
      if (setOptimizationProgressRaw) {
        setOptimizationProgressRaw((prev: any) =>
          mergeHarnessProgressSiteAndBatch(prev, site.id, {
            harnessSections: [],
            harnessPlannedSectionCount: EXTRA_TEXT_HARNESS_TOTAL_SECTIONS,
          }),
        );
      }
    } else {
      setProgress({ step: 'Skipping content generation...', progress: 90, message: 'Content optimization disabled, proceeding to upload...' });
      if (!getMuteOptimizationToasts()) notify.info(NOTIFY_CONTENT_OPTIMIZATION_DISABLED_PROCEEDING, { duration: 3000 });
    }
  } else {
    console.log('[Content Generation Upload] ✅ Content optimization ENABLED - proceeding with content generation');
    // Generate optimized content
    if (!getMuteOptimizationToasts()) notify.info(notifyXPostInWordpress(context.updateMode === 'update' ? 'Updating' : 'Creating'), { duration: 3000 });
    setProgress({ step: `${context.updateMode === 'update' ? 'Updating' : 'Creating'} post...`, progress: 90, message: 'Generating content and preparing for upload...' });

    const portfolioList = buildPortfolioBlockedHosts(getStoredSites(), {
      excludeSiteId: site.id,
      excludeSiteUrl: site.siteUrl,
    });
    const portfolioBlockedHostsForPrompts =
      portfolioList.length > 0 ? portfolioList : undefined;

    if (setOptimizationProgressRaw) {
      setOptimizationProgressRaw((prev: any) =>
        mergeOptimizationProgress(prev, site.id, {
          harnessSections: [],
          harnessPlannedSectionCount: null,
        }),
      );
    }

    const contentResult = await generateOptimizedContent({
      blueprintResult,
      existingTitle,
      primaryKeyword,
      site,
      context: {
        wordPressRAGContext: context.wordPressRAGContext,
        wordPressPosts: context.wordPressPosts,
        url: context.url,
        existingContent: toStringContent(context.existingContent),
        inContentImageRequest: context.inContentImageRequest,
        acfFields,
        acfContext: resolvedAcfContext,
        isPage: context.resolved?.subtype === 'page',
        gscKeywordsContext: context.gscKeywordsContext,
        semrushKeywordsContext: context.semrushKeywordsContext,
        semrushScatterContext: context.semrushScatterContext,
        semrushExternalUrls: context.semrushExternalUrls,
        portfolioBlockedHosts: portfolioBlockedHostsForPrompts,
      },
      fileManager,
      setProgress,
      onContentChunk,
      shouldOptimizeContent,
      hasEntityOverride: optimizationOptions?.hasEntity,
      skipMetaDescriptionGeneration: !shouldOptimizeMeta,
      onHarnessSection: setOptimizationProgressRaw
        ? (payload) => {
            setOptimizationProgressRaw((prev: any) => {
              const entry = prev[site.id] || {};
              const nextSections = reduceHarnessSectionList(entry.harnessSections || [], payload);
              return mergeHarnessProgressSiteAndBatch(prev, site.id, {
                harnessSections: nextSections,
                harnessPlannedSectionCount: payload.totalSections,
                step: "Generating optimized content...",
                message: `Harness ${payload.sectionIndex + 1}/${payload.totalSections}: ${payload.title}${payload.phase === "start" ? "…" : ""}`,
              });
            });
          }
        : undefined,
    });

    markdownContent = contentResult.markdownContent;
    htmlContent = contentResult.htmlContent;
    excerpt = contentResult.excerpt ?? '';
    preservedMediaUrls = contentResult.preservedMediaUrls ?? [];

    // CRITICAL: Never silently upload when user asked for content optimization but we got no generated content
    const generatedTrimmed = (markdownContent || '').trim();
    if (context.updateMode === 'update' && !generatedTrimmed) {
      console.error('[Content Generation Upload] Content optimization was enabled but no content was generated', {
        generatedLength: generatedTrimmed.length,
        existingContentLength: toStringContent(context.existingContent).length,
      });
      throw new Error('Content optimization was enabled but no content was generated. Refusing to overwrite with empty content.');
    }

  }

  // Ensure links in main content: 1 per 200 words, then dedupe (each URL once), then top up to minimum 10
  if (context.wordPressPosts && context.wordPressPosts.length > 0) {
    setProgress({ step: 'Ensuring links every 200 words...', progress: 62, message: 'Adding internal links to content...' });
    try {
      htmlContent = await ensureLinksEvery200WordsForHtml({
        htmlContent,
        wordPressPosts: context.wordPressPosts,
        currentPageUrl: context.url,
        siteUrl: site.siteUrl,
        apiKey: openRouterApiKey,
        siteId: site.id,
        setProgress,
      });
      htmlContent = deduplicateInternalLinksInHtml(htmlContent);
      htmlContent = await ensureMinimumLinksInHtml({
        htmlContent,
        wordPressPosts: context.wordPressPosts,
        currentPageUrl: context.url,
        siteUrl: site.siteUrl,
        apiKey: openRouterApiKey,
        siteId: site.id,
        setProgress,
        minTotalLinks: MIN_LINKS_PER_POST,
      });
      htmlContent = ensureNoLinkEndsInPeriod(htmlContent);
      const earlyLinks = countInternalLinksInHtmlContent(htmlContent, context.wordPressPosts, site.siteUrl);
      if (earlyLinks > 0) {
        console.log('[Content Generation Upload] Main content: ', earlyLinks, ' internal link(s) (min ', MIN_LINKS_PER_POST, ')');
      }
    } catch (err) {
      console.error('[Content Generation Upload] Early ensure links failed:', err);
    }
  }

  if (context.wordPressPagesForOfferTable?.length) {
    htmlContent = ensureWhatWeOfferTablePageLinks(
      htmlContent,
      context.wordPressPagesForOfferTable,
      context.url,
      site.siteUrl,
    );
  }

    if (shouldOptimizeContent && context.semrushExternalUrls?.length) {
    htmlContent = ensureSemrushExternalLinksInHtml(htmlContent, context.semrushExternalUrls);
  }

  // Step 2: Handle featured image
  // Extract entity from blueprint (for Google Maps image generation)
  const blueprintEntity = (blueprintResult as any)?.entity;
  const entity = blueprintEntity && blueprintEntity !== 'N/A' ? blueprintEntity : undefined;
  const featuredImageType = optimizationOptions?.featuredImageType || 'ai-generated';
  
  const featuredImageResult = await handleFeaturedImage({
    blueprintResult,
    existingTitle,
    primaryKeyword,
    site,
    markdownContent,
    existingContent: toStringContent(context.existingContent),
    existingPost: context.existingPost,
    fileManager,
    setProgress,
    shouldOptimizeFeaturedImage,
    apiKey: openRouterApiKey,
    featuredImageType,
    entity,
  });

  const { featuredImageId } = featuredImageResult;

  // Step 3: Upload to WordPress
  // Safety check: Clean existingTitle if entity is N/A (though uploadToWordPress will also clean)
  // This ensures we pass the cleanest title possible
  let cleanedExistingTitle = existingTitle;
  if (!blueprintEntity || blueprintEntity === 'N/A') {
    cleanedExistingTitle = cleanTitleForNonEntity(existingTitle, blueprintEntity || 'N/A');
    if (cleanedExistingTitle !== existingTitle) {
      console.log('[Content Generation Upload] Cleaned existingTitle before upload:', {
        original: existingTitle,
        cleaned: cleanedExistingTitle,
        entity: blueprintEntity || 'N/A'
      });
    }
  }
  
  // DEBUG: Log selectedPeopleAlsoAsk before passing to uploader
  console.log('[Content Generation Upload] PAA questions from context:', {
    hasSelectedPeopleAlsoAsk: !!context.selectedPeopleAlsoAsk,
    selectedPeopleAlsoAskLength: context.selectedPeopleAlsoAsk?.length || 0,
    selectedPeopleAlsoAskPreview: context.selectedPeopleAlsoAsk?.slice(0, 2) || [],
    entity
  });
  
  // Step 2.5: Generate extra text and image when the post has the field (post/page agnostic)
  let extraTextContent: string | undefined;
  let extraImageBase64: string | undefined;
  
  const isPage = context.resolved?.subtype === 'page' ||
                 context.resolved?.endpoint === 'pages' ||
                 context.existingPost?.postTypeEndpoint === 'pages';
  // Use AI-driven context to detect extra text/image field presence (no static ACF key names)
  const hasExtraText = resolvedAcfContext ? hasExtraTextField(resolvedAcfContext) : false;
  const shouldGenerateExtraText =
    Boolean(optimizationOptions?.optimizeExtraText) &&
    (seoExtraTextFieldOnly ? true : resolvedAcfContext ? hasExtraText || isPage : isPage);

  if (shouldGenerateExtraText) {
    try {
      if (setOptimizationProgressRaw) {
        setOptimizationProgressRaw((prev: any) =>
          mergeHarnessProgressSiteAndBatch(prev, site.id, {
            harnessSections: [],
            harnessPlannedSectionCount: EXTRA_TEXT_HARNESS_TOTAL_SECTIONS,
          }),
        );
      }
      setProgress({
        step: 'Generating extra text...',
        progress: 78,
        message: `Extra text 1/${EXTRA_TEXT_HARNESS_TOTAL_SECTIONS}: H2…`,
      });
      const existingBody = toStringContent(context.existingContent).trim();
      const pageRagFromPost =
        context.wordPressRAGContext?.trim() ||
        (existingBody
          ? `Main post content (match this topic):\n${existingBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4500)}`
          : "");
      extraTextContent = await generateExtraTextForPage({
        existingContent: existingBody,
        primaryKeyword,
        secondaryKeywords: context.clusterKeywords || [],
        pageUrl: context.url,
        pageTitle: cleanedExistingTitle,
        wordPressRAGContext: pageRagFromPost,
        wordPressPosts: context.wordPressPosts || [],
        site,
        apiKey: openRouterApiKey,
        siteId: site.id,
        setProgress,
        onHarnessSection: setOptimizationProgressRaw
          ? (payload) => {
              setOptimizationProgressRaw((prev: any) => {
                const entry = prev[site.id] || {};
                const nextSections = reduceHarnessSectionList(entry.harnessSections || [], payload);
                const harnessPatch = {
                  harnessSections: nextSections,
                  harnessPlannedSectionCount: payload.totalSections,
                  step: "Generating extra text...",
                  message: `Extra text ${payload.sectionIndex + 1}/${payload.totalSections}: ${payload.title}${payload.phase === "start" ? "…" : ""}`,
                };
                return mergeHarnessProgressSiteAndBatch(prev, site.id, harnessPatch);
              });
            }
          : undefined,
      });
      console.log('[Content Generation Upload] Extra text generated for page:', extraTextContent?.substring(0, 100));
    } catch (error) {
      console.error('[Content Generation Upload] Failed to generate extra text:', error);
      if (!getMuteOptimizationToasts()) notify.warning(NOTIFY_FAILED_TO_GENERATE_EXTRA_TEXT_CONTINUING, { duration: 3000 });
    }
  }
  
  const hasExtraImage = resolvedAcfContext ? hasExtraImageField(resolvedAcfContext) : false;
  const shouldGenerateExtraImage = Boolean(optimizationOptions?.optimizeExtraImage) && (resolvedAcfContext ? hasExtraImage : isPage);
  if (shouldGenerateExtraImage) {
    try {
      setProgress({ step: 'Generating extra image...', progress: 79, message: 'Creating AI-generated image (1:1 ratio, no people/pets)...' });
      const extraImageResult = await generateExtraImageForPage({
        existingContent: toStringContent(context.existingContent),
        primaryKeyword,
        site,
        apiKey: openRouterApiKey,
        siteId: site.id
      });
      extraImageBase64 = extraImageResult.imageBase64;
      console.log('[Content Generation Upload] Extra image generated for page');
    } catch (error) {
      console.error('[Content Generation Upload] Failed to generate extra image:', error);
      if (!getMuteOptimizationToasts()) notify.warning(NOTIFY_FAILED_TO_GENERATE_EXTRA_IMAGE_CONTINUIN, { duration: 3000 });
    }
  }

  // Ensure links in extra text only (main content was ensured earlier)
  if (context.wordPressPosts && context.wordPressPosts.length > 0 && extraTextContent?.trim()) {
    setProgress({ step: 'Ensuring links in extra text...', progress: 88, message: 'Adding internal links to extra content...' });
    try {
      extraTextContent = await ensureLinksEvery200WordsForHtml({
        htmlContent: extraTextContent,
        wordPressPosts: context.wordPressPosts,
        currentPageUrl: context.url,
        siteUrl: site.siteUrl,
        apiKey: openRouterApiKey,
        siteId: site.id,
        setProgress,
      });
      const mainLinks = countInternalLinksInHtmlContent(htmlContent, context.wordPressPosts, site.siteUrl);
      const extraLinks = countInternalLinksInHtmlContent(extraTextContent, context.wordPressPosts, site.siteUrl);
      const totalLinks = mainLinks + extraLinks;
      console.log('[Content Generation Upload] Ensure links: total internal links', totalLinks, '(main:', mainLinks, ', extra:', extraLinks, ')');
      if (totalLinks === 0) {
        console.warn('[Content Generation Upload] No links in content after ensure step – upload will continue; add more linkable posts or retry.');
      }
    } catch (err) {
      console.error('[Content Generation Upload] Ensure links in extra text failed:', err);
      if (!getMuteOptimizationToasts()) notify.warning(NOTIFY_FAILED_TO_ENSURE_LINKS_IN_EXTRA_CONTENT_, { duration: 4000 });
    }
  }

  // Ensure each internal link URL appears at most once in SEO extra content
  if (extraTextContent?.trim()) {
    extraTextContent = deduplicateInternalLinksInHtml(extraTextContent);
  }

  // Sanitize before validate: remove internal links not in allowed list (200-only) so we never throw on 404s
  const htmlForValidation = removeInvalidInternalLinks(htmlContent, context.wordPressPosts, site.siteUrl);
  const extraForValidation = extraTextContent
    ? removeInvalidInternalLinks(extraTextContent, context.wordPressPosts, site.siteUrl)
    : undefined;

  const strippedHtml = htmlForValidation;
  const strippedExtra = extraForValidation;

  const prefetchedFaqRaw = (() => {
    if (!acfFields) return '';
    const raw = acfFields.faq ?? acfFields.seo_faq;
    if (typeof raw === 'string') return raw;
    if (raw != null) return String(raw);
    return '';
  })();

  // HTML + canonical link are stored after a successful WordPress upload (below).

  const uploadResult = await uploadToWordPress({
    context,
    blueprintResult,
    existingTitle: cleanedExistingTitle, // Use cleaned title
    primaryKeyword,
    htmlContent: strippedHtml,
    excerpt,
    featuredImageId,
    shouldOptimizeTitle,
    writeFocusKeywords,
    generateFaqSchema,
    prefetchedFaqRaw,
    bulkFaqMinimum4,
    writeMetaDescription,
    writeExcerpt,
    setProgress,
    entity, // Pass entity to uploader for ACF origin field update
    faqQuestions: context.selectedPeopleAlsoAsk, // Pass PAA questions for FAQ schema generation
    allowedExternalUrls: (() => {
      const u = dedupeTrimmedUrls([
        ...(context.semrushExternalUrls ?? []),
        ...preservedMediaUrls,
      ]);
      return u;
    })(),
    apiKey: openRouterApiKey, // Pass API key for AI-driven question generation when PAA questions are missing
    extraTextContent: strippedExtra ?? extraTextContent, // Pass stripped extra for pages
    extraImageBase64, // Pass extra image for pages
    seoExtraTextFieldOnly,
  });

  const { result, postId, link, finalTitle } = uploadResult;

  // Persist HTML + WordPress canonical link for the Overview row patch.
  try {
    const { storeOverviewOptimizedHtml } = await import("@/lib/overview/overview-content-opt-html-store");
    storeOverviewOptimizedHtml(context.url, strippedHtml, link || undefined);
  } catch {
    /* ignore */
  }
  
  // CRITICAL: Do not proceed when WordPress REST upload failed.
  // Bulk runner assumes "completed" means upload + ACF updates succeeded.
  if (result?.success !== true || !postId || !link) {
    const errorMessage =
      result?.error
      ? String(result.error)
      : `Unknown WordPress upload failure (success=${String(result?.success)})`;
    throw new Error(`WordPress upload failed: ${errorMessage}`);
  }
  if (result?.contentSaveWarning) {
    throw new Error(`WordPress upload failed: ${String(result.contentSaveWarning)}`);
  }

  // Save WordPress upload confirmation file so the user has proof of a successful upload
  const uploadConfirmationFileName = OptimizationFileManager.generateFilename(
    'wordpress-post-upload',
    postId.toString(),
    'json'
  );
  fileManager.addFile(
    uploadConfirmationFileName,
    JSON.stringify({
      success: true,
      postId,
      link,
      finalTitle,
      status: result.status || 'published',
      updateMode: context.updateMode,
      url: context.url,
      uploadedAt: new Date().toISOString(),
      wordpressSite: site?.url || site?.name || null,
      result,
    }, null, 2),
    'application/json'
  );

  // Track what was actually changed - compare with original values
  const existingExcerptClean = toStringContent(context.existingExcerpt).replace(/<[^>]*>/g, '').trim();
  const excerptClean = excerpt ? excerpt.replace(/<[^>]*>/g, '').trim() : '';
  
  const titleChanged = shouldOptimizeTitle && finalTitle !== existingTitle && finalTitle.trim() !== existingTitle.trim();
  const metaChanged = shouldOptimizeMeta && excerptClean !== existingExcerptClean && excerptClean.length > 0;
  const existingContentStrForCompare = toStringContent(context.existingContent);
  const contentChanged = shouldOptimizeContent && markdownContent !== existingContentStrForCompare && markdownContent.trim() !== existingContentStrForCompare.trim();

  const changes = {
    titleChanged,
    metaChanged,
    contentChanged,
    title: titleChanged ? finalTitle : undefined,
    meta: metaChanged ? excerptClean : undefined,
  };

  console.log('[Content Generation] Changes tracked:', {
    ...changes,
    comparison: {
      title: { existing: existingTitle, final: finalTitle, changed: titleChanged },
      meta: { existing: existingExcerptClean.substring(0, 50), final: excerptClean.substring(0, 50), changed: metaChanged },
      content: { existingLength: toStringContent(context.existingContent).length, finalLength: markdownContent?.length, changed: contentChanged }
    }
  });

  // Show success notification with post details
  if (result.success && postId && link) {
    if (!getMuteOptimizationToasts()) {
      console.log("[Content Generation] Post link:", link, postId, result.status);
      notify.success(
        context.updateMode === "update" ? `Post updated (${postId})` : `Post created (${postId})`,
        { duration: 8000 },
      );
    }
    console.log(`[Content Generation] ✅ Post ${context.updateMode === 'update' ? 'updated' : 'created'}: ID ${postId}, Link: ${link}, Status: ${result.status}`);
  } else {
    console.error('[Content Generation] ⚠️ Post upload completed but result indicates failure:', { success: result.success, postId, link, error: result.error });
    if (!getMuteOptimizationToasts()) notify.warning(NOTIFY_POST_UPLOAD_COMPLETED_BUT_MAY_NOT_HAVE_B, { duration: 8000 });
  }

  // Step 4: Update ACF Origin field (if entity sitemap URL is provided)
  // Skip when SEO extra-text-only or bulk content-only upload (inventory keyword untouched).
  if (!seoExtraTextFieldOnly && !contentOnlyUpload) {
    const blueprintOriginRaw =
      blueprintResult && typeof (blueprintResult as { origin?: unknown }).origin === "string"
        ? String((blueprintResult as { origin: string }).origin).trim()
        : "";
    await updateACFOriginField({
      postId,
      finalTitle,
      site,
      existingPost: context.existingPost,
      resolved: context.resolved,
      setProgress,
      pageUrl: context.url,
      excerpt, // AI agent uses excerpt + title + slug to fill Origin (no manual extraction)
      existingOrigin: context.existingPost?.acf?.origin ?? undefined,
      preferredOrigin: blueprintOriginRaw.length > 0 ? blueprintOriginRaw : undefined,
    });
  }

  // Step 5: Optimize meta fields (meta description is set in final step by uploadToWordPress, not here)
  if (shouldOptimizeMeta && !contentOnlyUpload) {
    console.log('[Content Generation Upload] ✅ Meta optimization ENABLED - proceeding with meta field optimization');
    await optimizeMetaFields({
      postId,
      markdownContent,
      finalTitle,
      metaDescription: excerpt, // Use the generated meta description (previously called excerpt)
      primaryKeyword,
      site,
      postLink: link,
      existingPost: context.existingPost,
      fileManager,
      setProgress,
      shouldOptimizeMeta,
      gscKeywordsContext: context.gscKeywordsContext,
    });
  } else {
    console.log('[Content Generation Upload] ⚠️ Meta optimization DISABLED - skipping meta field optimization', {
      optimizeMeta: opts.optimizeMeta,
      shouldOptimizeMeta,
      reason: 'User unchecked Meta optimization option'
    });
  }

  const uploadTime = Math.floor((Date.now() - uploadStartTime) / 1000);
  
  if (!getMuteOptimizationToasts()) {
    notify.success(notifyOptimizedXs(uploadTime), { duration: 5000 });
  }
  if (link) {
    if (!getMuteOptimizationToasts()) notify.info(notifyViewPostX(link), {
      duration: 5000,
      action: {
        label: 'Open',
        onClick: () => window.open(link, '_blank'),
      },
    });
  }

  const returnedExcerpt = contentOnlyUpload ? '' : excerpt;

  const acf = context.existingPost?.acf;
  const originalExtraRaw =
    acf && typeof acf === 'object'
      ? typeof acf.seo_extra_text === 'string'
        ? acf.seo_extra_text
        : typeof acf.extra_text === 'string'
          ? acf.extra_text
          : ''
      : '';
  let originalExtraForReport = originalExtraRaw;
  try {
    if (originalExtraForReport.includes('<') && originalExtraForReport.includes('>')) {
      originalExtraForReport = htmlToMarkdown(originalExtraForReport);
    }
  } catch {
    // keep raw
  }
  const newExtraForReport = (strippedExtra ?? extraTextContent ?? '').trim();

  // Step 6: Generate Implementation Report
  try {
    setProgress({ step: 'Generating implementation report...', progress: 95, message: 'Creating comparison report...' });
    
    // Get original content as markdown for comparison (WordPress API may return { raw, rendered })
    let originalContentMarkdown = toStringContent(context.existingContent);
    try {
      if (originalContentMarkdown.includes('<') && originalContentMarkdown.includes('>')) {
        originalContentMarkdown = htmlToMarkdown(originalContentMarkdown);
      }
    } catch (error) {
      console.warn('[Content Generation] Could not convert original content to markdown for report:', error);
    }

    await generateImplementationReport(
      {
        originalTitle: context.existingTitle,
        newTitle: blueprintResult.title || context.existingTitle || primaryKeyword,
        originalExcerpt: toStringContent(context.existingExcerpt) || '',
        newExcerpt: returnedExcerpt,
        originalContent: originalContentMarkdown,
        newContent: markdownContent,
        primaryKeyword,
        clusterKeywords: context.clusterKeywords,
        selectedKeyword: context.selectedKeyword,
        blueprintResult,
        updateMode: context.updateMode,
        url: context.url,
        originalExtraText: originalExtraForReport || undefined,
        newExtraText: newExtraForReport || undefined,
      },
      fileManager,
      {
        skipMetaDescriptionSection: contentOnlyUpload && !shouldOptimizeMeta,
      }
    );

    setProgress({ step: 'Complete', progress: 100, message: 'Implementation report generated successfully!' });
    if (!getMuteOptimizationToasts()) notify.success(NOTIFY_IMPLEMENTATION_REPORT_GENERATED, { duration: 3000 });
  } catch (error) {
    console.error('[Content Generation] Error generating implementation report:', error);
    // Don't fail the whole process if report generation fails
    if (!getMuteOptimizationToasts()) notify.warning(NOTIFY_CONTENT_OPTIMIZED_BUT_IMPLEMENTATION_REP, { duration: 5000 });
  }

  return { result, markdownContent, excerpt: returnedExcerpt, changes };
}
