import { callGscReportingOpenRouterChatCompletion } from "@/lib/gsc-reporting/gsc-reporting-openrouter";
import {
  buildOpenRouterChatPostBodyJson,
  getCompetitorReportMaxOutputTokens,
} from "@/lib/competitor-research/competitor-report-openrouter-limits";
import {
  bundleGscOutlineFilesForPrompt,
} from "@/lib/gsc-reporting/gsc-reporting-outline-bundle";
import {
  type GscManualAiPayload,
  type GscManualAiTopRow,
} from "@/lib/gsc-manual-ai-aggregate";
import type { GscReportingOutlineResult, GscReportingSectionKind, GscReportingSectionPlan } from "@/lib/gsc-reporting/gsc-reporting-types";
import { GSC_OUTLINE_OPENROUTER_OPTS } from "@/lib/gsc-reporting/gsc-reporting-outline-schema";
import {
  searchPerformanceH2ForCompareKind,
  type GscCompareKind,
} from "@/lib/gsc-reporting/gsc-reporting-compare-signals";
import { seedHasGenerativeAiFiles } from "@/lib/gsc-reporting/gsc-reporting-generative-ai";
import {
  applyReportPeriodToClientSeason,
  emptyGscClientSeasonContext,
  formatGscClientSeasonPromptBlock,
  type GscClientSeasonContext,
} from "@/lib/gsc-reporting/gsc-reporting-client-season";
import { formatGscReportTitlePeriod } from "@/lib/gsc-reporting/gsc-reporting-document-title";

/** Fail fast when OpenRouter outline hangs (PHP allows up to 300s). */
export const GSC_OUTLINE_OPENROUTER_TIMEOUT_MS = 120_000;

function outlineAbortSignal(userSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(GSC_OUTLINE_OPENROUTER_TIMEOUT_MS);
  if (!userSignal) return timeoutSignal;
  return AbortSignal.any([userSignal, timeoutSignal]);
}

/** Blog-style Title Case H2s; no calendar ranges in headings (periods stay in tables / CSV). */
const CANONICAL_H2_BY_KIND: Partial<Record<GscReportingSectionKind, string>> = {
  executive_summary: "Executive Summary",
  generative_ai_impressions: "Generative AI Search Impressions",
  search_performance_period: "Search Performance Compared Month Over Month",
  key_performance_insights: "Key Performance Insights for the Team",
  sap_local_seo: "SAP & Local SEO Performance",
  content_performance: "Content Performance: Your Growing Digital Footprint",
};

/** Overwrite model-provided h2Title for standard sections so titles stay consistent. Cluster sections keep their titles. */
export function applyCanonicalGscSectionTitles(
  sections: GscReportingSectionPlan[],
  compareKind: GscCompareKind = "mom",
): GscReportingSectionPlan[] {
  const searchPerformanceH2 = searchPerformanceH2ForCompareKind(compareKind);
  return sections.map((s) => {
    if (s.kind === "cluster") return s;
    if (s.kind === "search_performance_period") {
      return { ...s, h2Title: searchPerformanceH2 };
    }
    const h2 = CANONICAL_H2_BY_KIND[s.kind];
    return h2 ? { ...s, h2Title: h2 } : s;
  });
}

const OUTLINE_SYSTEM = `You are an SEO analyst. The user provides Google Search Console CSV exports.

Return JSON matching the response schema exactly.

**executiveSummary** MUST name the **REPORT_PERIOD** date range when referring to the current window, and include **exactly one sentence** that uses the word **seasonality** and says **busy** or **not busy** for this city and vertical across the **full REPORT_PERIOD** from **CLIENT_SEASON** (not only the first month; not today's calendar month). Do **not** say **shoulder**, **peak**, or **slow**. Do **not** repeat that seasonality reading elsewhere. Do not invent metrics. Do not invent a city.

Data rules:
- Numbers in executiveSummary, metrics, and evidence must come from the CSV text.
- **Site-totals-MoM.csv** includes **Search queries** (total query count per period) as a standard site-wide KPI alongside clicks, impressions, CTR, and position.
- When **Site-totals-compare-signals.txt** is present, **executiveSummary** must align with \`primaryPattern\` and \`interpretation\` from that block. **Never** describe **query_footprint_expansion** months as overall search visibility decline.
- **Cross-metric rule (any period compare):** Do **not** infer visibility loss from average position alone when **Search queries** and **Total impressions** both rose vs the prior period.
- **Formatting:** Do **not** wrap queries, keywords, page titles, or brands in \`"\` or \`'\` in **executiveSummary**, **topOpportunities** labels, **why**, or **metrics**. Use plain text only.
- **executiveSummary** must be **factual synthesis** with numbers from the CSV only; keep it **thematic**. Do **not** output prioritized action lists, "next steps", or tactical blocks.
- topOpportunities: at most 8 rows; rank by business impact and merge near-duplicates.
- evidence: at most 3 strings per row, each under 200 characters.`;

