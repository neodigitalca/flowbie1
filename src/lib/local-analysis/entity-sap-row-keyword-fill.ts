/**
 * Assign one unique keyword per Entity SAP row: GSC first, OpenRouter when GSC cannot fill.
 */

import type { WordPressSite } from "@/components/integrations/types";
import {
  ensureMasterInstructionsInMemory,
} from "@/lib/master-instructions-storage";
import type { PromptBulkSitemapInventoryBuckets, PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import {
  fetchEntityGscKeywordBundle,
  gscSapKeywordBasesForOpenRouter,
} from "@/lib/bulk/bulk-gsc-site-queries";
import {
  ensureEntitySiteWarmCache,
  gscQueriesFromWarmBundleForSapBudget,
} from "@/lib/local-analysis/entity-site-warm-cache";
import type { GscCompetitorDateRange, GscSiteQueryRow } from "@/lib/competitor-research/types";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { keywordUniquenessKey } from "@/lib/local-analysis-fill-keywords-from-wp-inventory";
import { normalizeEntityHintCommaLabel } from "@/lib/comma-place-label";
import { buildEntityAdGroupSections, type EntityAdGroupSection } from "@/lib/local-analysis/sap-entity-ad-groups";
import {
  aiFilterAllowedBrandTexts,
  aiRejectBrandOrBlockedTexts,
} from "@/lib/content-brand-ai-gate";
import {
  GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK,
} from "@/lib/content-topic-blocklist";
import { isOffensiveGscQuery } from "@/lib/gsc-offensive-word-blocklist";
import { openRouterWebAppHeaders } from "@/lib/openrouter-attribution";

/** Collapse repeated comma segments (e.g. "Fort Saskatchewan, Fort Saskatchewan, AB"). */
export function collapseRepeatedPlaceSegmentsInKeyword(keyword: string): string {
  let out = keyword.trim();
  if (!out) return out;
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/([^,]+),\s*\1(\s*,|\s*$)/gi, "$1$2");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Collapse adjacent duplicate space-separated words (e.g. "Edmonton Edmonton"). */
function collapseRepeatedWords(text: string): string {
  let out = text.trim().replace(/\s{2,}/g, " ");
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/\b(\w+)\s+\1\b/gi, "$1");
  }
  return out.trim();
}

/** Drop earlier copies of a word when the same word appears again later (case-insensitive). */
function collapseDuplicateWordsKeepLast(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words.join(" ");
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = words.length - 1; i >= 0; i--) {
    const key = words[i]!.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.unshift(words[i]!);
  }
  return out.join(" ");
}

/**
 * Remove from the service base any tokens that already appear in the place suffix
 * (e.g. base "blinds edmonton" + place "Westmount Edmonton" → "blinds").
 */
export function stripBaseTokensPresentInPlace(base: string, place: string): string {
  const placeWords = new Set(
    place
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
  if (placeWords.size === 0) return base.trim().replace(/\s+/g, " ");
  const words = base.trim().split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !placeWords.has(w.toLowerCase()));
  return kept.join(" ");
}

/** Collect place tokens (length > 1) from entity / city labels. */
export function placeTokenSetFromLabels(placeLabels: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of placeLabels) {
    const place = keywordPlaceSuffixFromEntity(raw) || raw.trim().replace(/,/g, " ");
    for (const w of place.toLowerCase().split(/\s+/).filter((t) => t.length > 1)) {
      out.add(w);
    }
  }
  return out;
}

/** True when any keyword word appears in the place corpus. */
export function keywordStillContainsPlaceTokens(
  keyword: string,
  placeCorpus: ReadonlySet<string> | readonly string[],
): boolean {
  const set =
    placeCorpus instanceof Set ? placeCorpus : placeTokenSetFromLabels(placeCorpus);
  if (set.size === 0) return false;
  const words = keyword
    .trim()
    .toLowerCase()
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return words.some((w) => set.has(w));
}

/** Neighbourhood / city tails that can partially strip a foreign multi-word place. */
const GENERIC_PLACE_TAIL_TOKENS = new Set([
  "park",
  "grove",
  "street",
  "hill",
  "ridge",
  "woods",
  "heights",
  "valley",
  "view",
  "dale",
  "green",
  "court",
  "place",
  "circle",
  "gardens",
  "manor",
]);

