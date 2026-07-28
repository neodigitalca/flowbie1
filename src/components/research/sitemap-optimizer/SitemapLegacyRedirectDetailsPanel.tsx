import { cn } from "@/lib/utils";
import {
  activeLegacyRedirectPhaseIndex,
  LEGACY_REDIRECT_PHASES,
} from "@/lib/sitemap-optimizer/legacy-redirect-header-progress";
import type { LegacyRedirectBatchProgress, LegacyRedirectHeaderProgress } from "@/lib/sitemap-optimizer/types";
import { detailsDrawerRowStripeClass } from "@/components/integrations/wordpress/bulk-details-drawer-styles";
import {
  WorkspaceDetailsKvRow,
  WorkspaceDetailsSection,
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

export type SitemapLegacyRedirectDetailsPanelProps = {
  workspaceBusy: boolean;
  headerProgress: LegacyRedirectHeaderProgress | null;
  sheetName: string | null;
  sheetLineCount: number;
  matchedCount: number;
  processedCount: number;
  batchProgress: LegacyRedirectBatchProgress[];
  catalogSize: number | null;
  inventoryFilename: string | null;
  inventoryRowCount: number | null;
  inventoryHref: string | null;
};

export function sitemapLegacyRedirectDetailsCanOpen(
  hasSheet: boolean,
  busy: boolean,
  hasInventory: boolean,
): boolean {
  return workspaceDetailsCanOpen(hasSheet, busy, hasInventory);
}

export function SitemapLegacyRedirectDetailsPanel({
  workspaceBusy,
  headerProgress,
  sheetName,
  sheetLineCount,
  matchedCount,
  processedCount,
  batchProgress,
  catalogSize,
  inventoryFilename,
  inventoryRowCount,
  inventoryHref,
}: SitemapLegacyRedirectDetailsPanelProps) {
  const activeIdx =
    headerProgress && workspaceBusy ? activeLegacyRedirectPhaseIndex(headerProgress.phase) : -1;

  let kvIndex = 0;

  return (
    <WorkspaceDetailsStack>
      <WorkspaceDetailsSection title="Workspace" stripeIndex={0}>
        <WorkspaceDetailsKvRow label="Sheet lines" value={String(sheetLineCount)} stripeIndex={kvIndex++} />
        <WorkspaceDetailsKvRow label="Redirects matched" value={String(matchedCount)} stripeIndex={kvIndex++} />
        {processedCount !== matchedCount ? (
          <WorkspaceDetailsKvRow label="URLs processed" value={String(processedCount)} stripeIndex={kvIndex++} />
        ) : null}
        {catalogSize != null ? (
          <WorkspaceDetailsKvRow label="Inventory pages" value={String(catalogSize)} stripeIndex={kvIndex++} />
        ) : null}
        {sheetName ? (
          <WorkspaceDetailsKvRow label="Upload" value={sheetName} stripeIndex={kvIndex++} />
        ) : null}
        {inventoryFilename ? (
          <WorkspaceDetailsKvRow
            label="Site inventory"
            value={`${inventoryFilename}${inventoryRowCount != null ? ` (${inventoryRowCount} URLs)` : ""}`}
            stripeIndex={kvIndex++}
          />
        ) : null}
      </WorkspaceDetailsSection>

      <WorkspaceDetailsSection title="Run detail" stripeIndex={1} defaultOpen>
        {workspaceBusy && headerProgress ? (
          <>
            <WorkspaceDetailsKvRow label="Phase" value={headerProgress.phase} stripeIndex={0} />
            {(headerProgress.batchesTotal ?? 0) > 0 && (headerProgress.sheetLineCount ?? 0) <= 0 ? (
              <WorkspaceDetailsKvRow
                label="Batch"
                value={`${headerProgress.batchesCompleted ?? 0} / ${headerProgress.batchesTotal}`}
                stripeIndex={1}
              />
            ) : (headerProgress.sheetLineCount ?? 0) > 0 ? (
              <WorkspaceDetailsKvRow
                label="Progress"
                value={`${processedCount} / ${sheetLineCount}`}
                stripeIndex={1}
              />
            ) : null}
            {batchProgress.length > 0 ? (
              <WorkspaceDetailsSection title="Match batches" stripeIndex={2} defaultOpen>
                <ol className="max-h-64 overflow-y-auto" aria-label="Match batches">
                  {batchProgress.map((batch, i) => {
                    const statusLabel =
                      batch.status === "done"
                        ? `${batch.matchedCount} / ${batch.lineCount} URLs`
                        : batch.status === "running"
                          ? "Running"
                          : batch.status === "error"
                            ? batch.error ?? "Error"
                            : "Pending";
                    return (
                      <li
                        key={batch.batchIndex}
                        className={cn(
                          "flex items-center justify-between gap-2 border-0 px-2.5 py-1.5 text-base sm:px-3",
                          detailsDrawerRowStripeClass(i, { isActiveOptimize: batch.status === "running" }),
                          batch.status === "done" && "text-muted-foreground",
                          batch.status === "pending" && "text-muted-foreground/70",
                          batch.status === "running" && "text-white",
                        )}
                      >
                        <span>
                          Batch {batch.batchIndex} / {batch.batchTotal}
                        </span>
                        <span className="shrink-0 text-muted-foreground">{statusLabel}</span>
                      </li>
                    );
                  })}
                </ol>
              </WorkspaceDetailsSection>
            ) : null}
            <ol className="flex flex-col gap-0" aria-label="Run steps">
              {LEGACY_REDIRECT_PHASES.map((step, i) => {
                const status =
                  activeIdx < 0
                    ? "pending"
                    : i < activeIdx
                      ? "done"
                      : i === activeIdx
                        ? "active"
                        : "pending";
                return (
                  <li
                    key={step}
                    className={cn(
                      "border-0 px-2.5 py-1.5 text-base sm:px-3",
                      detailsDrawerRowStripeClass(i + 2, { isActiveOptimize: status === "active" }),
                      status === "done" && "text-muted-foreground",
                      status === "pending" && "text-muted-foreground/70",
                      status === "active" && "text-white",
                    )}
                  >
                    {step}
                  </li>
                );
              })}
            </ol>
          </>
        ) : inventoryHref ? (
          <a
            className="block px-2.5 py-2 font-medium text-primary underline underline-offset-4 hover:text-primary/90 sm:px-3"
            href={inventoryHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {inventoryFilename}
          </a>
        ) : null}
      </WorkspaceDetailsSection>
    </WorkspaceDetailsStack>
  );
}
