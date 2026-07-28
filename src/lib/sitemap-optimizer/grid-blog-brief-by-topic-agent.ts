import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { BULK_WORDPRESS_POST_TITLE_RULE } from "@/lib/prompt-builders/system-user";
import {
  GRID_BRIEF_TECHNICAL_APPEND,
  TECHNICAL_SEO_STRATEGIST_ROLE,
} from "@/lib/sitemap-optimizer/seo-strategist-prompts";
import {
  SITEMAP_OPTIMIZER_GRID_BLOG_BRIEF_CLUSTERS_PER_SECTION,
  SITEMAP_OPTIMIZER_GRID_BLOG_BRIEF_SECTION_CONCURRENCY,
  SITEMAP_OPTIMIZER_GRID_URL_TAG_MAX_TOKENS,
} from "@/lib/sitemap-optimizer/constants";
import type { BlogDestinationPolicy } from "@/lib/sitemap-optimizer/blog-destination-policy";
import {
  applyBlogDestinationPolicy,
  blogDestinationPolicyForCollections,
} from "@/lib/sitemap-optimizer/blog-destination-policy";
import { editorialDestinationWithContentYear } from "@/lib/sitemap-optimizer/apply-content-year-policy";
import { getGridContentYear } from "@/lib/sitemap-optimizer/grid-title-year";
import { optimizeBlogMergeDestination } from "@/lib/sitemap-optimizer/optimize-blog-destination";
import { buildGridDestinationPreservingPermalink } from "@/lib/sitemap-optimizer/grid-destination-aiseo-policy";
import { optimizeGridDestinationForAiseo } from "@/lib/sitemap-optimizer/grid-destination-aiseo-policy";
import { parseGridBlogBriefBatchJson } from "@/lib/sitemap-optimizer/grid-blog-brief-parse";
import { resolveGridLockedDestinationUrl } from "@/lib/sitemap-optimizer/grid-locked-destination";
import {
  buildDeterministicGridBrief,
  fillMissingClusterBriefs,
} from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import {
  gridMemberCanonicalUrl,
  gridMemberSourceUrl,
} from "@/lib/sitemap-optimizer/grid-member-url";
import { sharedGridClusterDestinationUrl } from "@/lib/sitemap-optimizer/grid-merge-group-ids";
import {
  isRedirectMapOverflowPackCluster,
} from "@/lib/sitemap-optimizer/grid-redirect-pack-cluster";
import {
  isTemporalCannibalizationCluster,
  pickTemporalPillarDestinationUrl,
  temporalPillarKeyword,
  temporalPillarOutline,
  temporalPillarTitle,
} from "@/lib/sitemap-optimizer/grid-temporal-cannibalization";
import {
  coerceRedirectMapLockedDestination,
  isRedirectMapCluster,
  lockedDestinationForRedirectMapCluster,
  lockedUrlMatchesLegacySource,
} from "@/lib/sitemap-optimizer/grid-redirect-destination";
import {
  isGridOneToOneRedirectMap,
  oneToOneRedirectMapLabel,
} from "@/lib/sitemap-optimizer/grid-one-to-one-redirect-map";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import { pickCanonicalDestinationUrl } from "@/lib/sitemap-optimizer/grid-cannibalization-family";
import { ensureKeywordYearsInTitle, yearsInText } from "@/lib/sitemap-optimizer/grid-title-year";
import { normalizeGridTopicTag } from "@/lib/sitemap-optimizer/grid-tag-key";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

