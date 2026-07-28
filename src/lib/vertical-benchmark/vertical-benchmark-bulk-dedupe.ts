import type { BacklinkBlogPitchOption } from "@/lib/backlink-research/backlink-tile-enriched";
import {
  GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK,
  isBlockedContentTopicPhrase,
} from "@/lib/content-topic-blocklist";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "in",
  "on",
  "with",
  "vs",
  "versus",
  "your",
  "how",
  "what",
  "why",
  "best",
  "guide",
  "complete",
  "explained",
]);

/** Hard-banned topics for benchmark bulk CSV (delegates to global content-topic blocklist). */
export function isBannedBulkBenchmarkTopic(...parts: (string | undefined | null)[]): boolean {
  return isBlockedContentTopicPhrase(...parts);
}

export const BULK_BENCHMARK_TOPIC_EXCLUSIONS_BLOCK = `
${GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK}
- If a GSC URL targets Bali blind removal/detachment, do not adapt that angle — use a different national window-treatment topic with zero "Bali" in keyword and title.`;

/** Prompt-only cannibalization rules (no product/title hardcoding in app logic). */
export const BULK_CANNIBALIZATION_INSTRUCTIONS = `
CANNIBALIZATION — STRICT (mandatory):
Evaluate every row against every other row in the set you are producing. If two rows would compete in search, keep only the stronger one — never ship near-duplicates.

Comparison posts (one per brand pair):
- Only ONE row per unordered comparison pair (Brand A vs Brand B = B vs A; same pair regardless of word order, punctuation, or subtitle).
- REJECT a second row that compares the same two subjects with a different suffix only (e.g. "Showdown" vs "Automated Shades", "Which Wins" vs "Best Fit", "Smart" vs "Motorized") — that is one intent, not two.
- REJECT any repeated A vs B title with light rephrasing — including when one version is in SITE_INVENTORY and you would output another in rows[].

Same-brand product-line pages → one roundup (not a stack of product reviews):
- When GSC MERGED CLUSTERS lists multiple URLs for one brand, output **exactly one** row for that cluster (see row count in prompt). Do **not** output separate rows for merged URLs.
- WRONG: three separate product-line review rows for the same brand when URLs were merged.
- RIGHT: **one** row on the cluster lead URL only — modifier **guide** or **explainer** (never product review), title covers all lines in one roundup post.
- A true comparison row (e.g. "System A vs System B: Smart Shades") stays a separate row when its URL is not merged.

Topic clusters (one per core phrase):
- Only ONE row per core topic phrase (product + angle). REJECT pairs like "Benefits of [Product]: Light & Privacy" vs "Best [Product]: Light & Privacy" — same cluster.
- REJECT two Top-Down/Bottom-Up (or any single product type) rows that share the same benefit hook (light, privacy, control) with Best/Benefits/Guide swapped.

Repair / DIY / service cluster (one row per repair topic — critical):
- Only ONE row per repair/fix/mend intent for the same product type (blinds, shades, cords, slats, etc.) in the set you are producing.
- WRONG (cannibalization): "Blind Repair: A DIY Guide for Common Issues" AND "Blinds Repair: When to Call a Pro" — same blind-repair intent; swapping DIY guide vs when-to-call-pro does NOT make two rows.
- WRONG: "Blinds Repair: When to Call a Pro" AND "Blind Repair: Simple Steps at Home" — plural/singular and DIY vs service do not separate the cluster.
- WRONG: two titles that share "repair" + the same product noun (blind/blinds/shade/window covering) with only format words changed (guide, steps, DIY, pro, professional, fix, common issues).
- If multiple GSC URLs imply repair, output repair for at most ONE URL (best match to that URL). For every other repair-flavored URL, pivot to a different verified product line or content type (comparison, explainer, opinion) with a new keyword — not a second repair title.
- Do not use modifier how-to on one row and service on another when both titles still center on repairing the same product.

Title / keyword distinctness (apply before output):
- Changing adjectives (Best, Benefits, Complete, Smart, Master, Versatile) does NOT create a new row if the noun phrase is unchanged.
- Changing the subtitle after a colon does NOT create a new row if the headline topic is unchanged.
- Keywords must not be near-synonyms for the same intent (reordered words, plural, or 1-word swap).

When several GSC URLs imply overlapping intent, choose a clearly different content type (comparison vs how-to vs opinion vs explainer) and a different primary keyword — not adjective stuffing on the same phrase.

Prefer omitting a row over outputting two similar titles.`;

