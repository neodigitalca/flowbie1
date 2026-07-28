import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { urlPathTail } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import {
  LEGACY_REDIRECT_MATCH_BATCH_CONCURRENCY,
  LEGACY_REDIRECT_MATCH_BATCH_LINE_SIZE,
} from "@/lib/sitemap-optimizer/constants";
import {
  parseLegacyRedirectMatchAgentJson,
  type LegacyRedirectMatchProposal,
} from "@/lib/sitemap-optimizer/legacy-redirect-match-parse";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import {
  legacyRedirectLegacyMatchKey,
  resolveLegacyRedirectSiteDomainUrl,
} from "@/lib/sitemap-optimizer/legacy-redirect-grid-rows";
import {
  filterWordPressNumberedSlugDuplicates,
  isWordPressNumberedSlugDuplicate,
} from "@/lib/sitemap-optimizer/wordpress-numbered-slug-duplicate";
import {
  normalizeRankMathRelativePath,
  rankMathSourceFromPageUrl,
} from "@/lib/rank-math-redirect-csv";
import type { LegacyRedirectBatchProgress, LegacyRedirectMatchRow } from "@/lib/sitemap-optimizer/types";
import { urlsDiffer } from "@/lib/url-optimizer/build-optimized-url";
import type { SitePostInventoryKbPayload } from "@/lib/wordpress-api/types";

const LEGACY_REDIRECT_URL_AGENT_SYSTEM = `You are a senior SEO URL redirect agent.

You receive a batch of legacy URLs and the site's full published WordPress inventory (posts and pages).

Your job:
1. Return exactly one matches[] row for every URL in allowedLegacyUrls.
2. requiredCount is exact. matches.length MUST equal requiredCount.
3. Every allowedLegacyUrls entry appears exactly once as legacyUrl.
4. For each legacy URL, pick the single best destinationUrl from allowedDestinationUrls by search intent and topic (title, keyword, slug, excerpt in siteInventory).
5. Legacy date-archive URLs like /2017/06/13/slug-name/ almost always map to the inventory post whose slug contains or matches slug-name under /blog/.
6. Match by topic, keyword, title, and slug. Prefer the closest specific page or post every time.
7. Use blogIndexUrl ONLY when no inventory page is even loosely related AND the legacy URL is pagination, a blog listing page, wp-*.php, wp-content asset, or otherwise has no content value.
8. Never default rows to blogIndexUrl. Most legacy URLs have a specific inventory successor.
9. Staff or bio paths (e.g. /darren-buma/) should map to the matching team or about page when one exists in inventory.
10. destinationUrl MUST be copied exactly from allowedDestinationUrls.
11. Never use numbered WordPress clone slugs (-2, -3, -2-2, -2-2-3, etc.). Those URLs are not in allowedDestinationUrls.
12. destinationUrl must differ from legacyUrl. Never return legacyUrl as destinationUrl.
13. Return ONLY valid JSON (no markdown fences).`;

function slimSiteInventoryForLegacyMatch(siteInventory: SitePostInventoryKbPayload) {
  return {
    site: siteInventory.site,
    posts: siteInventory.posts.map((post) => ({
      url: post.url,
      slug: post.slug ?? "",
      title: post.fields.title ?? "",
      keyword: post.fields.keyword ?? "",
      excerpt: post.fields.excerpt ?? "",
    })),
  };
}

