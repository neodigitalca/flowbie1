/**
 * GSC Report AI - Agentic AI-driven executive report generation
 * One AI agent per section (9 sections). Raw data → section agents → full markdown.
 */

import type { GSCPerformanceStats, GMBReportData } from "@/components/integrations/types";
import { formatMonthYearFromAPI } from "./gsc-date-helpers";
import { streamGeneration } from "./api";
import { AGENCY_NAME } from "./report-planner";

export type ReportType = 'standard' | 'progress';

/** Input shape compatible with ReportDiscoveryData - avoids circular import */
export interface GSCReportDiscoveryInput {
  site: { siteUrl: string };
  wordPressContext: {
    siteName: string;
    napInfo?: { name?: string; address?: string; phone?: string; email?: string };
    sampleTitles?: string[];
  };
  stats: GSCPerformanceStats;
  entityPagesData: {
    pages: Array<{
      url?: string;
      pagePath: string;
      impressions: number;
      position: number;
      isNew: boolean;
      impressionsChange: number;
      queries?: Array<{
        query: string;
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
      }>;
    }>;
  } | null;
  gmbData?: GMBReportData | null;
  historicalData?: {
    monthlyStats: Array<{ month: string; impressions: number; avgPosition: number }>;
  } | null;
}

export interface RawReportData {
  siteName: string;
  periodContext: string;
  currentPeriodLabel: string;
  comparisonPeriodLabel: string;
  growth: {
    impressions: number;
    clicks: number;
    pagesCount: number;
    searchTermsCount: number;
    avgPosition: number;
    comparisons: {
      impressionsChange: number;
      impressionsChangePercent: number;
      clicksChange: number;
      clicksChangePercent: number;
      pagesChange: number;
      searchTermsChange: number;
      avgPositionChange: number;
    };
  };
  keywords: Array<{
    query: string;
    currentImpressions: number;
    previousImpressions: number;
    currentClicks: number;
    previousClicks: number;
    currentRanking: number;
    previousRanking: number;
    impressionsChange: number;
    isNew: boolean;
    isLost: boolean;
  }>;
  entityPages: Array<{
    pagePath: string;
    url?: string;
    impressions: number;
    position: number;
    isNew: boolean;
    impressionsChange: number;
    queries?: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  }>;
  gmb: {
    currentPeriod: { calls: number; directions: number; websiteClicks: number };
    comparisonPeriod: { calls: number; directions: number; websiteClicks: number };
  } | null;
  napInfo?: { name?: string; address?: string; phone?: string; email?: string };
  sampleTitles?: string[];
  monthlyStats?: Array<{ month: string; impressions: number; avgPosition: number }>;
}

/** Section definition: id, heading template (with {siteName}, {currentPeriodLabel}, {comparisonPeriodLabel}), purpose, table row cap if any */
export interface ReportSectionDef {
  id: string;
  heading: string;
  purpose: string;
  rowCap?: number;
  tableColumns?: string;
}

