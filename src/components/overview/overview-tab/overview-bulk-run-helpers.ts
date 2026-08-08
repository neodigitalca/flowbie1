import type { WordPressSite } from "@/components/integrations/types";
import type { useWordPressOptimization } from "@/contexts/wordpress-optimization-context";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import { buildContentPrepUrlHarnessMap } from "@/lib/overview/overview-content-prep-harness-run";
import {
  buildWaitingBatchPrepHarnessSections,
  CONTENT_PREP_BATCH_HARNESS_TOTAL_SECTIONS,
} from "@/lib/overview/overview-content-prep-harness-sections";

type Opt = ReturnType<typeof useWordPressOptimization>;

export function getOverviewBulkPageTitle(
  batchBulkState: BulkOptimizationState | undefined,
  site: WordPressSite,
): string {
  const runKind = batchBulkState?.runKind;
  if (runKind === "research") return `Research - ${site.name}`;
  if (runKind === "aiAllMeta") return `AI All Meta - ${site.name}`;
  if (runKind === "aiHeaders") return `Headers - ${site.name}`;
  if (runKind === "contentCleanup") return `Clean Up - ${site.name}`;
  if (runKind === "aiLinks") return `Links - ${site.name}`;
  if (runKind === "aiWikipediaLink") return `Wikipedia link - ${site.name}`;
  if (runKind === "aiOverview") return `Overview - ${site.name}`;
  if (runKind === "aiInContentImage") return `In Content Image - ${site.name}`;
  if (runKind === "wpUpload") return `WordPress upload - ${site.name}`;
  return `Content Optimizer - ${site.name}`;
}

function bulkUrlStatus(
  batchBulkState: BulkOptimizationState,
  url: string,
  index: number,
): BulkOptimizationState["urlStatuses"][string] {
  const explicit = batchBulkState.urlStatuses?.[url];
  if (explicit) return explicit;
  const currentIndex = batchBulkState.currentIndex ?? 0;
  if (index < currentIndex) return "completed";
  if (index === currentIndex) return "optimizing";
  return "pending";
}

export function getOverviewBulkActiveRowUrl(
  batchBulkState: BulkOptimizationState | undefined,
  batchRunning: boolean,
): string | null {
  if (!batchRunning || !batchBulkState?.urls?.length) return null;
  if (isOverviewBatchAllComplete(batchBulkState)) return null;

  const urls = batchBulkState.urls;

  for (const url of urls) {
    if (batchBulkState.urlStatuses?.[url] === "optimizing") return url;
  }

  if (typeof batchBulkState.warmingUpIndex === "number") {
    const warmupUrl = urls[batchBulkState.warmingUpIndex];
    if (warmupUrl) return warmupUrl;
  }

  const currentIndex = batchBulkState.currentIndex ?? 0;
  if (currentIndex >= 0 && currentIndex < urls.length) {
    const url = urls[currentIndex]!;
    const status = bulkUrlStatus(batchBulkState, url, currentIndex);
    if (status === "optimizing" || status === "pending") return url;
  }

  const fromCurrent = batchBulkState.currentUrl?.trim();
  if (fromCurrent) return fromCurrent;

  return null;
}

export function isOverviewRowBulkActive(
  rowUrl: string,
  batchBulkState: BulkOptimizationState | undefined,
  batchRunning: boolean,
): boolean {
  const active = getOverviewBulkActiveRowUrl(batchBulkState, batchRunning);
  if (!active) return false;
  return normalizePageUrlKey(rowUrl) === normalizePageUrlKey(active);
}

export function getOverviewBulkActiveUrl(batchBulkState: BulkOptimizationState | undefined): string | null {
  return getOverviewBulkActiveRowUrl(batchBulkState, Boolean(batchBulkState?.urls?.length));
}

export function deriveOverviewBulkRunGsc(
  site: WordPressSite,
  batchBulkState: BulkOptimizationState | undefined,
  bulkBatchKey: string,
  batchProgress: Opt["optimizationProgress"][string] | undefined,
  opt: Opt,
) {
  const gscMapOverview = opt.gscPerformancePreview[site.id] || {};
  const bulkActiveUrl =
    batchBulkState?.urls?.length && typeof batchBulkState.currentIndex === "number"
      ? (batchBulkState.urls[batchBulkState.currentIndex] ?? null)
      : null;
  const gscSnapshot = bulkActiveUrl ? gscMapOverview[bulkActiveUrl] : undefined;
  const rowProgress = opt.optimizationProgress[site.id] ?? batchProgress;
  const progressText = `${rowProgress?.step || ""} ${rowProgress?.message || ""}`.toLowerCase();
  const isBusy =
    Boolean(opt.isOptimizingContent[site.id]) ||
    Boolean(bulkBatchKey && opt.isOptimizingContent[bulkBatchKey]);
  const gscPreviewLoading =
    Boolean(isBusy) &&
    Boolean(bulkActiveUrl) &&
    !gscSnapshot?.queries?.length &&
    (progressText.includes("gsc") ||
      progressText.includes("search console") ||
      progressText.includes("page performance"));

  return {
    rowProgress,
    gscMapOverview,
    bulkActiveUrl,
    gscPreviewLoading,
    isBusy,
  };
}

export function isOverviewBatchAllComplete(batchBulkState: BulkOptimizationState | undefined): boolean {
  const urls = batchBulkState?.urls || [];
  if (urls.length === 0) return false;
  const urlStatuses = batchBulkState?.urlStatuses || {};
  let processed = 0;
  for (const url of urls) {
    const st = urlStatuses[url];
    if (st === "completed" || st === "skipped" || st === "error") processed += 1;
  }
  return processed === urls.length;
}

/** Seed batch state at Optimize All start so grid highlight + Details work during prelude. */
export function seedOverviewBulkBatchPrelude(
  setBulkOptimizationState: Opt["setBulkOptimizationState"],
  setIsOptimizingContent: Opt["setIsOptimizingContent"],
  batchKey: string,
  urls: string[],
  currentStep: string,
): void {
  const initialUrlStatuses: BulkOptimizationState["urlStatuses"] = {};
  for (const url of urls) {
    initialUrlStatuses[url] = "pending";
  }
  const batchPrepHarnessSections = buildWaitingBatchPrepHarnessSections();
  const urlHarnessSections = buildContentPrepUrlHarnessMap(urls);
  setBulkOptimizationState((prev) => ({
    ...prev,
    [batchKey]: {
      urls,
      currentIndex: 0,
      urlStatuses: initialUrlStatuses,
      currentStep,
      currentUrl: urls[0],
      warmingUpIndex: null,
      warmingUpIndex2: null,
      researchedUrls: [],
      urlHarnessSections,
      batchPrepHarnessSections,
      currentStepProgress: {
        step: currentStep,
        progress: 2,
        message: currentStep,
        harnessSections: batchPrepHarnessSections,
        harnessPlannedSectionCount: CONTENT_PREP_BATCH_HARNESS_TOTAL_SECTIONS,
      },
    },
  }));
  setIsOptimizingContent((prev) => ({ ...prev, [batchKey]: true }));
}

export function isOverviewBulkWorkerActive(
  isOptimizingContent: Record<string, boolean>,
  batchKey: string,
  siteId: string,
): boolean {
  return Boolean(isOptimizingContent[batchKey] || isOptimizingContent[siteId]);
}
