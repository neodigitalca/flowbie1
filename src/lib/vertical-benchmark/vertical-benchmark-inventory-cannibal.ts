import type { SitePostInventoryKbPayload, SitePostInventoryRow } from "@/lib/wordpress-api/types";
import {
  KEYWORD_JACCARD_CANNIBAL_THRESHOLD,
  jaccardSimilarity,
  normalizeDedupeKey,
  significantTokens,
} from "@/lib/vertical-benchmark/vertical-benchmark-bulk-dedupe";

export type InventoryKeywordSet = {
  /** Original phrases for conflict reporting. */
  phrases: string[];
  normalizedKeys: string[];
  tokenSets: string[][];
};

export type InventoryKeywordConflict =
  | { conflicts: false }
  | { conflicts: true; matched: string };

function parseInventoryRows(siteInventoryJson: string): SitePostInventoryRow[] {
  if (!siteInventoryJson.trim()) return [];
  try {
    const parsed = JSON.parse(siteInventoryJson) as SitePostInventoryKbPayload;
    return Array.isArray(parsed.posts) ? parsed.posts : [];
  } catch {
    return [];
  }
}

function keywordFocusFromRow(row: SitePostInventoryRow): string {
  const acf = row.acf && typeof row.acf === "object" ? (row.acf as Record<string, unknown>) : {};
  const fromAcf = typeof acf.keyword_focus === "string" ? acf.keyword_focus.trim() : "";
  return fromAcf;
}

function collectPhrasesFromRow(row: SitePostInventoryRow): string[] {
  const out: string[] = [];
  const keyword = row.fields?.keyword?.trim();
  const title = row.fields?.title?.trim();
  const focus = keywordFocusFromRow(row);
  if (keyword) out.push(keyword);
  if (focus && normalizeDedupeKey(focus) !== normalizeDedupeKey(keyword ?? "")) out.push(focus);
  if (title) out.push(title);
  return out;
}

/** Grep-ready inventory keyword set from published site inventory JSON. */
export function buildInventoryKeywordSet(siteInventoryJson: string): InventoryKeywordSet {
  const rows = parseInventoryRows(siteInventoryJson);
  const seen = new Set<string>();
  const phrases: string[] = [];
  const normalizedKeys: string[] = [];
  const tokenSets: string[][] = [];

  for (const row of rows) {
    for (const phrase of collectPhrasesFromRow(row)) {
      const key = normalizeDedupeKey(phrase);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      phrases.push(phrase);
      normalizedKeys.push(key);
      tokenSets.push(significantTokens(phrase));
    }
  }

  return { phrases, normalizedKeys, tokenSets };
}

function substringGrepConflict(proposedKey: string, inventory: InventoryKeywordSet): string | null {
  for (let i = 0; i < inventory.normalizedKeys.length; i++) {
    const invKey = inventory.normalizedKeys[i];
    const invTokens = inventory.tokenSets[i];
    if (invTokens.length < 2) continue;
    if (proposedKey.includes(invKey) || invKey.includes(proposedKey)) {
      return inventory.phrases[i] ?? invKey;
    }
  }
  return null;
}

/** Deterministic inventory cannibalization check (no LLM). */
export function conflictsWithInventoryKeyword(
  proposedKeyword: string,
  inventory: InventoryKeywordSet,
): InventoryKeywordConflict {
  const trimmed = proposedKeyword?.trim() ?? "";
  if (!trimmed || !inventory.phrases.length) return { conflicts: false };

  const proposedKey = normalizeDedupeKey(trimmed);
  const proposedTokens = significantTokens(trimmed);

  for (let i = 0; i < inventory.normalizedKeys.length; i++) {
    if (inventory.normalizedKeys[i] === proposedKey) {
      return { conflicts: true, matched: inventory.phrases[i] ?? trimmed };
    }
  }

  const substringHit = substringGrepConflict(proposedKey, inventory);
  if (substringHit) return { conflicts: true, matched: substringHit };

  for (let i = 0; i < inventory.tokenSets.length; i++) {
    if (
      jaccardSimilarity(proposedTokens, inventory.tokenSets[i]) >= KEYWORD_JACCARD_CANNIBAL_THRESHOLD
    ) {
      return { conflicts: true, matched: inventory.phrases[i] ?? trimmed };
    }
  }

  return { conflicts: false };
}

