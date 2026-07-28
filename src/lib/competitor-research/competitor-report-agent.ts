import { loadApiKey } from "@/lib/api";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import type {
  CompetitorKeywordRow,
  CompetitorResearchSemrushResponse,
  GscCompetitorDateRange,
  GscSiteQueryRow,
  TieredCompetitorsResult,
} from "@/lib/competitor-research/types";
import {
  applyClusteredKeywordsToSemrush,
  buildClusterExcludePhrases,
  clusterReportKeywordsAggregated,
  dedupeKeywordRowsForClustering,
  isSemrushClusteredForReportDomains,
  MAX_SEMANTIC_CLUSTERS,
} from "@/lib/competitor-research/competitor-keyword-cluster-openrouter";
import { topCompetitorRowsByTraffic } from "@/lib/competitor-research/competitor-top-rows";
import { enrichmentSortedByTopTraffic, sortKeywordsByTrafficThenVolume } from "@/lib/competitor-research/competitor-keyword-sort";
import {
  getCompetitorReportMaxOutputTokens,
  measureCompetitorReportOpenRouterPayload,
  REPORT_PIPELINE_MICRO_TOTAL,
  type CompetitorReportRequestStats,
  type CompetitorReportMicroStepPayload,
  type ReportPipelineMicroStep,
} from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";
import { renderKeywordsTheyOwnAppendix } from "@/lib/competitor-research/competitor-report-ekr-markdown";
import {
  buildCompetitorReportWirePayload,
  mergeSummarizedWirePreserveDataTables,
  REPORT_WIRE_LEGEND_LINE,
  type CompetitorReportWirePayload,
} from "@/lib/competitor-research/competitor-report-wire";
import {
  COMPETITOR_REPORT_SUMMARIZE_SYSTEM,
  getCompetitorReportSectionSystemPrompt,
  getCompetitorReportSectionUserInstructions,
  stitchCompetitorReportSections,
  type CompetitorReportDataSource,
  type CompetitorReportSectionIndex,
  type GqDemandSource,
} from "@/lib/competitor-research/competitor-report-system-prompt";
import { roundWirePayloadForOpenRouterJson } from "@/lib/competitor-research/competitor-report-openrouter-payload-round";
import { sanitizeStrategistMarkdownSection } from "@/lib/competitor-research/competitor-report-markdown-sanitize";
import { DEFAULT_COMPETITOR_PLAN_MONTHS, clampPlanMonths } from "@/lib/research/plan-months";
import { formatStrategistGuidancePrefix } from "@/lib/research/strategist-guidance";

/** Fired when one strategist section finishes (sections 1–3 may complete in any order). */
export type StrategistSectionReadyPayload = {
  section: CompetitorReportSectionIndex;
  markdown: string;
  requestStats?: CompetitorReportRequestStats;
};

/** Sort parallel section results into 1→3 order before stitch (exported for tests). */
export function sortStrategistParallelSectionResults<T extends { section: CompetitorReportSectionIndex }>(
  results: T[],
): T[] {
  return [...results].sort((a, b) => a.section - b.section);
}

/** True when the provider stopped because output hit max_tokens (truncated mid-report). */
function isCompletionTruncatedByTokenLimit(
  finishReason?: string,
  nativeFinishReason?: string,
): boolean {
  for (const r of [finishReason, nativeFinishReason]) {
    if (typeof r !== "string" || !r.trim()) continue;
    const lo = r.trim().toLowerCase().replace(/-/g, "_");
    if (lo === "length" || lo === "max_tokens" || lo === "max_output_tokens") return true;
    if (lo.includes("max_tokens") || lo.includes("length_limit")) return true;
  }
  return false;
}

/** Lets React paint updated micro-step labels before heavy synchronous JSON.parse. */
function yieldToUiFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** GSC queries included in report context JSON (impressions-sorted). */
const REPORT_GSC_QUERIES_MAX = 200;
export { REPORT_MAX_COMPETITORS } from "@/lib/competitor-research/competitor-top-rows";

function emitReportMicroStep(
  options: { onMicroStep?: (p: CompetitorReportMicroStepPayload) => void } | undefined,
  step: ReportPipelineMicroStep,
  label: string,
  requestStats?: CompetitorReportRequestStats,
): void {
  options?.onMicroStep?.({ step, total: REPORT_PIPELINE_MICRO_TOTAL, label, requestStats });
}

