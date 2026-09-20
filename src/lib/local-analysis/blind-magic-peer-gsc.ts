import type { WordPressSite } from "@/components/integrations/types";
import {
  brandExclusionPhrasesFromNames,
  ENTITY_SITE_WARM_GSC_ROW_LIMIT,
  fetchEntityGscKeywordBundle,
  gscQueryContainsBrandPhrase,
} from "@/lib/bulk/bulk-gsc-site-queries";
import type { GscCompetitorDateRange, GscSiteQueryRow } from "@/lib/competitor-research/types";

function siteTextBlob(site: Pick<WordPressSite, "name" | "siteUrl" | "industryVertical">): string {
  return [site.name, site.siteUrl, site.industryVertical].filter(Boolean).join(" ").toLowerCase();
}

export function isBlindMagicSite(site: Pick<WordPressSite, "name" | "siteUrl">): boolean {
  const name = (site.name ?? "").toLowerCase();
  const host = (site.siteUrl ?? "").toLowerCase();
  return name.includes("blind magic") || host.includes("blindmagic");
}

export function isBlindsCompanySite(
  site: Pick<WordPressSite, "name" | "siteUrl" | "industryVertical">,
): boolean {
  return siteTextBlob(site).includes("blind");
}

export function findBlindMagicPeerSite(
  sites: readonly WordPressSite[],
  currentSiteId: string,
): WordPressSite | null {
  const current = currentSiteId.trim();
  for (const site of sites) {
    if (!site.siteUrl?.trim()) continue;
    if (current && site.id === current) continue;
    if (!isBlindMagicSite(site)) continue;
    return site;
  }
  return null;
}

export function canUseBlindMagicKeywordOption(
  sites: readonly WordPressSite[],
  currentSite: Pick<WordPressSite, "id" | "name" | "siteUrl" | "industryVertical">,
): boolean {
  if (isBlindMagicSite(currentSite)) return false;
  if (!isBlindsCompanySite(currentSite)) return false;
  return Boolean(findBlindMagicPeerSite(sites, currentSite.id));
}

export function stripPeerBrandFromGscQueries(
  queries: readonly GscSiteQueryRow[],
  peerName: string,
): GscSiteQueryRow[] {
  const phrases = brandExclusionPhrasesFromNames(peerName);
  return queries.filter((row) => !gscQueryContainsBrandPhrase(row.query ?? "", phrases));
}

export async function loadBlindMagicPeerGscQueries(peer: WordPressSite): Promise<{
  queries: GscSiteQueryRow[];
  dateRange: GscCompetitorDateRange;
}> {
  const bundle = await fetchEntityGscKeywordBundle(peer, ENTITY_SITE_WARM_GSC_ROW_LIMIT);
  const queries = stripPeerBrandFromGscQueries(bundle.queries, peer.name);
  if (queries.length === 0) {
    throw new Error("Blind Magic GSC returned no usable keywords.");
  }
  return { queries, dateRange: bundle.dateRange };
}