/** Normalize for exact duplicate checks (case/spacing/punctuation). */
export function normalizeDedupeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function significantTokens(value: string): string[] {
  const norm = normalizeDedupeKey(value);
  return norm
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

const TITLE_JACCARD_CANNIBAL_THRESHOLD = 0.58;
export const KEYWORD_JACCARD_CANNIBAL_THRESHOLD = 0.72;

export type BulkDedupeDropReason = "duplicate_title" | "duplicate_keyword" | "cannibal_title" | "cannibal_keyword";

export type BulkDedupeDrop = {
  reason: BulkDedupeDropReason;
  row: BacklinkBlogPitchOption;
  conflictsWith: string;
};

export type GlobalBulkDedupeState = {
  titleKeys: Set<string>;
  keywordKeys: Set<string>;
  titleTokenSets: string[][];
  keywordTokenSets: string[][];
  /** Human-readable values for Gemini exclusion prompts. */
  titlesUsed: string[];
  keywordsUsed: string[];
};

export function createGlobalBulkDedupeState(): GlobalBulkDedupeState {
  return {
    titleKeys: new Set(),
    keywordKeys: new Set(),
    titleTokenSets: [],
    keywordTokenSets: [],
    titlesUsed: [],
    keywordsUsed: [],
  };
}

export function summarizeBulkDedupeDrops(dropped: BulkDedupeDrop[]): string {
  if (!dropped.length) return "";
  const counts: Record<BulkDedupeDropReason, number> = {
    duplicate_title: 0,
    duplicate_keyword: 0,
    cannibal_title: 0,
    cannibal_keyword: 0,
  };
  for (const d of dropped) counts[d.reason] += 1;
  const parts = (Object.entries(counts) as [BulkDedupeDropReason, number][])
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`);
  const samples = dropped
    .slice(0, 3)
    .map((d) => `"${d.row.title}" (${d.reason})`)
    .join("; ");
  return `${dropped.length} row(s) removed (${parts.join(", ")}). Examples: ${samples}`;
}

export function globalExclusionBlockForPrompt(state: GlobalBulkDedupeState, maxEach = 40): string {
  const titles = state.titlesUsed.slice(-maxEach);
  const keywords = state.keywordsUsed.slice(-maxEach);
  if (!titles.length && !keywords.length) return "";
  return `
=== ALREADY USED IN THIS COMBINED EXPORT (FORBIDDEN — NO DUPLICATES / NO CANNIBALIZATION) ===
Do not reuse or lightly rephrase any of these titles or keywords. Do not add another row with the same comparison pair or topic cluster as any title below.
Titles: ${titles.map((t) => `"${t}"`).join(", ") || "(none yet)"}
Keywords: ${keywords.map((k) => `"${k}"`).join(", ") || "(none yet)"}
Each new row must be a clearly different search intent — not the same brands in a vs post, not the same product+benefit phrase with swapped adjectives.
=== END ALREADY USED ===`;
}

function conflictsWithState(
  row: BacklinkBlogPitchOption,
  state: GlobalBulkDedupeState,
): BulkDedupeDrop | null {
  const title = row.title?.trim() ?? "";
  const keyword = row.keyword?.trim() ?? "";
  if (!title || !keyword) return null;

  const titleKey = normalizeDedupeKey(title);
  const keywordKey = normalizeDedupeKey(keyword);
  const titleTokens = significantTokens(title);
  const keywordTokens = significantTokens(keyword);

  if (state.titleKeys.has(titleKey)) {
    const prior =
      state.titlesUsed.find((t) => normalizeDedupeKey(t) === titleKey) ?? title;
    return { reason: "duplicate_title", row, conflictsWith: prior };
  }
  if (state.keywordKeys.has(keywordKey)) {
    const prior =
      state.keywordsUsed.find((k) => normalizeDedupeKey(k) === keywordKey) ?? keyword;
    return { reason: "duplicate_keyword", row, conflictsWith: prior };
  }

  for (let i = 0; i < state.titleTokenSets.length; i++) {
    if (jaccardSimilarity(titleTokens, state.titleTokenSets[i]) >= TITLE_JACCARD_CANNIBAL_THRESHOLD) {
      return {
        reason: "cannibal_title",
        row,
        conflictsWith: state.titlesUsed[i] ?? title,
      };
    }
  }
  for (let i = 0; i < state.keywordTokenSets.length; i++) {
    if (jaccardSimilarity(keywordTokens, state.keywordTokenSets[i]) >= KEYWORD_JACCARD_CANNIBAL_THRESHOLD) {
      return {
        reason: "cannibal_keyword",
        row,
        conflictsWith: state.keywordsUsed[i] ?? keyword,
      };
    }
  }

  return null;
}

function commitRowToState(row: BacklinkBlogPitchOption, state: GlobalBulkDedupeState): void {
  const title = row.title?.trim() ?? "";
  const keyword = row.keyword?.trim() ?? "";
  if (!title || !keyword) return;
  state.titleKeys.add(normalizeDedupeKey(title));
  state.keywordKeys.add(normalizeDedupeKey(keyword));
  state.titleTokenSets.push(significantTokens(title));
  state.keywordTokenSets.push(significantTokens(keyword));
  state.titlesUsed.push(title);
  state.keywordsUsed.push(keyword);
}

/**
 * Keeps first occurrence; drops exact duplicates and near-duplicate (cannibal) title/keyword pairs.
 */
export function filterBannedBulkBenchmarkRows<T extends BacklinkBlogPitchOption>(
  rows: T[],
): T[] {
  return rows.filter((r) => !isBannedBulkBenchmarkTopic(r.keyword, r.title));
}

export function dedupeBulkBenchmarkRows(
  rows: BacklinkBlogPitchOption[],
  state: GlobalBulkDedupeState,
): { rows: BacklinkBlogPitchOption[]; dropped: BulkDedupeDrop[] } {
  const kept: BacklinkBlogPitchOption[] = [];
  const dropped: BulkDedupeDrop[] = [];

  for (const row of rows) {
    if (isBannedBulkBenchmarkTopic(row.keyword, row.title)) {
      continue;
    }
    const conflict = conflictsWithState(row, state);
    if (conflict) {
      dropped.push(conflict);
      continue;
    }
    commitRowToState(row, state);
    kept.push(row);
  }

  return { rows: kept, dropped };
}
