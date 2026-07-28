import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { BULK_WORDPRESS_POST_TITLE_RULE } from "@/lib/prompt-builders/system-user";
import {
  stripHtmlToPlainText,
  truncatePlainText,
} from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import { SITEMAP_OPTIMIZER_MERGE_CONTENT_MAX } from "@/lib/sitemap-optimizer/constants";
import { resolveEntityLockedDestination } from "@/lib/sitemap-optimizer/entity-locked-destination";
import {
  entitySapBriefHasRequiredFields,
  parseEntitySapBriefJson,
  type ParsedEntitySapBrief,
} from "@/lib/sitemap-optimizer/entity-sap-brief-parse";
import {
  ENTITY_MERGE_AGENT_PREAMBLE,
  entityConsolidatedTitleHint,
  entityMergeContextForMembers,
} from "@/lib/sitemap-optimizer/entity-merge-prompts";
import { gridMemberSourceUrl } from "@/lib/sitemap-optimizer/grid-member-url";
import { displayPostTitle } from "@/lib/sitemap-optimizer/merge-results-display";
import { resolvedMemberRows } from "@/lib/sitemap-optimizer/resolved-cluster-members";
import type { BlogDestinationPolicy } from "@/lib/sitemap-optimizer/blog-destination-policy";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

const ENTITY_SAP_BRIEF_MAX_ATTEMPTS = 3;

const ENTITY_SAP_BRIEF_SYSTEM = `${ENTITY_MERGE_AGENT_PREAMBLE}

You output one SAP bulk CSV row per cluster for service-area / location landing pages.

Return ONLY one JSON object (no markdown fences). Use these exact keys:
- recommendedPrimaryKeyword (string, geography-free, 2-4 words)
- sapEntity (string, hyperlocal place label: Place, City[, Province])
- recommendedTitle (string, local SEO headline with keyword substring + Near/in phrasing)
- sapModifier (string, optional writer brief, may be "")
- recommendedMeta (string, 120-160 chars)
- combinedOutline (array of H2 strings)
- whatToKeepFromEach (array of { url, title, bullets })
- redirectOrCanonicalNote (string)
- priority ("high"|"medium"|"low")
- confidence ("high"|"medium"|"low")
- rationale (string)

You may also use bulk CSV aliases keyword, entity, title, modifier instead of the recommended* / sap* keys.

Rules:
- recommendedPrimaryKeyword: no city or neighbourhood tokens.
- sapEntity: hyperlocal anchor first, then city; not a sentence; no "Near" prefix.
- recommendedTitle: include recommendedPrimaryKeyword as exact substring; local phrasing; no pipe brand suffix.
${BULK_WORDPRESS_POST_TITLE_RULE}
- sapModifier: short writer brief only. Never "Search intent", "Required H2 sections", or "consolidated service-area page".`;

const ENTITY_SAP_BRIEF_REPAIR_SYSTEM = `You repair incomplete SAP bulk row JSON for a service-area landing page.

Return ONLY one valid JSON object with ALL required keys populated:
recommendedPrimaryKeyword, sapEntity, recommendedTitle, sapModifier, recommendedMeta, combinedOutline, whatToKeepFromEach, redirectOrCanonicalNote, priority, confidence, rationale.

Aliases allowed: keyword, entity, title, modifier. No markdown fences.`;

function memberPayload(
  cluster: SitemapOptimizerCluster,
  rowById: Map<string, SitemapOptimizerPostRow>,
): Record<string, unknown>[] {
  return cluster.memberPostIds.map((id) => {
    const row = rowById.get(id);
    if (!row) return { postId: id, missing: true };
    const body =
      row.contentSnippet ||
      truncatePlainText(stripHtmlToPlainText(row.seoResearch ?? ""), SITEMAP_OPTIMIZER_MERGE_CONTENT_MAX);
    return {
      postId: id,
      url: row.url,
      title: row.title,
      keyword: row.keyword,
      meta: row.meta,
      collection: row.collection,
      gscTopQueries: row.gscQueries.slice(0, 12).map((q) => q.query),
      contentSnippet: body,
    };
  });
}

