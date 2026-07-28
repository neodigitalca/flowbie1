import {
  LOCAL_ANALYSIS_SAP_MAX,
  LOCAL_ANALYSIS_SAP_MIN,
  LOCAL_ANALYSIS_TOTAL_SAP_CAP,
} from "@/lib/local-analysis-target-constants";
import { repairSapPageAllocation, type SuggestedKeywordTarget } from "@/lib/local-analysis-suggest-keyword-targets";

const MAX_CANDIDATE_KEYWORDS = 50;
const MAX_RAW_PHRASES = 120;

const STOP_SEGMENTS = new Set(
  [
    "page",
    "p",
    "tag",
    "category",
    "author",
    "feed",
    "search",
    "archive",
    "shop",
    "cart",
    "checkout",
    "my-account",
    "account",
    "login",
    "register",
    "wp",
    "wp-admin",
    "wp-content",
    "wp-json",
    "oembed",
    "embed",
    "reply",
    "trackback",
    "privacy-policy",
    "terms",
    "contact",
    "about",
    "home",
    "sample-page",
    "service-area",
    "service-areas",
    "servicearea",
    "service",
    "services",
    "locations",
    "location",
    "areas",
    "our-locations",
    "local-pages",
    "entity",
    "sitemap",
  ].map((s) => s.toLowerCase())
);

/** Full phrases we never suggest (structural / generic). */
const BLOCK_PHRASES = new Set(
  [
    "service area",
    "service areas",
    "service area page",
    "areas",
    "locations",
    "location",
    "local service",
    "our locations",
    "find a location",
    "dealer",
    "dealers",
  ].map((s) => s.toLowerCase())
);

const PRODUCT_WORDS =
  /\b(blinds|shades|shutters|drapery|draperies|sheers|roman|cellular|roller|woven|wood|motorized|treatments?|windows?)\b/i;