export function defaultSectionsFromPayload(
  p: GscManualAiPayload,
  compareKind: GscCompareKind = "mom",
  options?: { includeGenerativeAi?: boolean },
): GscReportingSectionPlan[] {
  void p;
  const includeGenerativeAi = options?.includeGenerativeAi === true;
  const sections: GscReportingSectionPlan[] = [
    {
      id: "executive_summary",
      h2Title: "",
      kind: "executive_summary",
      ragQuery: "executive summary clicks impressions ctr position trends branded",
    },
  ];
  if (includeGenerativeAi) {
    sections.push({
      id: "generative_ai_impressions",
      h2Title: "",
      kind: "generative_ai_impressions",
      ragQuery: "generative AI impressions AI Overviews AI Mode Pages-GenerativeAI Site-totals-GenerativeAI",
    });
  }
  sections.push(
    {
      id: "search_performance_period",
      h2Title: "",
      kind: "search_performance_period",
      ragQuery: "search performance impressions clicks period comparison month",
    },
    {
      id: "key_performance_insights",
      h2Title: "",
      kind: "key_performance_insights",
      ragQuery: "insights strategy themes clicks impressions queries",
    },
    {
      id: "sap_local_seo",
      h2Title: "",
      kind: "sap_local_seo",
      ragQuery: "entity sitemap xml location place local business page url impressions clicks position comparison",
    },
    {
      id: "content_performance",
      h2Title: "",
      kind: "content_performance",
      ragQuery: "pages urls sitemap post blog product location local service-area landing impressions clicks position",
    },
  );
  return applyCanonicalGscSectionTitles(sections, compareKind);
}

/** Keep generative_ai_impressions only when includeGenerativeAi; insert after executive_summary when included and missing. */
export function applyGenerativeAiSectionGate(
  sections: GscReportingSectionPlan[],
  includeGenerativeAi: boolean,
  compareKind: GscCompareKind = "mom",
): GscReportingSectionPlan[] {
  const withoutAi = sections.filter((s) => s.kind !== "generative_ai_impressions");
  if (!includeGenerativeAi) {
    return applyCanonicalGscSectionTitles(withoutAi, compareKind);
  }
  const aiSection: GscReportingSectionPlan = {
    id: "generative_ai_impressions",
    h2Title: "Generative AI Search Impressions",
    kind: "generative_ai_impressions",
    ragQuery: "generative AI impressions AI Overviews AI Mode Pages-GenerativeAI Site-totals-GenerativeAI",
  };
  const execIdx = withoutAi.findIndex((s) => s.kind === "executive_summary");
  const insertAt = execIdx >= 0 ? execIdx + 1 : 0;
  const next = [...withoutAi.slice(0, insertAt), aiSection, ...withoutAi.slice(insertAt)];
  return applyCanonicalGscSectionTitles(next, compareKind);
}

