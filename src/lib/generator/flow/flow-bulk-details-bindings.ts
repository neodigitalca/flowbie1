import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { GenerationResult } from "@/lib/api";
import type { FlowFreeformSectionPlan } from "@/lib/flow-freeform/flow-freeform-types";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";

const FLOW_PREP_TITLES = ["Clarify", "Outline"] as const;

function prepSectionStatus(
  title: (typeof FLOW_PREP_TITLES)[number],
  isGenerating: boolean,
  stage: GenerationResult["currentStage"],
  hasSections: boolean,
): BulkHarnessSectionUi["status"] {
  if (title === "Clarify") {
    if (stage === "planning") return "generating";
    if (stage !== "idle" && stage !== "error") return "done";
    return isGenerating ? "generating" : "waiting";
  }
  if (title === "Outline") {
    if (hasSections && stage !== "planning") return "done";
    if (isGenerating && stage === "planning") return "generating";
    return hasSections ? "done" : "waiting";
  }
  return "waiting";
}

function sectionHarnessStatus(
  sectionIndex: number,
  isGenerating: boolean,
  stage: GenerationResult["currentStage"],
  sectionsComplete: boolean,
): BulkHarnessSectionUi["status"] {
  if (sectionsComplete) return "done";
  if (isGenerating && (stage === "drafting" || stage === "reviewing")) {
    return sectionIndex === 0 ? "generating" : "waiting";
  }
  return "waiting";
}

export function buildFlowBulkGeneratorDetailsProps(input: {
  workspaceBusy: boolean;
  flowTitle: string;
  sections: FlowFreeformSectionPlan[];
  generationResult: GenerationResult;
  isGenerating: boolean;
}): BulkGeneratorDetailsPanelProps {
  const sectionsComplete =
    input.generationResult.currentStage === "complete" &&
    Boolean(input.generationResult.final.trim());
  const displayRows = input.sections.map((section) => ({
    keyword: section.ragQuery.trim() || section.id,
    title: section.h2Title.trim() || section.id,
    destination_url: section.id,
  }));

  const batchPrepHarnessSections: BulkHarnessSectionUi[] = FLOW_PREP_TITLES.map(
    (title, sectionIndex) => ({
      sectionIndex,
      title,
      status: prepSectionStatus(
        title,
        input.isGenerating,
        input.generationResult.currentStage,
        input.sections.length > 0,
      ),
    }),
  );

  const harnessByRow = new Map<number, BulkHarnessSectionUi[]>();
  input.sections.forEach((_section, index) => {
    harnessByRow.set(index, [
      {
        sectionIndex: 0,
        title: "Write section",
        status: sectionHarnessStatus(
          index,
          input.isGenerating,
          input.generationResult.currentStage,
          sectionsComplete,
        ),
      },
    ]);
  });

  let currentRow = -1;
  if (
    input.isGenerating &&
    (input.generationResult.currentStage === "drafting" ||
      input.generationResult.currentStage === "reviewing")
  ) {
    currentRow = 0;
  }

  const status =
    input.generationResult.currentStage === "error"
      ? "Error"
      : input.generationResult.currentStage === "complete"
        ? "Complete"
        : input.isGenerating
          ? input.generationResult.currentStage
          : "";

  return {
    variant: "csv",
    workspaceBusy: input.workspaceBusy,
    headerProgress: null,
    isProcessing: input.isGenerating,
    status,
    harnessSections: [],
    harnessByRow,
    batchPrepHarnessSections,
    harnessPlannedSectionCount: 1,
    currentRow,
    totalRows: displayRows.length,
    displayRows,
    postDestination: "local",
    wpConfig: null,
    prepAccordionTitle: "Flow prep",
    pipelineSectionTitles: ["Write section"],
    liveMessage: input.flowTitle.trim() || undefined,
  };
}
