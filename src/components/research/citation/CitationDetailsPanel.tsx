import {
  WorkspaceDetailsKvRow,
  WorkspaceDetailsSection,
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

export type CitationDetailsPanelProps = {
  workspaceMode: string;
  siteUrl: string | null;
  seedKeyword: string;
  hasRecord: boolean;
};

export function citationDetailsCanOpen(
  hasSiteOrSeed: boolean,
  hasKeyword: boolean,
  hasRecord: boolean,
): boolean {
  return workspaceDetailsCanOpen(hasSiteOrSeed, hasKeyword, hasRecord);
}

export function CitationDetailsPanel({
  workspaceMode,
  siteUrl,
  seedKeyword,
  hasRecord,
}: CitationDetailsPanelProps) {
  let kvIndex = 0;
  return (
    <WorkspaceDetailsStack>
      <WorkspaceDetailsSection title="Workspace" stripeIndex={0}>
        <WorkspaceDetailsKvRow
          label="Mode"
          value={workspaceMode === "temp" ? "Temp seed" : "Connected site"}
          stripeIndex={kvIndex++}
        />
        <WorkspaceDetailsKvRow
          label="Property"
          value={
            siteUrl ??
            (workspaceMode === "temp" ? "Set a temp seed URL in the header." : "Select a connected site.")
          }
          stripeIndex={kvIndex++}
        />
        {seedKeyword.trim() ? (
          <WorkspaceDetailsKvRow label="Keyword" value={seedKeyword.trim()} stripeIndex={kvIndex++} />
        ) : null}
      </WorkspaceDetailsSection>
      {hasRecord ? (
        <WorkspaceDetailsSection title="Run detail" stripeIndex={1} defaultOpen>
          <WorkspaceDetailsKvRow label="Status" value="Citation record ready" stripeIndex={0} />
        </WorkspaceDetailsSection>
      ) : null}
    </WorkspaceDetailsStack>
  );
}