const GRID_BLOG_BRIEF_BY_TOPIC_SYSTEM = `${TECHNICAL_SEO_STRATEGIST_ROLE}

For a **topic section** of GSC URL clusters, plan one definitive **new article** per cluster (not merging existing WordPress posts).

Output rules (apply to EVERY brief in the briefs array):
- recommendedTitle: under 60 characters, compelling new post headline.
${BULK_WORDPRESS_POST_TITLE_RULE}
- recommendedPrimaryKeyword: 2-5 word short-tail focus phrase; preserve any 4-digit year (19xx/20xx) from tagLabel, slug, or member titles when present (e.g. "2026 federal budget changes").
- **Year in keyword → year in title (mandatory)**: If recommendedPrimaryKeyword contains a 4-digit year, recommendedTitle MUST include that **exact same year** (same digits). Never omit the year. Never substitute vague framing like "historical overview", "current rules", or "latest update" instead of the year. Forbidden example: keyword "2026 federal budget changes" → title "Federal Budget Changes: A Historical Overview".
- recommendedMeta: 120-160 characters; no double quotes inside the value. If the keyword includes a year, include that year in recommendedMeta.
- combinedOutline: complete H2 headings for the new article.
- whatToKeepFromEach: every member URL in that cluster; bullets are search intents or angles.
- redirectOrCanonicalNote: brief note on how source URLs relate to the new post (internal linking).
- lockedDestinationUrl: REQUIRED full https canonical URL on the same origin as that cluster's members. Use the section topicTag for the slug phrase. **Keep the permalink folder from a member URL in that cluster** (if they use /YYYY/MM/DD/, keep that date path). Only shorten the final slug (3-5 words, max ~48 chars). Never remove date folders.
- priority and confidence: high|medium|low.
- rationale: 2-3 sentences on intent overlap, cannibalization fix, and GSC opportunity.
- For tax/budget/guide clusters (topicTag not "company") with **no** year in the keyword, you may use the current calendar year when the topic is an annual budget or tax-year guide.
- For company/firm news (topicTag "company"), keep historical years from the keyword in recommendedTitle when they reflect the announcement date.
- clusterId in each brief MUST match a clusterId from the user payload exactly.
- You MUST return exactly requiredBriefCount brief objects (one per cluster). Do not omit clusters.
Return ONLY valid JSON: { "briefs": [ { clusterId, recommendedTitle, recommendedPrimaryKeyword, recommendedMeta, lockedDestinationUrl, combinedOutline, whatToKeepFromEach, redirectOrCanonicalNote, priority, confidence, rationale } ] }${GRID_BRIEF_TECHNICAL_APPEND}`;

const GRID_BLOG_BRIEF_ONE_TO_ONE_APPEND = `

Redirect-map mode: one content plan per cluster. Each cluster may include many member URLs (old_url sources) sharing the same lockedDestinationUrl (canonical new_url).
Use canonicalDestinationUrl from the payload when present. Roll forward 19xx/20xx year tokens in the slug to the current content year (e.g. canada-2023-budget → canada-2026-budget) while preserving /blog/ path structure.
**Anti-cannibalization:** Do not plan separate competing articles for the same searcher intent. When memberCount > 1 or mergedTopicGroup is true, output ONE definitive guide: combine angles as H2 sections in combinedOutline (not separate pillar + spin-off titles). Keyword order/year wording differences alone are NOT separate articles (e.g. "alberta tax brackets 2026" vs "2026 canadian alberta tax brackets" = one post).
When tagLabel or permalinkSamples include a year, carry that year into recommendedPrimaryKeyword and recommendedTitle.`;

function applyKeywordYearTitleRules(
  brief: SitemapOptimizerMergeRecommendation,
): SitemapOptimizerMergeRecommendation {
  const keyword = brief.recommendedPrimaryKeyword.trim();
  const title = ensureKeywordYearsInTitle(keyword, brief.recommendedTitle);
  const meta = ensureKeywordYearsInTitle(keyword, brief.recommendedMeta);
  return {
    ...brief,
    recommendedTitle: title,
    recommendedMeta: meta.length <= 160 ? meta : `${meta.slice(0, 157).trim()}...`,
  };
}

function briefSystemPrompt(fixedDestinations: boolean): string {
  return fixedDestinations
    ? GRID_BLOG_BRIEF_BY_TOPIC_SYSTEM + GRID_BLOG_BRIEF_ONE_TO_ONE_APPEND
    : GRID_BLOG_BRIEF_BY_TOPIC_SYSTEM;
}

