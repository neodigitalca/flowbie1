import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { BacklinkingDetailsPanelProps } from "@/components/research/backlinking/BacklinkingDetailsPanel";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";

export function buildBacklinkingBulkGeneratorDetailsProps(
  input: BacklinkingDetailsPanelProps & { busy: boolean },
): BulkGeneratorDetailsPanelProps {
  const keyword = input.lastKeyword?.trim() || input.industry.trim() || "Backlinking";
  const displayRows = [
    {
      keyword,
      title: keyword,
      destination_url: input.locationName.trim() || keyword,
    },
  ];

  const pipelineStatus: BulkHarnessSectionUi["status"] = input.tileCount > 0
    ? "done"
    : input.busy
      ? "generating"
      : "waiting";

  const harnessByRow = new Map<number, BulkHarnessSectionUi[]>([
    [
      0,
      [
        { sectionIndex: 0, title: "Discover targets", status: pipelineStatus },
        { sectionIndex: 1, title: "Build tiles", status: pipelineStatus },
      ],
    ],
  ]);

  const status = input.loadingHint?.trim() ?? (input.tileCount > 0 ? `${input.tileCount} tiles` : "");

  return {
    variant: "csv",
    workspaceBusy: input.busy,
    headerProgress: null,
    isProcessing: input.busy,
    status,
    harnessSections: [],
    harnessByRow,
    batchPrepHarnessSections: [],
    harnessPlannedSectionCount: 2,
    currentRow: input.busy ? 0 : -1,
    totalRows: 1,
    displayRows,
    postDestination: "local",
    wpConfig: null,
    pipelineSectionTitles: ["Discover targets", "Build tiles"],
    liveMessage: status || undefined,
  };
}
