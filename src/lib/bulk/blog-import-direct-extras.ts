import type { WordPressSite } from "@/components/integrations/types";
import type { BulkProcessingOptions } from "@/lib/bulk-auto-generate";
import {
  addKeywordResearchSnapshotToBulkFiles,
  resolveRankMathFromKeywordResearch,
} from "@/lib/bulk-auto-generate";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { htmlTextFingerprint } from "@/lib/bulk/blog-import-format-blocks";
import { runIntelligentKeywordResearchMerge } from "@/lib/bulk/intelligent-keyword-research-merge";
import { generateFeaturedImage, generateImageChecklist } from "@/lib/bulk/bulk-image-generator";
import { BulkFileManager, type BulkGeneratedFile } from "@/lib/bulk-file-manager";
import { fetchGoogleMapsImageForEntity } from "@/lib/content-generation/google-maps-image-api";
import { discoverACFFieldMapping, fallbackFieldMapping } from "@/lib/content-generation/acf-field-mapper";
import { buildAcfPayload } from "@/lib/content-generation/apply-meta-acf-payload";
import { buildOptimizedMetaFromKeywordResearch } from "@/lib/content-generation/apply-bulk-meta-from-seo-json";
import {
  buildPostMarkdownAcfSeoFaqBundle,
  buildPreBlogSeoResearchSkeleton,
  patchPostLinkInSeoResearchJson,
  resolveFaqEntriesForVisibleTable,
  type PrecomputedAcfSeoBundle,
} from "@/lib/content-generation/bulk-acf-seo-bundle";
import { generateSEOImageFilename } from "@/lib/image-filename-generator";
import type { KeywordAIAnalysis, KeywordAnalysisComplete, KeywordAnalysisOptions, KeywordData } from "@/lib/keyword-types";
import {
  extractAnswerSectionHtml,
  extractOverviewSectionHtml,
  generateAndPrependOverviewHtml,
  stripLeadingAnswerSection,
  stripLeadingOverviewSection,
} from "@/lib/overview/overview-blog-overview-prepend";
import {
  appendVisibleFaqTableWithIntro,
  stripTrailingFaqSection,
} from "@/lib/overview/overview-blog-faq-append";
import { buildBlogImportKeywordResearchStub } from "@/lib/bulk/blog-import-parse";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { getACFFieldsForPost, resolveAcfFieldsForMapping } from "@/lib/wordpress-api/acf-discovery";
import { fetchSemrushBulkEnrichment } from "@/lib/wordpress-api/semrush";
import { uploadWordPressMedia, updateWordPressPostMeta } from "@/lib/wordpress-api";
import { updateACFFields } from "@/lib/wordpress-acf-origin";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";

export type DirectAnalyzeKeywordFn = (
  keyword: string,
  analysisOptions: KeywordAnalysisOptions,
) => Promise<KeywordAnalysisComplete | null>;

export type DirectFeaturedImageMode = "y" | "n" | "google-maps";

export function resolveDirectFeaturedImageMode(
  row: Pick<CSVRow, "featuredImage">,
  formMode?: DirectFeaturedImageMode,
): DirectFeaturedImageMode {
  const fromRow = row.featuredImage?.trim().toLowerCase();
  if (fromRow === "y" || fromRow === "n" || fromRow === "google-maps") return fromRow;
  return formMode === "n" || formMode === "google-maps" ? formMode : "y";
}

export function directImportBodyFingerprint(html: string): string {
  const withoutFaq = stripTrailingFaqSection(html);
  const body = stripLeadingOverviewSection(stripLeadingAnswerSection(withoutFaq));
  return htmlTextFingerprint(body);
}