/** Restrict enrichment to report sr domains; keys normalized so Semrush payloads match reportDomainKeys. */
function filterEnrichmentToDomains(
  enrichment: CompetitorResearchSemrushResponse["enrichmentByDomain"],
  domainKeys: Set<string>,
): CompetitorResearchSemrushResponse["enrichmentByDomain"] {
  if (!enrichment) return enrichment;
  const out: NonNullable<typeof enrichment> = {};
  for (const [k, v] of Object.entries(enrichment)) {
    const nk = normalizeCompetitorDomainKey(k);
    if (domainKeys.has(nk)) {
      out[nk] = v;
    }
  }
  return out;
}

function filterTieredCompetitorsToDomains(
  tiers: TieredCompetitorsResult,
  domainKeys: Set<string>,
): TieredCompetitorsResult {
  const nextTiers = tiers.tiers
    .map((g) => ({
      ...g,
      competitors: g.competitors.filter((c) => domainKeys.has(normalizeCompetitorDomainKey(c.domain))),
    }))
    .filter((g) => g.competitors.length > 0);
  return { ...tiers, tiers: nextTiers };
}

async function summarizeResearchWire(args: {
  apiKey: string;
  model: string;
  wire: CompetitorReportWirePayload;
  signal: AbortSignal;
}): Promise<{ json: unknown; usedFallback: boolean }> {
  const roundedWire = roundWirePayloadForOpenRouterJson(args.wire);
  const baseUser = `L:${REPORT_WIRE_LEGEND_LINE} ${JSON.stringify(roundedWire)} Return one JSON object only. Shorten ta.Sum,Rsn,n,lb if long. Keep all numbers and domains. Keep sk,sr,ekr,dm,gq rows.`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = attempt === 0 ? baseUser : `${baseUser} JSON only. No prose. No fences.`;
    try {
      const maxTok = Math.min(32_768, getCompetitorReportMaxOutputTokens(args.model));
      const { content } = await callOpenRouterChatCompletion({
        apiKey: args.apiKey,
        model: args.model,
        system: COMPETITOR_REPORT_SUMMARIZE_SYSTEM,
        user,
        maxTokens: maxTok,
        signal: args.signal,
      });
      const parsed = parseAssistantJsonObject(content);
      return { json: parsed, usedFallback: false };
    } catch {
      /* retry */
    }
  }
  return { json: args.wire, usedFallback: true };
}

/**
 * Long-form Markdown report: client-facing strategist pitch - research model only.
 * Pipeline: cluster domain_organic keywords (OpenRouter, unless already clustered in `semrush`) → wire JSON → optional summarize → Markdown report (OpenRouter).
 */
