import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import type { WordPressSite } from "@/components/integrations/types";
import { downloadFieldsFromInventoryRow } from "@/lib/overview/overview-inventory-seo-fields";
import {
  lookupOverviewInventoryHitForUrl,
} from "@/hooks/content-optimization/bulk-seo-extra-text-fast-path";
import {
  overviewBindingForRow,
  resolveOverviewBindingForRow,
} from "@/lib/overview/overview-bulk-seo-payload";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import { extractH2TextsFromHtml, htmlMissingLeadingH2 } from "@/lib/overview/overview-blog-headers-extract";
import type { BlogHeadersGscPicks } from "@/lib/overview/overview-blog-headers-gsc";

export type BlogHeadersCatalogRow = {
  index: number;
  url: string;
  postId: number;
  title: string;
  focusKeyword: string;
  seoResearchBrief: string;
  existingH2s: string[];
  html: string;
  sectionLabels: string[];
  missingLeadingH2: boolean;
  gscPicks?: BlogHeadersGscPicks;
};

export type BuildBlogHeadersCatalogResult = {
  catalog: BlogHeadersCatalogRow[];
  skippedNoHtml: number[];
  skippedNoBinding: number[];
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

export function buildBlogHeadersCatalog(
  rows: OverviewRow[],
  bindings: Record<string, OverviewBinding | undefined>,
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined,
  site: WordPressSite | null,
  sitemapSource?: OverviewSitemapSource,
): BuildBlogHeadersCatalogResult {
  const catalog: BlogHeadersCatalogRow[] = [];
  const skippedNoHtml: number[] = [];
  const skippedNoBinding: number[] = [];

  rows.forEach((row, index) => {
    const trimmedUrl = row.url?.trim();
    if (!trimmedUrl) return;

    const snapshotHit = site ? lookupOverviewInventoryHitForUrl(site, trimmedUrl, sitemapSource) : undefined;
    const invMatch =
      snapshotHit != null
        ? { row: snapshotHit.row, subtype: snapshotHit.source === "pages" ? "page" as const : snapshotHit.source === "posts" ? "post" as const : snapshotHit.source }
        : site
          ? getInventoryMatchForUrl(site, trimmedUrl)
          : undefined;

    const binding = resolveBinding(row, bindings, invMatch ?? null);
    if (!binding?.postId) {
      skippedNoBinding.push(index);
      return;
    }

    const inventoryHtml = snapshotHit?.row?.fields?.content?.trim() ?? "";
    const html = inventoryHtml || row.postContent?.trim() || "";
    if (!html) {
      skippedNoHtml.push(index);
      return;
    }

    const invFields = snapshotHit?.row ? downloadFieldsFromInventoryRow(snapshotHit.row) : null;
    const existingH2s = extractH2TextsFromHtml(html);
    const sectionLabels = existingH2s.length > 0 ? existingH2s : [];

    catalog.push({
      index,
      url: trimmedUrl,
      postId: binding.postId,
      title: (row.title || invFields?.title || "").trim(),
      focusKeyword: (row.focusKeyword || invFields?.focusKeyword || "").trim(),
      seoResearchBrief: (row.seoResearch ?? "").trim(),
      existingH2s,
      html,
      sectionLabels,
      missingLeadingH2: htmlMissingLeadingH2(html),
    });
  });

  return { catalog, skippedNoHtml, skippedNoBinding };
}