export async function prependDirectAnswerAndOverview(args: {
  bodyHtml: string;
  articleTitle: string;
  focusKeyword: string;
  pageUrl?: string;
  site: WordPressSite;
  entity?: string;
  seoResearchBrief?: string;
  apiKey: string;
  model?: string;
}): Promise<string> {
  const result = await generateAndPrependOverviewHtml({
    sourceHtml: args.bodyHtml,
    articleTitle: args.articleTitle,
    focusKeyword: args.focusKeyword,
    pageUrl: args.pageUrl,
    connectedSite: { name: args.site.name, siteUrl: args.site.siteUrl },
    site: args.site,
    entity: args.entity,
    seoResearchBrief: args.seoResearchBrief,
    apiKey: args.apiKey,
    model: args.model,
  });
  if (!result?.html?.trim()) {
    throw new Error("Direct Answer and Overview returned no HTML");
  }
  if (!extractAnswerSectionHtml(result.html).trim()) {
    throw new Error("Direct Answer section is empty");
  }
  if (!extractOverviewSectionHtml(result.html).trim()) {
    throw new Error("Direct Overview section is empty");
  }
  return result.html;
}

/** Use DataForSEO when Labs returns keyword_info. Long-tail phrases with empty items keep the row keyword. */
export function resolveDirectKeywordResearchFromAnalyze(
  row: CSVRow,
  research: KeywordAnalysisComplete | null,
): { keywordData: KeywordData; aiAnalysis: KeywordAIAnalysis } {
  const keyword = row.keyword?.trim() || row.keyword_focus?.trim() || "";
  if (!keyword) throw new Error("Direct import meta is missing keyword");
  const stub = buildBlogImportKeywordResearchStub(row);
  if (!research?.result?.keywordData) {
    return { keywordData: stub.keywordData, aiAnalysis: stub.aiAnalysis };
  }
  return {
    keywordData: { ...research.result.keywordData, keyword },
    aiAnalysis: research.aiAnalysis ?? stub.aiAnalysis,
  };
}

export async function runDirectKeywordResearch(args: {
  rowIndex: number;
  row: CSVRow;
  options: BulkProcessingOptions;
  fileManager: BulkFileManager;
  analyzeKeyword: DirectAnalyzeKeywordFn;
  pageUrl: string;
}): Promise<{
  keywordData: KeywordData;
  seoResearchBrief: string;
  files: BulkGeneratedFile[];
}> {
  const keyword = args.row.keyword?.trim() || args.row.keyword_focus?.trim() || "";
  if (!keyword) throw new Error("Direct import meta is missing keyword");

  args.options.onProgress?.(args.rowIndex, 0, "Keyword research...");
  let research: KeywordAnalysisComplete | null = null;
  try {
    research = await args.analyzeKeyword(keyword, {
      location: "United States",
      language: "en",
      strict: false,
    });
  } catch (err) {
    console.warn("[Direct import] DataForSEO keyword overview empty or failed, using row keyword:", err);
    research = null;
  }

  const { keywordData, aiAnalysis } = resolveDirectKeywordResearchFromAnalyze(args.row, research);

  const semrush = await fetchSemrushBulkEnrichment({
    pageUrl: args.pageUrl,
    seedKeyword: keyword,
    portfolioBlockedHosts: args.options.portfolioBlockedHosts,
  });

  args.options.onProgress?.(args.rowIndex, 0, "Merging keyword research with Semrush...");
  const mergeResult = await runIntelligentKeywordResearchMerge(args.row, keywordData, semrush, {
    apiKey: args.options.openRouterApiKey,
    model: args.options.selectedModel || getResearchModel(),
  });

  const timestamp = Date.now();
  const snapshot = addKeywordResearchSnapshotToBulkFiles(
    args.rowIndex,
    args.row,
    args.fileManager,
    args.options,
    timestamp,
    {
      keywordData,
      aiAnalysis,
      keywordsVolumeData: research?.keywordsVolumeData ?? [],
      paaRawResponse: research?.paaRawResponse ?? null,
      primaryKeyword: keyword,
      semrush,
      intelligentMerge: mergeResult.merge,
      primaryExternalCitationUrl: mergeResult.primaryExternalCitationUrl,
    },
  );

  const skeleton = buildPreBlogSeoResearchSkeleton({
    keywordData,
    enrichedRow: args.row,
    flowTitle: args.row.title.trim(),
  });
  if (mergeResult.primaryExternalCitationUrl) {
    skeleton.semrush_primary_external_url = mergeResult.primaryExternalCitationUrl;
  }
  skeleton.research_intent = mergeResult.merge.primaryIntent ?? keywordData.intent;

  return {
    keywordData,
    seoResearchBrief: JSON.stringify(skeleton),
    files: [snapshot],
  };
}