/** Tokens that are service/product language — never treat as orphan place heads. */
const SERVICE_KEYWORD_TOKENS = new Set([
  "blinds",
  "blind",
  "shades",
  "shade",
  "curtains",
  "curtain",
  "repair",
  "repairs",
  "window",
  "windows",
  "coverings",
  "treatment",
  "treatments",
  "store",
  "stores",
  "cleaning",
  "custom",
  "motorized",
  "roller",
  "roman",
  "wood",
  "blackout",
  "venetian",
  "commercial",
  "hunter",
  "douglas",
  "alta",
]);

/**
 * Strip every place token from the corpus. Empty string if nothing service-like remains
 * or place tokens are still present after strip.
 *
 * When a generic place tail (park, grove, …) is removed from a multi-word foreign city
 * (e.g. "sherwood park"), also drop the orphan head word ("sherwood") so it cannot
 * survive into the service phrase.
 */
export function stripAllPlaceTokensFromKeyword(
  base: string,
  placeLabels: readonly string[],
): string {
  let out = base.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!out) return "";

  // Longest multi-word place phrases first (contiguous), then per-token strip.
  const phrases = placeLabels
    .map((p) => (keywordPlaceSuffixFromEntity(p) || p).toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p.split(/\s+/).filter(Boolean).length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    const parts = out.toLowerCase().split(/\s+/).filter(Boolean);
    const needle = phrase.split(/\s+/).filter(Boolean);
    if (needle.length < 2) continue;
    const next: string[] = [];
    for (let i = 0; i < parts.length; ) {
      let match = i + needle.length <= parts.length;
      if (match) {
        for (let j = 0; j < needle.length; j++) {
          if (parts[i + j] !== needle[j]) {
            match = false;
            break;
          }
        }
      }
      if (match) {
        i += needle.length;
        continue;
      }
      next.push(parts[i]!);
      i++;
    }
    out = next.join(" ");
  }

  const corpus = placeTokenSetFromLabels(placeLabels);
  const words = out.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const kept: string[] = [];
  for (const w of words) {
    if (!corpus.has(w)) {
      kept.push(w);
      continue;
    }
    // Generic tail removed: drop prior orphan head (sherwood before park) unless it is service.
    if (
      GENERIC_PLACE_TAIL_TOKENS.has(w) &&
      kept.length > 0 &&
      !corpus.has(kept[kept.length - 1]!) &&
      !SERVICE_KEYWORD_TOKENS.has(kept[kept.length - 1]!)
    ) {
      kept.pop();
    }
  }
  out = kept.join(" ").trim();
  if (!out) return "";
  if (keywordStillContainsPlaceTokens(out, corpus)) return "";
  return out;
}

/**
 * Trailing multi-word place phrases in GSC bases (e.g. "sherwood park" in
 * "blinds sherwood park"), excluding phrases that contain service tokens.
 */
export function harvestTrailingPlacePhrasesFromBases(bases: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (label: string) => {
    const t = label.trim().toLowerCase().replace(/\s+/g, " ");
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const base of bases) {
    const words = base
      .trim()
      .toLowerCase()
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
    if (words.length < 3) continue;
    for (const len of [3, 2]) {
      if (words.length <= len) continue;
      const phraseWords = words.slice(-len);
      if (phraseWords.some((w) => SERVICE_KEYWORD_TOKENS.has(w))) continue;
      const prefix = words.slice(0, -len).join(" ");
      const phrase = phraseWords.join(" ");
      const stripped = stripBaseTokensPresentInPlace(base, phrase);
      if (stripped.toLowerCase().replace(/\s+/g, " ").trim() === prefix) add(phrase);
    }
  }
  return out;
}

/**
 * "sherwood park" style pairs in GSC bases → add full phrase + head token so
 * leftover "blinds sherwood" still strips after park was eaten by another entity.
 */
export function harvestGenericTailPlacesFromBases(bases: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (label: string) => {
    const t = label.trim().toLowerCase().replace(/\s+/g, " ");
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const base of bases) {
    const words = base
      .trim()
      .toLowerCase()
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
    for (let i = 0; i < words.length - 1; i++) {
      const head = words[i]!;
      const tail = words[i + 1]!;
      if (!GENERIC_PLACE_TAIL_TOKENS.has(tail)) continue;
      if (SERVICE_KEYWORD_TOKENS.has(head)) continue;
      add(`${head} ${tail}`);
      add(head);
    }
  }
  return out;
}

