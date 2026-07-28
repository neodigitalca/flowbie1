import type { WordPressSite } from "@/components/integrations/types";

/** Child sitemap URLs the user excluded for this property (Sitemaps tab menu). */
export function getExcludedChildSitemapUrls(
  site: Pick<WordPressSite, "sitemaps"> | null | undefined,
): string[] {
  return site?.sitemaps?.disabledChildSitemapUrls ?? [];
}

export function isChildSitemapExcludedFromProperty(
  site: Pick<WordPressSite, "sitemaps"> | null | undefined,
  childUrl: string,
): boolean {
  const url = childUrl.trim();
  if (!url) return false;
  return getExcludedChildSitemapUrls(site).includes(url);
}

/** Active child sitemaps for bulk/scrape picks (excludes per-property exclusions). */
export function activeChildSitemapUrls(
  site: Pick<WordPressSite, "sitemaps"> | null | undefined,
): string[] {
  const children = site?.sitemaps?.childSitemaps ?? [];
  const excluded = new Set(getExcludedChildSitemapUrls(site));
  return children.filter((u) => !excluded.has(u));
}