function buildOneToOneTopicSections(
  targets: readonly SitemapOptimizerCluster[],
  rowById: Map<string, SitemapOptimizerPostRow>,
): TopicTagSection[] {
  return [...targets]
    .sort((a, b) => {
      const ia =
        rowById.get(a.memberPostIds[0] ?? "")?.uploadRowIndex ?? Number.MAX_SAFE_INTEGER;
      const ib =
        rowById.get(b.memberPostIds[0] ?? "")?.uploadRowIndex ?? Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      return a.clusterId.localeCompare(b.clusterId);
    })
    .map((cluster) => {
      const member = resolvedMembers(cluster, rowById)[0];
      return {
        topicKey: cluster.clusterId,
        topicTag: member?.gridTopicTag ?? "untagged",
        tagLabel: member ? oneToOneRedirectMapLabel(member) : cluster.label,
        clusters: [cluster],
      };
    });
}

export type TopicTagSection = {
  topicKey: string;
  topicTag: string;
  tagLabel: string;
  clusters: SitemapOptimizerCluster[];
};

export type GridBlogBriefSectionProgress = {
  topicsCompleted: number;
  topicsTotal: number;
  currentTopicLabel?: string;
  blogsCompleted: number;
  blogsTotal: number;
  topicsInFlight?: number;
  microStep?: string;
  mergeBatchCompleted?: number;
  mergeBatchTotal?: number;
};

async function mapTopicsWithConcurrency<R>(
  topics: readonly TopicTagSection[],
  concurrency: number,
  fn: (topic: TopicTagSection) => Promise<R>,
  signal?: AbortSignal,
  onSectionDone?: (completed: number, total: number, result: R) => void,
): Promise<R[]> {
  const n = topics.length;
  const ret: R[] = new Array(n);
  let next = 0;
  let finished = 0;

  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const idx = next;
      next += 1;
      if (idx >= n) return;
      const topic = topics[idx]!;
      const result = await fn(topic);
      ret[idx] = result;
      finished += 1;
      onSectionDone?.(finished, n, result);
    }
  }

  const workers = Math.min(Math.max(1, concurrency), n);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return ret;
}

function resolvedMembers(
  cluster: SitemapOptimizerCluster,
  rowById: Map<string, SitemapOptimizerPostRow>,
): SitemapOptimizerPostRow[] {
  return cluster.memberPostIds
    .map((id) => rowById.get(id))
    .filter((r): r is SitemapOptimizerPostRow => r != null);
}

function memberPayload(
  cluster: SitemapOptimizerCluster,
  rowById: Map<string, SitemapOptimizerPostRow>,
): Record<string, unknown>[] {
  return cluster.memberPostIds
    .map((id) => rowById.get(id))
    .filter((row): row is SitemapOptimizerPostRow => row != null)
    .map((row) => ({
      postId: row.postId,
      url: gridMemberSourceUrl(row),
      canonicalUrl: gridMemberCanonicalUrl(row),
      title: row.title,
      topicTag: row.gridTopicTag,
      geoTag: row.gridGeoTag,
      tagLabel: row.gridTagLabel,
      uploadRowIndex: row.uploadRowIndex,
      gscPageClicks: row.gscPageClicks,
      gscPageImpressions: row.gscPageImpressions,
    }));
}

