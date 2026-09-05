import type { WordPressSite } from "@/components/integrations/types";

/** ISO country from location label suffix (e.g. "Plum Coulee, MB" → CA). */
export function webSearchCountryIsoFromLocation(location: string): string | undefined {
  const t = location.trim();
  if (!t) return undefined;
  const upper = t.toUpperCase();
  if (/\b(CANADA|,\s*MB\b|,\s*ON\b|,\s*BC\b|,\s*AB\b|,\s*SK\b|,\s*QC\b|,\s*NL\b|,\s*NB\b|,\s*NS\b|,\s*PE\b|,\s*YT\b|,\s*NT\b|,\s*NU\b)/.test(upper)) {
    return "CA";
  }
  if (/\b(USA|,\s*US\b|,\s*[A-Z]{2}\b)/.test(upper) && !/\b(CANADA|,\s*MB\b)/.test(upper)) {
    return "US";
  }
  if (/\b(UK|,\s*ENGLAND\b|,\s*SCOTLAND\b|,\s*WALES\b)/.test(upper)) {
    return "GB";
  }
  if (/\bAUSTRALIA\b/.test(upper)) {
    return "AU";
  }
  return undefined;
}

/** City name for DFS web_search_city (first segment before comma). */
export function webSearchCityFromLocation(location: string): string | undefined {
  const t = location.trim();
  if (!t) return undefined;
  const city = t.split(",")[0]?.trim();
  return city || undefined;
}

export function cityStateFromNapAddress(address: string): string {
  const t = address.trim();
  if (!t) return "";
  const streetCityState = t.match(/,\s*([^,]+?),\s*([A-Z]{2})\b/i);
  if (streetCityState?.[1] && streetCityState[2]) {
    return `${streetCityState[1].trim()}, ${streetCityState[2].trim().toUpperCase()}`;
  }
  const cityState = t.match(/^([^,]+),\s*([A-Z]{2})\b/i);
  if (cityState?.[1] && cityState[2]) {
    return `${cityState[1].trim()}, ${cityState[2].trim().toUpperCase()}`;
  }
  return "";
}

export function resolveSiteLocationLabel(site?: WordPressSite | null, keyword?: string): string {
  const locs = site?.locations ?? site?.napInfo?.locations ?? [];
  const preferred = locs.find((l) => l.isDefault) ?? locs[0];
  if (preferred) {
    const city = preferred.city?.trim();
    const state = preferred.state?.trim();
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
  }

  const napAddress = site?.napInfo?.address?.trim() ?? "";
  if (napAddress) {
    const fromAddress = cityStateFromNapAddress(napAddress);
    if (fromAddress) return fromAddress;
  }

  const kw = keyword?.trim() ?? "";
  const nearMatch = kw.match(/\bnear\s+(.+)$/i);
  if (nearMatch?.[1]?.trim()) {
    return nearMatch[1].trim();
  }

  return "";
}

const GENERIC_SERVICE_TOKENS = new Set([
  "solar",
  "panel",
  "panels",
  "installation",
  "installer",
  "installers",
  "energy",
  "power",
  "electricity",
  "efficiency",
  "cost",
  "costs",
  "price",
  "prices",
  "grants",
  "rebates",
  "financing",
  "systems",
  "system",
  "residential",
  "commercial",
  "home",
  "homes",
]);

/** Prefer city embedded in geo-modified keywords (e.g. Westlock solar panels → Westlock, AB). */
export function resolveFanoutLocationForResearch(
  site: WordPressSite | null | undefined,
  keyword: string,
): string {
  const siteLabel = resolveSiteLocationLabel(site, keyword).trim();
  const province =
    siteLabel.includes(",") ? siteLabel.split(",").slice(1).join(",").trim() : siteLabel;

  const tokens = keyword.trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const lead: string[] = [];
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (GENERIC_SERVICE_TOKENS.has(lower)) break;
      lead.push(token);
    }
    const city = lead.join(" ").trim();
    if (city) {
      if (province && !city.toLowerCase().includes(province.toLowerCase().split(/\s+/)[0] ?? "")) {
        return `${city}, ${province}`;
      }
      return city;
    }
  }

  return siteLabel;
}