/** Report outline: standard GSC comparison report sections */
const REPORT_OUTLINE: ReportSectionDef[] = [
  {
    id: "1",
    heading: "Search Performance - {currentPeriodLabel} vs {comparisonPeriodLabel}",
    purpose:
      "1 short overview paragraph covering Impression Growth, Traffic Surge, Index Expansion, and Keyword Discovery woven into the narrative. Use only RAW_DATA. No table. No bullet points. No numbered lists.",
  },
  {
    id: "2",
    heading: "Key Performance Insights for the Team",
    purpose:
      "1 short overview paragraph covering Visibility Scaling, Term Diversification, Local Footprint, Content Discovery, and Relevance Alignment woven into the narrative. AI derives from data. Absolutely NO table - do not create any table in this section. No bullet points. No numbered lists. No 'Strategic Focus' or 'Recommendation' tables.",
  },
  {
    id: "3",
    heading: "Service Area Pages (SAP) & Local SEO Performance",
    purpose:
      "1 short overview paragraph (no bullet points, no numbered lists) then SAP table. CRITICAL: you MUST output ONE table row for EVERY single entity page in SCOPE_DATA.entityPages - if there are 20 pages you output 20 rows, if there are 10 you output 10. NEVER show fewer rows than exist in the data. Columns: Service Area Page | Position | Times Shown | Status. Status = NEW if isNew, else +N for impressionsChange. Sorted by Position ascending (best position first). Do NOT truncate, summarize, or limit the table in any way.",
    tableColumns: "Service Area Page | Position | Times Shown | Status",
  },
  {
    id: "4",
    heading: "Growth Metrics for {currentPeriodLabel}",
    purpose:
      "1 short overview paragraph (no bullet points, no numbered lists) then growth table. Exactly 4 rows. Columns: Metric | {currentPeriodLabel} | Growth vs {comparisonPeriodLabel}. Fixed rows: Times Shown in Google | Website Visitors from Search | Pages Ranking in Google | Search Terms Found For. Values from growth and comparisons.",
    rowCap: 4,
    tableColumns: "Metric | {currentPeriodLabel} | Growth vs {comparisonPeriodLabel}",
  },
  {
    id: "5",
    heading: "All Search Terms: {currentPeriodLabel} vs {comparisonPeriodLabel}",
    purpose:
      "1 short overview paragraph (no bullet points, no numbered lists) summarizing the full month-to-month comparison of ALL search terms (not just clicked or new ones). Then a table of the top 50 search terms by current impressions. Columns: Search Term | {comparisonPeriodLabel} Impressions | {currentPeriodLabel} Impressions | Change | {comparisonPeriodLabel} Position | {currentPeriodLabel} Position. Include terms that appeared in EITHER month. If a term had 0 impressions in a month it means it didn't appear that month. Sort by current impressions descending. Include all rows in SCOPE_DATA (already capped to 50).",
    rowCap: 50,
    tableColumns: "Search Term | {comparisonPeriodLabel} Imp. | {currentPeriodLabel} Imp. | Change | {comparisonPeriodLabel} Pos. | {currentPeriodLabel} Pos.",
  },
  {
    id: "9",
    heading: "Content Performance: Your Growing Digital Footprint",
    purpose:
      "1 short overview paragraph (no bullet points, no numbered lists) then content table. Exactly 4 rows. Columns: Content Metric | {comparisonPeriodLabel} | {currentPeriodLabel} | Change. Fixed rows: Pages Appearing in Google (pagesCount) | Average Position (avgPosition) | Total Impressions (impressions) | Total Clicks (clicks). Use RAW_DATA growth object for {currentPeriodLabel} values and calculate {comparisonPeriodLabel} values by subtracting comparisons change from current values. Change column should show +N or -N with the numeric difference.",
    rowCap: 4,
    tableColumns: "Content Metric | {comparisonPeriodLabel} | {currentPeriodLabel} | Change",
  },
  {
    id: "10",
    heading: "Performance Summary Infographic",
    purpose:
      "Output a FULL PROMPT for creating the infographic. (1) Design spec: hex codes Background #02050A, Accent #84BD00, Text #fff; format Tall 9:16 mobile; theme Neon-Noir Tech; shapes only; NO faces; NO hashtags; NO Next Steps; Google/SEO icons. (2) ALL actual stats from RAW_DATA that must appear: impressions, clicks, growth % and change, pages count, keywords count, average position, top 2–3 SAP names and times shown. Self-contained so the section text can be used as the complete prompt for an infographic generator. No table.",
  },
  {
    id: "11",
    heading: "Frequently Asked Questions",
    purpose:
      "1 short overview paragraph (no bullet points, no numbered lists) then Q&A table. Exactly 3 rows. Columns: Question | Answer. Generate 3 Q&As from growth and comparisons only.",
    rowCap: 3,
    tableColumns: "Question | Answer",
  },
];

