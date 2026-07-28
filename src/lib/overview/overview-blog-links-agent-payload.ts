import { normalizeFocusKeywordPhrase } from "@/lib/seo-redirect-csv";
import { urlPathTail } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import type { BlogLinkCandidate } from "@/lib/overview/overview-blog-links-catalog";
import type { BlogLinksSiteLinkPool } from "@/lib/overview/overview-blog-links-inventory";
import type { LinkInventoryBucket } from "@/lib/overview/overview-blog-links-bucket";
import type { BlogLinksPlanResult } from "@/lib/overview/overview-blog-links-agent";
import { linkUrlEqual } from "@/lib/overview/overview-blog-links-plan-filter";
import { normalizeInternalUrl } from "@/lib/wordpress-api/validate-internal-links";

export type SlimLinkCandidate = {
  url: string;
  title: string;
  focusKeyword?: string;
  bucket: LinkInventoryBucket;
  slug: string;
};

function keywordKey(raw: string): string {
  return normalizeFocusKeywordPhrase(raw).toLowerCase();
}

function poolItems(
  pool: BlogLinksSiteLinkPool,
  choice?: "post" | "page",
): SlimLinkCandidate[] {
  if (choice === "post") return pool.postInventory;
  if (choice === "page") return pool.pageInventory;
  return [...pool.postInventory, ...pool.pageInventory];
}

/** Compressed keyword lines for OpenRouter (GSC + scored pool, min 20 lines). */
export function keywordCandidatesForAnchor(
  anchor: string,
  pool: BlogLinksSiteLinkPool,
  gscHeadingKeywords: string[] = [],
  limit = 50,
): string {
  const scored: Array<{ kw: string; score: number }> = [];
  const seen = new Set<string>();

  const push = (kw: string, score: number) => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    const k = keywordKey(trimmed);
    if (!k || seen.has(k)) return;
    seen.add(k);
    scored.push({ kw: trimmed, score });
  };

  for (const gsc of gscHeadingKeywords) {
    push(gsc, 200);
  }

  const anchorKey = keywordKey(anchor);
  const tokens = anchorKey.split(" ").filter((t) => t.length > 2);

  for (const item of poolItems(pool)) {
    const kw = (item.focusKeyword ?? "").trim();
    if (!kw) continue;
    const hay = `${keywordKey(kw)} ${keywordKey(item.slug)} ${keywordKey(item.title)}`;
    let score = 0;
    for (const t of tokens) {
      if (hay.includes(t)) score += 15;
    }
    if (anchorKey.length >= 4 && (hay.includes(anchorKey) || anchorKey.includes(keywordKey(kw)))) {
      score += 25;
    }
    if (score > 0) push(kw, score);
  }

  scored.sort((a, b) => b.score - a.score);

  if (scored.length < 20) {
    for (const item of poolItems(pool, "post")) {
      const kw = (item.focusKeyword ?? "").trim();
      if (!kw) continue;
      push(kw, 1);
      if (scored.length >= limit) break;
    }
  }

  return scored
    .slice(0, limit)
    .map((s) => s.kw)
    .join("\n");
}

/** Resolve add-intent keyword to destination URL (post, then page). */
export function resolveAddKeywordToUrl(
  keyword: string,
  pool: BlogLinksSiteLinkPool,
  siteUrl: string,
): string {
  const kw = keyword.trim();
  if (!kw || !siteUrl.trim()) return "";
  return (
    resolveKeywordToPoolUrl(kw, pool, "post", siteUrl) ||
    resolveKeywordToPoolUrl(kw, pool, "page", siteUrl)
  );
}

/** WordPress clone slugs: ...-2, ...-3, ...-2-2, etc. (not ...-1). */
export function isNumberedSlugDuplicateHref(href: string): boolean {
  const slug = urlPathTail(href).toLowerCase();
  const suffix = slug.match(/(?:-\d+)+$/);
  if (!suffix) return false;
  return suffix[0]
    .split("-")
    .filter(Boolean)
    .some((seg) => {
      const n = Number(seg);
      return Number.isInteger(n) && n >= 2 && n <= 99;
    });
}

