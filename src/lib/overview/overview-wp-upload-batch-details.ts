import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { CSVRow } from "@/lib/bulk-auto-generate";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import type { MetaPipelineStepUi } from "@/components/overview/overview-tab-constants";
import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { BulkGscKeywordsHostedLink } from "@/lib/bulk/bulk-gsc-keywords-hosted-link";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import {
  buildWpUploadBatchPipelineSteps,
  wpUploadBatchDisplayCount,
} from "@/lib/overview/overview-batch-pipeline-progress";

export function resolveWpUploadBatchPipelineSteps(
  bulkState: BulkOptimizationState,
): MetaPipelineStepUi[] {
  if (bulkState.batchPipelineSteps?.length) {
    return bulkState.batchPipelineSteps;
  }
  return buildWpUploadBatchPipelineSteps(bulkState.urls?.length ?? 0);
}

export function buildOverviewWpUploadBatchDetailsProps(
  input: {
    bulkState: BulkOptimizationState;
    sitemapInventoryLinks?: PromptBulkSitemapInventoryLink[];
    siteKwHostedLink?: BulkGscKeywordsHostedLink | null;
    sitemapInventoryLoading?: boolean;
    sitemapSource?: OverviewSitemapSource;
  },
  workspaceBusy: boolean,
): BulkGeneratorDetailsPanelProps {
  const steps = resolveWpUploadBatchPipelineSteps(input.bulkState);
  const ticker = wpUploadBatchDisplayCount(steps);
  const current = ticker?.current ?? 0;
  const total = ticker?.total ?? steps.length;
  const currentStep = current > 0 ? steps[current - 1] : undefined;
  const displayRows: CSVRow[] = currentStep
    ? [{ title: currentStep.label, keyword: "", destination_url: "" }]
    : [];

  const running = steps.find((step) => step.status === "running");
  const status =
    input.bulkState.currentStepProgress?.message?.trim() ||
    running?.label ||
    input.bulkState.currentStep?.trim() ||
    "Uploading to WordPress";

  return {
    variant: "csv",
    workspaceBusy,
    headerProgress: total > 0
      ? {
          phase: `WordPress upload ${current}/${total}`,
          completed: current,
          total,
          progressPct: total > 0 ? Math.round((current / total) * 100) : 0,
          harnessActive: workspaceBusy,
        }
      : null,
    isProcessing: workspaceBusy,
    status,
    harnessSections: [],
    harnessByRow: new Map(),
    batchPrepHarnessSections: [],
    harnessPlannedSectionCount: null,
    currentRow: displayRows.length ? 0 : -1,
    totalRows: total,
    displayRows,
    postDestination: "wordpress",
    wpConfig: null,
    pipelineSectionTitles: [],
    entitySapRowDisplay: input.sitemapSource === "sap",
    filesByRow: new Map(),
    sitemapInventoryLinks: input.sitemapInventoryLinks,
    siteKwHostedLink: input.siteKwHostedLink ?? null,
    sitemapInventoryLoading: input.sitemapInventoryLoading ?? false,
  };
}
