import type { CompetitorResearchSemrushResponse, SemrushCompetitorRow } from "@/lib/competitor-research/types";
import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";

/**
 * Root domains that share keyword overlap with almost any site but are not "main"
 * business competitors (social, UGC, search, encyclopedia, mega-marketplaces).
 * Matched with suffix rules so subdomains (e.g. m.youtube.com) are excluded too.
 */
const NON_MAIN_COMPETITOR_ROOTS = [
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "fb.com",
  "instagram.com",
  "reddit.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "pinterest.com",
  "tiktok.com",
  "snapchat.com",
  "whatsapp.com",
  "discord.com",
  "telegram.org",
  "tumblr.com",
  "medium.com",
  "quora.com",
  "wikipedia.org",
  "wikimedia.org",
  "amazon.com",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.ca",
  "amazon.com.au",
  "amazon.in",
  "amazon.es",
  "amazon.it",
  "amazon.co.jp",
  "ebay.com",
  "ebay.co.uk",
  "ebay.de",
  "etsy.com",
  "google.com",
  "google.co.uk",
  "google.de",
  "google.ca",
  "google.com.au",
  "google.fr",
  "bing.com",
  "yahoo.com",
  "duckduckgo.com",
  "baidu.com",
  "yandex.com",
  "yandex.ru",
  "tripadvisor.com",
  "yelp.com",
  "bbc.com",
  "cnn.com",
  "imdb.com",
  "netflix.com",
  "spotify.com",
  "microsoft.com",
  "apple.com",
  "craigslist.org",
  "slideshare.net",
  "scribd.com",
  "fandom.com",
  "stackexchange.com",
  "stackoverflow.com",
  "github.com",
  "gitlab.com",
  "twitch.tv",
  "vimeo.com",
  "dailymotion.com",
];

/**
 * True if the hostname is a known mega-platform / non-main competitor for overlap analysis.
 */
export function isNonMainCompetitorDomain(domain: string): boolean {
  const host = normalizeCompetitorDomainKey(domain);
  if (!host) return true;
  for (const root of NON_MAIN_COMPETITOR_ROOTS) {
    if (host === root || host.endsWith(`.${root}`)) return true;
  }
  return false;
}

function filterRows(rows: SemrushCompetitorRow[]): SemrushCompetitorRow[] {
  return rows.filter((r) => !isNonMainCompetitorDomain(r.domain));
}

/**
 * Drops mega-platform rows and enrichment entries that do not correspond to main competitors.
 * Seed metrics / seed overview / seed top keywords are unchanged.
 */
export function filterMainCompetitorResearchResponse(
  input: CompetitorResearchSemrushResponse,
): CompetitorResearchSemrushResponse {
  const rows = filterRows(input.rows);
  const kept = new Set(rows.map((r) => normalizeCompetitorDomainKey(r.domain)));
  const enrichmentByDomain = (() => {
    const e = input.enrichmentByDomain;
    if (!e || Object.keys(e).length === 0) return e;
    const next: typeof e = {};
    for (const [k, v] of Object.entries(e)) {
      if (kept.has(normalizeCompetitorDomainKey(k))) {
        next[k] = v;
      }
    }
    return next;
  })();

  const domainOrganicCsvByDomain = (() => {
    const c = input.domainOrganicCsvByDomain;
    if (!c || Object.keys(c).length === 0) return c;
    const next: typeof c = {};
    for (const [k, v] of Object.entries(c)) {
      if (kept.has(normalizeCompetitorDomainKey(k))) {
        next[k] = v;
      }
    }
    return next;
  })();

  return {
    ...input,
    rows,
    enrichmentByDomain,
    domainOrganicCsvByDomain,
  };
}