/** Drop keyword lines that resolve to numbered slug clone URLs (prompt sheet only). */
export function keywordCandidatesExcludingNumberedSlugDuplicates(
  keywordLines: string,
  pool: BlogLinksSiteLinkPool,
  siteUrl: string,
): string {
  if (!keywordLines.trim() || !siteUrl.trim()) return keywordLines;

  const kept: string[] = [];
  for (const line of keywordLines.split("\n")) {
    const kw = line.trim();
    if (!kw) continue;
    const url = resolveAddKeywordToUrl(kw, pool, siteUrl);
    if (!url || isNumberedSlugDuplicateHref(url)) continue;
    kept.push(kw);
  }
  return kept.join("\n");
}

/** Drop keyword lines that resolve to the article's own URL (prompt sheet only). */
export function keywordCandidatesExcludingSelfUrl(
  keywordLines: string,
  pool: BlogLinksSiteLinkPool,
  siteUrl: string,
  pageUrl: string,
): string {
  if (!keywordLines.trim() || !siteUrl.trim() || !pageUrl.trim()) return keywordLines;

  const selfNorm = normalizeInternalUrl(siteUrl, pageUrl);
  if (!selfNorm) return keywordLines;

  const kept: string[] = [];
  for (const line of keywordLines.split("\n")) {
    const kw = line.trim();
    if (!kw) continue;
    const url = resolveAddKeywordToUrl(kw, pool, siteUrl);
    if (!url) continue;
    const norm = normalizeInternalUrl(siteUrl, url);
    if (linkUrlEqual(norm, selfNorm)) continue;
    kept.push(kw);
  }
  return kept.join("\n");
}

/** Prompt sheet: unused destinations, no numbered slug clones, no self-links. */
export function availableCandidateKeywordsForIntent(
  keywordLines: string,
  pool: BlogLinksSiteLinkPool,
  siteUrl: string,
  forbiddenDestinationUrls: string[],
  pageUrl: string,
): string {
  const withoutUsed = keywordCandidatesExcludingUsedUrls(
    keywordLines,
    pool,
    siteUrl,
    forbiddenDestinationUrls,
  );
  const withoutClones = keywordCandidatesExcludingNumberedSlugDuplicates(withoutUsed, pool, siteUrl);
  return keywordCandidatesExcludingSelfUrl(withoutClones, pool, siteUrl, pageUrl);
}

/** Drop keyword lines that resolve to URLs already linked in this article (prompt sheet only). */
export function keywordCandidatesExcludingUsedUrls(
  keywordLines: string,
  pool: BlogLinksSiteLinkPool,
  siteUrl: string,
  usedDestinationUrls: string[],
): string {
  if (!keywordLines.trim() || !siteUrl.trim()) return keywordLines;
  if (!usedDestinationUrls.length) return keywordLines;

  const kept: string[] = [];
  for (const line of keywordLines.split("\n")) {
    const kw = line.trim();
    if (!kw) continue;
    const url = resolveAddKeywordToUrl(kw, pool, siteUrl);
    if (!url) continue;
    const norm = normalizeInternalUrl(siteUrl, url);
    const taken = usedDestinationUrls.some((used) => linkUrlEqual(used, norm));
    if (!taken) kept.push(kw);
  }
  return kept.join("\n");
}

function findPoolUrlByPhrase(
  phrase: string,
  pool: BlogLinksSiteLinkPool,
  choice: "post" | "page" | undefined,
  siteUrl: string,
  excludeHref?: string,
): string {
  const key = keywordKey(phrase);
  if (!key) return "";
  const excludeNorm = excludeHref ? normalizeInternalUrl(siteUrl, excludeHref) : "";

  for (const item of poolItems(pool, choice)) {
    const norm = normalizeInternalUrl(siteUrl, item.url);
    if (!norm) continue;
    if (excludeNorm && linkUrlEqual(norm, excludeNorm)) continue;
    const itemKw = keywordKey(item.focusKeyword ?? "");
    const itemSlug = keywordKey(item.slug.replace(/-/g, " "));
    const itemTitle = keywordKey(item.title);
    if (itemKw === key || itemSlug === key || itemTitle === key) return item.url;
    if (key.length >= 4 && (itemKw.includes(key) || key.includes(itemKw))) return item.url;
    if (key.length >= 4 && (itemSlug.includes(key) || key.includes(itemSlug))) return item.url;
  }
  return "";
}

