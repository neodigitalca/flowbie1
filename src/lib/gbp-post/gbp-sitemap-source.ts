import type { WordPressSite } from "@/components/integrations/types";
import {
  OVERVIEW_SITEMAP_SOURCE_LABELS,
  resolveOverviewSitemapUrls,
  type OverviewSitemapSource,
} from "@/lib/overview/overview-sitemap-source";

export function resolveGbpSitemapUrlsForSite(
  site: WordPressSite,
  source: OverviewSitemapSource,
): string[] {
  return resolveOverviewSitemapUrls(site, source);
}

export function gbpSitemapSourceEmptyMessage(
  siteName: string,
  source: OverviewSitemapSource,
): string {
  const label = OVERVIEW_SITEMAP_SOURCE_LABELS[source];
  return `No ${label} sitemap URLs for ${siteName}. Check Integrations.`;
}
