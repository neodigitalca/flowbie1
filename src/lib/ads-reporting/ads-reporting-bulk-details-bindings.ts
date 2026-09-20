import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type {
  AdsReportingPipelineProgress,
  AdsReportingSectionPlan,
  AdsReportingSectionResult,
} from "@/lib/ads-reporting/ads-reporting-types";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";

export function buildAdsReportingBulkGeneratorDetailsProps(input: {
  busy: boolean;
  progress: AdsReportingPipelineProgress | null;
  siteName?: string;
  siteUrl?: string;
  outlineSections?: AdsReportingSectionPlan[];
  sectionMap?: Record<number, AdsReportingSectionResult>;
  generatingSectionIndex?: number | null;
}): BulkGeneratorDetailsPanelProps {
  const sections = input.outlineSections ?? [];
  const displayRows = sections.length
    ? sections.map((section) => ({
        keyword: section.ragQuery.trim() || section.kind,
        title: section.h2Title.trim() || section.id,
        destination_url: section.id,
      }))
    : [
        {
          keyword: input.siteName?.trim() || "PPC report",
          title: input.siteName?.trim() || "PPC report",
          destination_url: input.siteUrl?.trim() || "ppc-report",
        },
      ];
  const harnessByRow = new Map<number, BulkHarnessSectionUi[]>();
  sections.forEach((_section, index) => {
    const hasResult = Boolean(input.sectionMap?.[index]?.markdownBlock?.trim());
    const isGenerating = input.busy && input.generatingSectionIndex === index && !hasResult;
    harnessByRow.set(index, [
      {
        sectionIndex: 0,
        title: "Write section",
        status: hasResult ? "done" : isGenerating ? "generating" : "waiting",
      },
    ]);
  });
  let currentRow = -1;
  if (input.busy && input.generatingSectionIndex != null) {
    currentRow = input.generatingSectionIndex;
  } else if (input.busy && sections.length === 0) {
    currentRow = 0;
  }
  return {
    variant: "csv",
    workspaceBusy: input.busy,
    headerProgress: null,
    isProcessing: input.busy,
    status: input.progress?.label?.trim() ?? "",
    harnessSections: [],
    harnessByRow,
    batchPrepHarnessSections: [
      {
        sectionIndex: 0,
        title: "Ads reporting bundle API",
        status: input.busy && sections.length === 0 ? "generating" : sections.length > 0 ? "done" : "waiting",
      },
      {
        sectionIndex: 1,
        title: "Outline",
        status: sections.length > 0 ? "done" : input.busy ? "generating" : "waiting",
      },
    ],
    harnessPlannedSectionCount: 1,
    currentRow,
    totalRows: displayRows.length,
    displayRows,
    postDestination: "local",
    wpConfig: null,
    prepAccordionTitle: "Report prep",
    pipelineSectionTitles: ["Write section"],
    liveMessage: input.siteName?.trim() || undefined,
  };
}
