/**
 * Single primary service location label for a connected WordPress site (NAP / locations).
 */

import type { Location, WordPressSite } from '@/components/integrations/types';
import { fetchLocationDiscovery } from '@/lib/fetch-location-discovery';

function pickLocation(locations: Location[] | undefined): Location | null {
  if (!locations?.length) return null;
  const def = locations.find((l) => l.isDefault);
  return def ?? locations[0] ?? null;
}

/** Prefer full street + city/state/zip for “distance from” - not the business or site name alone. */
function formatLocationLine(loc: Location): string | null {
  const street = loc.address?.trim();
  const city = loc.city?.trim();
  const state = loc.state?.trim();
  const zip = loc.zip?.trim();
  const cityState = [city, state].filter(Boolean).join(', ').trim();
  const tail = [cityState, zip].filter(Boolean).join(' ').trim();

  if (street && tail) return `${street}, ${tail}`;
  if (street) return street;
  if (tail) return tail;
  if (cityState) return cityState;
  return null;
}

/** One line: street address when available, else city/state - never the WordPress site title. */
export function getPrimaryLocationLabel(site: WordPressSite): string | null {
  const fromSite = site.locations?.length ? pickLocation(site.locations) : null;
  const fromNap = site.napInfo?.locations?.length ? pickLocation(site.napInfo.locations) : null;
  const loc = fromSite ?? fromNap;
  if (loc) {
    const formatted = formatLocationLine(loc);
    if (formatted) return formatted;
  }
  const addr = site.napInfo?.address?.trim();
  if (addr) return addr;
  return null;
}

/** City + state (or city) from Integrations / NAP - for SAP market hints when no manual override. */
export function getPrimaryCityStateLabel(site: WordPressSite): string | undefined {
  const fromSite = site.locations?.length ? pickLocation(site.locations) : null;
  const fromNap = site.napInfo?.locations?.length ? pickLocation(site.napInfo.locations) : null;
  const loc = fromSite ?? fromNap;
  if (!loc) return undefined;
  const city = loc.city?.trim();
  const state = loc.state?.trim();
  if (city && state) return `${city}, ${state}`;
  return city || state || undefined;
}

/**
 * Primary label for radius / “distance from”: **LocalBusiness JSON-LD on the live homepage first**,
 * then saved NAP / locations in Flowbie.
 */
export async function resolvePrimaryLocationLabel(site: WordPressSite): Promise<string | null> {
  const disc = await fetchLocationDiscovery(site.siteUrl, {
    entitySitemapUrl: site.entitySitemapUrl?.trim() || undefined,
  });
  if (disc.primarySuggestion) return disc.primarySuggestion;
  if (disc.primaryAreaLabel) return disc.primaryAreaLabel;
  return getPrimaryLocationLabel(site);
}