function isHttpUrl(url: string): boolean {
  try {
    const protocol = new URL(url.trim()).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function resolveLegacyUrl(raw: string, siteBaseUrl?: string): string {
  const trimmed = raw.trim();
  if (isHttpUrl(trimmed)) return trimmed;
  const path = normalizeRankMathRelativePath(trimmed);
  if (!path) return trimmed;
  const base = siteBaseUrl?.trim();
  if (!base) return trimmed;
  try {
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    return new URL(path, normalizedBase).href;
  } catch {
    return trimmed;
  }
}

function pathnameKey(url: string): string {
  try {
    let path = new URL(url.trim()).pathname.replace(/\/+/g, "/").toLowerCase();
    if (!path.endsWith("/")) path += "/";
    return path;
  } catch {
    const path =
      rankMathSourceFromPageUrl(url) ||
      normalizeRankMathRelativePath(url) ||
      "";
    if (!path) return "";
    const withSlash = path.startsWith("/") ? path : `/${path}`;
    return withSlash.endsWith("/") ? withSlash.toLowerCase() : `${withSlash.toLowerCase()}/`;
  }
}

/** Legacy URL is already the blog index; no 301 needed. */
export function isNonRedirectLegacyUrl(legacyUrl: string, blogIndexUrl: string): boolean {
  return !legacyUrlsDiffer(legacyUrl, blogIndexUrl);
}

function resolveCanonicalInventoryDestination(
  legacyUrl: string,
  destinationByKey: Map<string, string>,
): string | null {
  const key = normalizePageUrlKey(legacyUrl);
  const byKey = destinationByKey.get(key);
  if (byKey && !isWordPressNumberedSlugDuplicate(byKey)) return byKey;
  const path = pathnameKey(legacyUrl);
  if (!path) return null;
  for (const dest of destinationByKey.values()) {
    if (isWordPressNumberedSlugDuplicate(dest)) continue;
    if (pathnameKey(dest) === path) return dest;
  }
  return null;
}

function legacyUrlsDiffer(legacyUrl: string, destinationUrl: string): boolean {
  if (isHttpUrl(legacyUrl) && isHttpUrl(destinationUrl)) {
    return urlsDiffer(legacyUrl, destinationUrl);
  }
  const legacyKey = legacyRedirectLegacyMatchKey(legacyUrl);
  const destPath =
    legacyRedirectLegacyMatchKey(destinationUrl) ||
    rankMathSourceFromPageUrl(destinationUrl) ||
    normalizeRankMathRelativePath(destinationUrl) ||
    "";
  return legacyKey !== destPath.toLowerCase();
}

function resolveDestinationUrl(
  raw: string,
  destinationByKey: Map<string, string>,
  blogIndexUrl: string,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const byKey = destinationByKey.get(normalizePageUrlKey(trimmed));
  if (byKey && !isWordPressNumberedSlugDuplicate(byKey)) return byKey;

  if (blogIndexUrl && normalizePageUrlKey(trimmed) === normalizePageUrlKey(blogIndexUrl)) {
    return blogIndexUrl;
  }

  const path = pathnameKey(trimmed);
  if (path) {
    for (const url of destinationByKey.values()) {
      if (isWordPressNumberedSlugDuplicate(url)) continue;
      if (pathnameKey(url) === path) return url;
    }
    if (blogIndexUrl && pathnameKey(blogIndexUrl) === path) return blogIndexUrl;
  }

  const slug = urlPathTail(trimmed).toLowerCase();
  if (slug) {
    for (const url of destinationByKey.values()) {
      if (isWordPressNumberedSlugDuplicate(url)) continue;
      if (urlPathTail(url).toLowerCase() === slug) return url;
    }
  }

  return null;
}

function legacyPathSlug(legacyUrl: string): string {
  const path = pathnameKey(legacyUrl);
  const segments = path.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
  if (!segments.length) return "";
  let index = segments.length - 1;
  while (index >= 0 && /^\d+$/.test(segments[index]!)) index -= 1;
  return segments[index]?.toLowerCase() ?? "";
}

function isPaginationOrThinLegacyUrl(legacyUrl: string): boolean {
  const path = pathnameKey(legacyUrl);
  if (path === "/blogs/" || /\/blogs\/\d+\//.test(path)) return true;
  if (/\/page\/\d+\//.test(path)) return true;
  if (path.includes("/wp-content/")) return true;
  if (path.includes("/wp-") && path.endsWith(".php/")) return true;
  if (path.endsWith("/null/")) return true;
  return false;
}

function findInventoryBySlugOverlap(
  legacyUrl: string,
  rawDestination: string,
  allowedDestinationUrls: readonly string[],
): string | null {
  const legacySlug = legacyPathSlug(legacyUrl);
  const proposalSlug = urlPathTail(rawDestination).toLowerCase();
  const needles = [...new Set([legacySlug, proposalSlug].filter((s) => s.length >= 3))];
  if (!needles.length) return null;

  let bestContains: string | null = null;
  let bestLen = 0;
  for (const dest of allowedDestinationUrls) {
    if (isWordPressNumberedSlugDuplicate(dest)) continue;
    const destSlug = urlPathTail(dest).toLowerCase();
    if (!destSlug) continue;
    for (const needle of needles) {
      if (destSlug === needle) return dest;
      if (destSlug.includes(needle) || needle.includes(destSlug)) {
        if (destSlug.length > bestLen) {
          bestLen = destSlug.length;
          bestContains = dest;
        }
      }
    }
  }
  return bestContains;
}

function findInventoryByLegacySlug(
  legacyUrl: string,
  allowedDestinationUrls: readonly string[],
): string | null {
  return findInventoryBySlugOverlap(legacyUrl, "", allowedDestinationUrls);
}

function resolveLegacyUrlWithoutAgent(
  legacyUrl: string,
  allowedDestinationUrls: readonly string[],
  destinationByKey: Map<string, string>,
  blogIndexUrl: string,
): LegacyRedirectMatchProposal | null {
  const slugHit = findInventoryByLegacySlug(legacyUrl, allowedDestinationUrls);
  if (slugHit) return { legacyUrl, destinationUrl: slugHit };
  const identity = adoptIdentityInventoryProposal(legacyUrl, destinationByKey);
  if (identity) return identity;
  if (isPaginationOrThinLegacyUrl(legacyUrl)) {
    return { legacyUrl, destinationUrl: blogIndexUrl };
  }
  return null;
}

function resolveProposalDestination(
  rawDestination: string,
  legacyUrl: string,
  allowedDestinationUrls: readonly string[],
  destinationByKey: Map<string, string>,
  blogIndexUrl: string,
): string | null {
  const resolved =
    resolveDestinationUrl(rawDestination, destinationByKey, blogIndexUrl) ??
    findInventoryBySlugOverlap(legacyUrl, rawDestination, allowedDestinationUrls);
  if (resolved && isWordPressNumberedSlugDuplicate(resolved)) return null;
  if (resolved) return resolved;
  if (isPaginationOrThinLegacyUrl(legacyUrl)) return blogIndexUrl;
  return null;
}

function adoptProposal(
  proposal: LegacyRedirectMatchProposal,
  legacyByKey: Map<string, string>,
  allowedDestinationUrls: readonly string[],
  destinationByKey: Map<string, string>,
  blogIndexUrl: string,
  siteBaseUrl?: string,
  forcedLegacyUrl?: string,
): LegacyRedirectMatchProposal | null {
  const resolvedLegacy = resolveLegacyUrl(proposal.legacyUrl, siteBaseUrl);
  const legacyKey = legacyRedirectLegacyMatchKey(proposal.legacyUrl);
  const legacyUrl =
    forcedLegacyUrl ||
    legacyByKey.get(legacyKey) ||
    legacyByKey.get(legacyRedirectLegacyMatchKey(resolvedLegacy)) ||
    legacyByKey.get(normalizePageUrlKey(resolvedLegacy));
  if (!legacyUrl) return null;

  const legacyPath = normalizeRankMathRelativePath(legacyUrl.trim());
  if (!isHttpUrl(legacyUrl) && !legacyPath && !isHttpUrl(resolvedLegacy) && !forcedLegacyUrl) {
    return null;
  }

  const blogKey = normalizePageUrlKey(blogIndexUrl);
  const agentWantsBlog =
    normalizePageUrlKey(proposal.destinationUrl) === blogKey ||
    pathnameKey(proposal.destinationUrl) === pathnameKey(blogIndexUrl);

  let destinationUrl = resolveProposalDestination(
    proposal.destinationUrl,
    legacyUrl,
    allowedDestinationUrls,
    destinationByKey,
    blogIndexUrl,
  );
  if (!destinationUrl && agentWantsBlog && isPaginationOrThinLegacyUrl(legacyUrl)) {
    destinationUrl = blogIndexUrl;
  }
  if (!destinationUrl) {
    destinationUrl = findInventoryByLegacySlug(legacyUrl, allowedDestinationUrls);
  }
  if (!destinationUrl) return null;

  if (!legacyUrlsDiffer(legacyUrl, destinationUrl)) {
    const slugHit = findInventoryByLegacySlug(legacyUrl, allowedDestinationUrls);
    if (slugHit && legacyUrlsDiffer(legacyUrl, slugHit)) {
      destinationUrl = slugHit;
    } else {
      const canonical = resolveCanonicalInventoryDestination(legacyUrl, destinationByKey);
      if (canonical && legacyUrlsDiffer(legacyUrl, canonical)) {
        destinationUrl = canonical;
      } else if (isPaginationOrThinLegacyUrl(legacyUrl)) {
        destinationUrl = blogIndexUrl;
      } else if (canonical) {
        destinationUrl = canonical;
      } else {
        return null;
      }
    }
  }

  return {
    legacyUrl,
    destinationUrl,
  };
}

function adoptIdentityInventoryProposal(
  legacyUrl: string,
  destinationByKey: Map<string, string>,
): LegacyRedirectMatchProposal | null {
  const canonical = resolveCanonicalInventoryDestination(legacyUrl, destinationByKey);
  if (!canonical) return null;
  return { legacyUrl, destinationUrl: canonical };
}

function splitRawLines(text: string): string[] {
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    if (i === text.length || ch === "\n" || ch === "\r") {
      const line = text.slice(start, i).trim();
      if (line && line.toLowerCase() !== "url") lines.push(line);
      if (ch === "\r" && text[i + 1] === "\n") i++;
      start = i + 1;
    }
  }
  return lines;
}

function chunkLines(lines: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < lines.length; i += size) {
    out.push(lines.slice(i, i + size));
  }
  return out;
}

export function splitLegacySheetIntoLineChunks(
  legacySheetText: string,
  maxLinesPerChunk = LEGACY_REDIRECT_MATCH_BATCH_LINE_SIZE,
): string[] {
  const lines = splitRawLines(legacySheetText);
  if (!lines.length) return [];
  return chunkLines(lines, maxLinesPerChunk).map((chunk) => chunk.join("\n"));
}

function adoptProposalsFromAgentResponse(args: {
  legacyUrls: string[];
  parsed: LegacyRedirectMatchProposal[];
  allowedDestinationUrls: readonly string[];
  destinationByKey: Map<string, string>;
  blogIndexUrl: string;
  siteBaseUrl?: string;
}): LegacyRedirectMatchProposal[] {
  const { legacyUrls, parsed, allowedDestinationUrls, destinationByKey, blogIndexUrl, siteBaseUrl } = args;
  const legacyByKey = new Map(
    legacyUrls.map((url) => [legacyRedirectLegacyMatchKey(url), url]),
  );
  const adopted: LegacyRedirectMatchProposal[] = [];
  const adoptedKeys = new Set<string>();

  for (const proposal of parsed) {
    const valid = adoptProposal(
      proposal,
      legacyByKey,
      allowedDestinationUrls,
      destinationByKey,
      blogIndexUrl,
      siteBaseUrl,
    );
    if (!valid) continue;
    const key = legacyRedirectLegacyMatchKey(valid.legacyUrl);
    if (adoptedKeys.has(key)) continue;
    adoptedKeys.add(key);
    adopted.push(valid);
  }

  if (adopted.length < legacyUrls.length && parsed.length) {
    for (let i = 0; i < legacyUrls.length; i++) {
      const legacyUrl = legacyUrls[i]!;
      const key = legacyRedirectLegacyMatchKey(legacyUrl);
      if (adoptedKeys.has(key)) continue;
      const proposal = parsed[i] ?? parsed[0];
      if (!proposal) continue;
      const valid = adoptProposal(
        proposal,
        legacyByKey,
        allowedDestinationUrls,
        destinationByKey,
        blogIndexUrl,
        siteBaseUrl,
        legacyUrl,
      );
      if (!valid) continue;
      adoptedKeys.add(key);
      adopted.push(valid);
    }
  }

  return adopted;
}

async function runLegacyRedirectUrlAgent(args: {
  legacyUrls: string[];
  chunkIndex: number;
  chunkCount: number;
  legacySheetName?: string;
  allowedDestinationUrls: string[];
  blogIndexUrl: string;
  siteInventory: SitePostInventoryKbPayload;
  apiKey: string;
  model: string;
  destinationByKey: Map<string, string>;
  siteBaseUrl?: string;
  signal?: AbortSignal;
}): Promise<LegacyRedirectMatchProposal[]> {
  const {
    legacyUrls,
    chunkIndex,
    chunkCount,
    legacySheetName,
    allowedDestinationUrls,
    blogIndexUrl,
    siteInventory,
    apiKey,
    model,
    destinationByKey,
    siteBaseUrl,
    signal,
  } = args;

  if (!legacyUrls.length) return [];

  const user = JSON.stringify({
    task: "legacy_redirect_url_agent",
    legacySheetName: legacySheetName ?? "upload",
    chunkIndex: chunkIndex + 1,
    chunkCount,
    requiredCount: legacyUrls.length,
    blogIndexUrl,
    allowedLegacyUrls: legacyUrls,
    allowedDestinationUrls,
    siteInventory: slimSiteInventoryForLegacyMatch(siteInventory),
    outputSchema: {
      matches: [
        {
          legacyUrl: "string (exact value from allowedLegacyUrls)",
          destinationUrl: "string (exact URL from allowedDestinationUrls)",
        },
      ],
    },
  });

  const orStart = Date.now();

  const completion = await callOpenRouterChatCompletion({
    apiKey,
    model,
    system: LEGACY_REDIRECT_URL_AGENT_SYSTEM,
    user,
    maxTokens: getCompetitorReportMaxOutputTokens(model),
    temperature: 0.15,
    responseFormat: { type: "json_object" },
    signal,
  });

  let parsed: LegacyRedirectMatchProposal[] = [];
  try {
    parsed = parseLegacyRedirectMatchAgentJson(completion.content);
  } catch (err) {
    return [];
  }

  if (completion.finishReason === "error" && !parsed.length) {
    return [];
  }

  const adopted = adoptProposalsFromAgentResponse({
    legacyUrls,
    parsed,
    allowedDestinationUrls,
    destinationByKey,
    blogIndexUrl,
    siteBaseUrl,
  });

  return adopted;
}

function countChunkLinesResolved(
  legacyUrls: readonly string[],
  byLegacy: Map<string, LegacyRedirectMatchProposal>,
): number {
  let count = 0;
  for (const url of legacyUrls) {
    if (byLegacy.has(legacyRedirectLegacyMatchKey(url))) count += 1;
  }
  return count;
}

function mergeProposalsIntoByLegacy(
  proposals: readonly LegacyRedirectMatchProposal[],
  byLegacy: Map<string, LegacyRedirectMatchProposal>,
  onMatch?: (match: LegacyRedirectMatchRow) => void,
) {
  for (const proposal of proposals) {
    const key = legacyRedirectLegacyMatchKey(proposal.legacyUrl);
    if (byLegacy.has(key)) continue;
    byLegacy.set(key, proposal);
    onMatch?.({
      legacyUrl: proposal.legacyUrl,
      destinationUrl: proposal.destinationUrl,
      uploadRow: byLegacy.size,
    });
  }
}

function fillChunkStragglersWithoutAgent(
  legacyUrls: readonly string[],
  byKey: Map<string, LegacyRedirectMatchProposal>,
  allowedDestinationUrls: readonly string[],
  destinationByKey: Map<string, string>,
  blogIndexUrl: string,
) {
  for (const legacyUrl of legacyUrls) {
    const key = legacyRedirectLegacyMatchKey(legacyUrl);
    if (byKey.has(key)) continue;
    const instant = resolveLegacyUrlWithoutAgent(
      legacyUrl,
      allowedDestinationUrls,
      destinationByKey,
      blogIndexUrl,
    );
    if (instant) byKey.set(key, instant);
  }
}

async function matchLegacyUrlsWithAgent(args: {
  legacyUrls: string[];
  chunkIndex: number;
  chunkCount: number;
  legacySheetName?: string;
  allowedDestinationUrls: string[];
  blogIndexUrl: string;
  siteInventory: SitePostInventoryKbPayload;
  apiKey: string;
  model: string;
  destinationByKey: Map<string, string>;
  siteBaseUrl?: string;
  signal?: AbortSignal;
}): Promise<LegacyRedirectMatchProposal[]> {
  const { legacyUrls } = args;
  if (!legacyUrls.length) return [];
  if (args.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  let proposals: LegacyRedirectMatchProposal[] = [];
  try {
    proposals = await runLegacyRedirectUrlAgent({
      ...args,
      legacyUrls,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  const byKey = new Map<string, LegacyRedirectMatchProposal>();
  for (const proposal of proposals) {
    const key = legacyRedirectLegacyMatchKey(proposal.legacyUrl);
    if (!byKey.has(key)) byKey.set(key, proposal);
  }

  fillChunkStragglersWithoutAgent(
    legacyUrls,
    byKey,
    args.allowedDestinationUrls,
    args.destinationByKey,
    args.blogIndexUrl,
  );

  return legacyUrls
    .map((url) => byKey.get(legacyRedirectLegacyMatchKey(url)))
    .filter((row): row is LegacyRedirectMatchProposal => Boolean(row));
}

async function runParallelLegacyRedirectBatches<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index]!, index);
    }
  });
  await Promise.all(runners);
}

