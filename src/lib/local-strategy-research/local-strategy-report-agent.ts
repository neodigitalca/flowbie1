import { loadApiKey } from "@/lib/api";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import type {
  CompetitorResearchSemrushResponse,
  GscCompetitorDateRange,
  GscSiteQueryRow,
  TieredCompetitorsResult,
} from "@/lib/competitor-research/types";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import {
  getCompetitorReportMaxOutputTokens,
  measureCompetitorReportOpenRouterPayload,
  type CompetitorReportRequestStats,
} from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { roundNumericValuesDeep } from "@/lib/competitor-research/competitor-report-openrouter-payload-round";
import { sanitizeStrategistMarkdownSection } from "@/lib/competitor-research/competitor-report-markdown-sanitize";
import {
  buildLocalStrategyWirePayload,
  LOCAL_STRATEGY_WIRE_LEGEND_LINE,
  type LocalStrategyGmbOauthWire,
  type LocalStrategyWirePayload,
} from "@/lib/local-strategy-research/local-strategy-report-wire";
import {
  getLocalStrategyReportSectionSystemPrompt,
  getLocalStrategyReportSectionUserInstructions,
  LOCAL_STRATEGY_SECTION_COUNT,
  stitchLocalStrategyReportSections,
  type LocalStrategyReportSectionIndex,
} from "@/lib/local-strategy-research/local-strategy-report-system-prompt";
import {
  LOCAL_STRATEGY_REPORT_MICRO_TOTAL,
  type LocalStrategyReportMicroStepPayload,
} from "@/lib/local-strategy-research/local-strategy-report-openrouter-limits";
import type { ProposalSiteAuditResult } from "@/lib/research/proposal-site-audit-types";
import { siteAuditToWire } from "@/lib/research/proposal-site-audit-fetch";
import { DEFAULT_LOCAL_STRATEGY_PLAN_MONTHS, clampPlanMonths } from "@/lib/research/plan-months";
import { formatStrategistGuidancePrefix } from "@/lib/research/strategist-guidance";

export type LocalStrategyStrategistSectionReadyPayload = {
  section: LocalStrategyReportSectionIndex;
  markdown: string;
  requestStats?: CompetitorReportRequestStats;
};

function yieldToUiFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function isCompletionTruncatedByTokenLimit(finishReason?: string, nativeFinishReason?: string): boolean {
  for (const r of [finishReason, nativeFinishReason]) {
    if (typeof r !== "string" || !r.trim()) continue;
    const lo = r.trim().toLowerCase().replace(/-/g, "_");
    if (lo === "length" || lo === "max_tokens" || lo === "max_output_tokens") return true;
    if (lo.includes("max_tokens") || lo.includes("length_limit")) return true;
  }
  return false;
}

function emitMicro(
  onMicroStep: ((p: LocalStrategyReportMicroStepPayload) => void) | undefined,
  step: number,
  label: string,
): void {
  onMicroStep?.({ step, total: LOCAL_STRATEGY_REPORT_MICRO_TOTAL, label });
}

/**
 * Local SEO blueprint - 13 sequential OpenRouter passes + stitch (default 4-month horizon unless overridden).
 */
