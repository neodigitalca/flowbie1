import React from "react";
import { OverviewContentHeader } from "@/components/overview/overview-tab/OverviewMetaWorkspaceBar";
import type { ContentOptimizerSectionId } from "@/components/content-optimizer/content-optimizer-sections";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { OverviewTabController } from "@/hooks/overview/use-overview-tab-controller";
import type { useWordPressOptimization } from "@/contexts/wordpress-optimization-context";
import type { MetaBulkActionKey, BulkProgressSlice } from "@/components/overview/overview-tab-constants";

type Opt = ReturnType<typeof useWordPressOptimization>;

export interface OverviewTabSitemapBulkFormProps {
  ctrl: OverviewTabController;
  metaOptBulkStripBusy: boolean;
  bulkWorkspaceBusy: boolean;
  bulkMicroSnapshot: MetaBulkMicroSnapshot | null;
  isBatchContentRunning: boolean;
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
}

export function OverviewTabSitemapBulkForm({
  ctrl,
  metaOptBulkStripBusy,
  bulkWorkspaceBusy,
  bulkMicroSnapshot,
  isBatchContentRunning,
  batchBulkState,
  bulkBatchKey,
  batchProgress,
  opt,
  setBulkActionProgress,
  onUploadToWordPress,
  optimizerSection,
  onOptimizerSectionChange,
  paginationLayoutTotal,
}: OverviewTabSitemapBulkFormProps) {
  return (
    <OverviewContentHeader
      ctrl={ctrl}
      metaOptBulkStripBusy={metaOptBulkStripBusy}
      bulkWorkspaceBusy={bulkWorkspaceBusy}
      bulkMicroSnapshot={bulkMicroSnapshot}
      isBatchContentRunning={isBatchContentRunning}
      batchBulkState={batchBulkState}
      bulkBatchKey={bulkBatchKey}
      batchProgress={batchProgress}
      opt={opt}
      setBulkActionProgress={setBulkActionProgress}
      onUploadToWordPress={onUploadToWordPress}
      optimizerSection={optimizerSection}
      onOptimizerSectionChange={onOptimizerSectionChange}
      paginationLayoutTotal={paginationLayoutTotal}
    />
  );
}