/** Progress report outline: sections framed around "what we accomplished" over a timeframe */
const PROGRESS_REPORT_OUTLINE: ReportSectionDef[] = [
  {
    id: "p1",
    heading: "Progress Overview: {currentPeriodLabel}",
    purpose:
      "1 short executive paragraph summarizing all accomplishments from the baseline period to now. Cover total impressions gained, pages indexed, new search terms discovered, and traffic growth. Frame as 'here is what we have achieved for your business'. Use only RAW_DATA. No table. No bullet points. No numbered lists.",
  },
  {
    id: "p2",
    heading: "Index Growth & Page Coverage - {currentPeriodLabel}",
    purpose:
      "1 short overview paragraph (no bullet points, no numbered lists) then a table showing page indexing progress. Exactly 4 rows. Columns: Metric | Baseline ({comparisonPeriodLabel}) | Current ({currentPeriodLabel}) | Growth. Fixed rows: Pages Appearing in Google (pagesCount) | Search Terms Ranking For (searchTermsCount) | Average Position (avgPosition) | Total Impressions (impressions). Baseline values = current minus comparisons change. Growth = the change value with +/- prefix.",
    rowCap: 4,
    tableColumns: "Metric | Baseline ({comparisonPeriodLabel}) | Current ({currentPeriodLabel}) | Growth",
  },
  {
    id: "p3",
    heading: "Search Term Acquisition - {currentPeriodLabel}",
    purpose:
      "1 short overview paragraph (no bullet points, no numbered lists) about how many new search terms were discovered during the progress period. Mention total current terms count vs baseline. Then provide a summary of total new terms acquired (isNew count) and total search terms now ranking. No table in this section. No bullet points. No numbered lists.",
  },
  {
    id: "p4",
    heading: "Service Area Pages (SAP) Performance - {currentPeriodLabel}",
    purpose:
      "1 short overview paragraph (no bullet points, no numbered lists) then SAP table. CRITICAL: output ONE table row for EVERY entity page in SCOPE_DATA.entityPages. Columns: Service Area Page | Position | Times Shown | Status. Status = NEW if isNew, else +N for impressionsChange. Sorted by Position ascending (best position first). Do NOT truncate.",
    tableColumns: "Service Area Page | Position | Times Shown | Status",
  },
  {
    id: "p5",
    heading: "Visibility & Traffic Growth - {currentPeriodLabel}",
    purpose:
      "1 short overview paragraph (no bullet points, no numbered lists) then growth table. Exactly 4 rows. Columns: Metric | Baseline ({comparisonPeriodLabel}) | Current ({currentPeriodLabel}) | Growth. Fixed rows: Times Shown in Google (impressions) | Website Visitors from Search (clicks) | Pages Ranking in Google (pagesCount) | Search Terms Found For (searchTermsCount). Values from growth and comparisons. Baseline = current minus change.",
    rowCap: 4,
    tableColumns: "Metric | Baseline ({comparisonPeriodLabel}) | Current ({currentPeriodLabel}) | Growth",
  },
  {
    id: "p6",
    heading: "Service Area Pages & Their Search Terms - {currentPeriodLabel}",
    purpose:
      "1 short overview paragraph (no bullet points, no numbered lists) then a table showing every service area page and the search terms it ranks for. Columns: Service Area Page URL | Search Term | Times Shown | Clicks | Position. Include ALL rows from SCOPE_DATA.entityPages and their queries - do not truncate. Output one or more rows per page depending on how many queries it has. Sorted by page Position (best first), and within each page, by impressions descending.",
    tableColumns: "Service Area Page URL | Search Term | Times Shown | Clicks | Position",
  },
  {
    id: "p8",
    heading: "Local Market Expansion - {currentPeriodLabel}",
    purpose:
      "1 short overview paragraph (no bullet points, no numbered lists) then local terms table. Include ALL rows from SCOPE_DATA - do not truncate. Columns: Local Search Term | Position | Times Shown | Status. Status = NEW if isNew, else +N for impressionsChange. Sorted by Position ascending. Keywords with local intent (e.g. 'near me' or location names).",
    rowCap: 15,
    tableColumns: "Local Search Term | Position | Times Shown | Status",
  },
  {
    id: "p9",
    heading: "Monthly Trend Summary - {currentPeriodLabel}",
    purpose:
      "1 short narrative paragraph (no bullet points, no numbered lists) then a month-by-month table if SCOPE_DATA.monthlyStats is available. Columns: Month | Impressions | Avg Position. Show the trajectory of growth over time. If monthlyStats is empty or unavailable, write a paragraph summarizing the overall growth using RAW_DATA growth metrics instead. No bullet points.",
    tableColumns: "Month | Impressions | Avg Position",
  },
  {
    id: "p10",
    heading: "Performance Summary Infographic",
    purpose:
      "Output a FULL PROMPT for creating a progress infographic. (1) Design spec: hex codes Background #02050A, Accent #84BD00, Text #fff; format Tall 9:16 mobile; theme Neon-Noir Tech; shapes only; NO faces; NO hashtags; NO Next Steps; Google/SEO icons. (2) Title: 'Progress Report: {currentPeriodLabel}'. (3) ALL actual stats from RAW_DATA: impressions, clicks, growth % and change, pages count, keywords count, average position, top 2-3 SAP names and times shown, new terms count. Self-contained so the section text can be used as the complete prompt for an infographic generator. No table.",
  },
];

/**
 * Serialize discovery data to raw JSON. No tables, no formatting, no row limits.
 */
