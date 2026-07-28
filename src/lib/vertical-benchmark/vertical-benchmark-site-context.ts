import type { WordPressSite } from "@/components/integrations/types";
import {
  formatGbpContextForSuggestMarkdown,
  parseGmbDfsBusinessInfo,
  type GbpResolvedFromDfs,
} from "@/lib/gmb-dfs-parse";
import { extractKeywordsFromSiteUrls } from "@/lib/local-analysis-suggest-from-paths";
import {
  fetchLocalStrategyGmbDfsRaw,
  inferDataForSeoLocationNameFromWebsiteUrl,
} from "@/lib/local-strategy-research/local-strategy-gmb-fetch";
import { getPrimaryCityStateLabel } from "@/lib/primary-location-from-site";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import type { SitePostInventoryKbPayload, SitePostInventoryRow } from "@/lib/wordpress-api/types";

const GMB_FETCH_TIMEOUT_MS = 25_000;
const MAX_INVENTORY_PHRASES = 24;

/** Brands commonly referenced in window-treatment content; only included when evidenced in inventory. */
export const WINDOW_TREATMENT_BRAND_CHECKS: ReadonlyArray<{
  id: string;
  label: string;
  slugPattern: RegExp;
  textPattern: RegExp;
}> = [
  { id: "hunter-douglas", label: "Hunter Douglas", slugPattern: /hunter-douglas|hunter_douglas/i, textPattern: /\bhunter\s+douglas\b/i },
  { id: "alta", label: "Alta", slugPattern: /\balta-window|\balta-blind|\b-alta-|\balta\b/i, textPattern: /\balta\s+(window|blind|shade)/i },
  { id: "somfy", label: "Somfy", slugPattern: /\bsomfy\b/i, textPattern: /\bsomfy\b/i },
  { id: "powerview", label: "PowerView", slugPattern: /\bpowerview\b/i, textPattern: /\bpowerview\b/i },
  { id: "luxaflex", label: "Luxaflex", slugPattern: /\bluxaflex\b/i, textPattern: /\bluxaflex\b/i },
  { id: "graber", label: "Graber", slugPattern: /\bgraber\b/i, textPattern: /\bgraber\b/i },
  { id: "bali", label: "Bali", slugPattern: /\bbali-blind|\bbali\b/i, textPattern: /\bbali\s+blind/i },
  { id: "altex", label: "Altex", slugPattern: /\baltex\b/i, textPattern: /\baltex\b/i },
  { id: "norman", label: "Norman", slugPattern: /\bnorman\b/i, textPattern: /\bnorman\s+(shutter|blind|shade)/i },
  { id: "springs", label: "Springs Window Fashions", slugPattern: /\bsprings\b/i, textPattern: /\bsprings\s+window/i },
];

const PRODUCT_LINE_CHECKS: ReadonlyArray<{ id: string; label: string; pattern: RegExp }> = [
  { id: "blinds", label: "blinds", pattern: /\bblinds?\b/i },
  { id: "shades", label: "shades", pattern: /\bshades?\b/i },
  { id: "shutters", label: "shutters", pattern: /\bshutters?\b/i },
  { id: "drapery", label: "drapery", pattern: /\bdrapery|draperies\b/i },
  { id: "motorized", label: "motorized treatments", pattern: /\bmotorized\b/i },
  { id: "roman", label: "roman shades", pattern: /\broman\s+shade/i },
  { id: "roller", label: "roller shades", pattern: /\broller\s+shade/i },
  { id: "cellular", label: "cellular / honeycomb", pattern: /\b(cellular|honeycomb)\b/i },
  { id: "woven", label: "woven wood", pattern: /\bwoven\s+wood\b/i },
  { id: "plantation", label: "plantation shutters", pattern: /\bplantation\s+shutter/i },
];

export type BenchmarkSiteOfferings = {
  verifiedBrands: string[];
  verifiedProductLines: string[];
  inventoryPhrases: string[];
};

export type BenchmarkClientContextEnrichment = {
  offerings: BenchmarkSiteOfferings;
  clientOfferingsBlock: string;
  gmbOk: boolean;
  /** Short line for progress UI */
  contextSummary: string;
};

