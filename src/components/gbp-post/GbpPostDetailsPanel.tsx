import { GbpPostPublishPipeline } from "@/components/gbp-post/GbpPostPublishPipeline";
import type { HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import type { GbpPostsInventoryHostedLink } from "@/lib/gbp-post/gbp-posts-inventory";
import type { GbpPublishPreview } from "@/components/gbp-post/GbpPostPublishPreview";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { OVERVIEW_SITEMAP_SOURCE_LABELS } from "@/lib/overview/overview-sitemap-source";
import {
  WorkspaceDetailsKvRow,
  WorkspaceDetailsSection,
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

export type GbpPostDetailsPanelProps = {
  site: WordPressSite;
  sitemapSource?: OverviewSitemapSource;
  isBusy: boolean;
  statusLine: string;
  resolvedTopic: string;
  harnessSections: HarnessSectionListItem[];
  harnessPlannedCount: number | null;
  bulkSlotIndex: number;
  harnessTotalRows: number;
  multiSitePosting: boolean;
  batchActiveSite: WordPressSite | null;
  inventoryLink: GbpPostsInventoryHostedLink | null;
  bulkSummary: { published: number; queued: number; failed: number } | null;
  publishPreview: GbpPublishPreview | null;
  keyword: string;
  numberOfPosts: number;
  selectedCount: number;
  rosterCount: number;
  publishPipelineActive: boolean;
  publishStepIndex: number;
};

export function gbpPostDetailsCanOpen(
  rosterCount: number,
  isBusy: boolean,
  hasTopic: boolean,
  hasSelection: boolean,
  hasBulkSummary: boolean,
): boolean {
  return workspaceDetailsCanOpen(
    rosterCount > 0,
    isBusy,
    hasTopic,
    hasSelection,
    hasBulkSummary,
  );
}

export function GbpPostDetailsPanel({
  site,
  sitemapSource,
  isBusy,
  statusLine,
  resolvedTopic,
  multiSitePosting,
  batchActiveSite,
  bulkSummary,
  keyword,
  numberOfPosts,
  selectedCount,
  rosterCount,
  publishPipelineActive,
  publishStepIndex,
  harnessSections,
  harnessPlannedCount,
  bulkSlotIndex,
  harnessTotalRows,
}: GbpPostDetailsPanelProps) {
  let kvIndex = 0;

  return (
    <WorkspaceDetailsStack>
      <WorkspaceDetailsSection title="Workspace" stripeIndex={0}>
        <WorkspaceDetailsKvRow label="Site" value={site.name} stripeIndex={kvIndex++} />
        {sitemapSource ? (
          <WorkspaceDetailsKvRow
            label="Source"
            value={OVERVIEW_SITEMAP_SOURCE_LABELS[sitemapSource]}
            stripeIndex={kvIndex++}
          />
        ) : null}
        <WorkspaceDetailsKvRow label="Roster" value={String(rosterCount)} stripeIndex={kvIndex++} />
        <WorkspaceDetailsKvRow label="Selected" value={String(selectedCount)} stripeIndex={kvIndex++} />
        <WorkspaceDetailsKvRow label="Posts per run" value={String(numberOfPosts)} stripeIndex={kvIndex++} />
        {resolvedTopic ? (
          <WorkspaceDetailsKvRow label="Topic" value={resolvedTopic} stripeIndex={kvIndex++} />
        ) : null}
        {keyword ? (
          <WorkspaceDetailsKvRow label="Keyword" value={keyword} stripeIndex={kvIndex++} />
        ) : null}
        {multiSitePosting ? (
          <WorkspaceDetailsKvRow label="Multi-site" value="On" stripeIndex={kvIndex++} />
        ) : null}
      </WorkspaceDetailsSection>

      {isBusy || bulkSummary ? (
        <WorkspaceDetailsSection title="Run detail" stripeIndex={1} defaultOpen>
          {isBusy ? (
            <>
              {multiSitePosting && batchActiveSite ? (
                <WorkspaceDetailsKvRow
                  label="Posting to"
                  value={batchActiveSite.name}
                  stripeIndex={0}
                />
              ) : null}
              {statusLine ? (
                <WorkspaceDetailsKvRow label="Status" value={statusLine} stripeIndex={1} />
              ) : null}
              {harnessSections.length > 0 ? (
                <WorkspaceDetailsKvRow
                  label="Harness"
                  value={`${bulkSlotIndex + 1} / ${harnessTotalRows} · ${harnessSections.filter((s) => s.status === "done").length}/${harnessPlannedCount ?? harnessSections.length} sections`}
                  stripeIndex={2}
                />
              ) : null}
              <div className="px-2.5 py-2 sm:px-3">
                <GbpPostPublishPipeline active={publishPipelineActive} activeStepIndex={publishStepIndex} />
              </div>
            </>
          ) : null}
          {bulkSummary && bulkSummary.published + bulkSummary.queued + bulkSummary.failed > 0 ? (
            <WorkspaceDetailsKvRow
              label="Batch result"
              value={`${bulkSummary.published} published, ${bulkSummary.queued} queued${bulkSummary.failed > 0 ? `, ${bulkSummary.failed} failed` : ""}`}
              stripeIndex={3}
            />
          ) : null}
        </WorkspaceDetailsSection>
      ) : null}
    </WorkspaceDetailsStack>
  );
}