export function serializeRawData(discoveryData: GSCReportDiscoveryInput): RawReportData {
  const { stats, entityPagesData, wordPressContext, gmbData } = discoveryData;
  const siteName = wordPressContext.siteName;

  // Label current period as a single month OR a month-to-month range
  const currentStartLabel = formatMonthYearFromAPI(stats.currentPeriod.startDate);
  const currentEndLabel = formatMonthYearFromAPI(stats.currentPeriod.endDate);
  const currentPeriodLabel =
    currentStartLabel === currentEndLabel
      ? currentStartLabel
      : `${currentStartLabel} to ${currentEndLabel}`;

  // Label comparison period similarly (usually a single month baseline)
  const comparisonStartLabel = formatMonthYearFromAPI(stats.comparisonPeriod.startDate);
  const comparisonEndLabel = formatMonthYearFromAPI(stats.comparisonPeriod.endDate);
  const comparisonPeriodLabel =
    comparisonStartLabel === comparisonEndLabel
      ? comparisonStartLabel
      : `${comparisonStartLabel} to ${comparisonEndLabel}`;

  const periodContext = `${currentPeriodLabel} compared to ${comparisonPeriodLabel}`;

  const keywords = (stats.topKeywords || []).map((kw) => ({
    query: kw.query || "",
    currentImpressions: kw.currentImpressions ?? 0,
    previousImpressions: kw.previousImpressions ?? 0,
    currentClicks: kw.currentClicks ?? 0,
    previousClicks: kw.previousClicks ?? 0,
    currentRanking: kw.currentRanking ?? 0,
    previousRanking: kw.previousRanking ?? 0,
    impressionsChange: kw.impressionsChange ?? 0,
    isNew: (kw.previousImpressions ?? 0) === 0 && (kw.currentImpressions ?? 0) > 0,
    isLost: (kw.currentImpressions ?? 0) === 0 && (kw.previousImpressions ?? 0) > 0,
  }));

  const entityPages = (entityPagesData?.pages || [])
    .map((p) => ({
      pagePath: p.pagePath || "",
      url: p.url,
      impressions: p.impressions ?? 0,
      position: p.position ?? 0,
      isNew: p.isNew ?? false,
      impressionsChange: p.impressionsChange ?? 0,
      queries: p.queries || [],
    }))
    .sort((a, b) => (a.position || 999) - (b.position || 999)); // Best position first (ascending)

  let gmb: RawReportData["gmb"] = null;
  if (gmbData?.currentPeriod && gmbData?.comparisonPeriod) {
    gmb = {
      currentPeriod: gmbData.currentPeriod,
      comparisonPeriod: gmbData.comparisonPeriod,
    };
  }

  return {
    siteName,
    periodContext,
    currentPeriodLabel,
    comparisonPeriodLabel,
    growth: {
      impressions: stats.currentPeriod.impressions,
      clicks: stats.currentPeriod.clicks,
      pagesCount: stats.currentPeriod.pagesCount,
      searchTermsCount: stats.currentPeriod.searchTermsCount,
      avgPosition: stats.currentPeriod.avgPosition,
      comparisons: {
        impressionsChange: stats.comparisons.impressionsChange,
        impressionsChangePercent: stats.comparisons.impressionsChangePercent,
        clicksChange: stats.comparisons.clicksChange,
        clicksChangePercent: stats.comparisons.clicksChangePercent,
        pagesChange: stats.comparisons.pagesChange,
        searchTermsChange: stats.comparisons.searchTermsChange,
        avgPositionChange: stats.comparisons.avgPositionChange,
      },
    },
    keywords,
    entityPages,
    gmb,
    napInfo: wordPressContext.napInfo,
    sampleTitles: wordPressContext.sampleTitles,
    monthlyStats: (() => {
      const all = discoveryData.historicalData?.monthlyStats ?? [];
      if (!all.length) return undefined;
      const startMonth = stats.currentPeriod.startDate.slice(0, 7);
      const endMonth = stats.currentPeriod.endDate.slice(0, 7);
      const filtered = all.filter(m => m.month >= startMonth && m.month <= endMonth);
      return (filtered.length ? filtered : all);
    })(),
  };
}

/** Resolve heading template with siteName, currentPeriodLabel, comparisonPeriodLabel */
function resolveHeading(template: string, data: RawReportData): string {
  return template
    .replace(/{siteName}/g, data.siteName)
    .replace(/{currentPeriodLabel}/g, data.currentPeriodLabel)
    .replace(/{comparisonPeriodLabel}/g, data.comparisonPeriodLabel);
}

/** Get scoped data for a section (row caps applied). For sections that need filtered/sliced data. */
function getScopedDataForSection(
  sectionId: string,
  rawData: RawReportData
): Record<string, unknown> {
  const base = {
    siteName: rawData.siteName,
    currentPeriodLabel: rawData.currentPeriodLabel,
    comparisonPeriodLabel: rawData.comparisonPeriodLabel,
    growth: rawData.growth,
    periodContext: rawData.periodContext,
  };

  switch (sectionId) {
    case "3": {
      return { ...base, entityPages: rawData.entityPages };
    }
    case "5": {
      // All search terms: top 50 by current impressions (includes terms from either month)
      const allTerms = rawData.keywords
        .slice()
        .sort((a, b) => b.currentImpressions - a.currentImpressions)
        .slice(0, 50);
      return { ...base, allTerms };
    }
    // Progress report sections
    case "p4": {
      return { ...base, entityPages: rawData.entityPages };
    }
    case "p6": {
      return { ...base, entityPages: rawData.entityPages };
    }
    case "p8": {
      const pLocal = rawData.keywords
        .filter(
          (k) =>
            (k.currentImpressions > 0 || k.previousImpressions > 0) &&
            (k.query.toLowerCase().includes("near me") || k.query.toLowerCase().includes(" near "))
        )
        .sort((a, b) => (a.currentRanking || 999) - (b.currentRanking || 999))
        .slice(0, 15);
      return { ...base, localKeywords: pLocal };
    }
    case "p9": {
      return { ...base, monthlyStats: rawData.monthlyStats || [] };
    }
    default:
      return base;
  }
}

