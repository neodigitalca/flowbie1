import React from "react";
import { Wand2 } from "lucide-react";
import { ContentOptimizerSectionPills } from "@/components/content-optimizer/ContentOptimizerSectionPills";
import type { ContentOptimizerSectionId } from "@/components/content-optimizer/content-optimizer-sections";
import type { ContentOptimizerGeneratorChrome } from "@/components/content-optimizer/content-optimizer-generator-chrome";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import {
  OVERVIEW_SITEMAP_SOURCE_LABELS,
  type OverviewSitemapSource,
} from "@/lib/overview/overview-sitemap-source";
import { buildOverviewBulkActionClusters } from "@/lib/overview/overview-bulk-action-clusters";
import { OverviewBulkClusterFlyout } from "@/components/overview/overview-tab/OverviewBulkClusterFlyout";
import { OverviewSemrushCsvUpload } from "@/components/overview/overview-tab/OverviewSemrushCsvUpload";
import { OverviewErrorsFilterMenu } from "@/components/overview/overview-tab/OverviewErrorsFilterMenu";
import { OverviewContentSortControls } from "@/components/overview/overview-tab/OverviewContentSortControls";
import { CONTENT_PAGINATION_SLOT_CLASS } from "@/components/overview/overview-tab/OverviewContentChromeReserve";
import { OVERVIEW_GRID_VISIBLE_ROW_COUNT } from "@/components/overview/overview-tab/overview-tab-content-constants";
import { OverviewGridPagination } from "@/components/overview/OverviewGridPagination";
import {
  BulkPostProgressLeading,
  resolveBulkPostTicker,
  type MetaBulkMicroSnapshot,
} from "@/components/overview/OverviewBulkMicroProgress";
import { BULK_TOOLBAR_GROUP_DIVIDER } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { OverviewTabController } from "@/hooks/overview/use-overview-tab-controller";
import { useOverviewSiteWarmDetails } from "@/hooks/overview/use-overview-site-warm-details";
import type { useWordPressOptimization } from "@/contexts/wordpress-optimization-context";
import type { MetaBulkActionKey, BulkProgressSlice } from "@/components/overview/overview-tab-constants";
import {
  OverviewContentDetailsPanel,
  overviewContentDetailsCanOpen,
  type OverviewSinglePageDetailsContext,
} from "@/components/overview/overview-tab/OverviewContentDetailsPanel";

type Opt = ReturnType<typeof useWordPressOptimization>;

/** Sitemap menu: Pages / Posts / SAP toggles (title row, right of Content). */
function OverviewContentSitemapMenu({ ctrl: c }: { ctrl: OverviewTabController }) {
  const rescrapeSitemap = () => void c.handleRefreshSitemap();

  if (!c.site?.username?.trim() || !c.site.appPassword?.trim()) {
    return (
      <p className="text-base text-muted-foreground">
        Connect a WordPress site with credentials to load content.
      </p>
    );
  }

  return (
    <div
      className="flex min-w-0 flex-nowrap items-center gap-1"
      role="group"
      aria-label="Content source"
    >
      {(Object.keys(OVERVIEW_SITEMAP_SOURCE_LABELS) as OverviewSitemapSource[]).map((source) => (
        <WorkspacePill
          key={source}
          label={OVERVIEW_SITEMAP_SOURCE_LABELS[source]}
          active={c.sitemapSource === source}
          square
          onClick={() => {
            if (c.sitemapSource === source) {
              rescrapeSitemap();
              return;
            }
            c.setSitemapSource(source);
          }}
        />
      ))}
    </div>
  );
}

export interface OverviewContentHeaderProps {
  ctrl: OverviewTabController;
  metaOptBulkStripBusy: boolean;
  bulkWorkspaceBusy: boolean;
  bulkMicroSnapshot: MetaBulkMicroSnapshot | null;
  isBatchContentRunning: boolean;
  isSinglePageOptimizing: boolean;
  batchBulkState: Opt["bulkOptimizationState"][string] | undefined;
  bulkBatchKey: string;
  batchProgress: Opt["optimizationProgress"][string] | undefined;
  opt: Opt;
  setBulkActionProgress: React.Dispatch<
    React.SetStateAction<Partial<Record<MetaBulkActionKey, BulkProgressSlice>>>
  >;
  onUploadToWordPress?: () => void;
  optimizerSection: ContentOptimizerSectionId;
  onOptimizerSectionChange: (id: ContentOptimizerSectionId) => void;
  paginationLayoutTotal: number;
  onDetailsOpenChange?: (open: boolean) => void;
  generatorChrome?: ContentOptimizerGeneratorChrome;
}

