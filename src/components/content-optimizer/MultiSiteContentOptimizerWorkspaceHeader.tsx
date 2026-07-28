import { Wand2 } from "lucide-react";
import { ContentOptimizerSectionPills } from "@/components/content-optimizer/ContentOptimizerSectionPills";
import {
  MultiSiteContentOptimizerToolbar,
  MultiSiteSelectAllControl,
} from "@/components/content-optimizer/MultiSiteContentOptimizerToolbar";
import {
  MultiSiteSourceModePills,
  SITEMAP_MIXED_SENTINEL,
} from "@/components/content-optimizer/MultiSiteSourceModePills";
import type { ContentOptimizerSectionId } from "@/components/content-optimizer/content-optimizer-sections";
import { OverviewContentPaginationReserve } from "@/components/overview/overview-tab/OverviewContentChromeReserve";
import {
  MultiSiteContentDetailsPanel,
  multiSiteContentDetailsCanOpen,
} from "@/components/content-optimizer/MultiSiteContentDetailsPanel";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import type { GscPerformancePreviewSnapshot } from "@/hooks/content-optimization/gsc-preview-types";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";

const DETAILS_PANEL_ID = "multi-site-batch-details-panel";

export type MultiSiteContentOptimizerWorkspaceHeaderProps = {
  optimizerSection: ContentOptimizerSectionId;
  onOptimizerSectionChange: (id: ContentOptimizerSectionId) => void;
  workspaceBusy: boolean;
  actionsBlocked: boolean;
  optimizeMode: "update" | "draft";
  onOptimizeModeChange: (mode: "update" | "draft") => void;
  progressSnapshot: MetaBulkMicroSnapshot | null;
  isProcessing: boolean;
  selectedSiteCount: number;
  toolbarProps: React.ComponentProps<typeof MultiSiteContentOptimizerToolbar>;
  batchBulkState: BulkOptimizationState | null | undefined;
  bulkRunBatchKey: string;
  batchSiteName?: string;
  rowProgressDs: { step?: string; message?: string } | undefined;
  gscMap: Record<string, GscPerformancePreviewSnapshot | null | undefined>;
  gscPreviewLoadingDs: boolean;
  bulkActiveUrlDs: string | null;
  onApproveKeywords: (batchKey: string) => void;
  onBatchClose: (abortingRun: boolean) => void;
  paginationLayoutTotal: number;
};

export function MultiSiteContentOptimizerWorkspaceHeader({
  optimizerSection,
  onOptimizerSectionChange,
  workspaceBusy,
  actionsBlocked,
  optimizeMode,
  onOptimizeModeChange,
  progressSnapshot,
  isProcessing,
  selectedSiteCount,
  toolbarProps,
  batchBulkState,
  bulkRunBatchKey,
  batchSiteName,
  rowProgressDs,
  gscMap,
  gscPreviewLoadingDs,
  bulkActiveUrlDs,
  onApproveKeywords,
  onBatchClose,
  paginationLayoutTotal,
}: MultiSiteContentOptimizerWorkspaceHeaderProps) {
  const canOpenDetails = multiSiteContentDetailsCanOpen(batchBulkState);

  return (
    <UnifiedWorkspaceChrome
      icon={Wand2}
      title="Content"
      titleRowMenu={
        <MultiSiteSourceModePills
          value={
            toolbarProps.propertySiteCount === 0
              ? "post"
              : (toolbarProps.universalSourceShared ?? SITEMAP_MIXED_SENTINEL)
          }
          onSelect={toolbarProps.onUniversalSitemapSelect}
          disabled={actionsBlocked || toolbarProps.propertySiteCount === 0}
          ariaLabel="Source for all sites"
        />
      }
      titleRowEnd={
        <ContentOptimizerSectionPills
          activeSection={optimizerSection}
          onSectionChange={onOptimizerSectionChange}
          disabled={actionsBlocked}
        />
      }
      progressLeading={
        <div className="flex shrink-0 items-center gap-2.5">
          <MultiSiteSelectAllControl
            actionsBlocked={actionsBlocked}
            propertySiteCount={toolbarProps.propertySiteCount}
            allSitesSelected={toolbarProps.allSitesSelected}
            someSitesSelected={toolbarProps.someSitesSelected}
            onSelectAllChange={toolbarProps.onSelectAllChange}
          />
          <OverviewContentPaginationReserve layoutTotalCount={paginationLayoutTotal} />
        </div>
      }
      workspaceBusy={workspaceBusy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId={DETAILS_PANEL_ID}
      toolbar={
        <MultiSiteContentOptimizerToolbar
          {...toolbarProps}
          optimizeMode={optimizeMode}
          onOptimizeModeChange={onOptimizeModeChange}
        />
      }
      detailsPanel={
        <MultiSiteContentDetailsPanel
          batchBulkState={batchBulkState}
          bulkRunBatchKey={bulkRunBatchKey}
          batchSiteName={batchSiteName}
          rowProgressDs={rowProgressDs}
          gscMap={gscMap}
          gscPreviewLoadingDs={gscPreviewLoadingDs}
          bulkActiveUrlDs={bulkActiveUrlDs}
          onApproveKeywords={onApproveKeywords}
          onBatchClose={onBatchClose}
        />
      }
    />
  );
}