export async function appendDirectFaqAndSchema(args: {
  html: string;
  row: CSVRow;
  keywordData: KeywordData;
  excerpt: string;
  site: WordPressSite;
  postTitle: string;
  primaryKw: string;
  placeholderPostUrl: string;
  seoResearchBrief: string;
  apiKey: string;
  model?: string;
  onProgress?: (message: string) => void;
}): Promise<{ html: string; bundle: PrecomputedAcfSeoBundle }> {
  const rankMeta = resolveRankMathFromKeywordResearch(args.keywordData);
  let parsed: unknown;
  try {
    parsed = JSON.parse(args.seoResearchBrief) as unknown;
  } catch {
    throw new Error("Direct SEO research JSON is invalid");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Direct SEO research JSON is invalid");
  }
  const preBlogSkeleton = parsed as Record<string, unknown>;
  const bundle = await buildPostMarkdownAcfSeoFaqBundle({
    preBlogSkeleton,
    markdownContent: args.html,
    enrichedRow: args.row,
    keywordData: args.keywordData,
    blueprintTitle: args.postTitle,
    excerpt: args.excerpt,
    site: args.site,
    postTitle: args.postTitle,
    primaryKw: args.primaryKw,
    rankMeta,
    openRouterApiKey: args.apiKey,
    placeholderPostUrl: args.placeholderPostUrl,
    onProgress: args.onProgress,
  });
  if (!bundle?.faqForAcf || !bundle.seoResearchJson) {
    throw new Error("Direct FAQ schema was empty");
  }

  let html = args.html;
  const visibleFaqEntries = resolveFaqEntriesForVisibleTable(bundle.faqEntries);
  if (!visibleFaqEntries.length) {
    throw new Error("Direct FAQ entries were empty");
  }
  const appended = await appendVisibleFaqTableWithIntro({
    sourceHtml: html,
    entries: visibleFaqEntries,
    apiKey: args.apiKey,
    model: args.model,
    focusKeyword: args.primaryKw,
    pageTitle: args.postTitle,
  });
  if (!appended?.html) {
    throw new Error("Direct FAQ table was not appended");
  }
  return { html: appended.html, bundle };
}

export async function generateDirectFeaturedImagePayload(args: {
  mode: DirectFeaturedImageMode;
  title: string;
  bodyHtml: string;
  entity?: string;
  apiKey: string;
  model?: string;
}): Promise<{ imageBase64: string; filename: string } | undefined> {
  if (args.mode === "n") return undefined;

  let imageBase64: string;
  if (args.mode === "google-maps") {
    const entity = args.entity?.trim();
    if (!entity || entity === "N/A") {
      throw new Error("Direct Google Maps featured image needs an entity");
    }
    const maps = await fetchGoogleMapsImageForEntity(entity);
    if (!maps?.imageBase64) {
      throw new Error("Direct Google Maps featured image failed");
    }
    imageBase64 = maps.imageBase64;
  } else {
    const purpose = `Featured image for ${args.title}`;
    const checklist = await generateImageChecklist(args.title, purpose, args.bodyHtml, {
      apiKey: args.apiKey,
      model: args.model || getResearchModel(),
    });
    const image = await generateFeaturedImage(args.title, purpose, args.bodyHtml, checklist, {
      apiKey: args.apiKey,
      model: args.model || getResearchModel(),
    });
    imageBase64 = image.imageBase64;
  }

  const filename = await generateSEOImageFilename(
    args.title,
    args.apiKey,
    args.model || getResearchModel(),
    "featured",
  );
  return { imageBase64, filename };
}

