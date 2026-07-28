import {
  META_BULK_MICRO_LABELS,
  META_BULK_MICRO_ORDER,
  type BulkProgressSlice,
  type MetaBulkActionKey,
} from "@/components/overview/overview-tab-constants";
import { BulkOptimizationPanel } from "@/components/integrations/wordpress/BulkOptimizationPanel";
import type { OverviewTabController } from "@/hooks/overview/use-overview-tab-controller";
import type { useWordPressOptimization } from "@/contexts/wordpress-optimization-context";
import type { GscPerformancePreviewSnapshot } from "@/hooks/content-optimization/gsc-preview-types";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import {
  WorkspaceDetailsProgressRow,
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
import { WorkspaceDetailsPipelineSteps } from "@/components/shared/WorkspaceDetailsPipelineSteps";
import { isOverviewBatchAllComplete } from "@/components/overview/overview-tab/overview-bulk-run-helpers";

type Opt = ReturnType<typeof useWordPressOptimization>;

export type OverviewContentDetailsPanelProps = {
  ctrl: OverviewTabController;
  batchBulkState: BulkOptimizationState | undefined;
  bulkBatchKey: string;
  batchProgress: Opt["optimizationProgress"][string] | undefined;
  opt: Opt;
  pageTitle?: string;
  gscPreviewByUrl: Record<string, GscPerformancePreviewSnapshot | null | undefined>;
  gscActiveUrl: string | null;
  gscFetching: boolean;
  onUploadToWordPress?: () => void;
  onBatchClose: (abortingRun: boolean) => void;
};

function isActiveBulkSlice(slice: BulkProgressSlice): boolean {
  if (slice.total <= 0) return false;
  return slice.completed < slice.total;
}

function activeBulkSlices(
  bulkActionProgress: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>,
): Array<{ key: MetaBulkActionKey; slice: BulkProgressSlice }> {
  return META_BULK_MICRO_ORDER.flatMap((key) => {
    const slice = bulkActionProgress[key];
    if (!slice || !isActiveBulkSlice(slice)) return [];
    return [{ key, slice }];
  });
}

function isOverviewBatchRunActive(
  batchBulkState: BulkOptimizationState | undefined,
  bulkBatchKey: string,
  isOptimizing: Record<string, boolean>,
): boolean {
  if (!batchBulkState?.urls?.length) return false;
  if (bulkBatchKey && isOptimizing[bulkBatchKey]) return true;
  return !isOverviewBatchAllComplete(batchBulkState);
}

export function hasOverviewContentDetailsActivity(
  bulkActionProgress: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>,
  batchBulkState: BulkOptimizationState | undefined,
): boolean {
  const hasBatch = Boolean(batchBulkState?.urls?.length);
  const hasActiveSlices = META_BULK_MICRO_ORDER.some((key) => {
    const slice = bulkActionProgress[key];
    return slice && isActiveBulkSlice(slice);
  });
  return hasBatch || hasActiveSlices;
}

export function OverviewContentDetailsPanel({
  ctrl: c,
  batchBulkState,
  bulkBatchKey,
  batchProgress,
  opt,
  pageTitle,
  gscPreviewByUrl,
  gscActiveUrl,
  gscFetching,
  onUploadToWordPress,
  onBatchClose,
}: OverviewContentDetailsPanelProps) {
  const slices = activeBulkSlices(c.bulkActionProgress);
  const site = c.site;
  const batchActive = isOverviewBatchRunActive(
    batchBulkState,
    bulkBatchKey,
    opt.isOptimizingContent,
  );
  // Local Image (in-content image): keep the completed report visible after the run finishes.
  const keepCompletedBatch = batchBulkState?.runKind === "aiInContentImage";
  const showBatch = Boolean(
    site && batchBulkState?.urls?.length && (batchActive || keepCompletedBatch),
  );
  const showSlices = !batchActive && slices.length > 0;
  const batchHarnessSteps = batchBulkState?.batchPipelineSteps;
  const showBatchHarness = Boolean(batchActive && batchHarnessSteps?.length);
  const showBatchPanel = showBatch && !showBatchHarness;

  return (
    <WorkspaceDetailsStack>
      {showBatchHarness ? <WorkspaceDetailsPipelineSteps steps={batchHarnessSteps!} /> : null}
      {showSlices
        ? slices.map(({ key, slice }, index) => (
            <WorkspaceDetailsProgressRow
              key={key}
              label={META_BULK_MICRO_LABELS[key]}
              slice={slice}
              stripeIndex={index}
            />
          ))
        : null}

      {showBatchPanel ? (
        <BulkOptimizationPanel
            variant="page"
            displayMode="details-only"
            bulkState={batchBulkState}
            batchKey={bulkBatchKey}
            siteProgress={batchProgress}
            onApproveKeywords={opt.approveBulkKeywordApproval}
            pageTitle={pageTitle}
            gscPreviewByUrl={gscPreviewByUrl}
            gscActiveUrl={gscActiveUrl}
            gscFetching={gscFetching}
            sitemapSource={c.sitemapSource}
            onUploadToWordPress={onUploadToWordPress}
            onRequestClose={({ abortingRun }) => onBatchClose(Boolean(abortingRun))}
        />
      ) : null}
    </WorkspaceDetailsStack>
  );
}

export function overviewContentDetailsCanOpen(
  site: OverviewTabController["site"],
  bulkActionProgress: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>,
  batchBulkState: BulkOptimizationState | undefined,
): boolean {
  return Boolean(site && hasOverviewContentDetailsActivity(bulkActionProgress, batchBulkState));
}