function finalizeBrief(
  raw: SitemapOptimizerMergeRecommendation,
  cluster: SitemapOptimizerCluster,
  rowById: Map<string, SitemapOptimizerPostRow>,
  blogDestination?: BlogDestinationPolicy | null,
): SitemapOptimizerMergeRecommendation | null {
  const resolved = resolvedMembers(cluster, rowById);
  if (!resolved.length) return null;

  const memberUrls = resolved.map((m) => gridMemberCanonicalUrl(m));
  const redirectMap = isRedirectMapCluster(resolved);
  const contentYear = getGridContentYear();
  const isOverflow = isRedirectMapOverflowPackCluster(cluster);
  const isTemporal = isTemporalCannibalizationCluster(cluster);
  const presetDestination = isOverflow
    ? null
    : (lockedDestinationForRedirectMapCluster(resolved, cluster) ??
      (!isTemporal ? sharedGridClusterDestinationUrl(resolved) : null));
  if (presetDestination) {
    const optimizedPreset = blogDestination?.preserveCsvDestinations
      ? editorialDestinationWithContentYear(
          applyBlogDestinationPolicy(presetDestination, blogDestination),
          contentYear,
        )
      : editorialDestinationWithContentYear(
          optimizeBlogMergeDestination(
            presetDestination,
            raw.recommendedPrimaryKeyword,
            raw.recommendedTitle,
            memberUrls,
            blogDestination,
          ),
          contentYear,
        );
    return applyKeywordYearTitleRules({
      ...raw,
      clusterId: cluster.clusterId,
      lockedDestinationUrl: optimizedPreset,
    });
  }

  const lockedRaw = raw.lockedDestinationUrl?.trim();
  let resolvedLocked = lockedRaw
    ? resolveGridLockedDestinationUrl(lockedRaw, resolved, blogDestination)
    : null;
  if (resolvedLocked && redirectMap && lockedUrlMatchesLegacySource(resolvedLocked, resolved)) {
    resolvedLocked = null;
  }
  const coerced = coerceRedirectMapLockedDestination(resolvedLocked ?? lockedRaw, resolved);
  if (isTemporal && redirectMap) {
    const contentYear = getGridContentYear();
    const pillarLocked = applyBlogDestinationPolicy(
      pickTemporalPillarDestinationUrl(resolved, contentYear, cluster),
      blogDestination,
    );
    const pillarKeyword = temporalPillarKeyword(resolved, contentYear, cluster);
    const pillarTitle = temporalPillarTitle(resolved, contentYear, cluster);
    return {
      ...raw,
      clusterId: cluster.clusterId,
      recommendedTitle: pillarTitle,
      recommendedPrimaryKeyword: pillarKeyword,
      recommendedMeta: raw.recommendedMeta || `Consolidated ${pillarKeyword} — quarters as H2 sections.`,
      lockedDestinationUrl: pillarLocked,
      combinedOutline: temporalPillarOutline(resolved, contentYear, cluster),
    };
  }
  if (coerced && redirectMap) {
    const optimizedCoerced = blogDestination?.preserveCsvDestinations
      ? editorialDestinationWithContentYear(
          applyBlogDestinationPolicy(coerced, blogDestination),
          contentYear,
        )
      : editorialDestinationWithContentYear(
          optimizeBlogMergeDestination(
            coerced,
            raw.recommendedPrimaryKeyword,
            raw.recommendedTitle,
            memberUrls,
            blogDestination,
          ),
          contentYear,
        );
    return applyKeywordYearTitleRules({
      ...raw,
      clusterId: cluster.clusterId,
      lockedDestinationUrl: optimizedCoerced,
    });
  }
  if (!resolvedLocked && !redirectMap) {
    resolvedLocked = buildGridDestinationPreservingPermalink(
      memberUrls,
      raw.recommendedPrimaryKeyword,
      raw.recommendedTitle,
      blogDestination,
    );
  }
  if (!resolvedLocked) return null;

  const locked = optimizeBlogMergeDestination(
    resolvedLocked,
    raw.recommendedPrimaryKeyword,
    raw.recommendedTitle,
    memberUrls,
    blogDestination,
  );

  const sourcePaths = new Set(
    memberUrls.map((u) => {
      try {
        return new URL(u.trim()).pathname.replace(/\/+$/, "/").toLowerCase();
      } catch {
        return "";
      }
    }),
  );
  try {
    const destPath = new URL(locked).pathname.replace(/\/+$/, "/").toLowerCase();
    if (!redirectMap && memberUrls.length === 1 && sourcePaths.has(destPath)) {
      const topicSlug =
        resolved[0]?.gridTopicTag?.replace(/_/g, "-").toLowerCase().slice(0, 48) || "guide";
      const retry = buildGridDestinationPreservingPermalink(
        memberUrls,
        `${topicSlug}-guide`,
        raw.recommendedTitle,
        blogDestination,
      );
      if (retry) {
        const fixed =
          optimizeGridDestinationForAiseo(
            retry,
            raw.recommendedPrimaryKeyword,
            raw.recommendedTitle,
            memberUrls,
            blogDestination,
          ) ?? retry;
        return applyKeywordYearTitleRules({
          ...raw,
          clusterId: cluster.clusterId,
          lockedDestinationUrl: applyBlogDestinationPolicy(fixed, blogDestination),
        });
      }
    }
  } catch {
    return null;
  }

  return applyKeywordYearTitleRules({
    ...raw,
    clusterId: cluster.clusterId,
    lockedDestinationUrl: locked,
  });
}

