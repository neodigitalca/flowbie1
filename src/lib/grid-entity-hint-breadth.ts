/**
 * Reject US state / Canadian province-only labels for grid-bound local SEO entity hints
 * (not "City, ST" service areas).
 */

const US_STATE_NAMES_LOWER = new Set(
  [
    "alabama",
    "alaska",
    "arizona",
    "arkansas",
    "california",
    "colorado",
    "connecticut",
    "delaware",
    "district of columbia",
    "florida",
    "georgia",
    "hawaii",
    "idaho",
    "illinois",
    "indiana",
    "iowa",
    "kansas",
    "kentucky",
    "louisiana",
    "maine",
    "maryland",
    "massachusetts",
    "michigan",
    "minnesota",
    "mississippi",
    "missouri",
    "montana",
    "nebraska",
    "nevada",
    "new hampshire",
    "new jersey",
    "new mexico",
    "new york",
    "north carolina",
    "north dakota",
    "ohio",
    "oklahoma",
    "oregon",
    "pennsylvania",
    "rhode island",
    "south carolina",
    "south dakota",
    "tennessee",
    "texas",
    "utah",
    "vermont",
    "virginia",
    "washington",
    "west virginia",
    "wisconsin",
    "wyoming",
  ].map((s) => s.toLowerCase())
);

/** Canadian provinces and territories (full name, normalized spaces). */
const CA_PROVINCE_TERRITORY_LOWER = new Set(
  [
    "alberta",
    "british columbia",
    "manitoba",
    "new brunswick",
    "newfoundland and labrador",
    "northwest territories",
    "nova scotia",
    "nunavut",
    "ontario",
    "prince edward island",
    "quebec",
    "saskatchewan",
    "yukon",
  ].map((s) => s.toLowerCase())
);

const US_STATE_CODE_LOWER = new Set([
  "al",
  "ak",
  "az",
  "ar",
  "ca",
  "co",
  "ct",
  "de",
  "dc",
  "fl",
  "ga",
  "hi",
  "id",
  "il",
  "in",
  "ia",
  "ks",
  "ky",
  "la",
  "me",
  "md",
  "ma",
  "mi",
  "mn",
  "ms",
  "mo",
  "mt",
  "ne",
  "nv",
  "nh",
  "nj",
  "nm",
  "ny",
  "nc",
  "nd",
  "oh",
  "ok",
  "or",
  "pa",
  "ri",
  "sc",
  "sd",
  "tn",
  "tx",
  "ut",
  "vt",
  "va",
  "wa",
  "wv",
  "wi",
  "wy",
]);

/** Canadian province/territory codes as returned in GBP/DataForSEO `region`. */
const CA_PROVINCE_CODE_UPPER = new Set([
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
]);

/**
 * DataForSEO `location_name` last segment (country name only) from a `region` value when ISO country is unknown.
 * Example: "Alberta" → Canada; "TX" → United States. Two-letter codes: CA provinces before US state list.
 */
export function dataForSeoCountryNameFromRegion(region: string): string | null {
  const r = region.trim();
  if (!r) return null;
  const upper = r.toUpperCase();
  if (upper.length === 2 && /^[A-Za-z]{2}$/.test(r)) {
    if (CA_PROVINCE_CODE_UPPER.has(upper)) return "Canada";
    if (US_STATE_CODE_LOWER.has(upper.toLowerCase())) return "United States";
    return null;
  }
  const l = r.toLowerCase().replace(/\s+/g, " ").trim();
  if (CA_PROVINCE_TERRITORY_LOWER.has(l)) return "Canada";
  if (US_STATE_NAMES_LOWER.has(l)) return "United States";
  return null;
}

/**
 * True when the hint is only a US state, US state code, or Canadian province/territory name
 * (too broad for grid-bound entity columns). "City, ST" and sub-metro labels are not rejected here.
 */
export function isOverlyBroadGridEntityHint(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  const l = t.toLowerCase().replace(/\s+/g, " ").trim();
  if (US_STATE_NAMES_LOWER.has(l)) return true;
  if (CA_PROVINCE_TERRITORY_LOWER.has(l)) return true;
  if (l.length === 2 && /^[a-z]{2}$/i.test(l) && US_STATE_CODE_LOWER.has(l)) return true;
  return false;
}

/**
 * Wikipedia titles often use "City, State" or "Name (disambiguation)". For umbrella checks,
 * use the substring before the first comma, then strip a trailing "(...)" disambiguator.
 */
export function wikipediaTitleCoreForBreadthCheck(raw: string): string {
  const head = raw.split(",")[0]!.trim();
  return head.replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

/** True when the title names only a US state/DC or Canadian province/territory (not "City, ST"). */
export function isStateOrProvinceOnlyWikipediaTitle(raw: string): boolean {
  const t = raw.trim();
  if (/\([^)]*country[^)]*\)/i.test(t)) return false;
  if (/\bWashington\s*,\s*D\.?\s*C\.?\b/i.test(t)) return false;
  if (/\bDistrict\s+of\s+Columbia\b/i.test(t)) return false;
  const core = wikipediaTitleCoreForBreadthCheck(raw);
  return core.length > 0 && isOverlyBroadGridEntityHint(core);
}