export type InventoryCannibalPromptBlockOptions = {
  maxRows?: number;
  maxChars?: number;
};

const DEFAULT_INVENTORY_PROMPT_MAX_ROWS = 500;
const DEFAULT_INVENTORY_PROMPT_MAX_CHARS = 96_000;

/** Senior SEO role framing for per-client curation and final sheet review. */
export const BENCHMARK_SEO_CONTENT_SPECIALIST_PERSONA = `
ROLE — SENIOR SEO CONTENT SPECIALIST (mandatory):
You are a senior SEO content specialist preparing a bulk editorial content sheet for a client site.
SITE_INVENTORY is the authoritative map of published and scheduled coverage (titles, keywords, URLs). Treat it as ground truth for what the site already owns in search.
Your job: propose only net-new angles that fill real gaps — not rewrites, not near-duplicates, not the same comparison pair or topic cluster with a new subtitle.
Cannibalization is unacceptable. If a GSC line suggests a topic already covered in inventory, pivot to a distinct search intent while keeping source_exemplar_url on the assigned GSC line when required.
Think in search intent, topic clusters, and editorial variety — not keyword stuffing or title tweaks on existing themes.
Inventory wins over GSC when they conflict.`;

/** Prompt-only rules: Gemini must read SITE_INVENTORY and avoid competing with published posts. */
export const BENCHMARK_SITE_INVENTORY_CANNIBALIZATION = `
SITE_INVENTORY — CANNIBALIZATION ONLY (mandatory before every row):
Read the entire SITE_INVENTORY JSON (every url, keyword, title). This is what already exists on the site. Your output must NOT compete with any inventory row in search intent.

Before you write rows[], scan all inventory entries. For each GSC OUTPUT line you adapt:
- If the natural GSC topic already exists in inventory (same comparison pair, same product line, same repair intent, same "A vs B" axis), you MUST pivot: keep source_exemplar_url on the GSC line but choose a different keyword and title that do not overlap inventory.
- Do not duplicate or lightly rephrase any inventory title (punctuation, subtitle after colon, or synonym swap does NOT make it new).
- Do not reuse or near-duplicate any inventory keyword (case, plural, word order, or 1-word swap).
- Do not output a second row for an unordered comparison pair already in inventory — a different subtitle or colon phrase does NOT make it a new intent.
- When inventory covers a topic, pivot to a verified-brand angle or content type with zero overlap (different product line, different comparison pair, explainer on a line not in inventory).

If you cannot adapt a GSC line without inventory overlap, pivot that row to the next-best gap topic for this client (still keep source_exemplar_url). Never ship a row that would cannibalize inventory.`;

/** Row count for prompt headers (full inventory in memory). */
export function countInventoryPromptRows(siteInventoryJson: string): number {
  return parseInventoryRows(siteInventoryJson).length;
}

/** Slim url/keyword/title list for prompts (grep uses full JSON in memory). */
export function buildInventoryCannibalPromptBlock(
  siteInventoryJson: string,
  options?: InventoryCannibalPromptBlockOptions,
): string {
  const maxRows = options?.maxRows ?? DEFAULT_INVENTORY_PROMPT_MAX_ROWS;
  const maxChars = options?.maxChars ?? DEFAULT_INVENTORY_PROMPT_MAX_CHARS;
  const rows = parseInventoryRows(siteInventoryJson);
  const slim: Array<{ url: string; keyword: string; title: string }> = [];

  for (const row of rows) {
    if (slim.length >= maxRows) break;
    const url = row.url?.trim() ?? "";
    const keyword = row.fields?.keyword?.trim() || keywordFocusFromRow(row);
    const title = row.fields?.title?.trim() ?? "";
    if (!url && !keyword && !title) continue;
    slim.push({ url, keyword, title });
  }

  let body = "";
  for (let n = slim.length; n >= 0; n--) {
    const slice = slim.slice(0, n);
    const candidate = JSON.stringify(
      slice.length < rows.length ?
        { truncated: true, shown: slice.length, total: rows.length, rows: slice }
      : slice,
    );
    if (candidate.length <= maxChars) {
      body = candidate;
      break;
    }
  }
  if (!body) {
    return JSON.stringify({ truncated: true, shown: 0, total: rows.length, rows: [] });
  }
  return body;
}
