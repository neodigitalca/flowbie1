import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { ImageReferenceProvenance } from "@/components/generator/image/image-generator-types";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";

const IMAGE_PIPELINE_TITLES = ["Checklist", "References", "Generate image"] as const;

function imagePipelineSections(input: {
  isGenerating: boolean;
  isGeneratingChecklist: boolean;
  hasGeneratedChecklist: boolean;
  referenceResearch: ImageReferenceProvenance | null;
  imageDisplayUrl: string | null;
}): BulkHarnessSectionUi[] {
  const checklistStatus: BulkHarnessSectionUi["status"] = input.isGeneratingChecklist
    ? "generating"
    : input.hasGeneratedChecklist
      ? "done"
      : "waiting";

  const referencesStatus: BulkHarnessSectionUi["status"] = input.referenceResearch
    ? "done"
    : input.isGenerating && input.hasGeneratedChecklist
      ? "generating"
      : "waiting";

  const generateStatus: BulkHarnessSectionUi["status"] = input.imageDisplayUrl
    ? "done"
    : input.isGenerating && input.referenceResearch
      ? "generating"
      : "waiting";

  return [
    { sectionIndex: 0, title: IMAGE_PIPELINE_TITLES[0], status: checklistStatus },
    { sectionIndex: 1, title: IMAGE_PIPELINE_TITLES[1], status: referencesStatus },
    { sectionIndex: 2, title: IMAGE_PIPELINE_TITLES[2], status: generateStatus },
  ];
}

export function buildImageBulkGeneratorDetailsProps(input: {
  workspaceBusy: boolean;
  isGenerating: boolean;
  isGeneratingChecklist: boolean;
  hasGeneratedChecklist: boolean;
  referenceResearch: ImageReferenceProvenance | null;
  imageDisplayUrl: string | null;
  userPrompt: string;
  imageSourceMode: string;
  error: string | null;
}): BulkGeneratorDetailsPanelProps {
  const title = input.userPrompt.trim() || "Image generation";
  const displayRows = [
    {
      keyword: input.imageSourceMode,
      title,
      destination_url: title,
    },
  ];

  const sections = imagePipelineSections(input);
  const harnessByRow = new Map<number, BulkHarnessSectionUi[]>([[0, sections]]);
  const isProcessing = input.isGenerating || input.isGeneratingChecklist;
  const status = input.error?.trim()
    ? input.error.trim()
    : input.isGeneratingChecklist
      ? "Building checklist…"
      : input.isGenerating
        ? "Gathering references and generating…"
        : input.imageDisplayUrl
          ? "Generated"
          : "";

  return {
    variant: "csv",
    workspaceBusy: input.workspaceBusy || isProcessing,
    headerProgress: null,
    isProcessing,
    status,
    harnessSections: [],
    harnessByRow,
    batchPrepHarnessSections: [],
    harnessPlannedSectionCount: IMAGE_PIPELINE_TITLES.length,
    currentRow: isProcessing ? 0 : -1,
    totalRows: 1,
    displayRows,
    postDestination: "local",
    wpConfig: null,
    pipelineSectionTitles: [...IMAGE_PIPELINE_TITLES],
  };
}
