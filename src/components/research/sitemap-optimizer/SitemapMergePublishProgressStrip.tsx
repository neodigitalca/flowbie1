import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BulkOptimizationPanel } from "@/components/integrations/wordpress/BulkOptimizationPanel";
import {
  MetaBulkMicroProgress,
  type MetaBulkMicroSnapshot,
} from "@/components/overview/OverviewBulkMicroProgress";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import { cn } from "@/lib/utils";

const SITEMAP_MERGE_PUBLISH_BATCH_KEY = "sitemap-merge-publish";

type Props = {
  bulkState: BulkOptimizationState;
  bulkMicroSnapshot: MetaBulkMicroSnapshot | null;
  publishing: boolean;
  siteProgress: {
    step: string;
    progress: number;
    message?: string;
    harnessSections?: import("@/hooks/use-bulk-auto-generate").BulkHarnessSectionUi[];
    harnessPlannedSectionCount?: number | null;
  };
  publishedLinksByUrl: Record<string, string>;
  entityPrimary: boolean;
  pageSubtitle: string;
  onCancelPublish: (abortingRun: boolean) => void;
};

export function SitemapMergePublishProgressStrip({
  bulkState,
  bulkMicroSnapshot,
  publishing,
  siteProgress,
  publishedLinksByUrl,
  entityPrimary,
  pageSubtitle,
  onCancelPublish,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const canOpenDetails = Boolean(bulkState.urls?.length);

  return (
    <div className="relative z-20 w-full overflow-visible bg-zinc-900/50 px-3 pb-3.5 pt-3 sm:px-3.5">
      <div className="flex min-w-0 items-center gap-2.5 overflow-visible">
        <div className="min-w-0 flex-1">
          <MetaBulkMicroProgress variant="embedded" snapshot={bulkMicroSnapshot} bulkActionProgress={{}} />
        </div>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-base font-normal transition-colors",
            "text-white hover:text-white/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !canOpenDetails && "pointer-events-none opacity-40",
          )}
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          aria-controls="sitemap-merge-publish-details-panel"
          disabled={!canOpenDetails}
        >
          Details
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {detailsOpen && canOpenDetails ? (
        <div
          id="sitemap-merge-publish-details-panel"
          className="absolute left-3 right-3 top-full z-50 mt-1.5 max-h-[min(60vh,720px)] overflow-y-auto rounded-md border border-white/[0.12] bg-zinc-900 shadow-lg sm:left-3.5 sm:right-3.5"
        >
          <BulkOptimizationPanel
            variant="page"
            displayMode="details-only"
            bulkState={bulkState}
            batchKey={SITEMAP_MERGE_PUBLISH_BATCH_KEY}
            siteProgress={siteProgress}
            pageTitle="Sitemap merge publish"
            pageSubtitle={pageSubtitle}
            publishedLinksByUrl={publishedLinksByUrl}
            sitemapSource={entityPrimary ? "sap" : undefined}
            onRequestClose={({ abortingRun }) => onCancelPublish(Boolean(abortingRun))}
          />
        </div>
      ) : null}
    </div>
  );
}
