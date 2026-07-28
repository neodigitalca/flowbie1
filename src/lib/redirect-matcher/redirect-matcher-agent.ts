import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { urlPathTail } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import { urlsDiffer } from "@/lib/url-optimizer/build-optimized-url";
import {
  REDIRECT_MATCHER_AGENT_MAX_TOKENS,
  REDIRECT_MATCHER_BATCH_CHUNK_SIZE,
} from "@/lib/redirect-matcher/constants";
import { parseRedirectMatcherAgentBatchJson } from "@/lib/redirect-matcher/redirect-matcher-parse";
import type {
  BlogCatalogEntry,
  LegacyEnrichedRow,
  RedirectMatcherProposal,
  RedirectMatcherResultRow,
} from "@/lib/redirect-matcher/types";

const REDIRECT_MATCHER_SYSTEM = `You are a senior SEO strategist matching legacy WordPress URLs to specific upgraded blog post URLs.

You receive a batch of legacy URLs and the site's live blog catalog. Read every legacy title, keyword, slug, and excerpt. Read every catalog title, keyword, and slug. Return semantic matches in one JSON response.

Hard rules:
- requiredCount is exact. Return exactly that many objects in matches[].
- Every legacyUrl from allowedLegacyUrls appears exactly once.
- matchedBlogUrl MUST be a specific post URL from allowedBlogUrls (copy the string exactly).
- Legacy date-archive URLs like /2017/06/13/slug-name/ almost always map to the catalog post whose slug matches slug-name under /blog/.
- Match by topic, keyword, title, and slug — not by upload order.
- Multiple legacy URLs may map to the same blog post.
- Use blogIndexUrl ONLY when no catalog post is even loosely related to that legacy URL.
- Never default every row to blogIndexUrl. Most legacy posts have a specific catalog successor.
- matchedBlogUrl must differ from legacyUrl.
- rationale: one short sentence.
- Return ONLY valid JSON (no markdown fences).`;

function normalizeUrlKey(url: string): string {
  return normalizePageUrlKey(url);
}

function blogIndexUrl(legacyUrl: string): string {
  try {
    const u = new URL(legacyUrl.trim());
    return `${u.origin}/blog/`;
  } catch {
    return "";
  }
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

function buildLegacyCatalogEntry(row: LegacyEnrichedRow) {
  return {
    legacyUrl: row.legacyUrl,
    title: row.title,
    focusKeyword: row.focusKeyword,
    meta: row.meta,
    slugTitle: row.slugTitle,
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
  };
}

function buildBlogCatalogPayload(catalog: BlogCatalogEntry[]) {
  return catalog.map((entry) => ({
    url: entry.url,
    title: entry.title,
    focusKeyword: entry.focusKeyword,
    slug: entry.slug,
  }));
}

function pathnameKey(url: string): string {
  try {
    let path = new URL(url.trim()).pathname.replace(/\/+/g, "/").toLowerCase();
    if (!path.endsWith("/")) path += "/";
    return path;
  } catch {
    return "";
  }
}

function resolveMatchedBlogUrl(
  raw: string,
  catalog: BlogCatalogEntry[],
  blogIndex: string,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const rawKey = normalizeUrlKey(trimmed);
  for (const entry of catalog) {
    if (normalizeUrlKey(entry.url) === rawKey) return entry.url;
  }
  if (blogIndex && normalizeUrlKey(blogIndex) === rawKey) return blogIndex;

  const rawPath = pathnameKey(trimmed);
  if (rawPath) {
    for (const entry of catalog) {
      if (pathnameKey(entry.url) === rawPath) return entry.url;
    }
  }

  const rawSlug = urlPathTail(trimmed).toLowerCase();
  if (rawSlug) {
    for (const entry of catalog) {
      const entrySlug = (entry.slug || urlPathTail(entry.url)).toLowerCase();
      if (entrySlug === rawSlug) return entry.url;
    }
  }

  return null;
}

function blogFallbackProposal(row: LegacyEnrichedRow): RedirectMatcherProposal {
  return {
    legacyUrl: row.legacyUrl,
    matchedBlogUrl: blogIndexUrl(row.legacyUrl),
    rationale: "No catalog match; default /blog/ redirect.",
  };
}

function adoptProposal(
  proposal: RedirectMatcherProposal,
  allowedLegacyUrls: string[],
  catalog: BlogCatalogEntry[],
  blogIndex: string,
): RedirectMatcherProposal | null {
  const legacyByKey = new Map(allowedLegacyUrls.map((u) => [normalizeUrlKey(u), u]));
  const legacyKey = normalizeUrlKey(proposal.legacyUrl);
  const legacyUrl = legacyByKey.get(legacyKey);
  if (!legacyUrl) return null;

  const matchedBlogUrl = resolveMatchedBlogUrl(proposal.matchedBlogUrl, catalog, blogIndex);
  if (!matchedBlogUrl) return null;
  if (!urlsDiffer(legacyUrl, matchedBlogUrl)) return null;

  return {
    legacyUrl,
    matchedBlogUrl,
    rationale: proposal.rationale,
  };
}

async function matchLegacyChunk(
  legacyRows: LegacyEnrichedRow[],
  catalog: BlogCatalogEntry[],
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<Map<string, RedirectMatcherProposal>> {
  const legacyCatalog = legacyRows.map(buildLegacyCatalogEntry);
  const blogCatalog = buildBlogCatalogPayload(catalog);
  const allowedLegacyUrls = legacyRows.map((r) => r.legacyUrl);
  const blogIndex = blogIndexUrl(legacyRows[0]!.legacyUrl);
  const allowedBlogUrls = [
    ...new Set([...blogCatalog.map((c) => c.url), ...(blogIndex ? [blogIndex] : [])]),
  ];

  const user = JSON.stringify({
    task: "redirect_matcher_batch",
    requiredCount: legacyCatalog.length,
    blogIndexUrl: blogIndex,
    allowedLegacyUrls,
    allowedBlogUrls,
    legacyCatalog,
    blogCatalog,
    outputSchema: {
      matches: [
        {
          legacyUrl: "string (exact URL from allowedLegacyUrls)",
          matchedBlogUrl: "string (exact URL from allowedBlogUrls)",
          rationale: "string",
        },
      ],
    },
  });

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model,
    system: REDIRECT_MATCHER_SYSTEM,
    user,
    maxTokens: REDIRECT_MATCHER_AGENT_MAX_TOKENS,
    temperature: 0.15,
    responseFormat: { type: "json_object" },
    signal,
  });

  const byLegacy = new Map<string, RedirectMatcherProposal>();
  const parsed = parseRedirectMatcherAgentBatchJson(content);

  for (const p of parsed) {
    const valid = adoptProposal(p, allowedLegacyUrls, catalog, blogIndex);
    if (!valid) continue;
    byLegacy.set(normalizeUrlKey(valid.legacyUrl), valid);
  }

  return byLegacy;
}

