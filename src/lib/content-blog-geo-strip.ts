/**
 * Strips common geographic tokens from keyword phrases when building **national content-blog**
 * titles - not service-area / city landing pages. Heuristic word list (not brand-specific).
 */
const GEO_TOKENS_FOR_CONTENT_STRIP = new Set(
  [
    "regina", "saskatoon", "calgary", "edmonton", "reddeer", "lethbridge", "medicinehat",
    "vancouver", "victoria", "surrey", "burnaby", "kelowna", "kamloops", "nanaimo",
    "winnipeg", "brandon",
    "toronto", "ottawa", "mississauga", "hamilton", "london", "kitchener", "windsor", "oakville", "brampton",
    "montreal", "quebec", "laval", "gatineau",
    "halifax", "dartmouth", "moncton", "fredericton", "charlottetown", "stjohns",
    "alberta", "saskatchewan", "manitoba", "ontario", "quebec", "british", "columbia", "novascotia", "newbrunswick",
    "princeedward", "newfoundland", "labrador", "nunavut", "northwest", "yukon",
    "canada", "canadian", "usa", "american",
    "texas", "california", "florida", "colorado", "arizona", "washington", "oregon", "ohio", "michigan", "illinois",
    "newyork", "pennsylvania", "georgia", "northcarolina", "southcarolina", "tennessee", "alabama", "louisiana",
  ].map((s) => s.toLowerCase()),
);

function normalizeWordToken(w: string): string {
  return w.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function stripGeoWordTokens(phrase: string): string[] {
  const raw = phrase.trim();
  if (!raw) return [];
  const parts = raw.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const w of parts) {
    const t = normalizeWordToken(w);
    if (t.length >= 2 && GEO_TOKENS_FOR_CONTENT_STRIP.has(t)) continue;
    kept.push(w);
  }
  return kept;
}

/**
 * Removes geographic tokens from a phrase so titles stay **content-blog** style (no city/province in title).
 * If nothing remains, returns the original phrase.
 */
export function stripGeoTokensForContentBlogPhrase(phrase: string): string {
  const raw = phrase.trim();
  if (!raw) return raw;
  const kept = stripGeoWordTokens(raw);
  const out = kept.join(" ").trim();
  return out.length > 0 ? out : raw;
}

/**
 * Same as stripping for titles, but **never** falls back to geographic text - for Keyword CSV fields.
 */
export function stripGeoTokensForKeywordField(phrase: string): string {
  return stripGeoWordTokens(phrase.trim()).join(" ").trim();
}

const MAX_SHORT_TAIL_WORDS = 3;

/**
 * Short-tail keyword: no geo tokens, max **maxWords** (default 3), lowercased.
 * Returns **""** only when the phrase has no non-geo words (caller may substitute a fallback).
 */
export function clampShortTailKeyword(phrase: string, maxWords = MAX_SHORT_TAIL_WORDS): string {
  const stripped = stripGeoTokensForKeywordField(phrase);
  if (!stripped.length) return "";
  return stripped
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ")
    .toLowerCase();
}

/**
 * Short-tail keyword for CSV rows: geo-stripped, max 3 words; if nothing remains, first non-geo word or `"topic"`.
 */
export function shortTailKeywordOrFallback(phrase: string, maxWords = MAX_SHORT_TAIL_WORDS): string {
  const k = clampShortTailKeyword(phrase, maxWords);
  if (k.length) return k;
  for (const w of phrase.trim().split(/\s+/)) {
    const t = normalizeWordToken(w);
    if (t.length >= 2 && !GEO_TOKENS_FOR_CONTENT_STRIP.has(t)) return t.toLowerCase();
  }
  return "topic";
}
