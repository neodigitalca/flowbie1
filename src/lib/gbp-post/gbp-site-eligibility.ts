import type { WordPressSite } from "@/components/integrations/types";

/** Multi-property batch: any property with a GBP Location ID in site settings. */
export function hasGbpLocationLink(site: WordPressSite): boolean {
  return Boolean(site.gbpLocationId?.trim());
}

export function sortGbpPostSitesByName(sites: WordPressSite[]): WordPressSite[] {
  return [...sites].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function filterSitesWithGbpLocation(sites: WordPressSite[]): WordPressSite[] {
  return sortGbpPostSitesByName(sites.filter(hasGbpLocationLink));
}

/** Current-property Post to GBP (needs WP REST + GBP location). */
export function isGbpPostSiteEligible(site: WordPressSite): boolean {
  if (site.enabled === false) return false;
  if (!hasGbpLocationLink(site)) return false;
  if (!site.username?.trim() || !site.appPassword?.trim()) return false;
  return true;
}

/** @deprecated Use filterSitesWithGbpLocation for multi-property batch. */
export function filterGbpPostEligibleSites(sites: WordPressSite[]): WordPressSite[] {
  return filterSitesWithGbpLocation(sites);
}