export async function runLegacyRedirectMatchAgent(args: {
  legacySheetText: string;
  legacySheetName?: string;
  allowedDestinationUrls: string[];
  blogIndexUrl: string;
  siteInventory: SitePostInventoryKbPayload;
  apiKey: string;
  siteId: string;
  signal?: AbortSignal;
  onProgress?: (completedBatches: number, totalBatches: number, matchedCount: number) => void;
  onBatchProgress?: (batches: LegacyRedirectBatchProgress[]) => void;
  onPartialMatches?: (matches: LegacyRedirectMatchRow[]) => void;
  onMatch?: (match: LegacyRedirectMatchRow) => void;
}): Promise<LegacyRedirectMatchRow[]> {
  const {
    legacySheetText,
    legacySheetName,
    allowedDestinationUrls,
    blogIndexUrl,
    siteInventory,
    apiKey,
    siteId,
    signal,
    onProgress,
    onBatchProgress,
    onPartialMatches,
    onMatch,
  } = args;

  const sheet = legacySheetText.trim();
  if (!sheet) {
    throw new Error("Legacy URL upload is empty.");
  }

  const blogUrl = blogIndexUrl.trim();
  if (!blogUrl) {
    throw new Error("Blog index URL is required.");
  }

  const destinations = filterWordPressNumberedSlugDuplicates([
    ...new Set([...allowedDestinationUrls, blogUrl]),
  ]);
  if (!destinations.length) {
    throw new Error("Site inventory has no destination URLs.");
  }

  const model = getResearchModel(siteId);
  const destinationByKey = new Map(
    destinations.map((u) => [normalizePageUrlKey(u), u]),
  );

  const allLegacyUrls = splitRawLines(sheet);
  if (!allLegacyUrls.length) {
    throw new Error("Legacy URL upload is empty.");
  }

  const chunks = chunkLines(allLegacyUrls, LEGACY_REDIRECT_MATCH_BATCH_LINE_SIZE);
  const totalBatches = chunks.length;
  let batchesDone = 0;
  const byLegacy = new Map<string, LegacyRedirectMatchProposal>();
  const siteBaseUrl = siteInventory.site?.url;
  const batchRows: LegacyRedirectBatchProgress[] = chunks.map((chunk, index) => ({
    batchIndex: index + 1,
    batchTotal: totalBatches,
    lineCount: chunk.length,
    matchedCount: 0,
    status: "pending",
  }));
  const emitBatchProgress = () => onBatchProgress?.([...batchRows]);
  emitBatchProgress();

  const processedLineCount = () => {
    let count = 0;
    for (const url of allLegacyUrls) {
      const key = legacyRedirectLegacyMatchKey(url);
      if (byLegacy.has(key)) count += 1;
    }
    return count;
  };

  const chunkArgsBase = {
    chunkCount: totalBatches,
    legacySheetName,
    allowedDestinationUrls: destinations,
    blogIndexUrl: blogUrl,
    siteInventory,
    apiKey,
    model,
    destinationByKey,
    siteBaseUrl,
    signal,
  };

  const publishProgress = () => {
    onProgress?.(batchesDone, totalBatches, processedLineCount());
    onPartialMatches?.(
      [...byLegacy.values()].map((proposal, rowIndex) => ({
        legacyUrl: proposal.legacyUrl,
        destinationUrl: proposal.destinationUrl,
        uploadRow: rowIndex + 1,
      })),
    );
  };

  onProgress?.(0, totalBatches, processedLineCount());

  await runParallelLegacyRedirectBatches(
    chunks,
    LEGACY_REDIRECT_MATCH_BATCH_CONCURRENCY,
    async (legacyUrls, index) => {
      const chunkStart = Date.now();
      batchRows[index] = { ...batchRows[index]!, status: "running" };
      emitBatchProgress();

      try {
        const proposals = await matchLegacyUrlsWithAgent({
          ...chunkArgsBase,
          legacyUrls,
          chunkIndex: index,
        });
        mergeProposalsIntoByLegacy(proposals, byLegacy, onMatch);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        const msg = err instanceof Error ? err.message : String(err);
        batchRows[index] = {
          ...batchRows[index]!,
          status: "error",
          matchedCount: countChunkLinesResolved(legacyUrls, byLegacy),
          error: msg,
          durationMs: Date.now() - chunkStart,
        };
        batchesDone += 1;
        emitBatchProgress();
        publishProgress();
        return;
      }

      const chunkMatched = countChunkLinesResolved(legacyUrls, byLegacy);
      batchesDone += 1;
      batchRows[index] = {
        ...batchRows[index]!,
        status: chunkMatched >= legacyUrls.length ? "done" : "error",
        matchedCount: chunkMatched,
        error:
          chunkMatched < legacyUrls.length
            ? `${legacyUrls.length - chunkMatched} URL(s) unresolved`
            : undefined,
        durationMs: Date.now() - chunkStart,
      };
      emitBatchProgress();
      publishProgress();
    },
  );

  const strayBefore = allLegacyUrls.filter(
    (url) => !byLegacy.has(legacyRedirectLegacyMatchKey(url)),
  );
  fillChunkStragglersWithoutAgent(
    strayBefore,
    byLegacy,
    destinations,
    destinationByKey,
    blogUrl,
  );
  for (let index = 0; index < allLegacyUrls.length; index++) {
    const legacyUrl = allLegacyUrls[index]!;
    if (!strayBefore.includes(legacyUrl)) continue;
    const proposal = byLegacy.get(legacyRedirectLegacyMatchKey(legacyUrl));
    if (!proposal) continue;
    onMatch?.({
      legacyUrl,
      destinationUrl: proposal.destinationUrl,
      uploadRow: index + 1,
    });
  }
  const siteDomainUrl = resolveLegacyRedirectSiteDomainUrl(siteBaseUrl ?? "");
  const domainDefaultKeys = new Set<string>();
  for (const legacyUrl of allLegacyUrls) {
    const key = legacyRedirectLegacyMatchKey(legacyUrl);
    if (byLegacy.has(key)) continue;
    const destinationUrl = siteDomainUrl || blogUrl;
    byLegacy.set(key, { legacyUrl, destinationUrl });
    domainDefaultKeys.add(key);
  }

  for (let index = 0; index < allLegacyUrls.length; index++) {
    const legacyUrl = allLegacyUrls[index]!;
    if (!domainDefaultKeys.has(legacyRedirectLegacyMatchKey(legacyUrl))) continue;
    const proposal = byLegacy.get(legacyRedirectLegacyMatchKey(legacyUrl));
    if (!proposal) continue;
    onMatch?.({
      legacyUrl,
      destinationUrl: proposal.destinationUrl,
      uploadRow: index + 1,
    });
  }

  for (let i = 0; i < batchRows.length; i++) {
    const chunk = chunks[i]!;
    const chunkMatched = countChunkLinesResolved(chunk, byLegacy);
    batchRows[i] = {
      ...batchRows[i]!,
      status: "done",
      matchedCount: chunkMatched,
      error: undefined,
    };
  }
  emitBatchProgress();

  const results: LegacyRedirectMatchRow[] = [];
  for (let index = 0; index < allLegacyUrls.length; index++) {
    const legacyUrl = allLegacyUrls[index]!;
    const key = legacyRedirectLegacyMatchKey(legacyUrl);
    const proposal = byLegacy.get(key)!;
    results.push({
      legacyUrl,
      destinationUrl: proposal.destinationUrl,
      uploadRow: index + 1,
    });
  }

  onProgress?.(totalBatches, totalBatches, processedLineCount());
  return results;
}
