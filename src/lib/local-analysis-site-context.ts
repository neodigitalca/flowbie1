import type { WordPressSite } from "@/components/integrations/types";
import { parseSitemap } from "@/lib/wordpress-api";

const MAX_URLS_IN_PROMPT = 180;

function sameOrigin(urlStr: string, siteOrigin: string): boolean {
  try {
    const u = new URL(urlStr);
    return `${u.protocol}//${u.host}` === siteOrigin;
  } catch {
    return false;
  }
}

/** Dedupe by pathname; cap length - same pool used for markdown bullets or local keyword parsing. */
export function collectSameOriginUrls(rawUrls: string[], siteOrigin: string, max = MAX_URLS_IN_PROMPT): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rawUrls) {
    const u = raw.trim();
    if (!u || !sameOrigin(u, siteOrigin)) continue;
    let pathKey: string;
    try {
      pathKey = new URL(u).pathname.toLowerCase();
    } catch {
      continue;
    }
    if (seen.has(pathKey)) continue;
    seen.add(pathKey);
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

function formatUrlBullets(urls: string[], siteOrigin: string): string {
  const lines: string[] = [];
  for (const raw of collectSameOriginUrls(urls, siteOrigin)) {
    let path: string;
    try {
      path = new URL(raw).pathname || raw;
    } catch {
      path = raw;
    }
    lines.push(`- ${path}`);
  }
  return lines.join("\n");
}

function siteOriginFromSite(site: WordPressSite): string {
  try {
    return new URL(site.siteUrl).origin;
  } catch {
    return "";
  }
}

/** Lower score = preferred for product/page/service URL lists (not location-only sitemaps). */
export function scoreSitemapUrlForOfferings(url: string): number {
  const s = url.toLowerCase();
  const looksLikeLocation =
    /location|entity|service-area|area-sitemap|geo|city-sitemap|local-sitemap/.test(s);
  const looksLikeContent =
    /post-sitemap|page-sitemap|product|shop|category|collection|woocommerce|service(?!-area)/.test(s);
  if (looksLikeContent && !looksLikeLocation) return 0;
  if (looksLikeLocation) return 2;
  return 1;
}

export function pickChildSitemapUrlForOfferings(childSitemaps: string[]): string | null {
  if (!childSitemaps?.length) return null;
  const sorted = [...childSitemaps].sort(
    (a, b) => scoreSitemapUrlForOfferings(a) - scoreSitemapUrlForOfferings(b)
  );
  return sorted[0] ?? null;
}

export function pickInitialSitemapUrlForMode(
  site: WordPressSite,
  mode: "entity" | "offerings"
): string | null {
  const main = site.sitemaps?.mainSitemapUrl?.trim();
  const entity = site.entitySitemapUrl?.trim();
  const children = (site.sitemaps?.childSitemaps ?? []).map((s) => s.trim()).filter(Boolean);

  if (mode === "entity") {
    return entity || main || children[0] || null;
  }

  if (main) return main;
  const bestChild = pickChildSitemapUrlForOfferings(children);
  if (bestChild) return bestChild;
  return entity || null;
}

/**
 * Same sitemap resolution as context strings, but returns raw URL strings for local parsing (no LLM).
 */
export async function listSiteUrlsForMode(
  site: WordPressSite,
  mode: "entity" | "offerings"
): Promise<string[] | null> {
  const siteOrigin = siteOriginFromSite(site);
  if (!siteOrigin) return null;

  const cached = site.sitemaps?.urls;
  if (cached?.length) {
    const list = collectSameOriginUrls(cached, siteOrigin);
    return list.length ? list : null;
  }

  const sitemapUrl = pickInitialSitemapUrlForMode(site, mode);
  if (!sitemapUrl) return null;

  try {
    async function urlsFromSitemapEntry(url: string): Promise<string[] | null> {
      const p = await parseSitemap(site.siteUrl, url, site.username, site.appPassword);
      if (p.error || !p.urls?.length) return null;
      let list = [...p.urls];
      if (p.type === "index" && p.childSitemaps?.length) {
        const childUrl =
          mode === "offerings"
            ? pickChildSitemapUrlForOfferings(p.childSitemaps) ?? p.childSitemaps[0]
            : p.childSitemaps[0];
        if (childUrl) {
          const child = await parseSitemap(site.siteUrl, childUrl, site.username, site.appPassword);
          if (!child.error && child.urls?.length) list = child.urls;
        }
      }
      return list;
    }

    let urls = await urlsFromSitemapEntry(sitemapUrl);
    if (!urls?.length && mode === "offerings" && site.entitySitemapUrl?.trim() && sitemapUrl !== site.entitySitemapUrl.trim()) {
      urls = await urlsFromSitemapEntry(site.entitySitemapUrl.trim());
    }
    if (!urls?.length) return null;

    const list = collectSameOriginUrls(urls, siteOrigin);
    return list.length ? list : null;
  } catch {
    return null;
  }
}

export async function listSiteUrlsForKeywordSuggest(site: WordPressSite): Promise<string[] | null> {
  return listSiteUrlsForMode(site, "offerings");
}

async function buildSiteUrlContextForMode(
  site: WordPressSite,
  mode: "entity" | "offerings"
): Promise<string | null> {
  const siteOrigin = siteOriginFromSite(site);
  if (!siteOrigin) return null;

  const urls = await listSiteUrlsForMode(site, mode);
  if (!urls?.length) return null;

  const text = formatUrlBullets(urls, siteOrigin);
  return text.length > 0 ? text : null;
}

export async function buildSiteUrlContextForLocalAnalysis(site: WordPressSite): Promise<string | null> {
  return buildSiteUrlContextForMode(site, "entity");
}
