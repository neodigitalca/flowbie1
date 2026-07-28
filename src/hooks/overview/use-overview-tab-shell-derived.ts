import { useEffect, useMemo, useRef } from "react";
import { notifyHeaderError } from "@/lib/app-notifications";
import { pickMetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { OverviewTabController } from "@/hooks/overview/use-overview-tab-controller";

export function useOverviewTabShellDerived(ctrl: OverviewTabController) {
  const combinedError = useMemo(() => {
    const candidates = [
      ctrl.sitemapError,
      ctrl.scrapeError,
      ctrl.aiError,
      ctrl.bindingError,
      ctrl.downloadError,
      ctrl.uploadError,
    ];
    for (const c of candidates) {
      if (!c?.trim()) continue;
      if (c.trim().toLowerCase() === "ok") continue;
      return c;
    }
    return null;
  }, [
    ctrl.sitemapError,
    ctrl.scrapeError,
    ctrl.aiError,
    ctrl.bindingError,
    ctrl.downloadError,
    ctrl.uploadError,
  ]);

  const lastOverviewCombinedErrorNotifyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!combinedError) {
      lastOverviewCombinedErrorNotifyRef.current = null;
      return;
    }
    if (lastOverviewCombinedErrorNotifyRef.current === combinedError) return;
    lastOverviewCombinedErrorNotifyRef.current = combinedError;
    notifyHeaderError("Load failed", combinedError, { duration: 12000 });
  }, [combinedError]);

  const metaOptBulkStripBusy = useMemo(() => {
    const p = ctrl.bulkActionProgress;
    return !!(
      ctrl.overviewSitemapLoadBusy ||
      p.scrape ||
      p.dates ||
      p.entityKw ||
      p.contentKw ||
      p.aiTitle ||
      p.aiMeta ||
      p.aiUrl ||
      p.aiHeaders ||
      p.aiLinks ||
      p.aiOverview ||
      p.aiInContentImage ||
      p.contentCleanup ||
      p.research ||
      p.optimizeAll ||
      p.wpUpload
    );
  }, [ctrl.bulkActionProgress, ctrl.overviewSitemapLoadBusy]);

  const bulkBatchKey = ctrl.site ? `${ctrl.site.id}-batch` : "";
  const batchBulkState = bulkBatchKey ? ctrl.opt.bulkOptimizationState[bulkBatchKey] : undefined;
  const isBatchContentRunning = bulkBatchKey
    ? Boolean(
        ctrl.opt.isOptimizingContent[bulkBatchKey] ||
          (ctrl.site && ctrl.opt.isOptimizingContent[ctrl.site.id]),
      )
    : false;
  const bulkMicroSnapshot = useMemo(
    () =>
      pickMetaBulkMicroSnapshot(
        ctrl.bulkActionProgress,
        batchBulkState,
        isBatchContentRunning,
        ctrl.site?.name,
      ),
    [ctrl.bulkActionProgress, batchBulkState, isBatchContentRunning, ctrl.site?.name],
  );
  const bulkWorkspaceBusy = useMemo(() => {
    const p = ctrl.bulkActionProgress;
    const exclusiveBulkRunning = !!(
      p.scrape ||
      p.dates ||
      p.entityKw ||
      p.contentKw ||
      p.aiTitle ||
      p.aiMeta ||
      p.aiUrl ||
      p.aiHeaders ||
      p.aiLinks ||
      p.aiOverview ||
      p.aiInContentImage ||
      p.contentCleanup ||
      p.research ||
      p.optimizeAll ||
      p.wpUpload
    );
    return (
      exclusiveBulkRunning ||
      isBatchContentRunning ||
      Boolean(ctrl.site && ctrl.opt.isOptimizingContent[ctrl.site.id]) ||
      ctrl.bulkSeoCsvExportBusy
    );
  }, [ctrl.bulkActionProgress, ctrl.site, ctrl.opt.isOptimizingContent, isBatchContentRunning, ctrl.bulkSeoCsvExportBusy]);

  return {
    combinedError,
    metaOptBulkStripBusy,
    bulkBatchKey,
    batchBulkState,
    isBatchContentRunning,
    bulkMicroSnapshot,
    bulkWorkspaceBusy,
  };
}
