import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { CitationDetailsPanelProps } from "@/components/research/citation/CitationDetailsPanel";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";

export function buildCitationBulkGeneratorDetailsProps(
  input: CitationDetailsPanelProps & { busy: boolean },
): BulkGeneratorDetailsPanelProps {
  const keyword = input.seedKeyword.trim() || "Citation";
  const displayRows = [
    {
      keyword,
      title: keyword,
      destination_url: input.siteUrl?.trim() || keyword,
    },
  ];

  const pipelineStatus: BulkHarnessSectionUi["status"] = input.hasRecord
    ? "done"
    : input.busy
      ? "generating"
      : "waiting";

  const harnessByRow = new Map<number, BulkHarnessSectionUi[]>([
    [
      0,
      [
        { sectionIndex: 0, title: "Listings + GBP", status: pipelineStatus },
        { sectionIndex: 1, title: "Extract citation", status: pipelineStatus },
      ],
    ],
  ]);

  return {
    variant: "csv",
    workspaceBusy: input.busy,
    headerProgress: null,
    isProcessing: input.busy,
    status: input.busy ? "Generating citation…" : input.hasRecord ? "Ready" : "",
    harnessSections: [],
    harnessByRow,
    batchPrepHarnessSections: [],
    harnessPlannedSectionCount: 2,
    currentRow: input.busy ? 0 : -1,
    totalRows: 1,
    displayRows,
    postDestination: "local",
    wpConfig: null,
    pipelineSectionTitles: ["Listings + GBP", "Extract citation"],
  };
}
