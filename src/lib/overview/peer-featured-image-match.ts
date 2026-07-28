/**
 * Word-order-insensitive keyword matching for peer blog featured image reuse.
 * Deterministic token-set scoring (no regex, no LLM): the requirement is
 * mechanical "same words, any order" matching between blog keywords/titles.
 */

/** Collapse whitespace/punctuation separators; lowercase; trim. No regex. */
export function normalizeKeywordMatchKey(value: string): string {
  const raw = String(value ?? "").trim().toLowerCase();
  let out = "";
  let space = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!;
    const isSeparator =
      ch === " " ||
      ch === "\t" ||
      ch === "\n" ||
      ch === "\r" ||
      ch === "-" ||
      ch === "_" ||
      ch === "/" ||
      ch === "," ||
      ch === "." ||
      ch === ":" ||
      ch === ";" ||
      ch === "|" ||
      ch === "(" ||
      ch === ")" ||
      ch === "'" ||
      ch === '"' ||
      ch === "&" ||
      ch === "?" ||
      ch === "!";
    if (isSeparator) {
      space = true;
      continue;
    }
    if (space && out.length > 0) out += " ";
    space = false;
    out += ch;
  }
  return out;
}

const KEYWORD_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "at",
  "for",
  "to",
  "with",
  "your",
  "our",
  "is",
  "are",
  "near",
  "me",
]);

/** Significant tokens: normalized, stopwords dropped (all-stopword input keeps raw tokens). */
export function keywordMatchTokens(value: string): string[] {
  const normalized = normalizeKeywordMatchKey(value);
  if (!normalized) return [];
  const rawTokens = normalized.split(" ").filter(Boolean);
  const significant = rawTokens.filter((t) => !KEYWORD_STOPWORDS.has(t));
  return significant.length ? significant : rawTokens;
}

export type KeywordWordOrderMatch = {
  match: boolean;
  /** 3 = same token set (any order); 2 = candidate contains every target token; 1 = Jaccard >= 0.6. */
  score: number;
};

const JACCARD_MIN = 0.6;

function tokenSet(tokens: string[]): Set<string> {
  return new Set(tokens);
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const t of a) {
    if (!b.has(t)) return false;
  }
  return true;
}

function containsAll(haystack: Set<string>, needles: Set<string>): boolean {
  for (const t of needles) {
    if (!haystack.has(t)) return false;
  }
  return true;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Score how well `candidate` (a peer blog keyword or title) matches `target`
 * (the new row's keyword), ignoring word order.
 */
export function scoreKeywordWordOrderMatch(
  candidate: string,
  target: string,
): KeywordWordOrderMatch {
  const targetTokens = tokenSet(keywordMatchTokens(target));
  const candidateTokens = tokenSet(keywordMatchTokens(candidate));
  if (!targetTokens.size || !candidateTokens.size) {
    return { match: false, score: 0 };
  }
  if (setsEqual(candidateTokens, targetTokens)) {
    return { match: true, score: 3 };
  }
  if (containsAll(candidateTokens, targetTokens)) {
    return { match: true, score: 2 };
  }
  if (jaccard(candidateTokens, targetTokens) >= JACCARD_MIN) {
    return { match: true, score: 1 };
  }
  return { match: false, score: 0 };
}

/**
 * Best word-order match for a peer row: keyword field first, then title.
 * Keyword matches outrank title matches at equal score.
 */
export function scorePeerRowKeywordMatch(
  row: { keyword?: string; title?: string },
  target: string,
): { match: boolean; score: number; matchedOn: "keyword" | "title" | null; matchedText: string } {
  const keyword = (row.keyword ?? "").trim();
  const title = (row.title ?? "").trim();
  const kwMatch = keyword ? scoreKeywordWordOrderMatch(keyword, target) : { match: false, score: 0 };
  const titleMatch = title ? scoreKeywordWordOrderMatch(title, target) : { match: false, score: 0 };
  if (kwMatch.match && kwMatch.score >= titleMatch.score) {
    return { match: true, score: kwMatch.score, matchedOn: "keyword", matchedText: keyword };
  }
  if (titleMatch.match) {
    return { match: true, score: titleMatch.score, matchedOn: "title", matchedText: title };
  }
  return { match: false, score: 0, matchedOn: null, matchedText: "" };
}
