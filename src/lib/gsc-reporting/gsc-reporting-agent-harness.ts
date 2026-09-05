import type { WordPressSite } from "@/components/integrations/types";
import { resolveOpenRouterApiKeyForHarness } from "@/lib/openrouter-api-key-resolve";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import { findConnectedWordPressSite } from "@/lib/agent-runs/resolve-agent-run-site";
import { fetchGscQueriesRawForReporting, gscIndexedPageUrlsFromCsv } from "@/lib/gsc-reporting/gsc-reporting-fetch";
import {
  computeCompareRangesForPreset,
  formatGscComparePeriodLabel,
  formatGscReportFullDateRange,
  parseGscYmd,
  validateGscCompareFetchRanges,
  type GscCompareRanges,
  type GscReportingComparePresetId,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import {
  ensureCompareSignalsFile,
  type GscCompareKind,
} from "@/lib/gsc-reporting/gsc-reporting-compare-signals";
import { runGscReportingPipeline } from "@/lib/gsc-reporting/gsc-reporting-pipeline";
import { buildSapEntityGrounding } from "@/lib/gsc-reporting/gsc-reporting-sap-entity-context";
import { resolveGscClientSeasonContext } from "@/lib/gsc-reporting/gsc-reporting-client-season";
import { pickClusterMarkdownForPipeline } from "@/lib/gsc-reporting/gsc-query-cluster-ai";
import type { AgentRunResumePoint } from "@/lib/agent-runs-types";
import {
  GSC_REPORTING_PROGRESS_LABELS,
  type GscReportingOutlineResult,
  type GscReportingPipelineProgress,
  type GscReportingPipelineResult,
  type GscReportingSectionResult,
} from "@/lib/gsc-reporting/gsc-reporting-types";
import {
  formatGscBundleApiLabel,
  formatGscBundleReadyLabel,
} from "@/lib/gsc-reporting/gsc-reporting-progress-log";

export type GscReportingAutomationComparePreset = "mom" | "yoy";

export type RunGscReportingAgentHarnessArgs = {
  site: WordPressSite;
  comparePreset?: GscReportingAutomationComparePreset;
  compareRanges?: GscCompareRanges;
  cachedFiles?: { name: string; content: string }[];
  resumePoint?: AgentRunResumePoint | null;
  signal?: AbortSignal;
  isCancelled?: () => Promise<boolean>;
  onProgress?: (p: GscReportingPipelineProgress, resumePayload?: Record<string, unknown>) => void | Promise<void>;
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

  let publicSiteUrl = getPublicSiteUrl(args.site).trim();
  if (!publicSiteUrl && args.site.id) {
    const connected = findConnectedWordPressSite(args.site.id);
    if (connected) publicSiteUrl = getPublicSiteUrl(connected).trim();
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
  const compareLabelDraft = `${formatGscReportFullDateRange(compareRangeDraft.primary.startDate, compareRangeDraft.primary.endDate)} vs ${formatGscComparePeriodLabel(compareRangeDraft.compare.startDate, compareRangeDraft.compare.endDate)}`;

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

  const emitProgress = async (
    progress: GscReportingPipelineProgress,
    resumePayload?: Record<string, unknown>,
  ) => {
    await args.onProgress?.(progress, resumePayload);
  };

  if (resumeCachedFiles?.length) {
    pipelineFiles = ensureCompareSignalsFile(
      resumeCachedFiles.map((f) => ({ ...f })),
      resolvedCompareKind,
      compareLabelDraft,
    );
    const md = pickClusterMarkdownForPipeline(pipelineFiles, {});
    if (md) pipelineFiles.push({ name: "Queries-AI-clusters.md", content: md });
    const cachedForResume = pipelineFiles.filter((f) => f.name !== "Queries-AI-clusters.md");
    await emitProgress(
      { step: 0, total: 1, label: formatGscBundleReadyLabel(cachedForResume, compareLabelDraft) },
      {
        phase: "gsc_outline",
        comparePreset,
        bundleFileNames: cachedForResume.map((file) => file.name),
        bundleFileCount: cachedForResume.length,
      },
    );
  } else {
    await emitProgress(
      { step: 0, total: 1, label: formatGscBundleApiLabel(compareLabelDraft) },
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
    const cachedForResume = pipelineFiles.filter((f) => f.name !== "Queries-AI-clusters.md");
    await emitProgress(
      { step: 0, total: 1, label: formatGscBundleReadyLabel(cachedForResume, compareLabelDraft) },
      {
        phase: "gsc_outline",
        comparePreset,
        bundleFileNames: cachedForResume.map((file) => file.name),
        bundleFileCount: cachedForResume.length,
        compareLabel: compareLabelDraft,
      },
    );
  }

  if (await args.isCancelled?.()) {
    throw new Error("Cancelled");
  }

  await emitProgress(
    { step: 0, total: 1, label: GSC_REPORTING_PROGRESS_LABELS.outlineGenerating },
    { phase: "gsc_outline_generating", comparePreset },
  );

  const indexedPagesFile = pipelineFiles.find((file) => file.name === "Indexed-pages-urls-current.csv");
  const allowlistUrls = indexedPagesFile ? gscIndexedPageUrlsFromCsv(indexedPagesFile.content) : [];
  const sapEntityGrounding = buildSapEntityGrounding({
    files: pipelineFiles,
    allowlistUrls,
    sourceLabel: "GSC indexed pages",
    publicSiteUrl,
  });

  const result = await runGscReportingPipeline({
    apiKey,
    model: getResearchModel(args.site.id),
    siteName: args.site.name,
    siteUrl: publicSiteUrl,
    files: pipelineFiles,
    sapEntityGrounding,
    compareKind: resolvedCompareKind,
    compareLabel: compareLabelDraft,
    clientSeason: resolveGscClientSeasonContext(
      args.site,
      parseGscYmd(compareRangeDraft.primary.startDate) ?? new Date(),
    ),
    signal: args.signal,
    priorSectionResults,
    savedOutline,
    savedOutlineRequestBodyJson,
    onProgress: async (p) => {
      await args.onProgress?.(p, {
        phase: "gsc_sections",
        sectionIndex: p.sectionIndex,
        comparePreset,
        outline: outlineRef,
        sectionResults: sectionResultsAcc,
      });
    },
    onOutlineReady: (payload) => {
      outlineRef = payload.outline;
      outlineRequestRef = payload.outlineRequestBodyJson;
      args.onOutlineReady?.(payload);
    },
    onSectionStart: (index) => args.onSectionStart?.(index),
    onSectionReady: (row) => {
      sectionResultsAcc = [
        ...sectionResultsAcc.filter((entry) => entry.index !== row.index),
        row,
      ].sort((a, b) => a.index - b.index);
      args.onSectionReady?.(row);
    },
  });

  const compareLabel = `${formatGscReportFullDateRange(fetchRange.startDate, fetchRange.endDate)} vs ${formatGscComparePeriodLabel(compareFetchRange.startDate, compareFetchRange.endDate)}`;

  return {
    ...result,
    files: pipelineFiles.filter((f) => f.name !== "Queries-AI-clusters.md"),
    comparePreset,
    compareLabel,
    fetchRange,
    compareFetchRange,
  };
}