export async function runRedirectMatcherAgent(args: {
  legacyRows: LegacyEnrichedRow[];
  catalog: BlogCatalogEntry[];
  apiKey: string;
  siteId: string;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number, detail?: string) => void;
}): Promise<RedirectMatcherResultRow[]> {
  const { legacyRows, catalog, apiKey, siteId, signal, onProgress } = args;
  if (!legacyRows.length) return [];

  const model = getResearchModel(siteId);
  const byLegacy = new Map<string, RedirectMatcherProposal>();
  const chunks = chunkRows(legacyRows, REDIRECT_MATCHER_BATCH_CHUNK_SIZE);
  let chunksDone = 0;

  onProgress?.(0, legacyRows.length, `Matching ${legacyRows.length} URLs (${chunks.length} parallel batches)`);

  if (catalog.length > 0) {
    const chunkResults = await Promise.all(
      chunks.map(async (chunk, index) => {
        try {
          return await matchLegacyChunk(chunk, catalog, apiKey, model, signal);
        } catch {
          return new Map<string, RedirectMatcherProposal>();
        } finally {
          chunksDone += 1;
          onProgress?.(
            Math.min(chunksDone * REDIRECT_MATCHER_BATCH_CHUNK_SIZE, legacyRows.length),
            legacyRows.length,
            `Batch ${chunksDone} / ${chunks.length}`,
          );
        }
      }),
    );

    for (const chunkMap of chunkResults) {
      for (const [key, proposal] of chunkMap) {
        byLegacy.set(key, proposal);
      }
    }
  }

  for (const row of legacyRows) {
    const key = normalizeUrlKey(row.legacyUrl);
    if (!byLegacy.has(key)) {
      byLegacy.set(key, blogFallbackProposal(row));
    }
  }

  const blogByUrl = new Map(catalog.map((c) => [normalizeUrlKey(c.url), c]));

  const results: RedirectMatcherResultRow[] = legacyRows.map((row) => {
    const proposal = byLegacy.get(normalizeUrlKey(row.legacyUrl))!;
    const blog = blogByUrl.get(normalizeUrlKey(proposal.matchedBlogUrl));
    return {
      ...row,
      matchedBlogUrl: proposal.matchedBlogUrl,
      matchedBlogKeyword: blog?.focusKeyword ?? "",
      rationale: proposal.rationale,
    };
  });

  onProgress?.(legacyRows.length, legacyRows.length, `Matched ${legacyRows.length} / ${legacyRows.length}`);
  return results.sort((a, b) => a.uploadRow - b.uploadRow);
}