/** Place labels orphaned when a generic tail token was stripped from a multi-word city. */
export function harvestOrphanPlaceLabelsFromBases(
  bases: readonly string[],
  seedPlaces: readonly string[],
): string[] {
  const seed = placeTokenSetFromLabels(seedPlaces);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (label: string) => {
    const t = label.trim().toLowerCase().replace(/\s+/g, " ");
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const base of bases) {
    const words = base
      .trim()
      .toLowerCase()
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
    if (words.length < 2) continue;
    const stripped = stripAllPlaceTokensFromKeyword(base, seedPlaces);
    if (!stripped) continue;
    const strippedSet = new Set(stripped.toLowerCase().split(/\s+/).filter(Boolean));
    for (let i = 0; i < words.length; i++) {
      const w = words[i]!;
      if (!strippedSet.has(w)) continue;
      if (SERVICE_KEYWORD_TOKENS.has(w)) continue;
      const next = words[i + 1];
      const prev = words[i - 1];
      if (next && seed.has(next) && GENERIC_PLACE_TAIL_TOKENS.has(next)) {
        add(`${w} ${next}`);
        add(w);
      } else if (prev && seed.has(prev) && GENERIC_PLACE_TAIL_TOKENS.has(prev)) {
        add(`${prev} ${w}`);
        add(w);
      }
    }
  }
  return out;
}

/** AdGroup entity as keyword suffix: lowercase, spaces, no commas / region code. */
export function adGroupEntityKeywordSuffix(entity: string): string {
  return keywordPlaceSuffixFromEntity(entity).toLowerCase().replace(/\s+/g, " ").trim();
}

/** Service phrase + AdGroup entity suffix (lowercase, no commas). */
export function composeServiceKeywordWithAdGroupEntity(service: string, entity: string): string {
  const svc = service.trim().replace(/\s+/g, " ");
  if (!svc) return "";
  const place = adGroupEntityKeywordSuffix(entity);
  if (!place) return svc.toLowerCase();
  const core = stripBaseTokensPresentInPlace(svc, place).trim();
  if (!core) return place;
  return `${core} ${place}`.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Unique AdGroup keywords: strip foreign places, append this entity (lowercase, no commas). */
export function sanitizeUniqueServiceKeywordsForAdGroup(
  bases: readonly string[],
  entity: string,
  placeCorpus: readonly string[] = [],
): string[] {
  const places = [entity, ...placeCorpus].filter((p) => p.trim());
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of bases) {
    const service = stripAllPlaceTokensFromKeyword(raw, places);
    if (!service) continue;
    const composed = composeServiceKeywordWithAdGroupEntity(service, entity);
    if (!composed) continue;
    const key = composed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(composed);
  }
  return out;
}

/**
 * Keyword place suffix from entity: every comma segment except a trailing 2-letter
 * region code, joined by spaces (e.g. "Ritchie, Edmonton, AB" → "Ritchie Edmonton").
 */
export function keywordPlaceSuffixFromEntity(entity: string): string {
  const parts = entity
    .trim()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  const deduped: string[] = [];
  for (const part of parts) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.toLowerCase() === part.toLowerCase()) continue;
    deduped.push(part);
  }
  if (deduped.length >= 2 && /^[A-Za-z]{2}$/.test(deduped[deduped.length - 1]!)) {
    deduped.pop();
  }
  return collapseRepeatedWords(deduped.join(" "));
}

/** Strip foreign places from keyword, then append AdGroup entity (lowercase, no commas). */
export function normalizeSapKeywordWithPlaceSuffix(
  keyword: string,
  entity: string,
  placeCorpus: readonly string[] = [],
): string {
  const places = [entity, ...placeCorpus].filter((p) => p.trim());
  const service = stripAllPlaceTokensFromKeyword(
    collapseRepeatedPlaceSegmentsInKeyword(keyword).replace(/,/g, " "),
    places,
  );
  if (!service) return "";
  return composeServiceKeywordWithAdGroupEntity(service, entity);
}

