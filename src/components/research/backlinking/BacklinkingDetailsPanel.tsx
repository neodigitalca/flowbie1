import {
  WorkspaceDetailsKvRow,
  WorkspaceDetailsSection,
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

export type BacklinkingDetailsPanelProps = {
  loadingHint: string | null;
  lastKeyword: string | null;
  industry: string;
  locationName: string;
  gmbChoiceCount: number;
  tileCount: number;
};

export function backlinkingDetailsCanOpen(
  hasKeyword: boolean,
  tileCount: number,
  loading: boolean,
): boolean {
  return workspaceDetailsCanOpen(hasKeyword, tileCount > 0, loading);
}

export function BacklinkingDetailsPanel({
  loadingHint,
  lastKeyword,
  industry,
  locationName,
  gmbChoiceCount,
  tileCount,
}: BacklinkingDetailsPanelProps) {
  let kvIndex = 0;
  return (
    <WorkspaceDetailsStack>
      <WorkspaceDetailsSection title="Workspace" stripeIndex={0}>
        {lastKeyword ? (
          <WorkspaceDetailsKvRow label="Keyword" value={lastKeyword} stripeIndex={kvIndex++} />
        ) : null}
        {industry.trim() ? (
          <WorkspaceDetailsKvRow label="Industry" value={industry.trim()} stripeIndex={kvIndex++} />
        ) : null}
        {locationName.trim() ? (
          <WorkspaceDetailsKvRow label="SERP location" value={locationName.trim()} stripeIndex={kvIndex++} />
        ) : null}
        {gmbChoiceCount > 0 ? (
          <WorkspaceDetailsKvRow
            label="GBP suggestions"
            value={String(gmbChoiceCount)}
            stripeIndex={kvIndex++}
          />
        ) : null}
        {tileCount > 0 ? (
          <WorkspaceDetailsKvRow label="Placement tiles" value={String(tileCount)} stripeIndex={kvIndex++} />
        ) : null}
      </WorkspaceDetailsSection>
      {loadingHint ? (
        <WorkspaceDetailsSection title="Run detail" stripeIndex={1} defaultOpen>
          <WorkspaceDetailsKvRow label="Status" value={loadingHint} stripeIndex={0} />
        </WorkspaceDetailsSection>
      ) : null}
    </WorkspaceDetailsStack>
  );
}