/**
 * Pre-build markdown tables from raw data so the AI cannot hallucinate columns or omit rows.
 * Returns the table markdown string, or null if the section doesn't have a pre-built table.
 */
function prebuiltTableForSection(sectionId: string, rawData: RawReportData): string | null {
  switch (sectionId) {
    case "3": {
      const pages = rawData.entityPages;
      if (!pages.length) return null;
      const rows = pages
        .slice()
        .sort((a, b) => (a.position || 999) - (b.position || 999))
        .map((p) => {
          const name = p.pagePath.replace(/^\//, "").replace(/\/$/, "").split("/").pop() || p.pagePath;
          const status = p.isNew ? "NEW" : (p.impressionsChange >= 0 ? `+${p.impressionsChange}` : `${p.impressionsChange}`);
          return `| ${name} | ${p.position} | ${p.impressions.toLocaleString()} | ${status} |`;
        });
      return `| Service Area Page | Position | Times Shown | Status |\n| --- | --- | --- | --- |\n${rows.join("\n")}`;
    }
    case "4": {
      const g = rawData.growth;
      const c = g.comparisons;
      const fmtChange = (v: number) => (v >= 0 ? `+${v.toLocaleString()}` : `${v.toLocaleString()}`);
      const fmtPct = (v: number) => (v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`);
      return [
        `| Metric | ${rawData.currentPeriodLabel} | Growth vs ${rawData.comparisonPeriodLabel} |`,
        `| --- | --- | --- |`,
        `| Times Shown in Google | ${g.impressions.toLocaleString()} | ${fmtChange(c.impressionsChange)} (${fmtPct(c.impressionsChangePercent)}) |`,
        `| Website Visitors from Search | ${g.clicks.toLocaleString()} | ${fmtChange(c.clicksChange)} (${fmtPct(c.clicksChangePercent)}) |`,
        `| Pages Ranking in Google | ${g.pagesCount.toLocaleString()} | ${fmtChange(c.pagesChange)} |`,
        `| Search Terms Found For | ${g.searchTermsCount.toLocaleString()} | ${fmtChange(c.searchTermsChange)} |`,
      ].join("\n");
    }
    case "5": {
      const terms = rawData.keywords
        .slice()
        .sort((a, b) => b.currentImpressions - a.currentImpressions)
        .slice(0, 50);
      if (!terms.length) return null;
      const rows = terms.map((k) => {
        const change = k.currentImpressions - k.previousImpressions;
        const changeStr = change >= 0 ? `+${change}` : `${change}`;
        return `| ${k.query} | ${k.previousImpressions.toLocaleString()} | ${k.currentImpressions.toLocaleString()} | ${changeStr} | ${k.previousRanking || " - "} | ${k.currentRanking || " - "} |`;
      });
      return `| Search Term | ${rawData.comparisonPeriodLabel} Imp. | ${rawData.currentPeriodLabel} Imp. | Change | ${rawData.comparisonPeriodLabel} Pos. | ${rawData.currentPeriodLabel} Pos. |\n| --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}`;
    }
    case "9": {
      const g = rawData.growth;
      const c = g.comparisons;
      const prev = (current: number, change: number) => current - change;
      const fmtChange = (v: number) => (v >= 0 ? `+${v}` : `${v}`);
      return [
        `| Content Metric | ${rawData.comparisonPeriodLabel} | ${rawData.currentPeriodLabel} | Change |`,
        `| --- | --- | --- | --- |`,
        `| Pages Appearing in Google | ${prev(g.pagesCount, c.pagesChange).toLocaleString()} | ${g.pagesCount.toLocaleString()} | ${fmtChange(c.pagesChange)} |`,
        `| Average Position | ${(prev(g.avgPosition, c.avgPositionChange)).toFixed(2)} | ${g.avgPosition.toFixed(2)} | ${fmtChange(Number(c.avgPositionChange.toFixed(2)))} |`,
        `| Total Impressions | ${prev(g.impressions, c.impressionsChange).toLocaleString()} | ${g.impressions.toLocaleString()} | ${fmtChange(c.impressionsChange)} |`,
        `| Total Clicks | ${prev(g.clicks, c.clicksChange).toLocaleString()} | ${g.clicks.toLocaleString()} | ${fmtChange(c.clicksChange)} |`,
      ].join("\n");
    }
    // ─── Progress report prebuilt tables ────────────────────────────────
    case "p2": {
      const g = rawData.growth;
      const c = g.comparisons;
      const prev = (current: number, change: number) => current - change;
      const fmtGrowth = (v: number) => (v >= 0 ? `+${v.toLocaleString()}` : `${v.toLocaleString()}`);
      return [
        `| Metric | Baseline (${rawData.comparisonPeriodLabel}) | Current (${rawData.currentPeriodLabel}) | Growth |`,
        `| --- | --- | --- | --- |`,
        `| Pages Appearing in Google | ${prev(g.pagesCount, c.pagesChange).toLocaleString()} | ${g.pagesCount.toLocaleString()} | ${fmtGrowth(c.pagesChange)} |`,
        `| Search Terms Ranking For | ${prev(g.searchTermsCount, c.searchTermsChange).toLocaleString()} | ${g.searchTermsCount.toLocaleString()} | ${fmtGrowth(c.searchTermsChange)} |`,
        `| Average Position | ${prev(g.avgPosition, c.avgPositionChange).toFixed(2)} | ${g.avgPosition.toFixed(2)} | ${fmtGrowth(Number(c.avgPositionChange.toFixed(2)))} |`,
        `| Total Impressions | ${prev(g.impressions, c.impressionsChange).toLocaleString()} | ${g.impressions.toLocaleString()} | ${fmtGrowth(c.impressionsChange)} |`,
      ].join("\n");
    }
    case "p4": {
      const pages = rawData.entityPages;
      if (!pages.length) return null;
      const rows = pages
        .slice()
        .sort((a, b) => (a.position || 999) - (b.position || 999))
        .map((p) => {
          const url = p.url || p.pagePath;
          const status = p.isNew ? "NEW" : (p.impressionsChange >= 0 ? `+${p.impressionsChange}` : `${p.impressionsChange}`);
          return `| ${url} | ${p.position} | ${p.impressions.toLocaleString()} | ${status} |`;
        });
      return `| Service Area Page | Position | Times Shown | Status |\n| --- | --- | --- | --- |\n${rows.join("\n")}`;
    }
    case "p5": {
      const g = rawData.growth;
      const c = g.comparisons;
      const prev = (current: number, change: number) => current - change;
      const fmtGrowth = (v: number) => (v >= 0 ? `+${v.toLocaleString()}` : `${v.toLocaleString()}`);
      const fmtPct = (v: number) => (v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`);
      return [
        `| Metric | Baseline (${rawData.comparisonPeriodLabel}) | Current (${rawData.currentPeriodLabel}) | Growth |`,
        `| --- | --- | --- | --- |`,
        `| Times Shown in Google | ${prev(g.impressions, c.impressionsChange).toLocaleString()} | ${g.impressions.toLocaleString()} | ${fmtGrowth(c.impressionsChange)} (${fmtPct(c.impressionsChangePercent)}) |`,
        `| Website Visitors from Search | ${prev(g.clicks, c.clicksChange).toLocaleString()} | ${g.clicks.toLocaleString()} | ${fmtGrowth(c.clicksChange)} (${fmtPct(c.clicksChangePercent)}) |`,
        `| Pages Ranking in Google | ${prev(g.pagesCount, c.pagesChange).toLocaleString()} | ${g.pagesCount.toLocaleString()} | ${fmtGrowth(c.pagesChange)} |`,
        `| Search Terms Found For | ${prev(g.searchTermsCount, c.searchTermsChange).toLocaleString()} | ${g.searchTermsCount.toLocaleString()} | ${fmtGrowth(c.searchTermsChange)} |`,
      ].join("\n");
    }
    case "p6": {
      const pages = rawData.entityPages;
      if (!pages.length) return null;
      const rows: string[] = [];
      pages
        .slice()
        .sort((a, b) => (a.position || 999) - (b.position || 999))
        .forEach((p) => {
          const url = p.url || p.pagePath;
          const queries = (p.queries || []) as Array<{ query: string; clicks: number; impressions: number; position: number }>;
          if (!queries.length) {
            rows.push(`| ${url} | - | 0 | 0 | - |`);
            return;
          }
          queries.forEach((q) => {
            rows.push(
              `| ${url} | ${q.query} | ${q.impressions.toLocaleString()} | ${q.clicks} | ${q.position || " - "} |`
            );
          });
        });
      if (!rows.length) return null;
      return `| Service Area Page URL | Search Term | Times Shown | Clicks | Position |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}`;
    }
    case "p8": {
      const pLocal = rawData.keywords
        .filter(
          (k) =>
            (k.currentImpressions > 0 || k.previousImpressions > 0) &&
            (k.query.toLowerCase().includes("near me") || k.query.toLowerCase().includes(" near "))
        )
        .sort((a, b) => (a.currentRanking || 999) - (b.currentRanking || 999))
        .slice(0, 15);
      if (!pLocal.length) return null;
      const rows = pLocal.map((k) => {
        const status = k.isNew ? "NEW" : (k.impressionsChange >= 0 ? `+${k.impressionsChange}` : `${k.impressionsChange}`);
        return `| ${k.query} | ${k.currentRanking || " - "} | ${k.currentImpressions.toLocaleString()} | ${status} |`;
      });
      return `| Local Search Term | Position | Times Shown | Status |\n| --- | --- | --- | --- |\n${rows.join("\n")}`;
    }
    case "p9": {
      const ms = rawData.monthlyStats;
      if (!ms || !ms.length) return null;
      const rows = ms.map((m) =>
        `| ${m.month} | ${m.impressions.toLocaleString()} | ${m.avgPosition.toFixed(1)} |`
      );
      return `| Month | Impressions | Avg Position |\n| --- | --- | --- |\n${rows.join("\n")}`;
    }
    default:
      return null;
  }
}

