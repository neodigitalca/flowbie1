import type { WordPressSite } from "@/components/integrations/types";
import {
  OVERVIEW_SITEMAP_SOURCE_LABELS,
  pickPageSitemapUrlForSite,
  postChildSitemapUrlForProperty,
  type OverviewSitemapSource,
} from "@/lib/overview/overview-sitemap-source";

/** One child sitemap URL for the selected GBP source (no index, no multi-child list). */
export function resolveGbpSitemapUrlForSite(
  site: WordPressSite,
  source: OverviewSitemapSource,
): string | null {
  const base = site.siteUrl?.trim().replace(/\/+$/, "") ?? "";
  if (source === "posts") {
    return (
      postChildSitemapUrlForProperty(site)?.trim() ||
      (base ? `${base}/post-sitemap.xml` : null)
    );
  }
  if (source === "sap") {
    return site.entitySitemapUrl?.trim() || null;
  }
  return (
    pickPageSitemapUrlForSite(site)?.trim() ||
    (base ? `${base}/page-sitemap.xml` : null)
  );
}

export function gbpSitemapSourceEmptyMessage(
  siteName: string,
  source: OverviewSitemapSource,
): string {
  const label = OVERVIEW_SITEMAP_SOURCE_LABELS[source];
  return `Configure ${label} sitemap in Integrations for ${siteName}.`;
}
