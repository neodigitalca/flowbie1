import { ExternalLink } from "lucide-react";
import { BulkHarnessSectionsPanel } from "@/components/keyword-research/bulk/BulkHarnessSectionsPanel";
import type { PressReleaseDetailsPanelProps } from "@/components/press-release/PressReleaseDetailsPanel";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";

export function PressReleaseDetailsDrawer({
  isProcessing,
  runPhase,
  keyword,
  title,
  wordPressSite,
  harnessSections,
  harnessPlannedSectionCount,
  inventoryJsonLink,
}: PressReleaseDetailsPanelProps) {
  const harnessActive = isProcessing && harnessSections.length > 0;
  let stripe = 0;

  return (
    <div className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS}>
      <div className={contentOptimizerRowStripeClass(stripe++)}>
        <div className="grid gap-1 px-2.5 py-1.5 text-base sm:px-3">
          <p className="text-white">
            <span className="text-muted-foreground">Keyword · </span>
            {keyword.trim() || "—"}
          </p>
          <p className="text-white">
            <span className="text-muted-foreground">Title · </span>
            {title.trim() || "—"}
          </p>
          <p className="text-white">
            <span className="text-muted-foreground">Site · </span>
            {wordPressSite?.name ?? "No site connected"}
          </p>
        </div>
      </div>

      {isProcessing && runPhase && !harnessActive ? (
        <div className={contentOptimizerRowStripeClass(stripe++)}>
          <div className="px-2.5 py-1.5 text-base text-white sm:px-3">{runPhase}</div>
        </div>
      ) : null}

      {harnessActive || harnessPlannedSectionCount ? (
        <div className={contentOptimizerRowStripeClass(stripe++)}>
          <BulkHarnessSectionsPanel
            harnessSections={harnessSections}
            harnessPlannedSectionCount={harnessPlannedSectionCount}
            currentRow={0}
            totalRows={1}
            isProcessing={isProcessing}
            variant="details-flat"
            hideHeader
            activeIndicator="border"
            blogImportCompact
          />
        </div>
      ) : null}

      {inventoryJsonLink ? (
        <div className={contentOptimizerRowStripeClass(stripe++)}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-2 text-base sm:px-3">
            <span className="text-muted-foreground">Post inventory</span>
            <a
              href={inventoryJsonLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-lime-400 hover:text-lime-300"
            >
              {inventoryJsonLink.filename} ({inventoryJsonLink.rowCount} URLs)
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