export function OverviewContentHeader({
  ctrl: c,
  metaOptBulkStripBusy,
  bulkWorkspaceBusy,
  bulkMicroSnapshot,
  isBatchContentRunning,
  isSinglePageOptimizing,
  batchBulkState,
  bulkBatchKey,
  batchProgress,
  opt,
  optimizerSection,
  onOptimizerSectionChange,
  onDetailsOpenChange,
  generatorChrome,
}: OverviewContentHeaderProps) {
  const hasDetectedSitemaps = Boolean(c.site?.sitemaps?.mainSitemapUrl);
  const site = c.site;
  const warmDetails = useOverviewSiteWarmDetails(site);
  const workspaceBusy = metaOptBulkStripBusy || isBatchContentRunning || isSinglePageOptimizing;

  const clusters = buildOverviewBulkActionClusters(c, {
    hasDetectedSitemaps,
    bulkWorkspaceBusy,
  });

  const singlePageCtx: OverviewSinglePageDetailsContext | undefined = site
    ? {
        siteId: site.id,
        isOptimizingContent: opt.isOptimizingContent,
        optimizationProgress: opt.optimizationProgress,
        optimizationFileManagers: opt.optimizationFileManagers,
      }
    : undefined;

  const canOpenBatchDetails = overviewContentDetailsCanOpen(
    site,
    c.bulkActionProgress,
    batchBulkState,
    singlePageCtx,
    {
      sitemapInventoryLinks: warmDetails.sitemapInventoryLinks,
      gscHostedLink: warmDetails.gscHostedLink,
      sitemapInventoryLoading: warmDetails.sitemapInventoryLoading,
    },
  );

  const detailsOpenSignal =
    batchBulkState?.runKind === "aiOverview" && batchBulkState.harnessStartedAt
      ? `${bulkBatchKey}-${batchBulkState.harnessStartedAt}`
      : site && isSinglePageOptimizing
        ? `single-opt-${site.id}`
        : null;

  const bulkPostTicker =
    isBatchContentRunning && batchBulkState ? resolveBulkPostTicker(batchBulkState) : null;

  const sitemapMenu = <OverviewContentSitemapMenu ctrl={c} />;

  const optimizerSectionPills = (
    <ContentOptimizerSectionPills
      activeSection={optimizerSection}
      onSectionChange={onOptimizerSectionChange}
      disabled={bulkWorkspaceBusy}
    />
  );

  const toolbarContent = (
    <>
      {clusters.map((cluster) => (
        <OverviewBulkClusterFlyout
          key={cluster.id}
          cluster={cluster}
          workspaceBusy={cluster.id === "wordpress" ? false : bulkWorkspaceBusy}
        />
      ))}
      <OverviewSemrushCsvUpload
        fileName={c.semrushCsvFileName}
        urlCount={c.semrushFilterUrlKeys?.size ?? 0}
        disabled={bulkWorkspaceBusy}
        onUpload={c.setSemrushCsvUpload}
        onClear={c.clearSemrushCsvUpload}
      />
      <OverviewErrorsFilterMenu
        rows={c.rows}
        activeFilters={c.activeErrorFilters}
        onToggle={c.toggleErrorFilter}
        onClear={c.clearErrorFilters}
        disabled={bulkWorkspaceBusy}
      />
      {c.rows.length > 0 ? (
        <>
          <div className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
          <div className="ml-auto flex shrink-0 flex-nowrap items-center">
            <OverviewContentSortControls
              sortColumn={c.sortColumn}
              sortDir={c.sortDir}
              setSortColumn={c.setSortColumn}
              setSortDir={c.setSortDir}
              disabled={bulkWorkspaceBusy}
            />
          </div>
        </>
      ) : null}
    </>
  );

  const progressLeading =
    bulkPostTicker && batchBulkState ? (
      <BulkPostProgressLeading batchState={batchBulkState} className={CONTENT_PAGINATION_SLOT_CLASS} />
    ) : (
      <OverviewGridPagination
        pageIndex={c.gridPageIndex}
        totalCount={c.displayRows.length}
        layoutTotalCount={c.gridPaginationLayoutTotal}
        pageSize={OVERVIEW_GRID_VISIBLE_ROW_COUNT}
        onPageChange={c.setGridPageIndex}
        className={CONTENT_PAGINATION_SLOT_CLASS}
      />
    );

  const detailsPanel = site ? (
    <OverviewContentDetailsPanel
      ctrl={c}
      batchBulkState={batchBulkState}
      bulkBatchKey={bulkBatchKey}
      batchProgress={batchProgress}
      opt={opt}
      sitemapInventoryLinks={warmDetails.sitemapInventoryLinks}
      gscHostedLink={warmDetails.gscHostedLink}
      sitemapInventoryLoading={warmDetails.sitemapInventoryLoading}
    />
  ) : null;

  const sharedProgressProps = {
    progressLeading,
    workspaceBusy,
    progressSnapshot: bulkMicroSnapshot,
    bulkActionProgress: c.bulkActionProgress,
    canOpenDetails: canOpenBatchDetails,
    detailsOpenSignal,
    onDetailsOpenChange,
    isProcessing: isBatchContentRunning || isSinglePageOptimizing,
    detailsPanelId: "overview-batch-details-panel" as const,
    detailsPanel,
    toolbar: toolbarContent,
  };

  if (generatorChrome) {
    return (
      <BlogGeneratorWorkspaceChrome
        activeSection={generatorChrome.activeSection}
        onSectionChange={generatorChrome.onSectionChange}
        sectionSwitchDisabled={generatorChrome.sectionSwitchDisabled}
        showOpt={generatorChrome.showOpt}
        titleRowMenu={sitemapMenu}
        {...sharedProgressProps}
      />
    );
  }

  return (
    <UnifiedWorkspaceChrome
      icon={Wand2}
      title="Content"
      titleRowMenu={sitemapMenu}
      titleRowEnd={optimizerSectionPills}
      {...sharedProgressProps}
    />
  );
}

/** @deprecated Use OverviewContentHeader */
export const OverviewMetaWorkspaceBar = OverviewContentHeader;
export type OverviewMetaWorkspaceBarProps = OverviewContentHeaderProps;