/** Group clusters by normalized gridTopicTag from member rows. */
export function groupClustersByTopicTag(
  clusters: readonly SitemapOptimizerCluster[],
  rowById: Map<string, SitemapOptimizerPostRow>,
): TopicTagSection[] {
  const byKey = new Map<string, TopicTagSection>();

  for (const cluster of clusters) {
    const members = resolvedMembers(cluster, rowById);
    const first = members[0];
    const topicTag = normalizeGridTopicTag(first?.gridTopicTag ?? "untagged");
    const tagLabel = first?.gridTagLabel?.trim() || cluster.label.trim() || topicTag.replace(/_/g, " ");
    const existing = byKey.get(topicTag);
    if (existing) {
      existing.clusters.push(cluster);
    } else {
      byKey.set(topicTag, { topicKey: topicTag, topicTag, tagLabel, clusters: [cluster] });
    }
  }

  return [...byKey.values()].sort((a, b) => a.topicTag.localeCompare(b.topicTag));
}

function chunkClusters(
  clusters: readonly SitemapOptimizerCluster[],
  size: number,
): SitemapOptimizerCluster[][] {
  const chunks: SitemapOptimizerCluster[][] = [];
  for (let i = 0; i < clusters.length; i += size) {
    chunks.push(clusters.slice(i, i + size));
  }
  return chunks;
}

function buildClusterPayload(
  cluster: SitemapOptimizerCluster,
  rowById: Map<string, SitemapOptimizerPostRow>,
): Record<string, unknown> {
  const resolved = resolvedMembers(cluster, rowById);
  const isOverflow = isRedirectMapOverflowPackCluster(cluster);
  const isTemporal = isTemporalCannibalizationCluster(cluster);
  const presetDestination = isOverflow
    ? null
    : (lockedDestinationForRedirectMapCluster(resolved, cluster) ??
      (!isTemporal ? sharedGridClusterDestinationUrl(resolved) : null));
  const legacySource =
    resolved.length === 1 && resolved[0]?.gridRedirectFromUrl?.trim()
      ? gridMemberSourceUrl(resolved[0])
      : undefined;
  const permalinkSamples: string[] = [];
  for (const row of resolved) {
    try {
      permalinkSamples.push(new URL(gridMemberCanonicalUrl(row)).pathname);
    } catch {
      /* skip */
    }
    if (permalinkSamples.length >= 5) break;
  }
  const tagLabel = resolved[0]?.gridTagLabel ?? cluster.label;
  const yearsRequiredInTitle = yearsInText(
    [tagLabel, cluster.label, ...permalinkSamples].filter(Boolean).join(" "),
  );
  const canonicalDestinationUrl =
    presetDestination ?? (resolved.length > 0 ? pickCanonicalDestinationUrl(resolved) : undefined);

  return {
    clusterId: cluster.clusterId,
    label: cluster.label,
    intent: cluster.intent,
    rationale: cluster.rationale,
    topicTag: resolved[0]?.gridTopicTag ?? "",
    tagLabel,
    memberCount: resolved.length,
    ...(isOverflow
      ? {
          overflowPackCluster: true,
          overflowPackRule:
            "Max URLs per post reached for the CSV new_url. Write a NEW distinct recommendedTitle and lockedDestinationUrl slug from this subset only. Do NOT reuse the CSV canonical URL or append -2/-3 suffixes.",
        }
      : {}),
    ...(isTemporal
      ? {
          temporalCannibalizationExempt: true,
          temporalPillarRule:
            "Time-sliced variants (quarters, tax season, dated archive posts) of the same topic. Output ONE annual/topic pillar: combine all time angles as H2 sections. One lockedDestinationUrl without quarter/month suffixes when possible.",
        }
      : {}),
    ...(resolved.length > 1 ? { mergedTopicGroup: true } : {}),
    ...(yearsRequiredInTitle.length
      ? { yearsRequiredInTitle, titleMustIncludeYear: yearsRequiredInTitle[0] }
      : {}),
    permalinkSamples,
    ...(canonicalDestinationUrl
      ? { lockedDestinationUrl: canonicalDestinationUrl, canonicalDestinationUrl }
      : {}),
    ...(legacySource ? { legacySourceUrl: legacySource } : {}),
    members: memberPayload(cluster, rowById),
  };
}