/** Drop seasonal_demand. Season is one sentence in Executive Summary only. */
export function applySeasonalDemandSectionGate(
  sections: GscReportingSectionPlan[],
  compareKind: GscCompareKind = "mom",
): GscReportingSectionPlan[] {
  return applyCanonicalGscSectionTitles(
    sections.filter((s) => s.kind !== "seasonal_demand"),
    compareKind,
  );
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function parseOutlineTopOpportunities(raw: unknown): GscManualAiTopRow[] {
  if (!Array.isArray(raw)) return [];
  const out: GscManualAiTopRow[] = [];
  for (let i = 0; i < raw.length && out.length < 12; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const rank = typeof r.rank === "number" ? r.rank : Number(r.rank);
    if (!Number.isFinite(rank)) continue;
    if (!isNonEmptyString(r.label) || !isNonEmptyString(r.why) || !isNonEmptyString(r.metrics)) continue;
    const evidence = Array.isArray(r.evidence)
      ? r.evidence.filter(isNonEmptyString).map((line) => String(line).trim()).slice(0, 8)
      : [];
    out.push({
      rank,
      label: r.label.trim(),
      why: r.why.trim(),
      metrics: r.metrics.trim(),
      evidence: evidence.length > 0 ? evidence : undefined,
    });
  }
  return out;
}

function parseOutlineBasePayload(parsed: Record<string, unknown>): GscManualAiPayload {
  if (!isNonEmptyString(parsed.executiveSummary)) {
    throw new Error("AI JSON missing executiveSummary.");
  }
  return {
    executiveSummary: parsed.executiveSummary.trim(),
    topOpportunities: parseOutlineTopOpportunities(parsed.topOpportunities),
    clusters: [],
  };
}

export function parseGscReportingOutlineJson(
  raw: string,
  compareKind: GscCompareKind = "mom",
  options?: { includeGenerativeAi?: boolean },
): GscReportingOutlineResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.trim()) as Record<string, unknown>;
  } catch {
    throw new Error("AI response was not valid JSON.");
  }
  const base = parseOutlineBasePayload(parsed);
  const includeGenerativeAi = options?.includeGenerativeAi === true;
  let sections = defaultSectionsFromPayload(base, compareKind, { includeGenerativeAi });
  sections = applyGenerativeAiSectionGate(sections, includeGenerativeAi, compareKind);
  sections = applySeasonalDemandSectionGate(sections, compareKind);
  return {
    ...base,
    clusters: [],
    sections,
  };
}

export async function runGscReportingOutline(args: {
  apiKey: string;
  model: string;
  siteName: string;
  siteUrl: string;
  files: { name: string; content: string }[];
  compareKind?: GscCompareKind;
  compareLabel?: string;
  clientSeason?: GscClientSeasonContext | null;
  signal?: AbortSignal;
}): Promise<{
  outline: GscReportingOutlineResult;
  truncatedInput: boolean;
  filenames: string[];
  outlineRequestBodyJson: string;
}> {
  const compareKind = args.compareKind ?? "mom";
  const includeGenerativeAi = seedHasGenerativeAiFiles(args.files);
  const { text, truncated, filenames } = bundleGscOutlineFilesForPrompt(args.files);
  const generativeAiHint = includeGenerativeAi
    ? "\nGenerative AI CSV files ARE present in this upload. The app will add a Generative AI section in the report outline."
    : "";
  const compareLabel = args.compareLabel?.trim() ?? "";
  const reportPeriod = formatGscReportTitlePeriod(compareLabel);
  const season = applyReportPeriodToClientSeason(args.clientSeason ?? emptyGscClientSeasonContext(), compareLabel);
  const reportPeriodBlock = reportPeriod
    ? `\nREPORT_PERIOD (current GSC window from the date picker; name this exact range when you mention the period): ${reportPeriod}\n`
    : "";
  const userMessage = `Site: ${args.siteName} (${args.siteUrl})
${generativeAiHint}
${reportPeriodBlock}
${formatGscClientSeasonPromptBlock(season)}

Below are the CSV file contents. Analyze and produce the JSON object as specified.

${text}`;

  const maxTokens = Math.min(24_000, getCompetitorReportMaxOutputTokens(args.model));
  const outlineRequestBodyJson = buildOpenRouterChatPostBodyJson({
    model: args.model,
    maxTokensRequested: maxTokens,
    system: OUTLINE_SYSTEM,
    userMessage,
    ...GSC_OUTLINE_OPENROUTER_OPTS,
  });

  const { content, finishReason } = await callGscReportingOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: OUTLINE_SYSTEM,
    user: userMessage,
    maxTokens,
    signal: outlineAbortSignal(args.signal),
    ...GSC_OUTLINE_OPENROUTER_OPTS,
  });

  if (finishReason === "length") {
    throw new Error("GSC outline model output was truncated.");
  }

  const outline = parseGscReportingOutlineJson(content, compareKind, { includeGenerativeAi });
  return { outline, truncatedInput: truncated, filenames, outlineRequestBodyJson };
}
