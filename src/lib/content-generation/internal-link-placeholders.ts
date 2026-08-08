/**
 * Internal link placeholders: harness writes [[LINK:query|anchor]], resolver greps sitemap.
 */

import { searchSiteCache } from "@/lib/wordpress-site-cache";
import { scorePostForLinkQuery } from "@/lib/content-generation/link-query-scoring";

export { scorePostForLinkQuery } from "@/lib/content-generation/link-query-scoring";

export const INTERNAL_LINK_PLACEHOLDER_RE = /\[\[LINK:([^|\]]+)\|([^\]]+)\]\]/g;

export type LinkablePost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  link: string;
  date_gmt: string;
};

export type ResolveInternalLinkPlaceholdersOptions = {
  siteId?: string;
  siteUrl: string;
  currentPageUrl?: string;
  wordPressPosts?: LinkablePost[];
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeUrlForMatch(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

function isSelfLink(link: string, currentPageUrl: string | undefined, siteUrl: string): boolean {
  if (!currentPageUrl?.trim()) return false;
  try {
    const base = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
    const normCurrent = normalizeUrlForMatch(
      new URL(currentPageUrl.startsWith("http") ? currentPageUrl : `${new URL(base).origin}${currentPageUrl}`, base).href,
    );
    const normLink = normalizeUrlForMatch(
      new URL(link.startsWith("http") ? link : `${new URL(base).origin}${link.startsWith("/") ? link : `/${link}`}`, base).href,
    );
    return normLink === normCurrent || normLink === `${normCurrent}/` || `${normLink}/` === normCurrent;
  } catch {
    return normalizeUrlForMatch(link) === normalizeUrlForMatch(currentPageUrl);
  }
}

function rankPostsForQuery(
  query: string,
  posts: LinkablePost[],
): Array<{ post: LinkablePost; score: number }> {
  return posts
    .map((post) => ({ post, score: scorePostForLinkQuery(post, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

function buildCandidatesForQuery(
  query: string,
  opts: ResolveInternalLinkPlaceholdersOptions,
): LinkablePost[] {
  const candidates: LinkablePost[] = [];
  const seen = new Set<string>();

  const addUnique = (post: LinkablePost) => {
    const norm = normalizeUrlForMatch(post.link);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    candidates.push(post);
  };

  if (opts.siteId) {
    for (const post of searchSiteCache(opts.siteId, query, 10)) {
      addUnique(post);
    }
  }

  if (opts.wordPressPosts?.length) {
    for (const r of rankPostsForQuery(query, opts.wordPressPosts)) {
      addUnique(r.post);
    }
  }

  return candidates;
}

function pickFirstUsablePost(
  candidates: LinkablePost[],
  opts: ResolveInternalLinkPlaceholdersOptions,
  usedUrls: Set<string>,
): LinkablePost | null {
  for (const post of candidates) {
    if (!post.link?.trim()) continue;
    if (isSelfLink(post.link, opts.currentPageUrl, opts.siteUrl)) continue;
    const norm = normalizeUrlForMatch(post.link);
    if (usedUrls.has(norm)) continue;
    return post;
  }
  return null;
}

function pickPostForSingleQuery(
  query: string,
  opts: ResolveInternalLinkPlaceholdersOptions,
  usedUrls: Set<string>,
): LinkablePost | null {
  const fromCandidates = pickFirstUsablePost(buildCandidatesForQuery(query, opts), opts, usedUrls);
  if (fromCandidates) return fromCandidates;

  if (opts.wordPressPosts?.length) {
    return pickFirstUsablePost(
      rankPostsForQuery(query, opts.wordPressPosts).map((r) => r.post),
      opts,
      usedUrls,
    );
  }

  return null;
}

function pickPostForQuery(
  query: string,
  anchor: string,
  opts: ResolveInternalLinkPlaceholdersOptions,
  usedUrls: Set<string>,
): LinkablePost | null {
  const queries = [query.trim()];
  const anchorTrim = anchor.trim();
  if (anchorTrim && anchorTrim !== query.trim()) {
    queries.push(anchorTrim);
  }

  for (const q of queries) {
    if (!q) continue;
    const post = pickPostForSingleQuery(q, opts, usedUrls);
    if (post) return post;
  }

  return null;
}

export function resolveInternalLinkPlaceholdersInHtml(
  html: string,
  opts: ResolveInternalLinkPlaceholdersOptions,
): string {
  if (!html?.trim()) return html;

  const usedUrls = new Set<string>();
  const re = new RegExp(INTERNAL_LINK_PLACEHOLDER_RE.source, "g");

  return html.replace(re, (full, rawQuery: string, rawAnchor: string) => {
    const query = rawQuery.trim();
    const anchor = rawAnchor.trim();
    if (!query || !anchor) {
      console.warn("[Internal link placeholders] Empty query or anchor; stripping token:", full);
      return escapeHtml(anchor || query);
    }

    const post = pickPostForQuery(query, anchor, opts, usedUrls);
    if (!post?.link?.trim()) {
      console.warn("[Internal link placeholders] No sitemap match for query:", query);
      return escapeHtml(anchor);
    }

    usedUrls.add(normalizeUrlForMatch(post.link));
    return `<a href="${post.link.trim()}">${escapeHtml(anchor)}</a>`;
  });
}

export function resolveInternalLinkPlaceholdersInMarkdown(
  markdown: string,
  opts: ResolveInternalLinkPlaceholdersOptions,
): string {
  if (!markdown?.trim()) return markdown;

  const usedUrls = new Set<string>();
  const re = new RegExp(INTERNAL_LINK_PLACEHOLDER_RE.source, "g");

  return markdown.replace(re, (full, rawQuery: string, rawAnchor: string) => {
    const query = rawQuery.trim();
    const anchor = rawAnchor.trim();
    if (!query || !anchor) {
      console.warn("[Internal link placeholders] Empty query or anchor; stripping token:", full);
      return anchor || query;
    }

    const post = pickPostForQuery(query, anchor, opts, usedUrls);
    if (!post?.link?.trim()) {
      console.warn("[Internal link placeholders] No sitemap match for query:", query);
      return anchor;
    }

    usedUrls.add(normalizeUrlForMatch(post.link));
    const safeAnchor = anchor.replace(/[\[\]()]/g, "");
    return `[${safeAnchor}](${post.link.trim()})`;
  });
}

/** Harness / checklist copy for placeholder-based internal links. */
export const INTERNAL_LINK_PLACEHOLDER_PROMPT_BLOCK = `=== INTERNAL LINK PLACEHOLDERS (body sections — NOT Overview) ===
Use 3–5 internal link slots per non-Overview section, woven into sentences.
Format (exact): [[LINK:sitemap search phrase|anchor text]]
- sitemap search phrase = topic words to match a site page (e.g. "employment expenses checklist", "BC PST registration")
- anchor text = 2–4 word natural phrase (not the full page title)
Examples: [[LINK:employment expenses checklist|employment expense rules]], [[LINK:Alberta productivity grant|productivity grant program]]
FORBIDDEN in body sections: raw https:// internal URLs (Overview uses # anchors only; Semrush uses approved externals only).
URLs are resolved from the site sitemap after generation — do not invent URLs.
=== END INTERNAL LINK PLACEHOLDERS ===`;

export const INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX =
  "3–5 [[LINK:query|anchor]] placeholders per section (no raw https:// internal URLs)";