import { callAdsReportingOpenRouterChatCompletion } from "@/lib/ads-reporting/ads-reporting-openrouter";
import {
  buildOpenRouterChatPostBodyJson,
  getCompetitorReportMaxOutputTokens,
} from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { GSC_OUTLINE_OPENROUTER_OPTS } from "@/lib/gsc-reporting/gsc-reporting-outline-schema";
import { adPerformanceH2ForCompareKind } from "@/lib/ads-reporting/ads-reporting-document-title";
import type { AdsReportingOutlineResult, AdsReportingSectionPlan } from "@/lib/ads-reporting/ads-reporting-types";

const OUTLINE_SYSTEM = `You are a PPC analyst. The user provides Google Ads CSV exports.

Return JSON matching the response schema exactly.

executiveSummary must name the REPORT_PERIOD and stay factual. Do not invent spend, CPA, campaign names, or conversions. Numbers must come from the CSV text.
topOpportunities: at most 8 rows; rank by business impact.
Do not output next-steps lists. Do not wrap campaign names, keywords, or search terms in quotation marks.
Use sentence case in executiveSummary and why. Write spend, clicks, impressions, and conversions in lowercase unless the word starts a sentence. The only all-caps words are acronyms (CPA, CPC, CTR). Do not write Cost Per Acquisition.`;

export function defaultAdsSectionsFromPayload(
  compareKind: "mom" | "yoy" | "custom" = "mom",
): AdsReportingSectionPlan[] {
  return [
    {
      id: "executive_summary",
      h2Title: "Executive Summary",
      kind: "executive_summary",
      ragQuery: "executive summary spend clicks conversions cpa ctr",
    },
    {
      id: "ad_performance_period",
      h2Title: adPerformanceH2ForCompareKind(compareKind),
      kind: "ad_performance_period",
      ragQuery: "ad performance spend clicks impressions ctr cpc conversions cpa site totals",
    },
    {
      id: "key_performance_insights",
      h2Title: "Key Performance Insights for the Team",
      kind: "key_performance_insights",
      ragQuery: "insights themes spend clicks conversions campaigns",
    },
    {
      id: "campaign_performance",
      h2Title: "Campaign Performance",
      kind: "campaign_performance",
      ragQuery: "campaign spend clicks conversions",
    },
    {
      id: "search_terms",
      h2Title: "Search Terms",
      kind: "search_terms",
      ragQuery: "keyword search term spend clicks wasted query Ads-keywords-MoM",
    },
  ];
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

export function parseAdsReportingOutlineJson(
  raw: string,
  compareKind: "mom" | "yoy" | "custom" = "mom",
): AdsReportingOutlineResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.trim()) as Record<string, unknown>;
  } catch {
    throw new Error("AI response was not valid JSON.");
  }
  if (!isNonEmptyString(parsed.executiveSummary)) {
    throw new Error("AI JSON missing executiveSummary.");
  }
  const top: AdsReportingOutlineResult["topOpportunities"] = [];
  if (Array.isArray(parsed.topOpportunities)) {
    for (const row of parsed.topOpportunities) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const rank = typeof r.rank === "number" ? r.rank : Number(r.rank);
      if (!Number.isFinite(rank) || !isNonEmptyString(r.label) || !isNonEmptyString(r.why) || !isNonEmptyString(r.metrics)) {
        continue;
      }
      top.push({
        rank,
        label: r.label.trim(),
        why: r.why.trim(),
        metrics: r.metrics.trim(),
        evidence: Array.isArray(r.evidence) ? r.evidence.filter(isNonEmptyString).slice(0, 3) : undefined,
      });
    }
  }
  return {
    executiveSummary: parsed.executiveSummary.trim(),
    topOpportunities: top,
    sections: defaultAdsSectionsFromPayload(compareKind),
  };
}

export async function runAdsReportingOutline(args: {
  apiKey: string;
  model: string;
  siteName: string;
  siteUrl: string;
  files: { name: string; content: string }[];
  compareKind?: "mom" | "yoy" | "custom";
  compareLabel?: string;
  signal?: AbortSignal;
}): Promise<{
  outline: AdsReportingOutlineResult;
  truncatedInput: boolean;
  filenames: string[];
  outlineRequestBodyJson: string;
}> {
  const compareKind = args.compareKind ?? "mom";
  const filenames = args.files.map((f) => f.name);
  const text = args.files
    .map((f) => `--- FILE: ${f.name} ---\n${f.content}`)
    .join("\n\n")
    .slice(0, 96_000);
  const truncatedInput = args.files.reduce((n, f) => n + f.content.length, 0) > 96_000;
  const userMessage = `Site: ${args.siteName} (${args.siteUrl})
REPORT_PERIOD: ${args.compareLabel ?? ""}

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
  const { content, finishReason } = await callAdsReportingOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: OUTLINE_SYSTEM,
    user: userMessage,
    maxTokens,
    signal: args.signal,
    ...GSC_OUTLINE_OPENROUTER_OPTS,
  });
  if (finishReason === "length") {
    throw new Error("Ads outline model output was truncated.");
  }
  return {
    outline: parseAdsReportingOutlineJson(content, compareKind),
    truncatedInput,
    filenames,
    outlineRequestBodyJson,
  };
}
