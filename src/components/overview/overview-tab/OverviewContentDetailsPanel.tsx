import {
  META_BULK_MICRO_ORDER,
  type BulkProgressSlice,
  type MetaBulkActionKey,
} from "@/components/overview/overview-tab-constants";
import type { OverviewTabController } from "@/hooks/overview/use-overview-tab-controller";
import type { useWordPressOptimization } from "@/contexts/wordpress-optimization-context";
import {
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
import {
  isOverviewBatchAllComplete,
  isOverviewResearchBatchInFlight,
} from "@/components/overview/overview-tab/overview-bulk-run-helpers";
import { SinglePageOptimizationDetailsPanel } from "@/components/overview/overview-tab/SinglePageOptimizationDetailsPanel";
import { ContentOptimizerDetailsDrawer } from "@/components/overview/overview-tab/ContentOptimizerDetailsDrawer";
import {
  buildOverviewBulkGeneratorDetailsProps,
  buildOverviewWarmInventoryDetailsProps,
  isOverviewBulkDetailsRun,
  overviewBulkDetailsCanOpenFromWarm,
} from "@/lib/overview/overview-bulk-details-bindings";
import type { BulkGscKeywordsHostedLink } from "@/lib/bulk/bulk-gsc-keywords-hosted-link";
import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
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
  sitemapInventoryLinks?: PromptBulkSitemapInventoryLink[];
  gscHostedLink?: BulkGscKeywordsHostedLink | null;
  sitemapInventoryLoading?: boolean;
};

function isActiveBulkSlice(slice: BulkProgressSlice): boolean {
  if (slice.total <= 0) return false;
  return slice.completed < slice.total;
}

function hasActiveMicroSlices(
  bulkActionProgress: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>,
): boolean {
  return META_BULK_MICRO_ORDER.some((key) => {
    const slice = bulkActionProgress[key];
    return slice && isActiveBulkSlice(slice);
  });
}

function isOverviewBatchRunActive(
  batchBulkState: BulkOptimizationState | undefined,
  bulkBatchKey: string,
  isOptimizing: Record<string, boolean>,
  siteId?: string,
): boolean {
  if (!batchBulkState?.urls?.length) return false;
  if (bulkBatchKey && isOptimizing[bulkBatchKey]) return true;
  if (siteId && isOptimizing[siteId]) return true;
  if (
    batchBulkState.runKind === "research" &&
    batchBulkState.currentStep !== "Batch complete" &&
    !isOverviewBatchAllComplete(batchBulkState)
  ) {
    return true;
  }
  return !isOverviewBatchAllComplete(batchBulkState);
}

export function hasOverviewContentDetailsActivity(
  bulkActionProgress: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>,
  batchBulkState: BulkOptimizationState | undefined,
  singlePageCtx?: OverviewSinglePageDetailsContext,
  warmInventory?: {
    sitemapInventoryLinks: PromptBulkSitemapInventoryLink[];
    gscHostedLink: BulkGscKeywordsHostedLink | null;
    sitemapInventoryLoading: boolean;
  },
): boolean {
  const hasBatch = Boolean(batchBulkState?.urls?.length);
  const hasActiveSlices = hasActiveMicroSlices(bulkActionProgress);
  const hasWarmInventory = warmInventory
    ? overviewBulkDetailsCanOpenFromWarm(
        warmInventory.sitemapInventoryLinks,
        warmInventory.gscHostedLink,
        warmInventory.sitemapInventoryLoading,
      )
    : false;
  return (
    hasBatch ||
    hasActiveSlices ||
    hasWarmInventory ||
    hasSinglePageOptimizationDetailsActivity(singlePageCtx)
  );
}

export function isOverviewResearchWorkerActive(
  batchBulkState: BulkOptimizationState | undefined,
  bulkBatchKey: string,
  siteId: string,
  isOptimizing: Record<string, boolean>,
): boolean {
  if (isOptimizing[bulkBatchKey] || (siteId && isOptimizing[siteId])) return true;
  return (
    batchBulkState?.runKind === "research" &&
    batchBulkState.currentStep !== "Batch complete" &&
    !isOverviewBatchAllComplete(batchBulkState)
  );
}

