import type { WordPressSite } from "@/components/integrations/types";
import { resolveOpenRouterApiKeyForHarness } from "@/lib/openrouter-api-key-resolve";
import { listSiteUrlsForMode } from "@/lib/local-analysis-site-context";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import {
  computeCompareRangesForPreset,
  formatGscComparePeriodLabel,
  validateGscCompareFetchRanges,
  type GscCompareRanges,
  type GscReportingComparePresetId,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import {
  ensureCompareSignalsFile,
  type GscCompareKind,
} from "@/lib/gsc-reporting/gsc-reporting-compare-signals";
import { fetchGscQueriesRawForReporting } from "@/lib/gsc-reporting/gsc-reporting-fetch";
import { runGscReportingPipeline } from "@/lib/gsc-reporting/gsc-reporting-pipeline";
import { buildSapEntityGrounding } from "@/lib/gsc-reporting/gsc-reporting-sap-entity-context";
import { pickClusterMarkdownForPipeline } from "@/lib/gsc-reporting/gsc-query-cluster-ai";
import type { AgentRunResumePoint } from "@/lib/agent-runs-types";
import type {
  GscReportingOutlineResult,
  GscReportingPipelineProgress,
  GscReportingPipelineResult,
  GscReportingSectionResult,
} from "@/lib/gsc-reporting/gsc-reporting-types";

export type GscReportingAutomationComparePreset = "mom" | "yoy";

export type RunGscReportingAgentHarnessArgs = {
  site: WordPressSite;
  comparePreset?: GscReportingAutomationComparePreset;
  compareRanges?: GscCompareRanges;
  cachedFiles?: { name: string; content: string }[];
  resumePoint?: AgentRunResumePoint | null;
  signal?: AbortSignal;
  isCancelled?: () => Promise<boolean>;
  onProgress?: (p: GscReportingPipelineProgress, resumePayload?: Record<string, unknown>) => void;
  onOutlineReady?: (payload: {
    outline: GscReportingOutlineResult;
    outlineRequestBodyJson: string;
  }) => void;
  onSectionStart?: (index: number) => void;
  onSectionReady?: (row: GscReportingSectionResult) => void;
};

export type GscReportingAgentHarnessResult = GscReportingPipelineResult & {
  files: { name: string; content: string }[];
  comparePreset: GscReportingAutomationComparePreset;
  compareLabel: string;
  fetchRange: { startDate: string; endDate: string };
  compareFetchRange: { startDate: string; endDate: string };
};

function resolveCompareRanges(
  comparePreset: GscReportingAutomationComparePreset,
  compareRanges?: GscCompareRanges,
): GscCompareRanges {
  if (compareRanges) return compareRanges;
  const presetId: GscReportingComparePresetId = comparePreset === "yoy" ? "yoy" : "mom";
  return computeCompareRangesForPreset(presetId);
}

function resolveCompareKind(
  comparePreset: GscReportingAutomationComparePreset,
  compareRanges?: GscCompareRanges,
): GscCompareKind {
  if (comparePreset === "yoy") return "yoy";
  if (compareRanges) return "custom";
  return "mom";
}

export async function runGscReportingAgentHarness(
  args: RunGscReportingAgentHarnessArgs,
): Promise<GscReportingAgentHarnessResult> {
  const comparePreset = args.comparePreset ?? "mom";
  const apiKey = (await resolveOpenRouterApiKeyForHarness())?.trim();
  if (!apiKey) {
    throw new Error("Add an OpenRouter API key in Settings.");
  }

  const publicSiteUrl = getPublicSiteUrl(args.site).trim();
  if (!publicSiteUrl) {
    throw new Error("Set a public site URL for this property.");
  }

  const compareRangeDraft = resolveCompareRanges(comparePreset, args.compareRanges);
  const check = validateGscCompareFetchRanges(compareRangeDraft.primary, compareRangeDraft.compare);
  if (!check.ok) {
    throw new Error(check.error);
  }

  if (await args.isCancelled?.()) {
    throw new Error("Cancelled");
  }

  let pipelineFiles: { name: string; content: string }[];
  let fetchRange = { startDate: compareRangeDraft.primary.startDate, endDate: compareRangeDraft.primary.endDate };
  let compareFetchRange = {
    startDate: compareRangeDraft.compare.startDate,
    endDate: compareRangeDraft.compare.endDate,
  };

  const resolvedCompareKind = resolveCompareKind(comparePreset, args.compareRanges);
  const compareLabelDraft = `${formatGscComparePeriodLabel(compareRangeDraft.primary.startDate, compareRangeDraft.primary.endDate)} vs ${formatGscComparePeriodLabel(compareRangeDraft.compare.startDate, compareRangeDraft.compare.endDate)}`;

  const resumePayload = args.resumePoint?.payload ?? {};
  const resumeCachedFiles = Array.isArray(resumePayload.cachedFiles)
    ? (resumePayload.cachedFiles as { name: string; content: string }[])
    : args.cachedFiles;
  const priorSectionResults = Array.isArray(resumePayload.sectionResults)
    ? (resumePayload.sectionResults as GscReportingSectionResult[])
    : [];
  const savedOutline = resumePayload.outline as GscReportingOutlineResult | undefined;
  const savedOutlineRequestBodyJson =
    typeof resumePayload.outlineRequestBodyJson === "string" ? resumePayload.outlineRequestBodyJson : undefined;

  let sectionResultsAcc = [...priorSectionResults];
  let outlineRef = savedOutline;
  let outlineRequestRef = savedOutlineRequestBodyJson;

  if (resumeCachedFiles?.length) {
    pipelineFiles = ensureCompareSignalsFile(
      resumeCachedFiles.map((f) => ({ ...f })),
      resolvedCompareKind,
      compareLabelDraft,
    );
    const md = pickClusterMarkdownForPipeline(pipelineFiles, {});
    if (md) pipelineFiles.push({ name: "Queries-AI-clusters.md", content: md });
  } else {
    args.onProgress?.(
      { step: 0, total: 1, label: "Fetching GSC bundle…" },
      { phase: "gsc_fetch", comparePreset },
    );
    const res = await fetchGscQueriesRawForReporting(publicSiteUrl, compareRangeDraft, {
      compareKind: resolvedCompareKind,
      compareLabel: compareLabelDraft,
    });
    fetchRange = { startDate: res.startDate, endDate: res.endDate };
    compareFetchRange = { startDate: res.compareStartDate, endDate: res.compareEndDate };
    pipelineFiles = res.files.map((f) => ({ ...f }));
    const md = pickClusterMarkdownForPipeline(res.files, {});
    if (md) pipelineFiles.push({ name: "Queries-AI-clusters.md", content: md });
    args.onProgress?.(
      { step: 0, total: 1, label: "GSC bundle ready" },
      { phase: "gsc_outline", comparePreset, cachedFiles: pipelineFiles.filter((f) => f.name !== "Queries-AI-clusters.md") },
    );
  }

  if (await args.isCancelled?.()) {
    throw new Error("Cancelled");
  }

  const allowlistUrls = (await listSiteUrlsForMode(args.site, "entity")) ?? [];
  const entityTail = args.site.entitySitemapUrl?.trim().split("/").pop();
  const sapEntityGrounding = buildSapEntityGrounding({
    files: pipelineFiles,
    allowlistUrls,
    sourceLabel: entityTail
      ? `Entity sitemap (${entityTail})`
      : "Entity URLs from WordPress sitemap",
    publicSiteUrl,
  });

  const cachedForResume = pipelineFiles.filter((f) => f.name !== "Queries-AI-clusters.md");

  const result = await runGscReportingPipeline({
    apiKey,
    model: getResearchModel(args.site.id),
    siteName: args.site.name,
    siteUrl: publicSiteUrl,
    files: pipelineFiles,
    sapEntityGrounding,
    compareKind: resolvedCompareKind,
    compareLabel: compareLabelDraft,
    signal: args.signal,
    priorSectionResults,
    savedOutline,
    savedOutlineRequestBodyJson,
    onProgress: (p) => {
      args.onProgress?.(p, {
        phase: "gsc_sections",
        comparePreset,
        cachedFiles: cachedForResume,
        outline: outlineRef,
        outlineRequestBodyJson: outlineRequestRef,
        sectionResults: sectionResultsAcc,
      });
    },
    onOutlineReady: (payload) => {
      outlineRef = payload.outline;
      outlineRequestRef = payload.outlineRequestBodyJson;
      args.onProgress?.(
        { step: 1, total: 1 + payload.outline.sections.length, label: "Outline complete" },
        {
          phase: "gsc_sections",
          comparePreset,
          cachedFiles: cachedForResume,
          outline: payload.outline,
          outlineRequestBodyJson: payload.outlineRequestBodyJson,
          sectionResults: sectionResultsAcc,
        },
      );
      args.onOutlineReady?.(payload);
    },
    onSectionStart: (index) => args.onSectionStart?.(index),
    onSectionReady: (row) => {
      sectionResultsAcc = [
        ...sectionResultsAcc.filter((entry) => entry.index !== row.index),
        row,
      ].sort((a, b) => a.index - b.index);
      args.onProgress?.(
        {
          step: 2 + row.index,
          total: 1 + (outlineRef?.sections.length ?? row.index + 1),
          label: `Section ${row.index + 1}: ${row.plan.h2Title.slice(0, 48)}…`,
        },
        {
          phase: "gsc_sections",
          comparePreset,
          cachedFiles: cachedForResume,
          outline: outlineRef,
          outlineRequestBodyJson: outlineRequestRef,
          sectionResults: sectionResultsAcc,
        },
      );
      args.onSectionReady?.(row);
    },
  });

  const compareLabel = `${formatGscComparePeriodLabel(fetchRange.startDate, fetchRange.endDate)} vs ${formatGscComparePeriodLabel(compareFetchRange.startDate, compareFetchRange.endDate)}`;

  return {
    ...result,
    files: pipelineFiles.filter((f) => f.name !== "Queries-AI-clusters.md"),
    comparePreset,
    compareLabel,
    fetchRange,
    compareFetchRange,
  };
}