async function briefOneTopicSlice(
  section: Pick<TopicTagSection, "topicTag" | "tagLabel">,
  clusters: readonly SitemapOptimizerCluster[],
  rowById: Map<string, SitemapOptimizerPostRow>,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
  fixedDestinations?: boolean,
  blogDestination?: BlogDestinationPolicy | null,
): Promise<Map<string, SitemapOptimizerMergeRecommendation>> {
  const allowedIds = clusters.map((c) => c.clusterId);
  let siteOrigin = "";
  for (const cluster of clusters) {
    for (const row of resolvedMembers(cluster, rowById)) {
      try {
        siteOrigin = new URL(row.url.trim()).origin;
        break;
      } catch {
        /* skip */
      }
    }
    if (siteOrigin) break;
  }

  const user = JSON.stringify({
    task: "grid_blog_briefs_for_topic_section",
    topicTag: section.topicTag,
    tagLabel: section.tagLabel,
    siteOrigin,
    requiredBriefCount: clusters.length,
    allowedClusterIds: allowedIds,
    mandatoryTitleRules: [
      "If recommendedPrimaryKeyword contains 19xx or 20xx, recommendedTitle MUST contain that exact year.",
      "Do not drop years for 'historical overview' or similar phrasing when the keyword names a year.",
    ],
    clusters: clusters.map((c) => buildClusterPayload(c, rowById)),
    outputSchema: {
      briefs: [
        {
          clusterId: "string",
          recommendedTitle: "string",
          recommendedPrimaryKeyword: "string",
          recommendedMeta: "string",
          lockedDestinationUrl: "string",
          combinedOutline: ["H2 string"],
          whatToKeepFromEach: [{ url: "string", title: "string", bullets: ["string"] }],
          redirectOrCanonicalNote: "string",
          priority: "high|medium|low",
          confidence: "high|medium|low",
          rationale: "string",
        },
      ],
    },
  });

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model,
    system: briefSystemPrompt(Boolean(fixedDestinations)),
    user,
    maxTokens: SITEMAP_OPTIMIZER_GRID_URL_TAG_MAX_TOKENS,
    temperature: 0.25,
    responseFormat: { type: "json_object" },
    signal,
  });

  const parsed = parseGridBlogBriefBatchJson(content);
  const clusterById = new Map(clusters.map((c) => [c.clusterId, c]));
  const out = new Map<string, SitemapOptimizerMergeRecommendation>();

  for (const brief of parsed) {
    if (!brief.clusterId || !allowedIds.includes(brief.clusterId)) continue;
    const cluster = clusterById.get(brief.clusterId);
    if (!cluster) continue;
    const finalized = finalizeBrief(brief, cluster, rowById, blogDestination);
    if (finalized) out.set(brief.clusterId, finalized);
  }

  return out;
}

async function briefTopicSliceWithFullCoverage(
  section: Pick<TopicTagSection, "topicTag" | "tagLabel">,
  clusters: readonly SitemapOptimizerCluster[],
  rowById: Map<string, SitemapOptimizerPostRow>,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
  fixedDestinations?: boolean,
  blogDestination?: BlogDestinationPolicy | null,
): Promise<Map<string, SitemapOptimizerMergeRecommendation>> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const part = await briefOneTopicSlice(
    section,
    clusters,
    rowById,
    apiKey,
    model,
    signal,
    fixedDestinations,
    blogDestination,
  );
  const missing = clusters.filter((c) => !part.has(c.clusterId));

  if (missing.length === 0) return part;

  if (clusters.length <= 1) {
    fillMissingClusterBriefs(clusters, part, rowById);
    return part;
  }

  const mid = Math.ceil(clusters.length / 2);
  const left = await briefTopicSliceWithFullCoverage(
    section,
    clusters.slice(0, mid),
    rowById,
    apiKey,
    model,
    signal,
    fixedDestinations,
    blogDestination,
  );
  const right = await briefTopicSliceWithFullCoverage(
    section,
    clusters.slice(mid),
    rowById,
    apiKey,
    model,
    signal,
    fixedDestinations,
    blogDestination,
  );

  const merged = new Map(part);
  for (const [id, b] of left) merged.set(id, b);
  for (const [id, b] of right) merged.set(id, b);
  fillMissingClusterBriefs(clusters, merged, rowById);
  return merged;
}

