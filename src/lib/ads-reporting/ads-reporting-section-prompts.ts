import type { AdsReportingOutlineResult, AdsReportingSectionKind, AdsReportingSectionPlan } from "@/lib/ads-reporting/ads-reporting-types";
import { adPerformanceH2ForCompareKind } from "@/lib/ads-reporting/ads-reporting-document-title";

const EXEC_RULES =
  "AUDIENCE: senior executives. Grasp the section in under 90 seconds. TONE: confident and constructive. FORBIDDEN: Priority Next Steps, Recommended actions, numbered campaign task lists. Do not output any ## heading. Target H2 is already applied. Do not repeat the section title. No HTML, no emoji. NUMBERS: every digit, %, spend, CPA, CPC, CTR, conversion figure must match RETRIEVED DATA exactly (same digits). If you cannot support a claim, omit the number. CLIENT-FACING: never name CSV filenames, RETRIEVED DATA, or harness labels. NUMBER FORMAT: Canadian English (253,441). DIRECTIONAL LANGUAGE: growth only when Δ% is strictly positive. GRAMMAR: running text uses sentence case. Write spend, clicks, impressions, and conversions in lowercase unless the word starts a sentence. The only all-caps words are acronyms: CPA, CPC, CTR. Do not write Cost Per Acquisition. Do not title-case Spend, Clicks, Impressions, or Conversions mid-sentence. BOLD: only campaign names, keywords, and search terms. Never bold spend, clicks, impressions, conversions, CPA, CPC, CTR, or other metric words. KEYWORDS: never wrap campaign names, keywords, or search terms in quotation marks. Use Markdown bold for those names only.";

const TABLE_RULE =
  "At most one GFM pipe table per section. Max 6 data rows. Abbreviate headers: Spend, Clk, Imp, CTR, CPC, Conv, CPA, Δ%. Theme tables: Theme | Spend | Spend Δ% | Clk | Clk Δ%. Each metric row maps to one CSV row. Omit empty tables. Bold only campaign and keyword names in table cells. Never bold metric words or numbers.";

const KEYWORD_TABLE_RULE =
  "Search Terms: one short sentence max, then a required keyword-level GFM table from Ads-keywords-MoM.csv. Columns: Keyword | Spend | Spend Δ% | Clk | Clk Δ%. Bold each Keyword cell. Do not write a keyword paragraph. Do not quote keywords. Do not repeat account totals.";

export function getAdsReportingSectionSystemPrompt(
  kind: AdsReportingSectionKind,
  compareKind: "mom" | "yoy" | "custom",
): string {
  const kpiH2 = adPerformanceH2ForCompareKind(compareKind);
  const shared = `${EXEC_RULES} ${TABLE_RULE}`;
  if (kind === "executive_summary") {
    return `${shared} Executive Summary: period story in prose. You may use ### Key Insights (3-5 bullets). Do not include the site-wide KPI table.`;
  }
  if (kind === "ad_performance_period") {
    return `${shared} This is the ONLY section with the account-wide KPI table (Spend, Clk, Imp, CTR, CPC, Conv, CPA and Δ%). Copy Ads-site-totals-MoM.csv numbers. Document H2 is ${kpiH2}.`;
  }
  if (kind === "key_performance_insights") {
    return `${shared} Interpretation only. Do not repeat the account KPI table. One theme table max.`;
  }
  if (kind === "campaign_performance") {
    return `${shared} Campaign lens from Ads-campaigns-MoM.csv. One short sentence max, then the campaign table. Do not repeat account totals.`;
  }
  return `${shared} ${KEYWORD_TABLE_RULE}`;
}

export function buildAdsUserMessageForSection(input: {
  siteName: string;
  siteUrl: string;
  outline: AdsReportingOutlineResult;
  plan: AdsReportingSectionPlan;
  retrievedContext: string;
  compareLabel: string;
}): string {
  return `Site: ${input.siteName} (${input.siteUrl})
REPORT_PERIOD: ${input.compareLabel}
Target H2 (already applied, do not write it): ${input.plan.h2Title}
Section kind: ${input.plan.kind}

OUTLINE_GROUNDING
executiveSummary: ${input.outline.executiveSummary}
topOpportunities: ${input.outline.topOpportunities.map((o) => `${o.rank}. ${o.label} | ${o.metrics} | ${o.why}`).join("\n")}

RETRIEVED DATA
${input.retrievedContext}

Do not output any ## heading. Do not quote keywords, campaigns, or search terms. Bold those names only. Never bold spend, clicks, impressions, conversions, or other metric words. In prose use sentence case. Only CPA, CPC, and CTR stay in all caps.`;
}