/** Resolve model proposedKeyword to full URL using cached pool. */
export function resolveKeywordToPoolUrl(
  keyword: string,
  pool: BlogLinksSiteLinkPool,
  choice?: "post" | "page",
  siteUrl?: string,
  excludeHref?: string,
): string {
  const postByKw = new Map<string, string>();
  const pageByKw = new Map<string, string>();
  for (const item of pool.postInventory) {
    const kw = keywordKey(item.focusKeyword ?? "");
    if (kw && !postByKw.has(kw)) postByKw.set(kw, item.url);
  }
  for (const item of pool.pageInventory) {
    const kw = keywordKey(item.focusKeyword ?? "");
    if (kw && !pageByKw.has(kw)) pageByKw.set(kw, item.url);
  }
  const kw = keywordKey(keyword);
  let url = "";
  if (choice === "page") url = pageByKw.get(kw) ?? postByKw.get(kw) ?? "";
  else if (choice === "post") url = postByKw.get(kw) ?? pageByKw.get(kw) ?? "";
  else url = postByKw.get(kw) ?? pageByKw.get(kw) ?? "";

  if (!url && siteUrl) {
    url = findPoolUrlByPhrase(keyword, pool, choice, siteUrl, excludeHref);
  }

  if (!url) return "";
  if (siteUrl && excludeHref) {
    const norm = normalizeInternalUrl(siteUrl, url);
    const excludeNorm = normalizeInternalUrl(siteUrl, excludeHref);
    if (excludeNorm && linkUrlEqual(norm, excludeNorm)) return "";
  }
  return url;
}

export function resolveReplaceDestination(
  anchor: string,
  proposedKeyword: string,
  choice: "post" | "page" | undefined,
  pool: BlogLinksSiteLinkPool,
  siteUrl: string,
  excludeHref?: string,
): string {
  const fromProposed = resolveKeywordToPoolUrl(proposedKeyword, pool, choice, siteUrl, excludeHref);
  if (fromProposed) return fromProposed;
  const fromAnchor = resolveKeywordToPoolUrl(anchor, pool, choice, siteUrl, excludeHref);
  if (fromAnchor) return fromAnchor;
  return (
    findPoolUrlByPhrase(proposedKeyword, pool, choice, siteUrl, excludeHref) ||
    findPoolUrlByPhrase(anchor, pool, choice, siteUrl, excludeHref)
  );
}

/** Resolve model proposedKeyword to full URL using cached pool. */
export function resolvePlanKeywordsFromPool(
  plan: BlogLinksPlanResult,
  pool: BlogLinksSiteLinkPool,
): BlogLinksPlanResult {
  return {
    linkActions: plan.linkActions.map((a) => {
      const raw = a.proposedUrl.trim();
      if (!raw) return a;
      if (raw.startsWith("http://") || raw.startsWith("https://")) return a;
      const resolved = resolveKeywordToPoolUrl(raw, pool);
      if (!resolved) return a;
      return { ...a, proposedUrl: resolved };
    }),
  };
}

export function slimLinkCandidatesForAgent(candidates: BlogLinkCandidate[]): SlimLinkCandidate[] {
  return candidates.map(({ url, title, focusKeyword, bucket }) => ({
    url,
    title,
    focusKeyword,
    bucket,
    slug: urlPathTail(url),
  }));
}

export function splitSlimCandidatesByBucket(candidates: BlogLinkCandidate[]): {
  post: SlimLinkCandidate[];
  page: SlimLinkCandidate[];
} {
  const slim = slimLinkCandidatesForAgent(candidates);
  return {
    post: slim.filter((c) => c.bucket === "post"),
    page: slim.filter((c) => c.bucket === "page"),
  };
}