/** Build system and user prompts for one section agent */
function buildSectionPrompts(
  section: ReportSectionDef,
  rawData: RawReportData,
  scopedData: Record<string, unknown>
): { systemPrompt: string; userPrompt: string } {
  const heading = resolveHeading(section.heading, rawData);
  const rowCap = section.rowCap;
  const hasPositionColumn = section.tableColumns?.toLowerCase().includes("position");
  const tableRule =
    section.id === "10"
      ? " Output a full prompt for the infographic (design spec + actual stats from RAW_DATA). Self-contained."
      : section.tableColumns && rowCap
        ? ` Table: ${section.tableColumns}. Max ${rowCap} rows.${hasPositionColumn ? " Sort rows by Position ascending (best position first)." : ""} Start with 1 short overview paragraph (NO bullet points, NO numbered lists), then the table. Nothing after the table.`
        : section.tableColumns
          ? ` Table: ${section.tableColumns}. You MUST include EVERY row from SCOPE_DATA - do NOT truncate, summarize, or limit the table. If SCOPE_DATA has 20 rows, the table must have 20 rows. Minimum 10 rows if 10+ exist.${hasPositionColumn ? " Sort rows by Position ascending (best position first)." : ""} Start with 1 short overview paragraph (NO bullet points, NO numbered lists), then the table. Nothing after the table.`
          : " Write 1 short overview paragraph (NO bullet points, NO numbered lists). Nothing else.";

  const isProgress = section.id.startsWith("p");
  const reportContext = isProgress
    ? "a client-facing SEO progress report that demonstrates accomplishments over a multi-month period. The comparison period is the baseline (before work started) and the current period spans all months of active work."
    : "a GSC performance report.";

  const systemPrompt = `You are a senior SEO strategist at ${AGENCY_NAME}. You write ONE section of ${reportContext}

ZERO HALLUCINATION:
- Every keyword, number, page, metric MUST exist in RAW_DATA or SCOPE_DATA. Never invent, guess, or fabricate.
- Never output placeholders such as [Value], [TBD], or bracketed stand-ins - only real numbers from RAW_DATA/SCOPE_DATA.
- If a list is empty, say so in one line and omit the table.
- If a metric is 0, report 0. Never substitute example data.

TONE - THIS IS MANDATORY, APPLIES TO PARAGRAPHS AND TABLES ALIKE:
- This is a POSITIVE performance report for a client. Focus ONLY on wins, improvements, and growth.
- NEVER mention ANY negative metric anywhere - not in paragraphs, not in tables, not in table rows, not in any form. No "loss", "decline", "dip", "drop", "decrease", "visibility loss", or negative numbers highlighted. If a keyword or metric went down, DO NOT INCLUDE IT AT ALL. Simply omit it. Do not reframe it, do not mention it.
- No "pros and cons" tables. No "challenges". No "areas of concern". No "Recommendation" columns that reference fixing problems.
- Every table row must showcase a positive result. If you cannot say something positive about a data point, leave it out entirely.
- The client should feel great reading every single line of this report.${isProgress ? "\n- Frame everything as accomplishments and progress. Use phrases like 'we achieved', 'your site now', 'growth of', 'expanded to'. The client should understand exactly what value has been delivered." : ""}

OUTPUT:
- Output ONLY this section. Start with ## ${heading}
- NEVER use ### subheadings. Only the single ## heading is allowed. Use paragraphs and tables ONLY - no sub-sections.
- ABSOLUTELY NO bullet point lists (- or *) or numbered lists (1. 2. 3.) in the prose/narrative paragraphs. Write flowing paragraphs ONLY. The ONLY place list-like formatting is allowed is inside markdown tables. No "key takeaways", no "follow-up points", no "action items", no enumerated insights after paragraphs. Just paragraphs of narrative text, then the table if one is required.
- Use only data from RAW_DATA and SCOPE_DATA below.${tableRule}
- Executive narrative tone. No placeholders. No invented data.`;

  const userPrompt = `SECTION: ${heading}

PURPOSE: ${section.purpose}

RAW_DATA (full dataset):
\`\`\`json
${JSON.stringify(rawData, null, 2)}
\`\`\`

${["3", "5", "p4", "p6", "p8", "p9"].includes(section.id) ? `SCOPE_DATA (filtered/sliced for this section - use this for the table rows):
\`\`\`json
${JSON.stringify(scopedData, null, 2)}
\`\`\`
` : ""}
Produce ONLY this section. Start with ## ${heading}. Use ONLY data above. No hallucination.`;

  return { systemPrompt, userPrompt };
}