export async function runLocalStrategyReportAgent(
  semrush: CompetitorResearchSemrushResponse,
  tiers: TieredCompetitorsResult,
  options: {
    siteId?: string;
    siteName?: string | null;
    siteUrl?: string | null;
    businessNameQuery: string;
    geoLabel?: string | null;
    gmbDfsRaw: unknown;
    gmbOauth: LocalStrategyGmbOauthWire | null;
    gscSiteQueries?: GscSiteQueryRow[];
    gscDateRange?: GscCompetitorDateRange | null;
    gqDemandSource: "gsc" | "dfs_seed";
    /** Plan horizon for titles and narrative (default 4). Proposal passes the same value as competitor report. */
    planMonths?: number;
    apiKey?: string;
    onMicroStep?: (info: LocalStrategyReportMicroStepPayload) => void;
    onStrategistSectionReady?: (payload: LocalStrategyStrategistSectionReadyPayload) => void;
    /** Lighthouse + FAQ audit from proposal site-audit (optional). */
    siteAudit?: ProposalSiteAuditResult | null;
    /** Optional user guidance prepended to every blueprint section. */
    strategistGuidance?: string;
  },
): Promise<{ markdown: string }> {
  const apiKey = options.apiKey ?? loadApiKey();
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    throw new Error("Add an OpenRouter API key in app settings to generate the report.");
  }

  const researchModelId = getResearchModel(options?.siteId);
  const maxOutputTokens = getCompetitorReportMaxOutputTokens(researchModelId);

  const abortController = new AbortController();
  const abortMs = options.siteAudit ? 2_100_000 : 1_200_000;
  const abortTimer =
    typeof setTimeout !== "undefined"
      ? setTimeout(() => abortController.abort(), abortMs)
      : null;

  const clientLabel =
    typeof options.siteName === "string" && options.siteName.trim() ? options.siteName.trim() : null;

  const planMonths = clampPlanMonths(options.planMonths, DEFAULT_LOCAL_STRATEGY_PLAN_MONTHS);

  const siteAuditWire = options.siteAudit ? siteAuditToWire(options.siteAudit) : null;

  const wire: LocalStrategyWirePayload = buildLocalStrategyWirePayload({
    semrush,
    tiers,
    siteUrl: options.siteUrl?.trim() || null,
    clientLabel,
    businessNameQuery: options.businessNameQuery,
    geoLabel: options.geoLabel ?? null,
    gmbDfsRaw: options.gmbDfsRaw,
    gmbOauth: options.gmbOauth,
    gscQueries: options.gscSiteQueries ?? [],
    gscDateRange: options.gscDateRange ?? null,
    gqDemandSource: options.gqDemandSource,
    planMonths,
    siteAudit: siteAuditWire,
  });

  emitMicro(options.onMicroStep, 1, "Built local strategy wire (GBP + organic snapshot + GSC).");

  const roundedWire = roundNumericValuesDeep(wire) as Record<string, unknown>;
  const jsonPayload = JSON.stringify(roundedWire);
  const guidancePrefix = formatStrategistGuidancePrefix(options.strategistGuidance);

  const allSections: LocalStrategyReportSectionIndex[] = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
  ];
  const parts: string[] = [];
  const truncated: LocalStrategyReportSectionIndex[] = [];

  try {
    for (let i = 0; i < allSections.length; i++) {
      const section = allSections[i]!;
      const stepNum = 2 + i;
      emitMicro(
        options.onMicroStep,
        stepNum,
        `Writing local blueprint section ${section}/${LOCAL_STRATEGY_SECTION_COUNT}…`,
      );

      const system = getLocalStrategyReportSectionSystemPrompt(section, planMonths);
      const userMsg = `${guidancePrefix}L:${LOCAL_STRATEGY_WIRE_LEGEND_LINE} ${jsonPayload} I:${getLocalStrategyReportSectionUserInstructions(section)}`;

      const requestStats = measureCompetitorReportOpenRouterPayload({
        model: researchModelId,
        maxTokensRequested: maxOutputTokens,
        system,
        userMessage: userMsg,
        context: roundedWire,
        breakdown: {
          semrushRowCount: semrush.rows?.length ?? 0,
          gscQueryCount: options.gscSiteQueries?.length ?? 0,
          enrichmentDomainCount: Object.keys(semrush.enrichmentByDomain ?? {}).length,
          enrichmentTopKeywordRowsTotal: Object.values(semrush.enrichmentByDomain ?? {}).reduce(
            (acc, en) => acc + (en?.topKeywords?.length ?? 0),
            0,
          ),
          seedTopKeywordCount: semrush.seedTopKeywords?.length ?? 0,
          tierGroupCount: tiers.tiers.length,
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
            `Local strategy report timed out after ${Math.round(abortMs / 60000)} minutes. Try again or pick a faster research model.`,
          );
        }
        throw e;
      }

      const hit = isCompletionTruncatedByTokenLimit(completion.finishReason, completion.nativeFinishReason);
      if (hit) truncated.push(section);

      const rawTrimmed = (completion.content ?? "").trim();
      const markdown = sanitizeStrategistMarkdownSection(rawTrimmed);
      parts.push(markdown);
      options.onStrategistSectionReady?.({ section, markdown, requestStats });
      await yieldToUiFrame();
    }
  } finally {
    if (abortTimer !== null) clearTimeout(abortTimer);
  }

  emitMicro(options.onMicroStep, 14, "Assembling final Markdown…");
  await yieldToUiFrame();

  const body = stitchLocalStrategyReportSections(parts);

  emitMicro(options.onMicroStep, 15, truncated.length ? "Report assembled (truncation warning)." : "Report assembled.");

  return { markdown: `${body}\n` };
}
