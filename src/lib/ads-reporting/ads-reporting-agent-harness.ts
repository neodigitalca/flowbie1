import type { WordPressSite } from "@/components/integrations/types";
import { resolveOpenRouterApiKeyForHarness } from "@/lib/openrouter-api-key-resolve";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import {
  computeCompareRangesForPreset,
  formatGscComparePeriodLabel,
  formatGscReportFullDateRange,
  validateGscCompareFetchRanges,
  type GscCompareRanges,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import { fetchAdsReportingBundle } from "@/lib/ads-reporting/ads-reporting-fetch";
import { runAdsReportingPipeline } from "@/lib/ads-reporting/ads-reporting-pipeline";
import {
  ADS_REPORTING_PROGRESS_LABELS,
  type AdsReportingOutlineResult,
  type AdsReportingPipelineProgress,
  type AdsReportingPipelineResult,
  type AdsReportingSectionResult,
} from "@/lib/ads-reporting/ads-reporting-types";
import { formatAdsBundleApiLabel, formatAdsBundleReadyLabel } from "@/lib/ads-reporting/ads-reporting-progress-log";
import type { AgentRunResumePoint } from "@/lib/agent-runs-types";

export type AdsReportingAutomationComparePreset = "mom" | "yoy";

export type RunAdsReportingAgentHarnessArgs = {
  site: WordPressSite;
  comparePreset?: AdsReportingAutomationComparePreset;
  compareRanges?: GscCompareRanges;
  cachedFiles?: { name: string; content: string }[];
  resumePoint?: AgentRunResumePoint | null;
  signal?: AbortSignal;
  isCancelled?: () => Promise<boolean>;
  onProgress?: (p: AdsReportingPipelineProgress, resumePayload?: Record<string, unknown>) => void | Promise<void>;
  onOutlineReady?: (payload: { outline: AdsReportingOutlineResult; outlineRequestBodyJson: string }) => void;
  onSectionStart?: (index: number) => void;
  onSectionReady?: (row: AdsReportingSectionResult) => void;
};

export type AdsReportingAgentHarnessResult = AdsReportingPipelineResult & {
  files: { name: string; content: string }[];
  comparePreset: AdsReportingAutomationComparePreset;
  compareLabel: string;
  fetchRange: { startDate: string; endDate: string };
  compareFetchRange: { startDate: string; endDate: string };
};

export async function runAdsReportingAgentHarness(
  args: RunAdsReportingAgentHarnessArgs,
): Promise<AdsReportingAgentHarnessResult> {
  const comparePreset = args.comparePreset ?? "mom";
  const apiKey = (await resolveOpenRouterApiKeyForHarness())?.trim();
  if (!apiKey) throw new Error("Add an OpenRouter API key in Settings.");
  const customerId = args.site.googleAdsCustomerId?.trim() ?? "";
  if (!customerId) throw new Error("Set a Google Ads customer ID on this property.");

  const compareRangeDraft = args.compareRanges ?? computeCompareRangesForPreset(comparePreset === "yoy" ? "yoy" : "mom");
  const check = validateGscCompareFetchRanges(compareRangeDraft.primary, compareRangeDraft.compare);
  if (!check.ok) throw new Error(check.error);
  if (await args.isCancelled?.()) throw new Error("Cancelled");

  const compareKind = comparePreset === "yoy" ? "yoy" : args.compareRanges ? "custom" : "mom";
  const compareLabelDraft = `${formatGscReportFullDateRange(compareRangeDraft.primary.startDate, compareRangeDraft.primary.endDate)} vs ${formatGscComparePeriodLabel(compareRangeDraft.compare.startDate, compareRangeDraft.compare.endDate)}`;

  const resumePayload = args.resumePoint?.payload ?? {};
  const resumeCachedFiles = Array.isArray(resumePayload.cachedFiles)
    ? (resumePayload.cachedFiles as { name: string; content: string }[])
    : args.cachedFiles;
  const priorSectionResults = Array.isArray(resumePayload.sectionResults)
    ? (resumePayload.sectionResults as AdsReportingSectionResult[])
    : [];
  const savedOutline = resumePayload.outline as AdsReportingOutlineResult | undefined;
  const savedOutlineRequestBodyJson =
    typeof resumePayload.outlineRequestBodyJson === "string" ? resumePayload.outlineRequestBodyJson : undefined;

  let pipelineFiles: { name: string; content: string }[];
  let fetchRange = { startDate: compareRangeDraft.primary.startDate, endDate: compareRangeDraft.primary.endDate };
  let compareFetchRange = {
    startDate: compareRangeDraft.compare.startDate,
    endDate: compareRangeDraft.compare.endDate,
  };

  if (resumeCachedFiles?.length) {
    pipelineFiles = resumeCachedFiles.map((f) => ({ ...f }));
    await args.onProgress?.(
      { step: 0, total: 1, label: formatAdsBundleReadyLabel(pipelineFiles, compareLabelDraft) },
      { phase: "ads_outline", comparePreset },
    );
  } else {
    await args.onProgress?.(
      { step: 0, total: 1, label: formatAdsBundleApiLabel(compareLabelDraft) },
      { phase: "ads_fetch", comparePreset },
    );
    const res = await fetchAdsReportingBundle(customerId, compareRangeDraft, {
      compareKind,
      compareLabel: compareLabelDraft,
    });
    fetchRange = { startDate: res.startDate, endDate: res.endDate };
    compareFetchRange = { startDate: res.compareStartDate, endDate: res.compareEndDate };
    pipelineFiles = res.files;
    await args.onProgress?.(
      { step: 0, total: 1, label: formatAdsBundleReadyLabel(pipelineFiles, compareLabelDraft) },
      { phase: "ads_outline", comparePreset },
    );
  }

  if (await args.isCancelled?.()) throw new Error("Cancelled");
  await args.onProgress?.(
    { step: 0, total: 1, label: ADS_REPORTING_PROGRESS_LABELS.outlineGenerating },
    { phase: "ads_outline_generating", comparePreset },
  );

  let sectionResultsAcc = [...priorSectionResults];
  let outlineRef = savedOutline;
  const result = await runAdsReportingPipeline({
    apiKey,
    model: getResearchModel(args.site.id),
    siteName: args.site.name,
    siteUrl: getPublicSiteUrl(args.site).trim(),
    files: pipelineFiles,
    compareKind,
    compareLabel: compareLabelDraft,
    signal: args.signal,
    priorSectionResults,
    savedOutline,
    savedOutlineRequestBodyJson,
    onProgress: async (p) => {
      await args.onProgress?.(p, {
        phase: "ads_sections",
        sectionIndex: p.sectionIndex,
        comparePreset,
        outline: outlineRef,
        sectionResults: sectionResultsAcc,
      });
    },
    onOutlineReady: (payload) => {
      outlineRef = payload.outline;
      args.onOutlineReady?.(payload);
    },
    onSectionStart: (index) => args.onSectionStart?.(index),
    onSectionReady: (row) => {
      sectionResultsAcc = [...sectionResultsAcc.filter((entry) => entry.index !== row.index), row].sort(
        (a, b) => a.index - b.index,
      );
      args.onSectionReady?.(row);
    },
  });

  return {
    ...result,
    files: pipelineFiles,
    comparePreset,
    compareLabel: `${formatGscReportFullDateRange(fetchRange.startDate, fetchRange.endDate)} vs ${formatGscComparePeriodLabel(compareFetchRange.startDate, compareFetchRange.endDate)}`,
    fetchRange,
    compareFetchRange,
  };
}
