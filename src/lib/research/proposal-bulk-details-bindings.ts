import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { ProposalDetailsPanelProps } from "@/components/research/proposal/ProposalDetailsPanel";
import {
  getProposalProgressStatusLine,
  type ProposalProgressPhase,
  type ProposalProgressSubphase,
} from "@/lib/research/proposal-header-progress";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";

function proposalHarnessSections(input: {
  phase: ProposalProgressPhase;
  proposalSubphase: ProposalProgressSubphase;
  competitorPipelineStep: number;
  localPipelineStep: number;
  gridCsvBusy: boolean;
}): BulkHarnessSectionUi[] {
  const semrushStatus: BulkHarnessSectionUi["status"] =
    input.phase === "semrush" ? "generating" : input.phase !== "idle" ? "done" : "waiting";

  const competitorStatus: BulkHarnessSectionUi["status"] =
    input.proposalSubphase === "competitor" || input.proposalSubphase === "parallel"
      ? "generating"
      : input.phase === "report" &&
          (input.competitorPipelineStep >= 9 || input.proposalSubphase === "sap")
        ? "done"
        : "waiting";

  const localStatus: BulkHarnessSectionUi["status"] =
    input.proposalSubphase === "local" || input.proposalSubphase === "parallel"
      ? "generating"
      : input.phase === "report" && input.localPipelineStep > 0
        ? "done"
        : "waiting";

  const sapStatus: BulkHarnessSectionUi["status"] =
    input.proposalSubphase === "sap" ? "generating" : input.phase === "report" ? "done" : "waiting";

  const gridStatus: BulkHarnessSectionUi["status"] = input.gridCsvBusy
    ? "generating"
    : input.phase !== "idle"
      ? "done"
      : "waiting";

  return [
    { sectionIndex: 0, title: "Semrush analyze", status: semrushStatus },
    { sectionIndex: 1, title: "Grid CSV", status: gridStatus },
    { sectionIndex: 2, title: "Competitor strategist", status: competitorStatus },
    { sectionIndex: 3, title: "Local blueprint", status: localStatus },
    { sectionIndex: 4, title: "Entity SAP", status: sapStatus },
  ];
}

export function buildProposalBulkGeneratorDetailsProps(
  input: ProposalDetailsPanelProps & { busy: boolean },
): BulkGeneratorDetailsPanelProps {
  const title = input.workspaceMode === "connected" ? "Connected proposal" : "Temp seed proposal";
  const displayRows = [{ keyword: input.workspaceMode, title, destination_url: title }];
  const sections = proposalHarnessSections({
    phase: input.phase,
    proposalSubphase: input.proposalSubphase,
    competitorPipelineStep: input.competitorPipelineStep,
    localPipelineStep: input.localPipelineStep,
    gridCsvBusy: input.gridCsvBusy,
  });
  const harnessByRow = new Map<number, BulkHarnessSectionUi[]>([[0, sections]]);
  const status =
    getProposalProgressStatusLine({
      phase: input.phase,
      proposalSubphase: input.proposalSubphase,
      competitorPipelineStep: input.competitorPipelineStep,
      competitorPipelineLabel: input.competitorPipelineLabel,
      localPipelineStep: input.localPipelineStep,
      localPipelineLabel: input.localPipelineLabel,
      reportMicroLabel: input.reportMicroLabel,
    }) ??
    input.error?.trim() ??
    "";

  return {
    variant: "csv",
    workspaceBusy: input.busy,
    headerProgress: null,
    isProcessing: input.busy,
    status,
    harnessSections: [],
    harnessByRow,
    batchPrepHarnessSections: [],
    harnessPlannedSectionCount: sections.length,
    currentRow: input.busy ? 0 : -1,
    totalRows: 1,
    displayRows,
    postDestination: "local",
    wpConfig: null,
    pipelineSectionTitles: sections.map((section) => section.title),
    liveMessage: status || undefined,
  };
}
