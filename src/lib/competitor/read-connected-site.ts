import { parseSitemap } from "@/lib/wordpress-api/connection";
import { analyzeWordPressPages } from "@/lib/wp-page-analyzer";
import type { WordPressSite } from "@/components/integrations/types";
import type { ConnectedSiteProfile } from "@/lib/competitor/types";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";

function servicesFromH2Patterns(h2Patterns: string[]): string[] {
  return h2Patterns
    .map((h) => h.trim())
    .filter((h) => h.length > 2 && h.length < 120)
    .slice(0, 20);
}

export async function readConnectedSiteProfile(
  site: WordPressSite,
  onProgress?: (message: string) => void,
): Promise<ConnectedSiteProfile> {
  const siteUrl = getPublicSiteUrl(site) || site.siteUrl?.trim() || "";
  const siteName = site.name?.trim() || siteUrl;
  onProgress?.("Reading connected site sitemap and meta…");

  const mainSitemap =
    site.sitemaps?.mainSitemapUrl?.trim() ||
    site.sitemaps?.postSitemapUrl?.trim() ||
    `${siteUrl.replace(/\/$/, "")}/sitemap_index.xml`;

  let samplePages: ConnectedSiteProfile["samplePages"] = [];
  let services: string[] = [];
  let metaPatterns: string[] = [];

  if (mainSitemap && site.username && site.appPassword) {
    try {
      const analysis = await analyzeWordPressPages(site, mainSitemap, "post", 12, onProgress);
      services = servicesFromH2Patterns(analysis.contentStyle.h2Patterns);
      if (analysis.metaDescriptionPattern) {
        metaPatterns.push(analysis.metaDescriptionPattern);
      }
      samplePages = analysis.examples.map((ex) => ({
        title: ex.title,
        url: ex.url,
        metaDescription: ex.metaDescription,
      }));
    } catch {
      /* fall through */
    }
  }

  if (samplePages.length === 0 && site.entitySitemapUrl?.trim() && site.username && site.appPassword) {
    try {
      const parseResult = await parseSitemap(
        site.siteUrl,
        site.entitySitemapUrl,
        site.username,
        site.appPassword,
      );
      samplePages = (parseResult.urls ?? []).slice(0, 8).map((url) => ({
        title: url.split("/").filter(Boolean).pop() ?? url,
        url,
      }));
    } catch {
      /* ignore */
    }
  }

  return {
    siteName,
    siteUrl,
    services,
    metaPatterns,
    samplePages,
  };
}