/**
 * Generate one section's markdown via a single AI call.
 */
async function generateSectionContent(
  section: ReportSectionDef,
  rawData: RawReportData,
  apiKey: string,
  model: string,
  options?: { signal?: AbortSignal }
): Promise<string> {
  const prebuiltTable = prebuiltTableForSection(section.id, rawData);
  const scopedData = getScopedDataForSection(section.id, rawData);
  const { systemPrompt, userPrompt } = buildSectionPrompts(section, rawData, scopedData);

  const finalSystemPrompt = prebuiltTable
    ? systemPrompt + "\n\nCRITICAL: The table for this section is pre-built and will be appended automatically. Do NOT generate any table. Output ONLY the ## heading and 1 short overview paragraph. Nothing else."
    : systemPrompt;

  let sectionMarkdown = "";
  await streamGeneration({
    apiKey,
    model,
    systemPrompt: finalSystemPrompt,
    userPrompt,
    temperature: 0.7,
    maxTokens: 8000,
    topP: 0.9,
    onContentChunk: (chunk) => {
      sectionMarkdown += chunk;
    },
    signal: options?.signal,
  });

  let result = sectionMarkdown.trim();

  if (prebuiltTable) {
    // Strip any table the AI may have generated anyway
    result = result.replace(/\n*\|[^\n]+\|(\n\|[^\n]+\|)*/g, "").trim();
    result = result + "\n\n" + prebuiltTable;
  }

  return result;
}