/**
 * Strip foreign / native place tokens from the GSC base, then append this AdGroup
 * entity (lowercase, no commas). Place lives on the keyword for SEO.
 */
export function sapKeywordFromShortBaseAndEntity(
  baseKeyword: string,
  entity: string,
  placeCorpus: readonly string[] = [],
): string {
  const places = [entity, ...placeCorpus].filter((p) => p.trim());
  const service = stripAllPlaceTokensFromKeyword(baseKeyword, places);
  if (!service) return "";
  return composeServiceKeywordWithAdGroupEntity(service, entity);
}

const OR = "https://openrouter.ai/api/v1/chat/completions";

const GROUP_KEYWORDS_SYSTEM = `You assign focus keywords for **one entity ad group** of Local Analysis SAP landing pages.

Return **only** valid JSON: {"keywords":["..."]} with **exactly** \`count\` keywords.

Rules:
- Every keyword must be **unique** within your response **and** must not match any string in \`keywordsAlreadyUsedInGroup\` (case-insensitive).
- Format: **2–3 word** service / product phrase only. Do **not** append city, neighbourhood, or province — code appends the AdGroup entity afterward.
- Bad: "blinds edmonton", "blind repair sherwood park", "blinds Westmount Edmonton".
- Good: "blinds", "blind repair", "hunter douglas blinds", "roman shades".
- Base phrases on **unused** entries in \`gscKeywords\` first (strip any place words); when those run out, invent distinct service angles from \`seedKeywords\` and site services (not the brand name).
- **NEVER** use the site's own trading name from \`siteName\` as the keyword (fuzzy / word-reorder: "Blind Magic" ↔ "Magic Blinds"). Never use blocked topics (Bali Blinds). Product lines the dealer sells (Hunter Douglas, Alta, etc.) are fine.
- Never use vulgar, profane, or offensive language.
${GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK}
No markdown outside JSON.`;

export type EntitySapKeywordSources = {
  links: PromptBulkSitemapInventoryLink[];
  buckets: PromptBulkSitemapInventoryBuckets;
  gscQueries: GscSiteQueryRow[];
  gscDateRange: GscCompetitorDateRange;
};

export type FillEntitySapRowKeywordsArgs = {
  apiKey: string;
  model: string;
  siteId?: string;
  siteName: string;
  siteUrl: string;
  rows: CSVRow[];
  seedKeywords: string[];
  buckets: PromptBulkSitemapInventoryBuckets;
  gscQueries: GscSiteQueryRow[];
  gridLocations: string[];
  entityTypeFocus?: string[];
  temperature?: number;
  topP?: number;
  onGroupComplete?: (rows: CSVRow[], doneGroups: number, totalGroups: number) => void;
};

export async function fetchEntitySapKeywordSources(
  site: WordPressSite,
  rowCount: number,
  onProgress?: (message: string) => void,
): Promise<EntitySapKeywordSources> {
  onProgress?.("Loading site inventory and GSC from cache");
  const warm = await ensureEntitySiteWarmCache(site);
  if (warm.error) {
    throw new Error(warm.error);
  }
  if (warm.inventory.totalRows === 0) {
    throw new Error(
      "WordPress sitemap inventory is empty. Connect the site and ensure Pages, Posts, and SAP sitemaps return URLs.",
    );
  }
  return {
    links: warm.inventory.links,
    buckets: warm.inventory.buckets,
    gscQueries: gscQueriesFromWarmBundleForSapBudget(warm, rowCount),
    gscDateRange: warm.gsc.dateRange,
  };
}

export async function buildEntitySapKeywordSourcesFromInventory(
  inventory: { links: PromptBulkSitemapInventoryLink[]; buckets: PromptBulkSitemapInventoryBuckets; totalRows: number },
  site: WordPressSite,
  rowCount: number,
  onProgress?: (message: string) => void,
): Promise<EntitySapKeywordSources> {
  if (inventory.totalRows === 0) {
    throw new Error(
      "WordPress sitemap inventory is empty. Connect the site and ensure Pages, Posts, and SAP sitemaps return URLs.",
    );
  }
  const gsc = await fetchEntityGscKeywordBundle(site, rowCount, onProgress);
  return {
    links: inventory.links,
    buckets: inventory.buckets,
    gscQueries: gsc.queries,
    gscDateRange: gsc.dateRange,
  };
}

