import { gridMemberCanonicalUrl } from "@/lib/sitemap-optimizer/grid-member-url";
import { normalizeGridDestinationKey } from "@/lib/sitemap-optimizer/grid-merge-group-ids";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

/** Generic SEO/title filler — not topic-defining nouns. */
const TOPIC_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "your",
  "you",
  "what",
  "when",
  "how",
  "why",
  "need",
  "know",
  "guide",
  "essential",
  "explained",
  "overview",
  "complete",
  "comprehensive",
  "definitive",
  "boost",
  "maximize",
  "improve",
  "tips",
  "blog",
  "post",
  "article",
]);

const YEAR_TOKEN = /^(?:19|20)\d{2}$/;
const QUARTER_TOKEN = /^q[1-4]$/;

/** Last path segment of the canonical (new) URL. */
export function slugFromCanonicalUrl(url: string): string {
  try {
    const segments = new URL(url.trim()).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  } catch {
    return "";
  }
}

export function slugFromRow(row: SitemapOptimizerPostRow): string {
  return slugFromCanonicalUrl(gridMemberCanonicalUrl(row));
}

/** Slug segments with years and quarter labels removed. */
export function normalizeSlugSegments(slug: string): string[] {
  return slug
    .toLowerCase()
    .split("-")
    .filter((s) => s && !YEAR_TOKEN.test(s) && !QUARTER_TOKEN.test(s));
}

export function topicTokensFromText(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    if (t.length < 2 || TOPIC_STOP_WORDS.has(t) || YEAR_TOKEN.test(t) || QUARTER_TOKEN.test(t)) {
      continue;
    }
    out.push(t);
  }
  return out;
}

export function topicTokenSetForRow(row: SitemapOptimizerPostRow): Set<string> {
  const slug = slugFromRow(row);
  const haystack = [slug.replace(/-/g, " "), row.title ?? "", row.gridTagLabel ?? ""].join(" ");
  return new Set(topicTokensFromText(haystack));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  const union = new Set([...a, ...b]).size;
  return union > 0 ? inter / union : 0;
}

/** General near-duplicate topic detection (slug + title tokens). */
export function areNearDuplicateTopics(
  rowA: SitemapOptimizerPostRow,
  rowB: SitemapOptimizerPostRow,
): boolean {
  const tokensA = topicTokenSetForRow(rowA);
  const tokensB = topicTokenSetForRow(rowB);
  if (!tokensA.size || !tokensB.size) return false;

  const slugA = slugFromRow(rowA);
  const slugB = slugFromRow(rowB);
  const segA = normalizeSlugSegments(slugA);
  const segB = normalizeSlugSegments(slugB);
  if (segA.length >= 2 && segB.length >= 2) {
    const sharedPrefix =
      segA[0] === segB[0] &&
      segA[1] === segB[1] &&
      segA[0].length >= 3 &&
      !/^[a-z]$/.test(segA[1]!);
    if (sharedPrefix) return true;
  }

  let inter = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) inter += 1;
  }
  const minSize = Math.min(tokensA.size, tokensB.size);
  if (minSize >= 3 && inter >= minSize) return true;

  if (inter >= 3 && jaccardSimilarity(tokensA, tokensB) >= 0.55) return true;

  return false;
}

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(i: number): number {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i]!);
    return this.parent[i]!;
  }

  union(i: number, j: number): void {
    const ri = this.find(i);
    const rj = this.find(j);
    if (ri !== rj) this.parent[rj] = ri;
  }
}

function signatureForTokenSet(tokens: Set<string>): string {
  return [...tokens].sort().join("|");
}

/** Assign each redirect-map row a stable topic-group bucket (union-find on near-duplicates). */
export function computeTopicGroupKeysForRedirectMap(
  rows: readonly SitemapOptimizerPostRow[],
): Map<string, string> {
  const out = new Map<string, string>();
  if (!rows.length) return out;

  const uf = new UnionFind(rows.length);
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (areNearDuplicateTopics(rows[i]!, rows[j]!)) uf.union(i, j);
    }
  }

  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < rows.length; i += 1) {
    const root = uf.find(i);
    const list = byRoot.get(root) ?? [];
    list.push(i);
    byRoot.set(root, list);
  }

  let groupIndex = 0;
  for (const indices of byRoot.values()) {
    groupIndex += 1;
    const members = indices.map((i) => rows[i]!);
    let bestTokens = topicTokenSetForRow(members[0]!);
    for (const m of members) {
      const t = topicTokenSetForRow(m);
      if (t.size > bestTokens.size) bestTokens = t;
    }
    let origin = "";
    try {
      origin = new URL(gridMemberCanonicalUrl(members[0]!)).origin;
    } catch {
      origin = "";
    }
    const sig = signatureForTokenSet(bestTokens);
    const key = `${origin}|topic|${sig || `group-${groupIndex}`}`;
    for (const m of members) {
      out.set(m.postId, key);
    }
  }

  return out;
}

/** Bucket for 1:1 coalescing: near-duplicate topic group. */
export function redirectMapClusterBucketKey(
  row: SitemapOptimizerPostRow,
  topicGroupKeys: Map<string, string>,
): string {
  return (
    topicGroupKeys.get(row.postId) ??
    normalizeGridDestinationKey(gridMemberCanonicalUrl(row))
  );
}

export function isMergedTopicGroup(
  row: SitemapOptimizerPostRow,
  topicGroupKeys: Map<string, string>,
): boolean {
  const key = topicGroupKeys.get(row.postId);
  if (!key) return false;
  let count = 0;
  for (const k of topicGroupKeys.values()) {
    if (k === key) count += 1;
    if (count > 1) return true;
  }
  return false;
}

/** One canonical new_url per topic group (fewest slug segments, then shortest slug). */
export function pickCanonicalDestinationUrl(
  members: readonly SitemapOptimizerPostRow[],
): string {
  if (!members.length) return "";
  const ranked = members.map((row) => ({
    url: gridMemberCanonicalUrl(row),
    slug: slugFromRow(row),
    segmentCount: normalizeSlugSegments(slugFromRow(row)).length,
    uploadRow: row.uploadRowIndex ?? Number.MAX_SAFE_INTEGER,
  }));

  ranked.sort((a, b) => {
    if (a.segmentCount !== b.segmentCount) return a.segmentCount - b.segmentCount;
    if (a.slug.length !== b.slug.length) return a.slug.length - b.slug.length;
    return a.uploadRow - b.uploadRow;
  });

  return ranked[0]!.url.trim();
}