/**
 * Generate full GSC report by running section agents in order and concatenating.
 */
export async function generateGSCReport(
  apiKey: string,
  model: string,
  discoveryData: GSCReportDiscoveryInput,
  options?: { signal?: AbortSignal; onProgress?: (current: number, total: number) => void; reportType?: ReportType }
): Promise<string> {
  const rawData = serializeRawData(discoveryData);
  const outline = options?.reportType === "progress" ? PROGRESS_REPORT_OUTLINE : REPORT_OUTLINE;
  const sections: string[] = [];
  const total = outline.length;
  options?.onProgress?.(0, total);

  for (let i = 0; i < outline.length; i++) {
    const section = outline[i];
    const sectionMarkdown = await generateSectionContent(
      section,
      rawData,
      apiKey,
      model,
      options
    );
    sections.push(sectionMarkdown);
    options?.onProgress?.(i + 1, total);
  }

  const fullContent = sections.join("\n\n");

  
  return fullContent;
}

/**
 * Parse markdown into sections by ## or # headings. Returns array of { title, content }.
 * Robust: handles ##, #, and ### as section breaks so we always get one agent per heading.
 */
export function parseReportIntoSections(
  markdown: string
): Array<{ title: string; content: string }> {
  const result: Array<{ title: string; content: string }> = [];
  const lines = markdown.split("\n");
  let currentTitle = "";
  let currentContent: string[] = [];

  const headingRegex = /^#{1,3}\s+(.+)$/;

  for (const line of lines) {
    const headingMatch = line.match(headingRegex);
    if (headingMatch) {
      if (currentTitle) {
        result.push({ title: currentTitle, content: currentContent.join("\n").trim() });
      }
      currentTitle = headingMatch[1].trim();
      currentContent = [];
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }
  if (currentTitle) {
    result.push({ title: currentTitle, content: currentContent.join("\n").trim() });
  }

  if (result.length === 0 && markdown.trim()) {
    const firstLine = markdown.split("\n")[0]?.trim() || "Report";
    const title = firstLine.startsWith("#") ? firstLine.replace(/^#+\s*/, "") : firstLine;
    result.push({ title: title.slice(0, 80), content: markdown.trim() });
  }

  
  return result;
}