/** Plan merge progress by canonical topic count (not API slice count). */
export function planGridBlogBriefTopics(
  clusterResult: SitemapOptimizerClusterResult,
  rows: readonly SitemapOptimizerPostRow[],
  gridMaxUrlsPerPost?: GridMaxUrlsPerPost,
): { topicsTotal: number; blogsTotal: number } {
  const blogsTotal = clusterResult.clusters.length;
  if (isGridOneToOneRedirectMap(rows, gridMaxUrlsPerPost)) {
    return { topicsTotal: blogsTotal, blogsTotal };
  }
  const rowById = new Map(rows.map((r) => [r.postId, r]));
  const topics = groupClustersByTopicTag(clusterResult.clusters, rowById);
  return { topicsTotal: topics.length, blogsTotal };
}

/** @deprecated Use planGridBlogBriefTopics */
export function planGridBlogBriefSections(
  clusterResult: SitemapOptimizerClusterResult,
  rows: readonly SitemapOptimizerPostRow[],
): { sections: Array<{ topicTag: string; tagLabel: string; clusterCount: number }>; blogsTotal: number } {
  const { blogsTotal } = planGridBlogBriefTopics(clusterResult, rows);
  const rowById = new Map(rows.map((r) => [r.postId, r]));
  const topics = groupClustersByTopicTag(clusterResult.clusters, rowById);
  return {
    sections: topics.map((t) => ({
      topicTag: t.topicTag,
      tagLabel: t.tagLabel,
      clusterCount: t.clusters.length,
    })),
    blogsTotal,
  };
}