export async function uploadDirectFeaturedMedia(args: {
  site: WordPressSite;
  imageBase64: string;
  filename: string;
  title: string;
  keyword: string;
}): Promise<number> {
  const media = await uploadWordPressMedia(
    args.site.siteUrl,
    args.site.username,
    args.site.appPassword,
    args.imageBase64,
    args.filename,
    args.title,
    args.keyword,
  );
  if (!media.success || !media.mediaId) {
    throw new Error(media.error || "Direct featured image upload failed");
  }
  return media.mediaId;
}

export async function writeDirectSeoAcfAndRankMath(args: {
  site: WordPressSite;
  postId: number;
  postTypeForAcf: string;
  entityEndpoint: string;
  postLink: string;
  postTitle: string;
  excerpt: string;
  primaryKw: string;
  keywordData: KeywordData;
  bundle: PrecomputedAcfSeoBundle;
  baseAcf: Record<string, string>;
  apiKey: string;
}): Promise<Record<string, string>> {
  const rankMeta = resolveRankMathFromKeywordResearch(args.keywordData);
  const seoResearchJson = patchPostLinkInSeoResearchJson(
    args.bundle.seoResearchJson,
    args.postLink,
    args.site.siteUrl,
    args.postTitle,
    args.excerpt,
    args.primaryKw,
    rankMeta,
  );
  const optimizedMeta = buildOptimizedMetaFromKeywordResearch(
    rankMeta,
    args.postTitle,
    args.excerpt,
    args.primaryKw,
    args.postLink,
    args.site.siteUrl,
  );

  const acfResult = await getACFFieldsForPost(
    args.site,
    args.postId,
    args.postTypeForAcf,
    args.entityEndpoint,
  );
  const existingAcfFields =
    acfResult.success && acfResult.fields ? (acfResult.fields as Record<string, unknown>) : {};
  const fieldsForMapping = await resolveAcfFieldsForMapping(args.site, existingAcfFields);
  const fieldMapping = {
    ...fallbackFieldMapping(fieldsForMapping),
    ...(await discoverACFFieldMapping(
      fieldsForMapping,
      args.postTypeForAcf,
      args.apiKey,
      args.site.siteUrl,
    )),
  };

  const acfWrite: Record<string, string> = { ...args.baseAcf };
  acfWrite[fieldMapping.keywordFocus || "keyword_focus"] = args.primaryKw.slice(0, 500);
  acfWrite[fieldMapping.seoResearch || "seo_research"] = seoResearchJson;
  acfWrite[fieldMapping.faq || "faq"] = args.bundle.faqForAcf;
  const mappedMeta = buildAcfPayload(
    fieldMapping,
    optimizedMeta,
    args.primaryKw,
    existingAcfFields,
    seoResearchJson,
    { includeSeoResearchInPayload: false },
  );
  Object.assign(acfWrite, mappedMeta);

  const acfUpdate = await updateACFFields(
    args.site.siteUrl,
    args.site.username,
    args.site.appPassword,
    args.postId,
    acfWrite,
    args.postTypeForAcf,
    args.entityEndpoint,
  );
  if (!acfUpdate.success) {
    throw new Error(acfUpdate.error || "Direct ACF write failed");
  }

  const rankMath = await updateWordPressPostMeta(
    args.site.siteUrl,
    args.site.username,
    args.site.appPassword,
    args.postId,
    args.postTypeForAcf,
    args.entityEndpoint,
    {
      rank_math_title: optimizedMeta.rank_math_title,
      rank_math_description: optimizedMeta.rank_math_description,
      rank_math_focus_keyword: optimizedMeta.rank_math_focus_keyword,
    },
  );
  if (!rankMath.success) {
    throw new Error(rankMath.error || "Direct Rank Math meta write failed");
  }

  return acfWrite;
}

export function directPageUrl(site: WordPressSite, slug: string): string {
  const base = getPublicSiteUrl(site).replace(/\/+$/, "");
  return slug ? `${base}/${slug}` : base;
}
