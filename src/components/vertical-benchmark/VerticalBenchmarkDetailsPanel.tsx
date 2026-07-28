import { ExternalLink } from "lucide-react";
import { VerticalBenchmarkPipelineBody } from "@/components/vertical-benchmark/VerticalBenchmarkPipelinePanel";
import type { BenchmarkGridCsvContext } from "@/lib/vertical-benchmark/vertical-benchmark-grid-entity";
import type {
  BenchmarkInventoryHostedLink,
  BenchmarkPipelineProgress,
} from "@/lib/vertical-benchmark/vertical-benchmark-pipeline-types";
import {
  WorkspaceDetailsKvRow,
  WorkspaceDetailsSection,
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

export type VerticalBenchmarkDetailsPanelProps = {
  busy: boolean;
  exporting: boolean;
  generatingBulkTemplate: boolean;
  exportProgress: BenchmarkPipelineProgress | null;
  bulkTemplateProgress: BenchmarkPipelineProgress | null;
  bulkInventoryLinks: BenchmarkInventoryHostedLink[];
  selectedCount: number;
  rosterCount: number;
  tagFilter: string;
  gridCsvContext: BenchmarkGridCsvContext | null;
  gridCsvFileName: string | null;
};

function categoryFilterLabel(tagFilter: string): string {
  return tagFilter === "__all__" ? "All categories" : tagFilter;
}

export function verticalBenchmarkDetailsCanOpen(
  rosterCount: number,
  busy: boolean,
  hasGrid: boolean,
): boolean {
  return workspaceDetailsCanOpen(rosterCount > 0, busy, hasGrid);
}

function InventoryLinksList({ links }: { links: BenchmarkInventoryHostedLink[] }) {
  if (!links.length) return null;
  return (
    <ul className="space-y-1 px-2.5 py-2 sm:px-3">
      {links.map((link) => (
        <li key={link.siteId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base">
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            {link.filename}
          </a>
          <span className="text-muted-foreground">
            {link.siteName} ({link.rowCount} URLs)
          </span>
        </li>
      ))}
    </ul>
  );
}

export function VerticalBenchmarkDetailsPanel({
  busy,
  exporting,
  generatingBulkTemplate,
  exportProgress,
  bulkTemplateProgress,
  bulkInventoryLinks,
  selectedCount,
  rosterCount,
  tagFilter,
  gridCsvContext,
  gridCsvFileName,
}: VerticalBenchmarkDetailsPanelProps) {
  let kvIndex = 0;

  return (
    <WorkspaceDetailsStack>
      <WorkspaceDetailsSection title="Workspace" stripeIndex={0}>
        <WorkspaceDetailsKvRow
          label="Selection"
          value={`${selectedCount} / ${rosterCount} in list`}
          stripeIndex={kvIndex++}
        />
        <WorkspaceDetailsKvRow
          label="Category"
          value={categoryFilterLabel(tagFilter)}
          stripeIndex={kvIndex++}
        />
        {gridCsvContext ? (
          <WorkspaceDetailsKvRow
            label="Grid CSV"
            value={`${gridCsvFileName ?? "Grid"} · ${gridCsvContext.matchedRowCount} rows · ${gridCsvContext.dominantKeyword}`}
            stripeIndex={kvIndex++}
          />
        ) : null}
      </WorkspaceDetailsSection>

      <WorkspaceDetailsSection title="Run detail" stripeIndex={1} defaultOpen>
        {busy && exporting && exportProgress ? (
          <VerticalBenchmarkPipelineBody embedded title="GSC export" progress={exportProgress} />
        ) : null}
        {busy && generatingBulkTemplate && bulkTemplateProgress ? (
          <VerticalBenchmarkPipelineBody
            embedded
            title="Bulk CSV"
            progress={bulkTemplateProgress}
            inventoryLinks={bulkInventoryLinks}
          />
        ) : null}
        {!busy ? <InventoryLinksList links={bulkInventoryLinks} /> : null}
      </WorkspaceDetailsSection>
    </WorkspaceDetailsStack>
  );
}
