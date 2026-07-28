/**
 * GSC Report Generator - Slim entry point
 * Delegates to gsc-report-ai.ts for AI-first report generation
 */

import type { AgentConfig } from "@/types/agent-config";
import type { GSCPerformanceStats } from "@/components/integrations/types";
import { formatMonthYearFromAPI } from "./gsc-date-helpers";
import { getResearchModel } from "./optimization-settings-storage";
import { AGENCY_NAME } from "./report-planner";
import type { ReportPlan } from "./report-planner";
import type { ReportDiscoveryData } from "./report-discovery";
import { generateGSCReport, parseReportIntoSections } from "./gsc-report-ai";
import type { GSCReportDiscoveryInput, ReportType } from "./gsc-report-ai";

// ─── Types (kept for report-discovery imports) ───────────────────────────────

export interface HistoricalData {
  success: boolean;
  siteUrl: string;
  dateRange: {
    earliest: string;
    latest: string;
    monthsOfData: number;
  };
  totals: {
    allTimeImpressions: number;
    currentMonthImpressions: number;
    firstMonthImpressions: number;
    growthPercent: number;
  };
  monthlyStats: Array<{
    month: string;
    impressions: number;
    avgPosition: number;
  }>;
}

export interface EntityPagesData {
  success: boolean;
  entityPathPattern: string;
  currentPeriod: {
    startDate: string;
    endDate: string;
    totalPages: number;
    totalImpressions: number;
    totalClicks: number;
  };
  comparisonPeriod?: {
    startDate: string;
    endDate: string;
    totalPages: number;
    totalImpressions: number;
    totalClicks: number;
  } | null;
  comparison?: {
    newPagesCount: number;
    impressionsChange: number;
    clicksChange: number;
    pagesChange: number;
  } | null;
  pages: Array<{
    url: string;
    pagePath: string;
    clicks: number;
    impressions: number;
    position: number;
    previousImpressions: number;
    previousClicks: number;
    previousPosition: number;
    impressionsChange: number;
    clicksChange: number;
    isNew: boolean;
    queries?: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  }>;
  newPages: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDiscoveryInput(
  stats: GSCPerformanceStats,
  siteName: string,
  siteUrl: string,
  options: {
    entityPagesData?: EntityPagesData | null;
    discoveryData?: ReportDiscoveryData | null;
  }
): GSCReportDiscoveryInput {
  if (options.discoveryData) {
    const dd = options.discoveryData;
    return {
      ...dd,
      historicalData: dd.historicalData
        ? { monthlyStats: dd.historicalData.monthlyStats }
        : null,
    };
  }
  return {
    site: { siteUrl },
    wordPressContext: { siteName },
    stats,
    entityPagesData: options.entityPagesData ?? null,
    gmbData: null,
  };
}

/**
 * Split section content into logical features (paragraphs, tables, bullet blocks).
 * Each block becomes a separate feature for robust per-agent editing.
 */
function sectionContentToFeatures(title: string, content: string): string[] {
  const features: string[] = [];
  const lines = content.split("\n");
  let currentBlock: string[] = [];
  let inTable = false;

  const flushBlock = () => {
    const text = currentBlock.join("\n").trim();
    if (text) features.push(text);
    currentBlock = [];
  };

  for (const line of lines) {
    const isTableRow = line.trim().startsWith("|");
    const isBlank = line.trim() === "";

    if (isTableRow) {
      if (!inTable && currentBlock.length > 0) {
        flushBlock();
      }
      inTable = true;
      currentBlock.push(line);
    } else {
      if (inTable) {
        flushBlock();
        inTable = false;
      }
      if (isBlank) {
        flushBlock();
  } else {
        currentBlock.push(line);
      }
    }
  }
  flushBlock();

  if (features.length === 0) {
    return [`## ${title}\n\n${content}`];
  }
  return features.map((f, i) => (i === 0 && !f.startsWith("##") ? `## ${title}\n\n${f}` : f));
}

/** Create one agent per section with multiple features each. Falls back to single agent if parsing yields no sections. */
export function markdownToSectionAgents(markdown: string): AgentConfig[] {
  const sections = parseReportIntoSections(markdown);
    if (sections.length === 0) {
    return [
      {
        id: "gsc-report",
        step: 1,
        title: "SEO Performance Report",
        description: `Executive GSC report by ${AGENCY_NAME}`,
        features: [markdown],
        h2Count: 1,
        h3Count: 0,
        h3Enabled: false,
        headingLevel: 1,
        maxTokens: 8000,
      },
    ];
  }
  return sections.map((sec, i) => {
    const features = sectionContentToFeatures(sec.title, sec.content);
    return {
      id: `gsc-section-${i + 1}`,
      step: i + 1,
      title: sec.title,
      description: sec.content.slice(0, 200) + (sec.content.length > 200 ? "..." : ""),
      features,
      h2Count: 1,
      h3Count: 0,
      h3Enabled: false,
      headingLevel: 1,
      maxTokens: 3000,
    };
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate GSC report directly - one AI call, returns markdown.
 * Use for Option B: bypass planner/draft, populate draft/final with markdown.
 */
export async function generateGSCReportDirect(
  stats: GSCPerformanceStats,
  siteName: string,
  siteUrl: string,
  options: {
    apiKey: string;
    model?: string;
    entityPagesData?: EntityPagesData | null;
    discoveryData?: ReportDiscoveryData | null;
    signal?: AbortSignal;
    onProgress?: (current: number, total: number) => void;
    reportType?: ReportType;
  }
): Promise<{ title: string; purpose: string; markdown: string }> {
  const input = toDiscoveryInput(stats, siteName, siteUrl, options);
  const model = options.model ?? getResearchModel();
  const reportType = options.reportType ?? "standard";
  const currentPeriodLabel = formatMonthYearFromAPI(stats.currentPeriod.startDate);
  const comparisonPeriodLabel = formatMonthYearFromAPI(stats.comparisonPeriod.startDate);

  const markdown = await generateGSCReport(options.apiKey, model, input, {
    signal: options.signal,
    onProgress: options.onProgress,
    reportType,
  });

  if (reportType === "progress") {
    const titleSuffix = `${comparisonPeriodLabel} → ${currentPeriodLabel}`;
    return {
      title: `${siteName} SEO Progress Report - ${titleSuffix}`,
      purpose: `SEO progress report for ${siteName} covering ${titleSuffix}, demonstrating accomplishments and growth by ${AGENCY_NAME}`,
      markdown,
    };
  }

  const reportTitleSuffix = `${currentPeriodLabel} vs ${comparisonPeriodLabel}`;
  return {
    title: `${siteName} SEO Performance Report - ${reportTitleSuffix}`,
    purpose: `Local SEO performance analysis for ${siteName} (${reportTitleSuffix}) by ${AGENCY_NAME}`,
    markdown,
  };
}

/**
 * Generate GSC report blueprint - backward-compatible entry point.
 * Delegates to AI-first path, wraps markdown in a single-agent blueprint.
 */
export async function generateGSCReportBlueprint(
  stats: GSCPerformanceStats,
  siteName: string,
  siteUrl: string,
  options: {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    entityPagesData?: EntityPagesData | null;
    historicalData?: HistoricalData | null;
    discoveryData?: ReportDiscoveryData | null;
    reportPlan?: ReportPlan | null;
  }
): Promise<{ title: string; purpose: string; agents: AgentConfig[] }> {
  const direct = await generateGSCReportDirect(stats, siteName, siteUrl, {
      apiKey: options.apiKey,
    model: options.model,
    entityPagesData: options.entityPagesData,
    discoveryData: options.discoveryData,
  });

  return {
    title: direct.title,
    purpose: direct.purpose,
    agents: markdownToSectionAgents(direct.markdown),
  };
}
