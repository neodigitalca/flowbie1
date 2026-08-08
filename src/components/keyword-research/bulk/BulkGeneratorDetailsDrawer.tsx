import { useCallback, useEffect, useRef, useState } from "react";
import { MetaOptimizerPageRowCompact } from "@/components/overview/MetaOptimizerPageRowCompact";
import { BulkSitemapInventoryRunDetail } from "@/components/keyword-research/bulk/BulkSitemapInventoryRunDetail";
import {
  csvRowToOverviewRowDisplay,
  publishDateLabelForRow,
  rowFilesToDownloadables,
} from "@/components/shared/bulk-details-row-display";
import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import {
  BulkDetailsDrawerStack,
  BulkDetailsTileSections,
  resolveDetailsPipelineSections,
  type BulkDetailsDownloadable,
} from "@/components/shared/bulk-details-tile-sections";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";
import { publishedLinkFromRowFiles } from "@/lib/sitemap-optimizer/sitemap-merge-bulk-state";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_CSV_DOWNLOADED } from "@/lib/notify-messages";

function downloadBlob(file: BulkDetailsDownloadable) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BulkGeneratorDetailsDrawer(props: BulkGeneratorDetailsPanelProps) {
  const {
    variant,
    headerProgress,
    isProcessing,
    status = "",
    harnessSections,
    harnessByRow,
    batchPrepHarnessSections,
    currentRow,
    displayRows,
    filesByRow,
    downloadFile,
    sitemapInventoryLinks,
    siteKwHostedLink,
    publishDateLabelByIndex,
    draftOnly,
  } = props;

  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());
  const pinnedExpandedRowsRef = useRef<Set<number>>(new Set());
  const [detailsPrepOpen, setDetailsPrepOpen] = useState(true);

  const livePhase = headerProgress?.phase?.trim() || (isProcessing ? status.trim() : "");

  const setRowExpanded = useCallback((index: number, open: boolean) => {
    if (open) pinnedExpandedRowsRef.current.add(index);
    else pinnedExpandedRowsRef.current.delete(index);
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (open) next.add(index);
      else next.delete(index);
      return next;
    });
  }, []);

  const commitAutoExpandedRows = useCallback((auto: Set<number>) => {
    const merged = new Set(auto);
    for (const index of pinnedExpandedRowsRef.current) merged.add(index);
    setExpandedRows((prev) => {
      if (prev.size === merged.size) {
        let same = true;
        for (const index of merged) {
          if (!prev.has(index)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return merged;
    });
  }, []);

  useEffect(() => {
    if (!isProcessing) {
      commitAutoExpandedRows(new Set());
      return;
    }
    const next = new Set<number>();
    if (currentRow >= 0 && currentRow < displayRows.length) {
      next.add(currentRow);
    }
    commitAutoExpandedRows(next);
  }, [commitAutoExpandedRows, currentRow, displayRows.length, isProcessing]);

  const handleDownloadFile = (file: BulkDetailsDownloadable) => {
    if (downloadFile) {
      const match = [...(filesByRow?.values() ?? [])]
        .flat()
        .find((f) => f.fileName === file.name && f.content === file.content);
      if (match) {
        downloadFile(match);
        return;
      }
    }
    downloadBlob(file);
    notify.success(NOTIFY_CSV_DOWNLOADED);
  };

  const handleDownloadAll = (files: BulkDetailsDownloadable[]) => {
    files.forEach((file) => handleDownloadFile(file));
  };

  const showInventory =
    variant === "prompt" &&
    ((sitemapInventoryLinks?.length ?? 0) > 0 || Boolean(siteKwHostedLink));

  const prepSections =
    batchPrepHarnessSections?.length ? batchPrepHarnessSections : null;

  const rows = displayRows.length > 0 ? displayRows : [];

  return (
    <BulkDetailsDrawerStack
      prepSections={prepSections}
      prepOpen={detailsPrepOpen}
      onPrepOpenChange={setDetailsPrepOpen}
    >
      {(stripeBase) => {
        let rowStripeBase = stripeBase;

        return (
          <>
            {showInventory ? (
              <div className={contentOptimizerRowStripeClass(rowStripeBase++)}>
                <BulkSitemapInventoryRunDetail
                  links={sitemapInventoryLinks ?? []}
                  gscHostedLink={siteKwHostedLink ?? null}
                />
              </div>
            ) : null}

            {rows.map((row, index) => {
              const stripeIndex = rowStripeBase + index;
              const isActive = isProcessing && index === currentRow;
              const isExpanded = expandedRows.has(index);
              const rowFiles = filesByRow?.get(index) ?? [];
              const previewUrl = publishedLinkFromRowFiles(rowFiles) ?? undefined;
              const displayRow = csvRowToOverviewRowDisplay(row, index, previewUrl);
              const dateLabelOverride = publishDateLabelForRow(
                index,
                publishDateLabelByIndex,
                draftOnly,
              );
              const persistedHarness = harnessByRow?.get(index);
              const liveHarness: BulkHarnessSectionUi[] | undefined =
                isActive && isProcessing ? harnessSections : undefined;
              const rowHarnessSectionsList = resolveDetailsPipelineSections(
                persistedHarness,
                liveHarness,
              );
              const panelId = `bulk-generator-details-row-${index}`;
              const toggleRow = () => setRowExpanded(index, !isExpanded);
              const activeStatus = isActive && livePhase ? livePhase : "";
              const useRowShell = isExpanded || isActive;

              if (useRowShell) {
                return (
                  <div key={`row-${index}`} className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS}>
                    <div
                      className={contentOptimizerRowStripeClass(stripeIndex, {
                        isActiveOptimize: isActive,
                      })}
                    >
                      <MetaOptimizerPageRowCompact
                        row={displayRow}
                        wpTitlesByUrl={{}}
                        isExpanded={isExpanded}
                        embedded
                        stripeIndex={stripeIndex}
                        isActiveOptimize={isActive}
                        panelId={panelId}
                        dateLabelOverride={dateLabelOverride}
                        onToggle={toggleRow}
                      />
                      {activeStatus ? (
                        <div
                          className="border-0 px-2.5 py-1.5 text-base text-white sm:px-3"
                          role="status"
                          aria-live="polite"
                        >
                          {activeStatus}
                        </div>
                      ) : null}
                      {isExpanded ? (
                        <BulkDetailsTileSections
                          harnessSections={rowHarnessSectionsList}
                          files={rowFilesToDownloadables(rowFiles)}
                          onDownloadFile={handleDownloadFile}
                          onDownloadAll={handleDownloadAll}
                          stripeBaseIndex={stripeIndex + 1}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              }

              return (
                <div key={`row-${index}`} className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS}>
                  <MetaOptimizerPageRowCompact
                    row={displayRow}
                    wpTitlesByUrl={{}}
                    isExpanded={false}
                    stripeIndex={stripeIndex}
                    isActiveOptimize={false}
                    panelId={panelId}
                    dateLabelOverride={dateLabelOverride}
                    onToggle={toggleRow}
                  />
                </div>
              );
            })}

            {rows.length === 0 && variant === "csv" ? (
              <div className={contentOptimizerRowStripeClass(rowStripeBase)}>
                <p className="px-2.5 py-1.5 text-base text-muted-foreground sm:px-3">
                  Select a CSV file to load rows.
                </p>
              </div>
            ) : null}

            {rows.length === 0 && variant === "prompt" ? (
              <div className={contentOptimizerRowStripeClass(rowStripeBase)}>
                <p className="px-2.5 py-1.5 text-base text-muted-foreground sm:px-3">
                  Generate blog ideas from the toolbar, then run processing on selected rows.
                </p>
              </div>
            ) : null}

            {rows.length === 0 && variant === "blog-import" ? (
              <div className={contentOptimizerRowStripeClass(rowStripeBase)}>
                <p className="px-2.5 py-1.5 text-base text-muted-foreground sm:px-3">
                  Upload a draft file to preview and run.
                </p>
              </div>
            ) : null}
          </>
        );
      }}
    </BulkDetailsDrawerStack>
  );
}