function fillEntitySapBriefGaps(
  brief: ParsedEntitySapBrief,
  members: readonly SitemapOptimizerPostRow[],
): ParsedEntitySapBrief {
  const out = { ...brief };
  if (!out.combinedOutline.length) {
    out.combinedOutline = [
      "Local service overview",
      "Products and options",
      "Service area coverage",
      "Next steps",
    ];
  }
  if (!out.whatToKeepFromEach.length) {
    out.whatToKeepFromEach = members.map((row) => ({
      url: gridMemberSourceUrl(row),
      title: displayPostTitle(row.title || ""),
      bullets: [displayPostTitle(row.title || row.url)].filter(Boolean),
    }));
  }
  return out;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  signal?: AbortSignal,
  onItemDone?: (completed: number, total: number) => void,
): Promise<R[]> {
  const n = items.length;
  const ret: R[] = new Array(n);
  let next = 0;
  let finished = 0;
  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const idx = next++;
      if (idx >= n) return;
      ret[idx] = await fn(items[idx]!);
      finished += 1;
      onItemDone?.(finished, n);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), n);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return ret;
}

function buildUserPayload(
  cluster: SitemapOptimizerCluster,
  rowById: Map<string, SitemapOptimizerPostRow>,
  siteName: string,
): Record<string, unknown> {
  const members = resolvedMemberRows(cluster, rowById);
  return {
    task: "entity_sap_bulk_row",
    siteName: siteName.trim() || undefined,
    cluster: {
      clusterId: cluster.clusterId,
      label: cluster.label,
      intent: cluster.intent,
      memberCount: members.length,
    },
    entityContext: entityMergeContextForMembers(members),
    members: memberPayload(cluster, rowById),
  };
}

async function requestEntitySapBrief(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  signal?: AbortSignal,
): Promise<string> {
  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model,
    system,
    user,
    maxTokens,
    temperature,
    responseFormat: { type: "json_object" },
    signal,
  });
  return content;
}