function siteOriginFromUrl(siteUrl: string): string {
  try {
    const u = new URL(siteUrl.includes("://") ? siteUrl : `https://${siteUrl}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

function parseInventoryPayload(siteInventoryJson: string): SitePostInventoryRow[] {
  if (!siteInventoryJson.trim()) return [];
  try {
    const parsed = JSON.parse(siteInventoryJson) as SitePostInventoryKbPayload;
    return Array.isArray(parsed.posts) ? parsed.posts : [];
  } catch {
    return [];
  }
}

function collectInventoryTextBlob(rows: SitePostInventoryRow[]): string {
  const parts: string[] = [];
  for (const row of rows) {
    if (row.url) parts.push(row.url);
    if (row.slug) parts.push(row.slug);
    if (row.fields?.title) parts.push(row.fields.title);
    if (row.fields?.keyword) parts.push(row.fields.keyword);
  }
  return parts.join("\n");
}

function countTextMatches(text: string, pattern: RegExp): number {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    n += 1;
    if (!re.global) break;
  }
  return n;
}

/** Evidence: slug/URL hit once, or 2+ mentions in titles/keywords/urls combined. */
export function detectVerifiedBrands(rows: SitePostInventoryRow[]): string[] {
  const blob = collectInventoryTextBlob(rows);
  const urlSlugBlob = rows.map((r) => `${r.url ?? ""} ${r.slug ?? ""}`).join("\n");
  const out: string[] = [];

  for (const brand of WINDOW_TREATMENT_BRAND_CHECKS) {
    const slugHit = brand.slugPattern.test(urlSlugBlob);
    const textHits = countTextMatches(blob, brand.textPattern);
    if (slugHit || textHits >= 2) {
      out.push(brand.label);
    }
  }
  return out;
}

export function detectVerifiedProductLines(rows: SitePostInventoryRow[]): string[] {
  const blob = collectInventoryTextBlob(rows);
  const out: string[] = [];
  for (const line of PRODUCT_LINE_CHECKS) {
    if (line.pattern.test(blob)) out.push(line.label);
  }
  return out;
}

export function deriveOfferingsFromInventory(
  siteUrl: string,
  siteInventoryJson: string,
): BenchmarkSiteOfferings {
  const rows = parseInventoryPayload(siteInventoryJson);
  const origin = siteOriginFromUrl(siteUrl);
  const urls = rows.map((r) => r.url).filter(Boolean);
  const inventoryPhrases = origin ? extractKeywordsFromSiteUrls(urls, origin).slice(0, MAX_INVENTORY_PHRASES) : [];

  const verifiedBrands = detectVerifiedBrands(rows);
  const verifiedProductLines = detectVerifiedProductLines(rows);

  return {
    verifiedBrands,
    verifiedProductLines,
    inventoryPhrases,
  };
}

export const CLIENT_OFFERINGS_PROMPT_RULES = `
CLIENT OFFERINGS (mandatory):
- Only write about brands and product lines listed in CLIENT_OFFERINGS_CONTEXT for this client.
- Forbidden: comparison or product-specific posts for brands NOT listed (e.g. no "Hunter Douglas vs …" if Hunter Douglas is absent from verified_brands).
- When a GSC URL targets a brand this client does not carry, pivot to a supported product angle for that client; still return exactly one row per URL.
- GBP/address data in CLIENT_OFFERINGS_CONTEXT is for understanding the business only. Never put city, state, region, country, or neighborhood names in keyword or title.`;

export function buildClientOfferingsPromptBlock(
  offerings: BenchmarkSiteOfferings,
  gbp: GbpResolvedFromDfs | null,
): string {
  const payload = {
    verified_brands: offerings.verifiedBrands.length ? offerings.verifiedBrands : ["(none detected; use generic window treatment language only)"],
    verified_product_lines:
      offerings.verifiedProductLines.length ?
        offerings.verifiedProductLines
      : ["(none detected; infer only from inventory phrases below)"],
    inventory_phrases_sample: offerings.inventoryPhrases.slice(0, MAX_INVENTORY_PHRASES),
    gbp_internal_only: gbp ?
      {
        business_name: gbp.title || null,
        note: "Do not copy city, region, or street address into keyword or title.",
      }
    : null,
  };

  const gbpMd =
    gbp ? `\n${formatGbpContextForSuggestMarkdown(gbp)}\n(GBP fields above are internal context only; never use place names in keyword or title.)` : "";

  return `=== CLIENT_OFFERINGS_CONTEXT (mandatory for curation) ===
${JSON.stringify(payload, null, 2)}
${gbpMd}
=== END CLIENT_OFFERINGS_CONTEXT ===`;
}

/** DataForSEO GMB for business grounding; failures return null without throwing. */
export async function fetchBenchmarkGmbRaw(site: WordPressSite): Promise<unknown | null> {
  const siteUrl = getPublicSiteUrl(site);
  const cityState = getPrimaryCityStateLabel(site)?.trim() ?? "";
  const name = site.name?.trim() ?? "";
  const keyword = cityState && name ? `${name} ${cityState}` : name || siteUrl;
  if (!keyword.trim()) return null;

  try {
    return await fetchLocalStrategyGmbDfsRaw({
      keyword,
      locationName: inferDataForSeoLocationNameFromWebsiteUrl(siteUrl),
      websiteUrl: siteUrl,
      signal: AbortSignal.timeout(GMB_FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

export function enrichBenchmarkClientContext(
  site: WordPressSite,
  siteUrl: string,
  siteInventoryJson: string,
  gmbRaw: unknown | null,
): BenchmarkClientContextEnrichment {
  const offerings = deriveOfferingsFromInventory(siteUrl, siteInventoryJson);
  const gbp = gmbRaw ? parseGmbDfsBusinessInfo(gmbRaw) : null;
  const clientOfferingsBlock = buildClientOfferingsPromptBlock(offerings, gbp);
  const gmbOk = Boolean(gbp?.title || gbp?.formattedAddress);
  const brandCount = offerings.verifiedBrands.length;
  const contextSummary = gmbOk ?
    `GMB ok, ${brandCount} brand(s)`
  : brandCount > 0 ?
    `${brandCount} brand(s)`
  : "context ready";

  return {
    offerings,
    clientOfferingsBlock,
    gmbOk,
    contextSummary,
  };
}