async function postOpenRouter(args: {
  apiKey: string;
  model: string;
  siteId: string | undefined;
  messages: { role: string; content: string }[];
  temperature: number;
  topP: number;
}): Promise<string> {
  const res = await fetch(OR, {
    method: "POST",
    headers: openRouterWebAppHeaders(args.apiKey),
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: args.temperature,
      top_p: args.topP,
      response_format: { type: "json_object" },
      stream: false,
    }),
  });
  const j = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok) return "";
  const content = j.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return "";
  return content;
}

export function applyKeywordFillsToSapRows(rows: CSVRow[], fills: Map<number, string>): CSVRow[] {
  return rows.map((row, i) => ({ ...row, keyword: fills.get(i) ?? row.keyword ?? "" }));
}

type GroupRowRequest = {
  localRowIndex: number;
  globalRowIndex: number;
  seedKeyword: string;
};

function isRejectedEntitySapKeywordSync(keyword: string): boolean {
  const k = keyword.trim();
  if (!k) return true;
  if (isOffensiveGscQuery(k)) return true;
  return false;
}

function assignGscKeywordsForSection(
  section: EntityAdGroupSection,
  rows: CSVRow[],
  gscKeywords: string[],
  fills: Map<number, string>,
  placeCorpus: readonly string[] = [],
): number {
  if (gscKeywords.length === 0) return 0;
  const usedInGroup = new Set<string>();
  for (const globalIdx of section.rowIndices) {
    const key = keywordUniquenessKey(fills.get(globalIdx) ?? "");
    if (key) usedInGroup.add(key);
  }
  let assigned = 0;
  let cursor = 0;
  for (const globalIdx of section.rowIndices) {
    if (fills.get(globalIdx)?.trim()) continue;
    const entity = normalizeEntityHintCommaLabel((rows[globalIdx]?.entity ?? section.entity).trim());
    if (!entity) continue;
    for (let attempt = 0; attempt < gscKeywords.length; attempt++) {
      const base = gscKeywords[(cursor + attempt) % gscKeywords.length]!;
      if (isRejectedEntitySapKeywordSync(base)) continue;
      const keyword = sapKeywordFromShortBaseAndEntity(base, entity, placeCorpus);
      if (isRejectedEntitySapKeywordSync(keyword)) continue;
      const key = keywordUniquenessKey(keyword);
      if (!key || usedInGroup.has(key)) continue;
      fills.set(globalIdx, keyword);
      usedInGroup.add(key);
      assigned++;
      cursor = (cursor + attempt + 1) % gscKeywords.length;
      break;
    }
  }
  return assigned;
}

/** One OpenRouter call for a whole ad group: returns `count` unique keywords. */
async function inventGroupKeywordsViaOpenRouter(args: {
  apiKey: string;
  model: string;
  siteId: string | undefined;
  siteName: string;
  siteUrl: string;
  entity: string;
  count: number;
  seedKeywords: string[];
  gscKeywords: string[];
  gridLocations: string[];
  keywordsAlreadyUsedInGroup: string[];
  temperature: number;
  topP: number;
}): Promise<string[]> {
  const keywordPlace = keywordPlaceSuffixFromEntity(args.entity);
  const user = JSON.stringify({
    siteName: args.siteName,
    siteUrl: args.siteUrl,
    entity: args.entity,
    keywordPlace,
    count: args.count,
    seedKeywords: args.seedKeywords,
    gscKeywords: args.gscKeywords,
    gridLocations: args.gridLocations,
    keywordsAlreadyUsedInGroup: args.keywordsAlreadyUsedInGroup,
  });
  const content = await postOpenRouter({
    apiKey: args.apiKey,
    model: args.model,
    siteId: args.siteId,
    messages: [
      { role: "system", content: GROUP_KEYWORDS_SYSTEM },
      { role: "user", content: user },
    ],
    temperature: args.temperature,
    topP: args.topP,
  });
  try {
    const parsed = JSON.parse(content) as { keywords?: unknown };
    if (!Array.isArray(parsed.keywords)) return [];
    const normalized = parsed.keywords
      .map((k) =>
        normalizeSapKeywordWithPlaceSuffix(
          String(k ?? "").trim(),
          args.entity,
          args.gridLocations,
        ),
      )
      .filter((k) => k.length > 0 && !isRejectedEntitySapKeywordSync(k));
    return await aiFilterAllowedBrandTexts({
      apiKey: args.apiKey,
      model: args.model,
      companyName: args.siteName,
      candidates: normalized,
      kind: "keyword",
    });
  } catch {
    return [];
  }
}

