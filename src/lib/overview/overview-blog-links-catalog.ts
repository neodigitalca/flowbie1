import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import type { WordPressSite } from "@/components/integrations/types";
import { downloadFieldsFromInventoryRow } from "@/lib/overview/overview-inventory-seo-fields";
import { lookupOverviewInventoryHitForUrl } from "@/hooks/content-optimization/bulk-seo-extra-text-fast-path";
import {
  overviewBindingForRow,
  resolveOverviewBindingForRow,
} from "@/lib/overview/overview-bulk-seo-payload";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import {
  extractInternalLinksFromHtml,
  findHtmlParagraphSpans,
  type BlogInternalLinkSpan,
} from "@/lib/overview/overview-blog-links-extract";
import type { BlogHeadersGscPicks } from "@/lib/overview/overview-blog-headers-gsc";
import { computeBlogLinksBudget } from "@/lib/overview/overview-blog-links-budget";
import type { LinkInventoryBucket } from "@/lib/overview/overview-blog-links-bucket";
import type { BlogLinksSiteLinkPool } from "@/lib/overview/overview-blog-links-inventory";
import { normalizeInternalUrl } from "@/lib/wordpress-api/validate-internal-links";

export type BlogLinkCandidate = {
  url: string;
  title: string;
  excerpt: string;
  focusKeyword?: string;
  bucket: LinkInventoryBucket;
};

export type BlogLinksCatalogRow = {
  index: number;
  url: string;
  postId: number;
  title: string;
  focusKeyword: string;
  seoResearchBrief: string;
  existingLinks: BlogInternalLinkSpan[];
  html: string;
  linkPool: BlogLinksSiteLinkPool;
  wordCount: number;
  sectionHeadings: number;
  linksToAdd: number;
  paragraphCount: number;
  gscPicks?: BlogHeadersGscPicks;
  userLinkTargets?: Array<{ anchor: string; href: string }>;
};

export type BuildBlogLinksCatalogResult = {
  catalog: BlogLinksCatalogRow[];
  skippedNoHtml: number[];
  skippedNoBinding: number[];
  skippedNoWork: number[];
};

function resolveBinding(
  row: OverviewRow,
  bindings: Record<string, OverviewBinding | undefined>,
  invMatch: OverviewInventoryUrlMatch | null,
): OverviewBinding | undefined {
  return (
    resolveOverviewBindingForRow(row, bindings, invMatch) ??
    overviewBindingForRow(row, bindings)
  );
}

export function linkPoolHasTargets(pool: BlogLinksSiteLinkPool, siteUrl: string, excludeUrl: string): boolean {
  const excludeNorm = normalizeInternalUrl(siteUrl, excludeUrl);
  for (const slim of [...pool.postInventory, ...pool.pageInventory]) {
    if (normalizeInternalUrl(siteUrl, slim.url) !== excludeNorm) return true;
  }
  return false;
}

export function buildBlogLinksCatalog(
  rows: OverviewRow[],
  bindings: Record<string, OverviewBinding | undefined>,
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined,
  site: WordPressSite | null,
  siteUrl: string,
  linkPool: BlogLinksSiteLinkPool,
  sitemapSource?: OverviewSitemapSource,
  rowHtmlByIndex?: Record<number, string>,
): BuildBlogLinksCatalogResult {
  const catalog: BlogLinksCatalogRow[] = [];
  const skippedNoHtml: number[] = [];
  const skippedNoBinding: number[] = [];
  const skippedNoWork: number[] = [];

  rows.forEach((row, index) => {
    const trimmedUrl = row.url?.trim();
    if (!trimmedUrl) return;

    const snapshotHit = site ? lookupOverviewInventoryHitForUrl(site, trimmedUrl, sitemapSource) : undefined;
    const invMatch =
      snapshotHit != null
        ? {
            row: snapshotHit.row,
            subtype:
              snapshotHit.source === "pages"
                ? ("page" as const)
                : snapshotHit.source === "posts"
                  ? ("post" as const)
                  : snapshotHit.source,
          }
        : site
          ? getInventoryMatchForUrl(site, trimmedUrl)
          : undefined;

    const binding = resolveBinding(row, bindings, invMatch ?? null);
    if (!binding?.postId) {
      skippedNoBinding.push(index);
      return;
    }

    const inventoryHtml = snapshotHit?.row?.fields?.content?.trim() ?? "";
    const html =
      rowHtmlByIndex?.[index]?.trim() ||
      row.postContentOptimized?.trim() ||
      inventoryHtml ||
      row.postContent?.trim() ||
      "";
    if (!html) {
      skippedNoHtml.push(index);
      return;
    }

    const existingLinks = extractInternalLinksFromHtml(html, siteUrl, trimmedUrl);
    const budget = computeBlogLinksBudget(html);
    const hasTargets = linkPoolHasTargets(linkPool, siteUrl, trimmedUrl);
    const userLinkTargets = row.blogLinkList ?? [];
    const hasUserLinkWork =
      userLinkTargets.length > existingLinks.length ||
      userLinkTargets.some((t) => t.anchor.trim() || t.href.trim());

    if (!hasTargets || (budget.linksToAdd === 0 && !existingLinks.length && !hasUserLinkWork)) {
      skippedNoWork.push(index);
      return;
    }

    const invFields = snapshotHit?.row ? downloadFieldsFromInventoryRow(snapshotHit.row) : null;

    catalog.push({
      index,
      url: trimmedUrl,
      postId: binding.postId,
      title: (row.title || invFields?.title || "").trim(),
      focusKeyword: (row.focusKeyword || invFields?.focusKeyword || "").trim(),
      seoResearchBrief: (row.seoResearch ?? "").trim(),
      existingLinks,
      html,
      linkPool,
      wordCount: budget.wordCount,
      sectionHeadings: budget.sectionHeadings,
      linksToAdd: budget.linksToAdd,
      paragraphCount: findHtmlParagraphSpans(html).length,
      userLinkTargets,
    });
  });

  return { catalog, skippedNoHtml, skippedNoBinding, skippedNoWork };
}
