import { BulkOptimizationPanel } from "@/components/integrations/wordpress/BulkOptimizationPanel";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import type { GscPerformancePreviewSnapshot } from "@/hooks/content-optimization/gsc-preview-types";
import {
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";

export type MultiSiteContentDetailsPanelProps = {
  batchBulkState: BulkOptimizationState | null | undefined;
  bulkRunBatchKey: string;
  batchSiteName?: string;
  rowProgressDs: { step?: string; message?: string } | undefined;
  gscMap: Record<string, GscPerformancePreviewSnapshot | null | undefined>;
  gscPreviewLoadingDs: boolean;
  bulkActiveUrlDs: string | null;
  onApproveKeywords: (batchKey: string) => void;
  onBatchClose: (abortingRun: boolean) => void;
};

export function multiSiteContentDetailsCanOpen(
  batchBulkState: BulkOptimizationState | null | undefined,
): boolean {
  return Boolean(batchBulkState?.urls?.length);
}

export function MultiSiteContentDetailsPanel({
  batchBulkState,
  bulkRunBatchKey,
  batchSiteName,
  rowProgressDs,
  gscMap,
  gscPreviewLoadingDs,
  bulkActiveUrlDs,
  onApproveKeywords,
  onBatchClose,
}: MultiSiteContentDetailsPanelProps) {
  const pageTitle = batchSiteName ? `Content Optimizer - ${batchSiteName}` : "Content Optimizer";

  if (!batchBulkState?.urls?.length) {
    return null;
  }

  return (
    <WorkspaceDetailsStack>
      <BulkOptimizationPanel
          variant="page"
          displayMode="details-only"
          bulkState={batchBulkState}
          batchKey={bulkRunBatchKey}
          siteProgress={rowProgressDs}
          onApproveKeywords={onApproveKeywords}
          pageTitle={pageTitle}
          pageSubtitle="Bulk operation in progress"
          gscPreviewByUrl={gscMap}
          gscFetching={gscPreviewLoadingDs}
          gscActiveUrl={bulkActiveUrlDs}
          onRequestClose={({ abortingRun }) => onBatchClose(Boolean(abortingRun))}
      />
    </WorkspaceDetailsStack>
  );
}