/** Later duplicates only (first occurrence keeps its keyword). */
function duplicateGlobalIndicesInSection(
  section: EntityAdGroupSection,
  fills: Map<number, string>,
): number[] {
  const seen = new Set<string>();
  const dupes: number[] = [];
  for (const globalIdx of section.rowIndices) {
    const kw = fills.get(globalIdx)?.trim();
    if (!kw) continue;
    const key = keywordUniquenessKey(kw);
    if (!key) continue;
    if (seen.has(key)) {
      dupes.push(globalIdx);
    } else {
      seen.add(key);
    }
  }
  return dupes;
}

type AdGroupKeywordSubAgentResult = {
  gscAssigned: number;
  aiAssigned: number;
};

/** One entity ad group sub-agent: GSC first, then parallel OpenRouter per child. */
async function runEntityAdGroupKeywordSubAgent(args: {
  section: EntityAdGroupSection;
  groupRows: GroupRowRequest[];
  rows: CSVRow[];
  gscKeywords: string[];
  allFills: Map<number, string>;
  apiKey: string;
  model: string;
  siteId: string | undefined;
  siteName: string;
  siteUrl: string;
  gridLocations: string[];
  fillTemperature: number;
  topP: number;
}): Promise<AdGroupKeywordSubAgentResult> {
  const {
    section,
    groupRows,
    rows,
    gscKeywords,
    allFills,
    apiKey,
    model,
    siteId,
    siteName,
    siteUrl,
    gridLocations,
    fillTemperature,
    topP,
  } = args;

  const gscAssigned = assignGscKeywordsForSection(
    section,
    rows,
    gscKeywords,
    allFills,
    gridLocations,
  );
  let aiAssigned = 0;

  // One batch OpenRouter call per pass: the agent sees the whole ad group and
  // returns exactly N unique keywords (missing rows + duplicate rows together).
  for (let attempt = 0; attempt < 3; attempt++) {
    const dupeIndices = new Set(duplicateGlobalIndicesInSection(section, allFills));
    const needy = groupRows.filter(
      (r) => dupeIndices.has(r.globalRowIndex) || !allFills.get(r.globalRowIndex)?.trim(),
    );
    if (needy.length === 0) break;
    const needySet = new Set(needy.map((r) => r.globalRowIndex));
    const used = section.rowIndices
      .filter((i) => !needySet.has(i))
      .map((i) => allFills.get(i)?.trim())
      .filter(Boolean) as string[];
    const usedKeys = new Set(used.map((k) => keywordUniquenessKey(k)));
    const candidates = await inventGroupKeywordsViaOpenRouter({
      apiKey,
      model,
      siteId,
      siteName,
      siteUrl,
      entity: section.entity,
      count: needy.length,
      seedKeywords: [...new Set(needy.map((r) => r.seedKeyword).filter(Boolean))],
      gscKeywords,
      gridLocations,
      keywordsAlreadyUsedInGroup: used,
      temperature: Math.min(fillTemperature + 0.15 * attempt, 0.75),
      topP,
    });
    let cursor = 0;
    for (const row of needy) {
      while (cursor < candidates.length) {
        const kw = candidates[cursor++]!;
        const key = keywordUniquenessKey(kw);
        if (!key || usedKeys.has(key)) continue;
        usedKeys.add(key);
        allFills.set(row.globalRowIndex, kw);
        aiAssigned++;
        break;
      }
    }
  }

  return { gscAssigned, aiAssigned };
}

