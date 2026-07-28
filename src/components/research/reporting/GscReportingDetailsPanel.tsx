import type { GscFetchDateRange } from "@/lib/gsc-reporting/gsc-console-ui-url";
import {
  GSC_REPORTING_COMPARE_PRESET_OPTIONS,
  type GscReportingComparePresetId,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import type { GscReportingPipelineProgress } from "@/lib/gsc-reporting/gsc-reporting-types";
import {
  WorkspaceDetailsKvRow,
  WorkspaceDetailsSection,
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

export type GscReportingDetailsPanelProps = {
  busy: boolean;
  progress: GscReportingPipelineProgress | null;
  siteName: string | null;
  siteUrl: string | null;
  gscFetchPreset: GscReportingComparePresetId;
  gscFetchRange: GscFetchDateRange | null;
  gscCompareFetchRange: GscFetchDateRange | null;
  cachedFileCount: number;
  sectionCount: number;
};

export function gscReportingDetailsCanOpen(
  hasSite: boolean,
  busy: boolean,
  hasReport: boolean,
  cachedFileCount: number,
): boolean {
  return workspaceDetailsCanOpen(hasSite, busy, hasReport, cachedFileCount > 0);
}

export function GscReportingDetailsPanel({
  busy,
  progress,
  siteName,
  siteUrl,
  gscFetchPreset,
  gscFetchRange,
  gscCompareFetchRange,
  cachedFileCount,
  sectionCount,
}: GscReportingDetailsPanelProps) {
  const presetLabel =
    GSC_REPORTING_COMPARE_PRESET_OPTIONS.find((o) => o.id === gscFetchPreset)?.label ?? gscFetchPreset;

  let kvIndex = 0;

  return (
    <WorkspaceDetailsStack>
      <WorkspaceDetailsSection title="Workspace" stripeIndex={0}>
        {siteName ? (
          <WorkspaceDetailsKvRow label="Site" value={siteName} stripeIndex={kvIndex++} />
        ) : null}
        {siteUrl ? (
          <WorkspaceDetailsKvRow label="Property URL" value={siteUrl} stripeIndex={kvIndex++} />
        ) : null}
        <WorkspaceDetailsKvRow label="Compare preset" value={presetLabel} stripeIndex={kvIndex++} />
        {gscFetchRange ? (
          <WorkspaceDetailsKvRow
            label="Fetched period A"
            value={`${gscFetchRange.startDate} → ${gscFetchRange.endDate}`}
            stripeIndex={kvIndex++}
          />
        ) : null}
        {gscCompareFetchRange ? (
          <WorkspaceDetailsKvRow
            label="Fetched period B"
            value={`${gscCompareFetchRange.startDate} → ${gscCompareFetchRange.endDate}`}
            stripeIndex={kvIndex++}
          />
        ) : null}
        {cachedFileCount > 0 ? (
          <WorkspaceDetailsKvRow label="Cached GSC files" value={String(cachedFileCount)} stripeIndex={kvIndex++} />
        ) : null}
        {sectionCount > 0 ? (
          <WorkspaceDetailsKvRow label="Report sections" value={String(sectionCount)} stripeIndex={kvIndex++} />
        ) : null}
      </WorkspaceDetailsSection>

      {busy && progress ? (
        <WorkspaceDetailsSection title="Run detail" stripeIndex={1} defaultOpen>
          <WorkspaceDetailsKvRow label="Phase" value={progress.label} stripeIndex={0} />
          <WorkspaceDetailsKvRow
            label="Step"
            value={`${progress.step} of ${progress.total}`}
            stripeIndex={1}
          />
        </WorkspaceDetailsSection>
      ) : null}
    </WorkspaceDetailsStack>
  );
}