export function OverviewContentDetailsPanel({
  ctrl: c,
  batchBulkState,
  bulkBatchKey,
  batchProgress,
  opt,
  sitemapInventoryLinks = [],
  gscHostedLink = null,
  sitemapInventoryLoading = false,
}: OverviewContentDetailsPanelProps) {
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
  const siteBatchKey = siteId ? `${siteId}-batch` : "";
  const siteBatchState = siteBatchKey ? opt.bulkOptimizationState[siteBatchKey] : undefined;
  const effectiveBatchState =
    batchBulkState?.urls?.length
      ? batchBulkState
      : siteBatchState?.runKind === "research" && siteBatchState.urls?.length
        ? siteBatchState
        : batchBulkState;
  const effectiveBatchKey =
    effectiveBatchState === siteBatchState && siteBatchKey ? siteBatchKey : bulkBatchKey;
  const hasSiteResearchBatch = Boolean(
    siteBatchState?.runKind === "research" && siteBatchState.urls?.length,
  );

  const singlePageUrl = opt.pendingOptimization[siteId]?.url;
  const batchActive = isOverviewBatchRunActive(
    effectiveBatchState,
    effectiveBatchKey,
    opt.isOptimizingContent,
    siteId,
  );
  const showSinglePage = hasSinglePageOptimizationDetailsActivity(singlePageCtx);
  const keepCompletedBatch =
    effectiveBatchState?.runKind === "research" ||
    effectiveBatchState?.runKind === "aiInContentImage" ||
    effectiveBatchState?.runKind === "aiWikipediaLink";
  const showBatch = Boolean(
    site && effectiveBatchState?.urls?.length && (batchActive || keepCompletedBatch),
  );
  const isSinglePageOptimizing = Boolean(site && opt.isOptimizingContent[siteId]);
  const hasMicroActivity = hasActiveMicroSlices(c.bulkActionProgress);
  const researchWorkerActive = isOverviewResearchWorkerActive(
    effectiveBatchState,
    effectiveBatchKey,
    siteId,
    opt.isOptimizingContent,
  );
  const workspaceBusy = Boolean(
    opt.isOptimizingContent[effectiveBatchKey] ||
      opt.isOptimizingContent[siteId] ||
      hasMicroActivity ||
      researchWorkerActive,
  );

  const bulkDetailsProps =
    site && (showBatch || hasMicroActivity || isOverviewBulkDetailsRun(effectiveBatchState))
      ? buildOverviewBulkGeneratorDetailsProps(
          {
            siteId,
            batchKey: effectiveBatchKey,
            bulkState: effectiveBatchState ?? { urls: [], currentIndex: 0, urlStatuses: {}, currentStep: "" },
            batchProgress,
            siteProgress: opt.optimizationProgress[siteId],
            overviewRows: c.rows,
            isOptimizingContent: opt.isOptimizingContent,
            optimizationFileManagers: opt.optimizationFileManagers,
            siteName: site.name,
            sitemapInventoryLinks,
            siteKwHostedLink: gscHostedLink,
            sitemapInventoryLoading,
            sitemapSource: c.sitemapSource,
            bulkActionProgress: c.bulkActionProgress,
            bulkScopeUrlKeys: c.bulkScopeUrlKeys,
          },
          workspaceBusy,
        )
      : researchWorkerActive && site && effectiveBatchState
        ? buildOverviewBulkGeneratorDetailsProps(
            {
              siteId,
              batchKey: effectiveBatchKey,
              bulkState: effectiveBatchState,
              batchProgress,
              siteProgress: opt.optimizationProgress[siteId],
              overviewRows: c.rows,
              isOptimizingContent: opt.isOptimizingContent,
              optimizationFileManagers: opt.optimizationFileManagers,
              siteName: site.name,
              sitemapInventoryLinks,
              siteKwHostedLink: gscHostedLink,
              sitemapInventoryLoading,
              sitemapSource: c.sitemapSource,
              bulkActionProgress: c.bulkActionProgress,
              bulkScopeUrlKeys: c.bulkScopeUrlKeys,
            },
            true,
          )
        : null;

  const showWarmInventoryOnly =
    !bulkDetailsProps &&
    !researchWorkerActive &&
    !isOverviewResearchBatchInFlight(effectiveBatchState) &&
    !hasSiteResearchBatch &&
    overviewBulkDetailsCanOpenFromWarm(sitemapInventoryLinks, gscHostedLink, sitemapInventoryLoading);

  const warmOnlyProps = showWarmInventoryOnly
    ? buildOverviewWarmInventoryDetailsProps({
        overviewRows: c.rows,
        sitemapInventoryLinks,
        siteKwHostedLink: gscHostedLink,
        sitemapInventoryLoading,
        sitemapSource: c.sitemapSource,
      })
    : null;

  const drawerProps = bulkDetailsProps ?? warmOnlyProps;

  const hideSinglePageForResearch =
    hasSiteResearchBatch ||
    researchWorkerActive ||
    effectiveBatchState?.runKind === "research" ||
    showBatch;

  return (
    <WorkspaceDetailsStack>
      {showSinglePage && !hideSinglePageForResearch ? (
        <SinglePageOptimizationDetailsPanel
          siteId={siteId}
          opt={opt}
          pageUrl={singlePageUrl}
          stripeIndex={0}
          hideRowBody={Boolean(batchActive && effectiveBatchState?.urls?.length)}
        />
      ) : null}

      {drawerProps ? <ContentOptimizerDetailsDrawer {...drawerProps} /> : null}
    </WorkspaceDetailsStack>
  );
}

export function overviewContentDetailsCanOpen(
  site: OverviewTabController["site"],
  bulkActionProgress: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>,
  batchBulkState: BulkOptimizationState | undefined,
  singlePageCtx?: OverviewSinglePageDetailsContext,
  warmInventory?: {
    sitemapInventoryLinks: PromptBulkSitemapInventoryLink[];
    gscHostedLink: BulkGscKeywordsHostedLink | null;
    sitemapInventoryLoading: boolean;
  },
): boolean {
  return Boolean(
    site &&
      hasOverviewContentDetailsActivity(
        bulkActionProgress,
        batchBulkState,
        singlePageCtx,
        warmInventory,
      ),
  );
}
