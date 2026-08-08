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
import { SinglePageOptimizationDetailsPanel } from "@/components/overview/overview-tab/SinglePageOptimizationDetailsPanel";
import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import {
  buildContentOptimizerBulkGeneratorDetailsProps,
  isContentOptimizerBulkRun,
} from "@/lib/content-optimization/content-optimizer-bulk-generator-bindings";
import type { OptimizationProgressState } from "@/hooks/content-optimization/use-optimization-state";
import type { OptimizationFileManager } from "@/lib/optimization-file-manager";

type Opt = ReturnType<typeof useWordPressOptimization>;

export type OverviewSinglePageDetailsContext = {
  siteId: string;
  isOptimizingContent: Record<string, boolean>;
  optimizationProgress: Record<string, OptimizationProgressState>;
  optimizationFileManagers: Record<string, OptimizationFileManager>;
};

export function hasSinglePageOptimizationDetailsActivity(
  ctx: OverviewSinglePageDetailsContext | undefined,
): boolean {
  if (!ctx?.siteId) return false;
  const { siteId } = ctx;
  if (ctx.isOptimizingContent[siteId]) return true;
  const progress = ctx.optimizationProgress[siteId];
  if (progress?.step?.trim()) return true;
  if ((progress?.progress ?? 0) > 0) return true;
  if ((progress?.microLog?.length ?? 0) > 0) return true;
  if ((progress?.harnessSections?.length ?? 0) > 0) return true;
  const fm = ctx.optimizationFileManagers[siteId];
  if (fm && fm.getFileCount() > 0) return true;
  return false;
}

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
  singlePageCtx?: OverviewSinglePageDetailsContext,
): boolean {
  const hasBatch = Boolean(batchBulkState?.urls?.length);
  const hasActiveSlices = META_BULK_MICRO_ORDER.some((key) => {
    const slice = bulkActionProgress[key];
    return slice && isActiveBulkSlice(slice);
  });
  return hasBatch || hasActiveSlices || hasSinglePageOptimizationDetailsActivity(singlePageCtx);
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
  const siteId = site?.id ?? "";
  const singlePageCtx: OverviewSinglePageDetailsContext | undefined = site
    ? {
        siteId,
        isOptimizingContent: opt.isOptimizingContent,
        optimizationProgress: opt.optimizationProgress,
        optimizationFileManagers: opt.optimizationFileManagers,
      }
    : undefined;
  const singlePageUrl = opt.pendingOptimization[siteId]?.url;
  const batchActive = isOverviewBatchRunActive(
    batchBulkState,
    bulkBatchKey,
    opt.isOptimizingContent,
  );
  const showSinglePage = hasSinglePageOptimizationDetailsActivity(singlePageCtx);
  // Keep the completed report visible after harness runs finish.
  const keepCompletedBatch =
    batchBulkState?.runKind === "aiInContentImage" ||
    batchBulkState?.runKind === "aiWikipediaLink";
  const showBatch = Boolean(
    site && batchBulkState?.urls?.length && (batchActive || keepCompletedBatch),
  );
  const showSlices = !batchActive && slices.length > 0;
  const batchHarnessSteps = batchBulkState?.batchPipelineSteps;
  const showBatchHarness = Boolean(batchActive && batchHarnessSteps?.length);
  const isSinglePageOptimizing = Boolean(site && opt.isOptimizingContent[siteId]);
  const showBatchPanel = showBatch && !showBatchHarness && !isSinglePageOptimizing;
  const isContentOptimizeBatch =
    Boolean(batchBulkState && isContentOptimizerBulkRun(batchBulkState)) && showBatchPanel;
  const contentOptimizerDetailsProps =
    isContentOptimizeBatch && batchBulkState && site
      ? buildContentOptimizerBulkGeneratorDetailsProps(
          {
            siteId,
            batchKey: bulkBatchKey,
            bulkState: batchBulkState,
            batchProgress,
            siteProgress: opt.optimizationProgress[siteId],
            overviewRows: c.rows,
            isOptimizingContent: opt.isOptimizingContent,
            optimizationFileManagers: opt.optimizationFileManagers,
            siteName: site.name,
          },
          Boolean(opt.isOptimizingContent[bulkBatchKey] || opt.isOptimizingContent[siteId]),
        )
      : null;

  return (
    <WorkspaceDetailsStack>
      {showSinglePage && !(batchActive && batchBulkState?.urls?.length) ? (
        <SinglePageOptimizationDetailsPanel
          siteId={siteId}
          opt={opt}
          pageUrl={singlePageUrl}
          stripeIndex={0}
          hideRowBody={Boolean(batchActive && batchBulkState?.urls?.length)}
        />
      ) : null}
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

      {isContentOptimizeBatch && contentOptimizerDetailsProps ? (
        <BulkGeneratorDetailsDrawer {...contentOptimizerDetailsProps} />
      ) : showBatchPanel ? (
        <BulkOptimizationPanel
            variant="page"
            displayMode="details-only"
            bulkState={batchBulkState}
            batchKey={bulkBatchKey}
            siteProgress={batchProgress}
            pageTitle={pageTitle}
            gscPreviewByUrl={gscPreviewByUrl}
            gscActiveUrl={gscActiveUrl}
            gscFetching={gscFetching}
            sitemapSource={c.sitemapSource}
            wpTitlesByUrl={c.wpTitlesByUrl}
            overviewRows={c.rows}
            onUploadToWordPress={onUploadToWordPress}
            onRequestClose={({ abortingRun }) => onBatchClose(Boolean(abortingRun))}
            onRowDateModifierChange={c.patchRowDateModifierByUrl}
            onRowDateModifierCommit={c.commitRowDateModifierByUrl}
        />
      ) : null}
    </WorkspaceDetailsStack>
  );
}

export function overviewContentDetailsCanOpen(
  site: OverviewTabController["site"],
  bulkActionProgress: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>,
  batchBulkState: BulkOptimizationState | undefined,
  singlePageCtx?: OverviewSinglePageDetailsContext,
): boolean {
  return Boolean(
    site && hasOverviewContentDetailsActivity(bulkActionProgress, batchBulkState, singlePageCtx),
  );
}