/** One OpenRouter batch per topic section; split incomplete slices (no per-cluster retry loop). */
export async function runGridBlogBriefByTopicAgent(
  clusterResult: SitemapOptimizerClusterResult,
  rows: SitemapOptimizerPostRow[],
  apiKey: string,
  signal?: AbortSignal,
  onProgress?: (p: GridBlogBriefSectionProgress) => void,
  gridMaxUrlsPerPost?: GridMaxUrlsPerPost,
  blogDestination?: BlogDestinationPolicy,
): Promise<SitemapOptimizerMergeRecommendation[]> {
  const rowById = new Map(rows.map((r) => [r.postId, r]));
  const targets = clusterResult.clusters;
  if (!targets.length) return [];

  const blogPolicy =
    blogDestination ??
    blogDestinationPolicyForCollections(new Set(["posts"]), { gridCsv: true });

  const oneToOne = isGridOneToOneRedirectMap(rows, gridMaxUrlsPerPost);
  const topics = oneToOne
    ? buildOneToOneTopicSections(targets, rowById)
    : groupClustersByTopicTag(targets, rowById);
  const clustersPerBatch = oneToOne ? 1 : SITEMAP_OPTIMIZER_GRID_BLOG_BRIEF_CLUSTERS_PER_SECTION;
  const model = getResearchModel();
  const byClusterId = new Map<string, SitemapOptimizerMergeRecommendation>();
  const blogsTotal = targets.length;
  const topicsTotal = topics.length;
  const mergeBatchTotal = oneToOne
    ? blogsTotal
    : topics.reduce(
        (sum, topic) => sum + Math.ceil(topic.clusters.length / clustersPerBatch),
        0,
      );
  let mergeBatchStarted = 0;
  let mergeBatchCompleted = 0;

  const emit = (microStep: string, blogsCompleted: number) => {
    onProgress?.({
      topicsCompleted: mergeBatchCompleted >= mergeBatchTotal ? topicsTotal : 0,
      topicsTotal,
      currentTopicLabel: undefined,
      blogsCompleted,
      blogsTotal,
      topicsInFlight: Math.min(SITEMAP_OPTIMIZER_GRID_BLOG_BRIEF_SECTION_CONCURRENCY, topicsTotal),
      microStep,
      mergeBatchCompleted,
      mergeBatchTotal,
    });
  };

  const redirectRows = rows.filter((r) => r.gridRedirectFromUrl?.trim()).length;
  emit(
    oneToOne
      ? blogsTotal < redirectRows
        ? `Queued ${blogsTotal} content plan(s) · ${redirectRows} old URLs → shared new_url`
        : `Queued ${blogsTotal} content plan(s) · one per old → new pair`
      : `Queued ${blogsTotal} content plans · ${mergeBatchTotal} Gemini batches`,
    0,
  );

  await mapTopicsWithConcurrency(
    topics,
    SITEMAP_OPTIMIZER_GRID_BLOG_BRIEF_SECTION_CONCURRENCY,
    async (topic) => {
      const chunks = chunkClusters(topic.clusters, clustersPerBatch);
      for (let i = 0; i < chunks.length; i += 1) {
        const clusters = chunks[i]!;
        const batchNum = ++mergeBatchStarted;
        const member = oneToOne
          ? resolvedMembers(clusters[0]!, rowById)[0]
          : undefined;
        const rowNum = member?.uploadRowIndex;
        const topicLabel = topic.tagLabel?.trim() || topic.topicTag || "untagged";
        emit(
          oneToOne
            ? `Brief ${batchNum}/${mergeBatchTotal}${rowNum != null ? ` · row ${rowNum}` : ""} · ${topicLabel}`
            : `Calling Gemini · batch ${batchNum}/${mergeBatchTotal} · ${clusters.length} plans · ${topicLabel}`,
          byClusterId.size,
        );
        const suffix = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : "";
        const part = await briefTopicSliceWithFullCoverage(
          { topicTag: topic.topicTag, tagLabel: `${topic.tagLabel}${suffix}` },
          clusters,
          rowById,
          apiKey,
          model,
          signal,
          oneToOne,
          blogPolicy,
        );
        for (const [id, brief] of part) byClusterId.set(id, brief);
        mergeBatchCompleted += 1;
        emit(
          oneToOne
            ? `Brief ${mergeBatchCompleted}/${mergeBatchTotal} done · ${byClusterId.size}/${blogsTotal} rows`
            : `Batch ${mergeBatchCompleted}/${mergeBatchTotal} done · ${byClusterId.size}/${blogsTotal} plans`,
          byClusterId.size,
        );
      }
      fillMissingClusterBriefs(topic.clusters, byClusterId, rowById);
      return topic;
    },
    signal,
    (topicsDone, total, topic) => {
      onProgress?.({
        topicsCompleted: topicsDone,
        topicsTotal: total,
        currentTopicLabel: topic.tagLabel,
        blogsCompleted: byClusterId.size,
        blogsTotal,
        topicsInFlight: Math.max(
          0,
          Math.min(SITEMAP_OPTIMIZER_GRID_BLOG_BRIEF_SECTION_CONCURRENCY, total - topicsDone),
        ),
        microStep: `Topic done · ${topic.tagLabel} · ${byClusterId.size}/${blogsTotal} plans`,
        mergeBatchCompleted,
        mergeBatchTotal,
      });
    },
  );

  fillMissingClusterBriefs(targets, byClusterId, rowById);

  onProgress?.({
    topicsCompleted: topicsTotal,
    topicsTotal,
    blogsCompleted: byClusterId.size,
    blogsTotal,
    topicsInFlight: 0,
    microStep: `All ${blogsTotal} content plans ready`,
    mergeBatchCompleted: mergeBatchTotal,
    mergeBatchTotal,
  });

  return targets.map((c) => {
    let brief =
      byClusterId.get(c.clusterId) ?? buildDeterministicGridBrief(c, rowById, undefined, blogPolicy);
    if (!brief) {
      fillMissingClusterBriefs([c], byClusterId, rowById);
      brief =
        byClusterId.get(c.clusterId) ?? buildDeterministicGridBrief(c, rowById, undefined, blogPolicy);
    }
    if (!brief) {
      return {
        clusterId: c.clusterId,
        recommendedTitle: (c.label || "New article").slice(0, 60),
        recommendedPrimaryKeyword: "guide",
        recommendedMeta: "Consolidated guide for related search URLs.",
        combinedOutline: ["Overview", "Key points"],
        whatToKeepFromEach: [],
        redirectOrCanonicalNote: "",
        priority: "medium" as const,
        confidence: "medium" as const,
        rationale: "Deterministic grid brief (empty cluster fallback).",
      };
    }
    return brief;
  });
}