export async function runCompetitorReportAgent(
  semrush: CompetitorResearchSemrushResponse,
  tiers: TieredCompetitorsResult,
  options?: {
    siteId?: string;
    siteName?: string;
    siteUrl?: string;
    /** Prepended to section 1 user message only (Foundational Pillars / strategic title). */
    strategicBrief?: string;
    /** Prepended to every strategist section user message (Proposal tab). */
    strategistGuidance?: string;
    apiKey?: string;
    gscSiteQueries?: GscSiteQueryRow[];
    gscDateRange?: GscCompetitorDateRange | null;
    onMicroStep?: (info: CompetitorReportMicroStepPayload) => void;
    /** Fired after step 3 - deterministic Keywords They Own Markdown (separate from strategist report). */
    onKeywordsMarkdownReady?: (md: string | null) => void;
    /** Fired as each strategist section completes (completion order may vary within wave 1). */
    onStrategistSectionReady?: (payload: StrategistSectionReadyPayload) => void;
    /** Temp seed mode: `gq` is synthetic demand from ranked keywords, not Search Console. */
    gqDemandSource?: GqDemandSource;
    /** Plan horizon for strategist copy (default 3). Proposal passes the same value as the local blueprint. */
    planMonths?: number;
  },
): Promise<{
  markdown: string;
  keywordsMarkdown: string | null;
  semrushForReport: CompetitorResearchSemrushResponse;
}> {
  const apiKey = options?.apiKey ?? loadApiKey();
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    throw new Error("Add an OpenRouter API key in app settings to generate the report.");
  }

  const reportDataSource: CompetitorReportDataSource =
    semrush.dataSource === "dfs" || semrush.database === "dfs" ? "dfs" : "semrush";

  const gqDemandSource: GqDemandSource = options?.gqDemandSource ?? "gsc";
  const planMonths = clampPlanMonths(options?.planMonths, DEFAULT_COMPETITOR_PLAN_MONTHS);
  const promptOpts = { dataSource: reportDataSource, gqDemandSource, planMonths };

  const researchModelId = getResearchModel(options?.siteId);
  const maxOutputTokens = getCompetitorReportMaxOutputTokens(researchModelId);

  const abortController = new AbortController();
  const abortMs = 1_200_000;
  const abortTimer =
    typeof setTimeout !== "undefined"
      ? setTimeout(() => abortController.abort(), abortMs)
      : null;

  const clientLabel =
    typeof options?.siteName === "string" && options.siteName.trim() ? options.siteName.trim() : null;

  const gscForReport =
    options?.gscSiteQueries?.length && options.gscSiteQueries.length > 0
      ? [...options.gscSiteQueries]
          .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
          .slice(0, REPORT_GSC_QUERIES_MAX)
      : [];

  const semrushRows = semrush.rows ?? [];
  const reportRows = topCompetitorRowsByTraffic(semrushRows, Math.max(1, semrushRows.length));
  const reportDomainKeys = new Set(reportRows.map((r) => normalizeCompetitorDomainKey(r.domain)));
  const tierAnalysis = filterTieredCompetitorsToDomains(tiers, reportDomainKeys);

  /** Semrush domain_organic phrases: traffic-sorted (full server list); no client-side brand or GSC overlap filtering. */
  const enrichmentSorted = enrichmentSortedByTopTraffic(
    filterEnrichmentToDomains(semrush.enrichmentByDomain ?? {}, reportDomainKeys),
  );

  const seedTopKeywordsSorted = sortKeywordsByTrafficThenVolume(semrush.seedTopKeywords ?? []);
  const seedForClustering = dedupeKeywordRowsForClustering(seedTopKeywordsSorted);

  const competitorsForCluster: Record<string, CompetitorKeywordRow[]> = {};
  for (const r of reportRows) {
    const nk = normalizeCompetitorDomainKey(r.domain);
    competitorsForCluster[nk] = dedupeKeywordRowsForClustering(
      enrichmentSorted?.[nk]?.topKeywords ?? [],
    );
  }

  const skipCluster = isSemrushClusteredForReportDomains(semrush, reportDomainKeys);

  let semrushForReport: CompetitorResearchSemrushResponse;
  if (skipCluster) {
    emitReportMicroStep(
      options,
      1,
      "Using saved keyword clusters (skipping OpenRouter clustering).",
    );
    semrushForReport = semrush;
  } else {
    emitReportMicroStep(
      options,
      1,
      "Clustering keywords (OpenRouter). Semantic groups per domain; metrics aggregated from Semrush rows.",
    );

    const excludePhrases = buildClusterExcludePhrases(
      gscForReport,
      seedForClustering.map((r) => r.phrase),
    );

    const clusterResult = await clusterReportKeywordsAggregated({
      apiKey,
      model: researchModelId,
      signal: abortController.signal,
      seed: seedForClustering,
      competitors: competitorsForCluster,
      excludePhrases,
    });

    semrushForReport = applyClusteredKeywordsToSemrush(semrush, clusterResult, reportDomainKeys);
  }
  const seedForWire = sortKeywordsByTrafficThenVolume(semrushForReport.seedTopKeywords ?? []);
  const enrichmentForWire = filterEnrichmentToDomains(
    semrushForReport.enrichmentByDomain ?? {},
    reportDomainKeys,
  );

  const reportCompetitorLimitNote = `sr lists ${reportRows.length} competitor domain(s) from Semrush (sorted by organic traffic).`;

  const competitorKeywordSortNote = `ekr: up to ${MAX_SEMANTIC_CLUSTERS} semantic clusters per competitor; Σ Vol and Σ Traffic are summed from Semrush rows in each cluster; Position is best (lowest) rank among members. sk: same for seed.`;

  const competitorSiteAlignmentNote = skipCluster
    ? "ekr/sk: Semantic clusters in sk/ekr use saved member lists; numeric metrics are aggregated in code from Semrush (not invented)."
    : "ekr/sk: OpenRouter assigns cluster labels and member phrase lists; numeric metrics are aggregated in code from Semrush (not invented).";

  const reportLinkBudgetAssumptionFor3MonthTable =
    `Link budget ~USD 300/mo combined PR plus paid links; target **1-5 net-new quality backlinks per month** (stay under 10/mo); AS gain often +0-2 pts in ${planMonths}mo.`;

  const wire = buildCompetitorReportWirePayload({
    semrush: semrushForReport,
    reportRows,
    seedTopKeywords: seedForWire,
    enrichmentByDomain: enrichmentForWire,
    tierAnalysis,
    gscForReport,
    gscDateRange: options?.gscDateRange ?? null,
    clientLabel,
    siteName: options?.siteName,
    siteUrl: options?.siteUrl,
    reportCompetitorLimitNote,
    competitorKeywordSortNote,
    competitorSiteAlignmentNote,
    reportLinkBudgetAssumptionFor3MonthTable,
    gqDemandSource,
  });

  emitReportMicroStep(
    options,
    2,
    "Built SEO wire context (organic-only, clustered ekr + skM/ekrM, abbrev keys + legend).",
  );

  const keywordsAppendixRaw = renderKeywordsTheyOwnAppendix(wire);
  const keywordsMarkdown =
    typeof keywordsAppendixRaw === "string" && keywordsAppendixRaw.trim().length > 0
      ? keywordsAppendixRaw
      : null;

  emitReportMicroStep(
    options,
    3,
    keywordsMarkdown
      ? "Keywords They Own document ready (deterministic tables). Separate from the strategist report."
      : "No Keywords They Own tables (no Semrush sk/ekr rows). Continuing.",
  );
  options?.onKeywordsMarkdownReady?.(keywordsMarkdown);

  let summarizeFallback = false;
  let researchPayload: unknown = wire;
  try {
    emitReportMicroStep(
      options,
      4,
      "Summarizing research (OpenRouter). Shrinking text fields.",
    );
    const sum = await summarizeResearchWire({
      apiKey,
      model: researchModelId,
      wire,
      signal: abortController.signal,
    });
    researchPayload = mergeSummarizedWirePreserveDataTables(wire, sum.json);
    summarizeFallback = sum.usedFallback;
  } finally {
    /* noop */
  }

  emitReportMicroStep(
    options,
    5,
    summarizeFallback
      ? "Summarize skipped. Using full wire JSON for the report step."
      : "Summary JSON ready. Writing Markdown report.",
  );

  const roundedForPost = roundWirePayloadForOpenRouterJson(researchPayload);
  const jsonPayload = JSON.stringify(roundedForPost);

  const enrichmentTopKeywordRowsTotal = Object.values(enrichmentForWire ?? {}).reduce(
    (acc, enr) => acc + (enr?.topKeywords?.length ?? 0),
    0,
  );

  const sectionIndices: CompetitorReportSectionIndex[] = [1, 2, 3];
  const systemFirst = getCompetitorReportSectionSystemPrompt(1, MAX_SEMANTIC_CLUSTERS, promptOpts);
  const briefPrefix =
    typeof options?.strategicBrief === "string" && options.strategicBrief.trim().length > 0
      ? `USER_STRATEGIC_BRIEF: ${options.strategicBrief.trim().replace(/\s+/g, " ").slice(0, 4000)}\n\n`
      : "";
  const guidancePrefix = formatStrategistGuidancePrefix(options?.strategistGuidance);
  const userFirst = `${briefPrefix}L:${REPORT_WIRE_LEGEND_LINE} ${jsonPayload} I:${getCompetitorReportSectionUserInstructions(1, MAX_SEMANTIC_CLUSTERS, promptOpts)}`;

  const requestStats = measureCompetitorReportOpenRouterPayload({
    model: researchModelId,
    maxTokensRequested: maxOutputTokens,
    system: systemFirst,
    userMessage: userFirst,
    context: roundedForPost,
    breakdown: {
      semrushRowCount: reportRows.length,
      gscQueryCount: gscForReport.length,
      enrichmentDomainCount: Object.keys(enrichmentForWire ?? {}).length,
      enrichmentTopKeywordRowsTotal,
      seedTopKeywordCount: seedForWire.length,
      tierGroupCount: tierAnalysis.tiers.length,
    },
  });

  emitReportMicroStep(
    options,
    6,
    "Writing strategist report (three OpenRouter completions in parallel; large tables can take several minutes)…",
    requestStats,
  );

  let parallelResults: { section: CompetitorReportSectionIndex; markdown: string; truncated: boolean }[];

  const runOneStrategistSection = async (
    section: CompetitorReportSectionIndex,
  ): Promise<{ section: CompetitorReportSectionIndex; markdown: string; truncated: boolean }> => {
    const system = getCompetitorReportSectionSystemPrompt(section, MAX_SEMANTIC_CLUSTERS, promptOpts);
    const userPayloadForSection = roundedForPost;
    const userJsonPayload = JSON.stringify(userPayloadForSection);
    const legend = REPORT_WIRE_LEGEND_LINE;
    const sectionBrief = section === 1 && briefPrefix ? briefPrefix : "";
    const userMsg = `${sectionBrief}${guidancePrefix}L:${legend} ${userJsonPayload} I:${getCompetitorReportSectionUserInstructions(section, MAX_SEMANTIC_CLUSTERS, promptOpts)}`;

    const sectionRequestStats = measureCompetitorReportOpenRouterPayload({
      model: researchModelId,
      maxTokensRequested: maxOutputTokens,
      system,
      userMessage: userMsg,
      context: userPayloadForSection,
      breakdown: {
        semrushRowCount: reportRows.length,
        gscQueryCount: gscForReport.length,
        enrichmentDomainCount: Object.keys(enrichmentForWire ?? {}).length,
        enrichmentTopKeywordRowsTotal,
        seedTopKeywordCount: seedForWire.length,
        tierGroupCount: tierAnalysis.tiers.length,
      },
    });

    let completion: Awaited<ReturnType<typeof callOpenRouterChatCompletion>>;
    try {
      completion = await callOpenRouterChatCompletion({
        apiKey,
        model: researchModelId,
        system,
        user: userMsg,
        maxTokens: maxOutputTokens,
        signal: abortController.signal,
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "AbortError") {
        throw new Error(
          `Competitor report request timed out after ${Math.round(abortMs / 60000)} minutes. Try again, or pick a faster research model in settings.`,
        );
      }
      throw e;
    }

    const hit = isCompletionTruncatedByTokenLimit(completion.finishReason, completion.nativeFinishReason);
    const rawTrimmed = (completion.content ?? "").trim();
    const markdown = sanitizeStrategistMarkdownSection(rawTrimmed);
    options?.onStrategistSectionReady?.({ section, markdown, requestStats: sectionRequestStats });
    await yieldToUiFrame();
    return { section, markdown, truncated: hit };
  };

  try {
    parallelResults = await Promise.all(sectionIndices.map((s) => runOneStrategistSection(s)));
  } finally {
    if (abortTimer !== null) clearTimeout(abortTimer);
  }

  const sorted = sortStrategistParallelSectionResults(parallelResults);
  const sectionBodies: [string, string, string] = [sorted[0].markdown, sorted[1].markdown, sorted[2].markdown];
  const truncatedSections: CompetitorReportSectionIndex[] = sorted.filter((r) => r.truncated).map((r) => r.section);

  emitReportMicroStep(options, 7, "Strategist sections received. Assembling final Markdown…");
  await yieldToUiFrame();

  const body = stitchCompetitorReportSections(sectionBodies);

  const hitLengthLimit = truncatedSections.length > 0;
  const sectionNote =
    truncatedSections.length > 0
      ? ` Truncated section(s): ${truncatedSections.join(", ")}.`
      : "";

  emitReportMicroStep(
    options,
    8,
    hitLengthLimit
      ? `Report assembled. One or more sections hit the completion token limit.${sectionNote}`
      : "Report assembled.",
  );

  emitReportMicroStep(
    options,
    9,
    hitLengthLimit
      ? "Strategist report ready. Partial text in at least one section."
      : "Strategist report ready.",
  );

  const markdown = `${body}\n`;
  return { markdown, keywordsMarkdown, semrushForReport };
}