function humanizeSegment(seg: string): string {
  let s = seg;
  try {
    s = decodeURIComponent(seg);
  } catch {
    /* keep */
  }
  s = s.replace(/\.(html?|php|aspx)$/i, "");
  return s.replace(/-/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function isJunkPhrase(phrase: string): boolean {
  const t = phrase.trim().toLowerCase();
  if (t.length < 3) return true;
  if (BLOCK_PHRASES.has(t)) return true;
  if (/\bservice area\b/.test(t)) return true;
  if (/^dealer(\s|$)/.test(t)) return true;
  if (/(\s|^)dealer$/.test(t)) return true;
  return false;
}

/** Prefer product / brand language; penalize bare location + dealer residue. */
function productScore(phrase: string): number {
  let s = 0;
  if (PRODUCT_WORDS.test(phrase)) s += 6;
  if (/\b(hunter|douglas|luxaflex)\b/i.test(phrase)) s += 3;
  if (/\b(installation|repair|custom|design)\b/i.test(phrase)) s += 2;
  if (/\bdealer\b/i.test(phrase)) s -= 4;
  if (/\b(arizona|az|phoenix|mesa|scottsdale)\b/i.test(phrase)) s -= 1;
  const words = phrase.split(/\s+/).length;
  if (words >= 2 && words <= 5 && PRODUCT_WORDS.test(phrase)) s += 2;
  return s;
}

/**
 * `hunter-douglas-dealer-phoenix` → brand slug `hunter-douglas` (drop location tail).
 */
function phrasesFromSlugSegment(base: string): string[] {
  const low = base.replace(/\.(html?|php|aspx)$/i, "").toLowerCase();
  if (!low || /^\d+$/.test(low) || low.length <= 2) return [];
  if (STOP_SEGMENTS.has(low)) return [];

  const dealerIdx = low.indexOf("-dealer-");
  if (dealerIdx > 0) {
    const brandSlug = low.slice(0, dealerIdx);
    const human = humanizeSegment(brandSlug);
    if (human && !isJunkPhrase(human)) return [human];
    return [];
  }
  if (low.endsWith("-dealer") && low.length > 8) {
    const brandSlug = low.slice(0, -"-dealer".length);
    const human = humanizeSegment(brandSlug);
    if (human && !isJunkPhrase(human)) return [human];
    return [];
  }

  const full = humanizeSegment(base);
  if (isJunkPhrase(full)) return [];
  const wc = full.split(/\s+/).length;
  if (wc > 12) return [];
  return [full];
}

function collectSiteWordsFromUrls(urls: string[], siteOrigin: string): Set<string> {
  const words = new Set<string>();
  for (const raw of urls) {
    let pathname: string;
    try {
      const u = new URL(raw);
      if (`${u.protocol}//${u.host}` !== siteOrigin) continue;
      pathname = u.pathname;
    } catch {
      continue;
    }
    for (const seg of pathname.split("/").filter(Boolean)) {
      const base = seg.replace(/\.(html?|php|aspx)$/i, "");
      for (const w of humanizeSegment(base).split(/\s+/)) {
        if (w.length > 2) words.add(w);
      }
    }
  }
  return words;
}

/**
 * Add a few meaningful product-style combos when the site vocabulary supports it.
 */
function augmentProductCombos(candidates: string[], siteWords: Set<string>): string[] {
  const seen = new Set(candidates.map((c) => c.toLowerCase()));
  const out = [...candidates];

  const hasBlinds = siteWords.has("blinds");
  const hasShades = siteWords.has("shades");
  const hasShutters = siteWords.has("shutters");

  for (const c of candidates) {
    const lower = c.toLowerCase();
    if (!/\bhunter\b.*\bdouglas\b|\bdouglas\b.*\bhunter\b/.test(lower) && !/\bhunter douglas\b/.test(lower)) {
      continue;
    }
    const pairs: string[] = [];
    if (hasBlinds) pairs.push("hunter douglas blinds");
    if (hasShades) pairs.push("hunter douglas shades");
    if (hasShutters) pairs.push("hunter douglas shutters");
    if (pairs.length === 0) pairs.push("hunter douglas window treatments");
    for (const p of pairs) {
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
    break;
  }

  return out;
}

/**
 * Derive keyword phrases from URL path segments. Collapses `brand-dealer-city` into brand;
 * prioritizes product language over generic location scaffolding.
 */
export function extractKeywordsFromSiteUrls(urls: string[], siteOrigin: string): string[] {
  const siteWords = collectSiteWordsFromUrls(urls, siteOrigin);
  const raw: string[] = [];
  const seen = new Set<string>();

  for (const rawUrl of urls) {
    let pathname: string;
    try {
      const u = new URL(rawUrl);
      if (`${u.protocol}//${u.host}` !== siteOrigin) continue;
      pathname = u.pathname;
    } catch {
      continue;
    }
    const segments = pathname.split("/").filter(Boolean);
    for (const seg of segments) {
      for (const phrase of phrasesFromSlugSegment(seg)) {
        const key = phrase.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        raw.push(phrase);
        if (raw.length >= MAX_RAW_PHRASES) break;
      }
      if (raw.length >= MAX_RAW_PHRASES) break;
    }
    if (raw.length >= MAX_RAW_PHRASES) break;
  }

  const augmented = augmentProductCombos(raw, siteWords);

  const ranked = [...augmented]
    .filter((p) => !isJunkPhrase(p))
    .sort((a, b) => productScore(b) - productScore(a));

  const ordered: string[] = [];
  const outSeen = new Set<string>();
  for (const p of ranked) {
    const k = p.toLowerCase();
    if (outSeen.has(k)) continue;
    outSeen.add(k);
    ordered.push(p);
    if (ordered.length >= 80) break;
  }

  return ordered;
}

/**
 * Build keyword rows + SAP counts from sitemap URL list (same JSON/backend flow as elsewhere). Deterministic; no API calls.
 */
export function suggestKeywordTargetsFromSiteUrls(
  urls: string[],
  siteOrigin: string,
  totalSapPages: number
): SuggestedKeywordTarget[] {
  if (totalSapPages < LOCAL_ANALYSIS_SAP_MIN || totalSapPages > LOCAL_ANALYSIS_TOTAL_SAP_CAP) {
    throw new Error(`Total must be between ${LOCAL_ANALYSIS_SAP_MIN} and ${LOCAL_ANALYSIS_TOTAL_SAP_CAP}.`);
  }
  const candidates = extractKeywordsFromSiteUrls(urls, siteOrigin);
  if (candidates.length === 0) {
    throw new Error("No keyword phrases could be derived from site URLs.");
  }
  const rough = candidates.slice(0, MAX_CANDIDATE_KEYWORDS).map((keyword) => ({ keyword, sapPages: 1 }));
  return repairSapPageAllocation(rough, totalSapPages, LOCAL_ANALYSIS_SAP_MIN, LOCAL_ANALYSIS_SAP_MAX);
}
