/**
 * When the hint is "Place, City, Province" and the first segment is not the city name,
 * we must not resolve to the city-wide Wikipedia article alone.
 */
const REGION_CODE_ONLY =
  /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$/i;

export interface SubCityEntityContext {
  /** First comma segment: neighborhood, corridor, park, etc. */
  placeHead: string;
  /** Metro / city name (first word of second segment). */
  cityWord: string;
}

export function getSubCityEntityContext(entityHint: string): SubCityEntityContext | null {
  const parts = entityHint.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const p1 = parts[1]!;
  if (REGION_CODE_ONLY.test(p1) || p1.length <= 2) return null;
  const placeHead = parts[0]!;
  const cityWord = p1.split(/\s+/)[0]!;
  if (!placeHead || !cityWord) return null;
  if (placeHead.toLowerCase() === cityWord.toLowerCase()) return null;
  return { placeHead, cityWord };
}

/** True when the title is only the city / region umbrella, not a sub-city place page. */
export function isCityUmbrellaTitle(title: string, cityWord: string): boolean {
  const t = title.trim().toLowerCase();
  const c = cityWord.trim().toLowerCase();
  if (t === c) return true;
  if (t === `city of ${c}`) return true;
  if (t === `${c}, alberta`) return true;
  if (t === `${c}, alberta, canada`) return true;
  if (t === `${c}, canada`) return true;
  if (t === "alberta" || t === "alberta, canada") return true;
  return false;
}

export function filterOutCityUmbrellaTitles(
  titles: string[],
  ctx: SubCityEntityContext | null
): string[] {
  if (!ctx) return titles;
  return titles.filter((t) => !isCityUmbrellaTitle(t, ctx.cityWord));
}

/** When the pool lists both a metro city article and finer place articles, callers may drop the umbrella. */
export function dropCityUmbrellaTitlesWhenFinerExist(titles: string[], cityWord: string): string[] {
  const cw = cityWord.trim();
  if (!cw) return titles;
  const finer = titles.filter((t) => !isCityUmbrellaTitle(t.trim(), cw));
  return finer.length > 0 ? finer : titles;
}

/** Broad list/index pages - wrong target when the hint names one real street, park, or district. */
export function isListOrBroadIndexTitle(title: string): boolean {
  const t = title.trim();
  if (/^List of\b/i.test(t)) return true;
  if (/^Timeline of\b/i.test(t)) return true;
  if (/^Index of\b/i.test(t)) return true;
  if (/^Outline of\b/i.test(t)) return true;
  return false;
}

/** Drop non-geography titles (always) plus city umbrella + list/index pages when `ctx` is set. */
export function filterWikiTitlesForPlaceHint(
  titles: string[],
  ctx: SubCityEntityContext | null
): string[] {
  return titles.filter((t) => isPlaceTitleForHint(t, ctx));
}

/**
 * Heuristic filter for titles that are almost never valid **geographic** service-area entities
 * (sports franchises, newspapers, generic orgs). OpenRouter filters handle the long tail; this
 * catches obvious cases when `ctx` is null (city-only hints) and blocks unsafe `list[0]` picks.
 */
export function isLikelyNonGeographicOrgTitle(title: string): boolean {
  const t = title.replace(/_/g, " ").trim();
  const lower = t.toLowerCase();
  // Newspapers / media brands (not streets named "Herald", etc. - title-shaped articles)
  if (/\b(newspaper|magazine)\b/i.test(lower) && !/\b(avenue|street|road|lane|drive|boulevard)\b/i.test(lower)) {
    return true;
  }
  if (/\bfree press\b/i.test(lower)) return true;
  // Pro / major sports franchises (article titles like "Winnipeg Jets", "New York Jets")
  if (/\b(blue bombers|roughriders|stampeders|argonauts|alouettes|eskimos|elks|redblacks)\b/i.test(lower)) {
    return true;
  }
  if (/\bjets\b/i.test(lower) && !/\b(airport|aviation|water|ski)\b/i.test(lower)) {
    if (/\b(hockey|football|basketball|baseball|soccer|nhl|nfl|cf[lf]|nba|mlb|mls)\b/i.test(lower)) return true;
    if (/\bJets\s*$/i.test(t) || /^[\w\s',.-]+\s+Jets$/i.test(t)) return true;
  }
  return false;
}

export function isPlaceTitleForHint(title: string, ctx: SubCityEntityContext | null): boolean {
  if (isLikelyNonGeographicOrgTitle(title)) return false;
  if (!ctx) return true;
  return !isCityUmbrellaTitle(title, ctx.cityWord) && !isListOrBroadIndexTitle(title);
}

/**
 * Numbered avenue/street hints (e.g. "17 Ave retail corridor") need queries that match
 * articles like "17 Avenue SE (Calgary)", not "List of shopping streets…".
 */
export function streetNumberSearchQueries(placeHead: string, cityWord: string): string[] {
  const city = cityWord.trim();
  if (!city) return [];
  const m = placeHead.trim().match(/^(\d+)\s*(?:Ave|Avenue)\b(?:\s+(SE|SW|NE|NW))?/i);
  if (!m) return [];
  const n = m[1]!;
  const quad = m[2]?.toUpperCase() ?? "";
  const out: string[] = [];
  if (quad) {
    out.push(`${n} Avenue ${quad} (${city})`);
    out.push(`${n} Avenue ${quad} ${city}`);
  } else {
    out.push(`${n} Avenue ${city}`);
    out.push(`${n} Ave ${city}`);
    for (const q of ["SE", "SW", "NE", "NW"]) {
      out.push(`${n} Avenue ${q} (${city})`);
    }
  }
  return [...new Set(out)];
}
