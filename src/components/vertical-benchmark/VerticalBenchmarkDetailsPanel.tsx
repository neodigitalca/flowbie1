import type { BenchmarkGridCsvContext } from "@/lib/vertical-benchmark/vertical-benchmark-grid-entity";
import type {
  BenchmarkInventoryHostedLink,
  BenchmarkPipelineProgress,
} from "@/lib/vertical-benchmark/vertical-benchmark-pipeline-types";
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

export function verticalBenchmarkDetailsCanOpen(
  rosterCount: number,
  busy: boolean,
  hasGrid: boolean,
): boolean {
  return workspaceDetailsCanOpen(rosterCount > 0, busy, hasGrid);
}
