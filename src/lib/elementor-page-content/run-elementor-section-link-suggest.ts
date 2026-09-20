import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { INTERNAL_LINK_INTENT_ROUTING_RULE } from "@/lib/content-generation/internal-link-routing-rules";
import { buildElementorPageHtml } from "@/lib/elementor-page-content/elementor-page-html";
import { resolveElementorSectionFocusKeyword } from "@/lib/elementor-page-content/elementor-section-focus-keyword";
import { sectionOutlineFromJson } from "@/lib/elementor-page-content/apply-elementor-section-copy";
import type { BlogLinksCatalogRow } from "@/lib/overview/overview-blog-links-catalog";
import { linkPoolHasTargets } from "@/lib/overview/overview-blog-links-catalog";
import {
  extractAllSectionLinkRowsFromHtml,
  extractInternalLinksFromHtml,
  findHtmlParagraphSpans,
} from "@/lib/overview/overview-blog-links-extract";
import {
  runBlogLinksAddIntent,
  runBlogLinksReplaceIntent,
  type ArticleLinkForIntent,
  type SectionLinkIntentContext,
} from "@/lib/overview/overview-blog-links-link-intent";
import {
  getBlogLinksLinkPoolFromSession,
  loadBlogLinksLinkInventory,
} from "@/lib/overview/overview-blog-links-inventory";
import { normalizeInternalUrl } from "@/lib/wordpress-api/validate-internal-links";

function heuristicSearchIntent(keyword: string): string {
  const k = keyword.toLowerCase();
  if (/\b(buy|price|cost|quote|order|near me|hire|book)\b/.test(k)) return "transactional";
  if (/\b(how|what|why|guide|tips|learn|explained)\b/.test(k)) return "informational";
  if (/\b(best|top|review|compare|vs|versus)\b/.test(k)) return "commercial";
  return "commercial";
}

export type RunElementorSectionLinkSuggestArgs = {
  site: WordPressSite;
  row: OverviewRow;
  sectionId: string;
  linkIndex: number;
  apiKey: string;
  model?: string;
};

export type ElementorSectionLinkSuggestResult = {
  anchor: string;
  href: string;
};

export async function runElementorSectionLinkSuggest(
  args: RunElementorSectionLinkSuggestArgs,
): Promise<ElementorSectionLinkSuggestResult | null> {
  const { site, row, sectionId, linkIndex, apiKey, model } = args;
  const url = row.url?.trim();
  const elementorJson = row.elementorDataJson?.trim();
  if (!url || !elementorJson) return null;

  let pool = getBlogLinksLinkPoolFromSession(site.id);
  if (!pool) {
    const loaded = await loadBlogLinksLinkInventory(site);
    pool = loaded?.pool ?? null;
  }
  if (!pool || !linkPoolHasTargets(pool, site.siteUrl, url)) return null;

  const sections = sectionOutlineFromJson(elementorJson);
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return null;

  const sectionBodyHtml = section.bodyHtml?.trim() || section.bodyText?.trim() || "";
  const sectionFocusKeyword = resolveElementorSectionFocusKeyword(row, sectionId, section.title);
  const sectionContext: SectionLinkIntentContext = {
    sectionHeading: section.title.trim(),
    sectionFocusKeyword,
    searchIntent: heuristicSearchIntent(sectionFocusKeyword),
    intentRoutingRule: INTERNAL_LINK_INTENT_ROUTING_RULE,
  };

  const pageHtml = buildElementorPageHtml(elementorJson);
  const usedDestinationUrls = extractInternalLinksFromHtml(pageHtml, site.siteUrl, url).map((link) =>
    normalizeInternalUrl(site.siteUrl, link.href),
  );

  const sectionLinks = extractAllSectionLinkRowsFromHtml(sectionBodyHtml);
  const articleLinks: ArticleLinkForIntent[] = sectionLinks.map((link, index) => ({
    index,
    anchor: link.anchor,
    href: link.href,
  }));

  const catalogRow: BlogLinksCatalogRow = {
    index: 0,
    url,
    postId: row.postId ?? 0,
    title: row.title.trim(),
    focusKeyword: sectionFocusKeyword,
    seoResearchBrief: row.seoResearch?.trim() ?? "",
    existingLinks: extractInternalLinksFromHtml(pageHtml, site.siteUrl, url),
    html: pageHtml,
    linkPool: pool,
    wordCount: 0,
    sectionHeadings: sections.length,
    linksToAdd: 1,
    paragraphCount: findHtmlParagraphSpans(sectionBodyHtml).length,
  };

  const agentOptions = {
    apiKey,
    model,
    siteUrl: site.siteUrl,
    siteId: site.id,
  };

  const existing = sectionLinks[linkIndex];
  if (existing) {
    const result = await runBlogLinksReplaceIntent(
      catalogRow,
      linkIndex,
      agentOptions,
      usedDestinationUrls,
      articleLinks,
      sectionContext,
    );
    if (!result?.proposedUrl) return null;
    return {
      anchor: result.proposedKeyword.trim() || existing.anchor.trim() || sectionFocusKeyword,
      href: result.proposedUrl,
    };
  }

  const paragraphs = findHtmlParagraphSpans(sectionBodyHtml);
  const paragraphIndex = 0;
  const paragraphText =
    paragraphs[paragraphIndex]?.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ||
    sectionFocusKeyword ||
    section.title.trim() ||
    sectionBodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);

  if (!paragraphText) return null;

  const result = await runBlogLinksAddIntent(
    catalogRow,
    paragraphIndex,
    paragraphText,
    agentOptions,
    usedDestinationUrls,
    articleLinks,
    sectionContext,
  );
  if (!result?.proposedUrl) return null;
  return {
    anchor: result.anchorText.trim() || result.proposedKeyword.trim() || sectionFocusKeyword,
    href: result.proposedUrl,
  };
}