async function briefOneEntityCluster(
  cluster: SitemapOptimizerCluster,
  rowById: Map<string, SitemapOptimizerPostRow>,
  apiKey: string,
  model: string,
  siteName: string,
  blogDestination: BlogDestinationPolicy | null | undefined,
  signal?: AbortSignal,
  lockedDestinationUrl?: string,
): Promise<SitemapOptimizerMergeRecommendation> {
  const members = resolvedMemberRows(cluster, rowById);
  const maxTokens = members.length > 2 ? 8000 : 5000;
  const baseUser = JSON.stringify(buildUserPayload(cluster, rowById, siteName));

  let lastContent = "";
  let parsed: ParsedEntitySapBrief | null = null;

  for (let attempt = 0; attempt < ENTITY_SAP_BRIEF_MAX_ATTEMPTS; attempt++) {
    const temperature = attempt === 0 ? 0.35 : 0.15;
    const user =
      attempt === 0
        ? baseUser
        : JSON.stringify({
            task: "repair_entity_sap_brief",
            clusterId: cluster.clusterId,
            missing:
              "Populate recommendedPrimaryKeyword, sapEntity, and recommendedTitle. Use keyword/entity/title aliases if easier.",
            previousResponse: lastContent.slice(0, 12_000),
            cluster: buildUserPayload(cluster, rowById, siteName).cluster,
            entityContext: entityMergeContextForMembers(members),
            members: memberPayload(cluster, rowById),
          });

    lastContent = await requestEntitySapBrief(
      apiKey,
      model,
      attempt === 0 ? ENTITY_SAP_BRIEF_SYSTEM : ENTITY_SAP_BRIEF_REPAIR_SYSTEM,
      user,
      maxTokens,
      temperature,
      signal,
    );

    const candidate = parseEntitySapBriefJson(lastContent, cluster.clusterId);
    if (candidate && entitySapBriefHasRequiredFields(candidate)) {
      parsed = fillEntitySapBriefGaps(candidate, members);
      break;
    }
    parsed = candidate;
  }

  if (!parsed || !entitySapBriefHasRequiredFields(parsed)) {
    lastContent = await requestEntitySapBrief(
      apiKey,
      model,
      ENTITY_SAP_BRIEF_REPAIR_SYSTEM,
      JSON.stringify({
        task: "final_repair_entity_sap_brief",
        clusterId: cluster.clusterId,
        requiredKeys: [
          "recommendedPrimaryKeyword",
          "sapEntity",
          "recommendedTitle",
          "sapModifier",
          "recommendedMeta",
        ],
        previousResponse: lastContent.slice(0, 12_000),
        members: memberPayload(cluster, rowById),
        entityContext: entityMergeContextForMembers(members),
      }),
      maxTokens,
      0.1,
      signal,
    );
    const repaired = parseEntitySapBriefJson(lastContent, cluster.clusterId);
    if (repaired && entitySapBriefHasRequiredFields(repaired)) {
      parsed = fillEntitySapBriefGaps(repaired, members);
    }
  }

  if (!parsed || !entitySapBriefHasRequiredFields(parsed)) {
    throw new Error(
      `Entity SAP brief failed for cluster ${cluster.clusterId} after ${ENTITY_SAP_BRIEF_MAX_ATTEMPTS} attempts. Re-run analyze or reduce cluster size.`,
    );
  }

  const lockedFromPlan = lockedDestinationUrl?.trim();
  const locked =
    lockedFromPlan ||
    resolveEntityLockedDestination(cluster, rowById, blogDestination, parsed.recommendedTitle) ||
    resolveEntityLockedDestination(
      cluster,
      rowById,
      blogDestination,
      entityConsolidatedTitleHint(members, parsed.recommendedPrimaryKeyword),
    );
  if (!locked) {
    throw new Error(
      `Entity SAP brief failed for cluster ${cluster.clusterId}: could not resolve service-area destination URL.`,
    );
  }

  return {
    clusterId: cluster.clusterId,
    recommendedTitle: parsed.recommendedTitle,
    recommendedPrimaryKeyword: parsed.recommendedPrimaryKeyword,
    recommendedMeta: parsed.recommendedMeta,
    sapEntity: parsed.sapEntity,
    sapModifier: parsed.sapModifier,
    combinedOutline: parsed.combinedOutline,
    whatToKeepFromEach: parsed.whatToKeepFromEach,
    redirectOrCanonicalNote: parsed.redirectOrCanonicalNote,
    priority: parsed.priority,
    confidence: parsed.confidence,
    rationale: parsed.rationale,
    lockedDestinationUrl: locked,
  };
}

/** AI SAP-shaped briefs for every entity cluster (including 1:1). */
export async function runEntitySapBriefAgent(
  clusters: SitemapOptimizerCluster[],
  rows: SitemapOptimizerPostRow[],
  apiKey: string,
  args: {
    siteName?: string;
    blogDestination?: BlogDestinationPolicy | null;
    concurrency: number;
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
    /** Redirect-plan pillar URLs: content briefs must not invent new destinations. */
    lockedDestinationByClusterId?: ReadonlyMap<string, string>;
  },
): Promise<SitemapOptimizerMergeRecommendation[]> {
  if (!clusters.length) return [];

  const rowById = new Map(rows.map((r) => [r.postId, r]));
  const model = getResearchModel();
  const siteName = args.siteName?.trim() ?? "";
  const lockedByCluster = args.lockedDestinationByClusterId;

  return mapWithConcurrency(
    clusters,
    args.concurrency,
    (cluster) =>
      briefOneEntityCluster(
        cluster,
        rowById,
        apiKey,
        model,
        siteName,
        args.blogDestination,
        args.signal,
        lockedByCluster?.get(cluster.clusterId),
      ),
    args.signal,
    args.onProgress,
  );
}
