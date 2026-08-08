import { useCallback, useEffect, useRef, useState } from "react";
import { MetaOptimizerPageRowCompact } from "@/components/overview/MetaOptimizerPageRowCompact";
import { BulkSitemapInventoryRunDetail } from "@/components/keyword-research/bulk/BulkSitemapInventoryRunDetail";
import {
  BulkDetailsDrawerStack,
  BulkDetailsTileSections,
  DETAILS_DRAWER_PIPELINE_TITLE,
  resolveDetailsPipelineSections,
} from "@/components/shared/bulk-details-tile-sections";
import { csvRowToOverviewRowDisplay } from "@/components/shared/bulk-details-row-display";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { LocalAnalysisDetailsPanelProps } from "@/components/sap-generator/LocalAnalysisDetailsPanel";

function persistedHarnessFromRow(row: CSVRow): BulkHarnessSectionUi[] | undefined {
  const title = row.title?.trim();
  if (!title) return undefined;
  return [
    {
      sectionIndex: 0,
      title: DETAILS_DRAWER_PIPELINE_TITLE,
      status: "done",
      markdown: title,
    },
  ];
}

function liveHarnessForActiveRow(): BulkHarnessSectionUi[] {
  return [
    {
      sectionIndex: 0,
      title: DETAILS_DRAWER_PIPELINE_TITLE,
      status: "generating",
    },
  ];
}

export function EntityDetailsDrawer({
  workspaceBusy,
  headerProgress,
  displayRows,
  currentRow,
  harnessByRow,
  batchPrepHarnessSections,
  sitemapInventoryLinks = [],
  gscHostedLink = null,
}: LocalAnalysisDetailsPanelProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());
  const pinnedExpandedRowsRef = useRef<Set<number>>(new Set());
  const [detailsPrepOpen, setDetailsPrepOpen] = useState(true);

  const isProcessing = workspaceBusy;
  const livePhase = headerProgress?.phase?.trim() || "";

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

  const showInventory =
    (sitemapInventoryLinks?.length ?? 0) > 0 || Boolean(gscHostedLink);

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
                  gscHostedLink={gscHostedLink ?? null}
                />
              </div>
            ) : null}

            {rows.map((row, index) => {
              const stripeIndex = rowStripeBase + index;
              const isActive = isProcessing && index === currentRow;
              const isExpanded = expandedRows.has(index);
              const displayRow = csvRowToOverviewRowDisplay(row, index, undefined, "entity-row");
              const dateLabelOverride = row.publish_date_gmt?.trim() || undefined;
              const persistedHarness =
                harnessByRow?.get(index) ?? persistedHarnessFromRow(row);
              const liveHarness =
                isActive && isProcessing ? liveHarnessForActiveRow() : undefined;
              const rowHarnessSectionsList = resolveDetailsPipelineSections(
                persistedHarness,
                liveHarness,
              );
              const panelId = `entity-details-row-${index}`;
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
                          files={[]}
                          onDownloadFile={() => {}}
                          onDownloadAll={() => {}}
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

            {rows.length === 0 ? (
              <div className={contentOptimizerRowStripeClass(rowStripeBase)}>
                <p className="px-2.5 py-1.5 text-base text-muted-foreground sm:px-3">
                  Run Clusters or Generate SAP rows from the toolbar.
                </p>
              </div>
            ) : null}
          </>
        );
      }}
    </BulkDetailsDrawerStack>
  );
}