/** GSC first per entity group; all ad groups run in parallel. */
export async function fillEntitySapRowKeywordsFromInventoryAndGsc(
  args: FillEntitySapRowKeywordsArgs,
): Promise<CSVRow[]> {
  const {
    apiKey,
    model,
    siteId,
    siteName,
    siteUrl,
    rows,
    seedKeywords,
    gscQueries,
    gridLocations,
    temperature = 0.35,
    topP = 1,
  } = args;

  if (rows.length === 0) return rows;
  await ensureMasterInstructionsInMemory(siteId);

  const fillTemperature = rows.length >= 2 ? Math.max(temperature, 0.45) : temperature;
  const gscKeywords = await aiFilterAllowedBrandTexts({
    apiKey,
    model,
    companyName: siteName,
    candidates: gscSapKeywordBasesForOpenRouter(
      gscQueries,
      Math.max(rows.length * 4, 40),
    ),
    kind: "keyword",
  });
  const sections = buildEntityAdGroupSections(rows);
  const allFills = new Map<number, string>();

  const totalGroups = sections.length;
  let doneGroups = 0;
  await Promise.all(
    sections.map(async (section) => {
      const groupRows: GroupRowRequest[] = section.rowIndices.map((globalRowIndex, localRowIndex) => ({
        localRowIndex,
        globalRowIndex,
        seedKeyword: (seedKeywords[globalRowIndex] ?? "").trim(),
      }));
      const localFills = new Map<number, string>();
      await runEntityAdGroupKeywordSubAgent({
        section,
        groupRows,
        rows,
        gscKeywords,
        allFills: localFills,
        apiKey,
        model,
        siteId,
        siteName,
        siteUrl,
        gridLocations,
        fillTemperature,
        topP,
      });
      for (const [idx, kw] of localFills) {
        allFills.set(idx, kw);
      }
      doneGroups += 1;
      args.onGroupComplete?.(applyKeywordFillsToSapRows(rows, allFills), doneGroups, totalGroups);
    }),
  );
  const filledPairs = [...allFills.entries()].filter(([, kw]) => kw.trim());
  if (filledPairs.length > 0) {
    const rejected = await aiRejectBrandOrBlockedTexts({
      apiKey,
      model,
      companyName: siteName,
      candidates: filledPairs.map(([, kw]) => kw),
      kind: "keyword",
    });
    if (rejected.length > 0) {
      const rejectKeys = new Set(rejected.map((k) => k.trim().toLowerCase().replace(/\s+/g, " ")));
      for (const [idx, kw] of filledPairs) {
        const key = kw.trim().toLowerCase().replace(/\s+/g, " ");
        if (rejectKeys.has(key)) allFills.delete(idx);
      }
    }
  }

  const blankAfterGate = rows
    .map((_, i) => i)
    .filter((i) => !allFills.get(i)?.trim() && (rows[i]?.entity ?? "").trim());
  if (blankAfterGate.length > 0) {
    const byEntity = new Map<string, number[]>();
    for (const idx of blankAfterGate) {
      const entity = normalizeEntityHintCommaLabel((rows[idx]?.entity ?? "").trim());
      if (!entity) continue;
      const list = byEntity.get(entity) ?? [];
      list.push(idx);
      byEntity.set(entity, list);
    }
    await Promise.all(
      [...byEntity.entries()].map(async ([entity, indices]) => {
        const used = rows
          .map((_, i) => allFills.get(i)?.trim())
          .filter(Boolean) as string[];
        const candidates = await inventGroupKeywordsViaOpenRouter({
          apiKey,
          model,
          siteId,
          siteName,
          siteUrl,
          entity,
          count: indices.length,
          seedKeywords: indices.map((i) => (seedKeywords[i] ?? "").trim()).filter(Boolean),
          gscKeywords,
          gridLocations,
          keywordsAlreadyUsedInGroup: used,
          temperature: Math.min(fillTemperature + 0.2, 0.75),
          topP,
        });
        const usedKeys = new Set(used.map((k) => keywordUniquenessKey(k)));
        let cursor = 0;
        for (const idx of indices) {
          while (cursor < candidates.length) {
            const kw = candidates[cursor++]!;
            const key = keywordUniquenessKey(kw);
            if (!key || usedKeys.has(key)) continue;
            usedKeys.add(key);
            allFills.set(idx, kw);
            break;
          }
        }
      }),
    );
  }

  return applyKeywordFillsToSapRows(rows, allFills);
}
