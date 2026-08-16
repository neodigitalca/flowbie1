import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { GscReportingDetailsPanelProps } from "@/components/research/reporting/GscReportingDetailsPanel";
import {
  GSC_REPORTING_COMPARE_PRESET_OPTIONS,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import type { GscReportingSectionPlan, GscReportingSectionResult } from "@/lib/gsc-reporting/gsc-reporting-types";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";

export function buildGscReportingBulkGeneratorDetailsProps(
  input: GscReportingDetailsPanelProps & {
    outlineSections?: GscReportingSectionPlan[];
    sectionMap?: Record<number, GscReportingSectionResult>;
    generatingSectionIndex?: number | null;
  },
): BulkGeneratorDetailsPanelProps {
  const sections = input.outlineSections ?? [];
  const displayRows = sections.length
    ? sections.map((section) => ({
        keyword: section.ragQuery.trim() || section.kind,
        title: section.h2Title.trim() || section.id,
        destination_url: section.id,
      }))
    : [
        {
          keyword: input.siteName?.trim() || "GSC report",
          title: input.siteName?.trim() || "GSC report",
          destination_url: input.siteUrl?.trim() || "gsc-report",
        },
      ];

  const harnessByRow = new Map<number, BulkHarnessSectionUi[]>();
  sections.forEach((section, index) => {
    const hasResult = Boolean(input.sectionMap?.[index]?.markdownBlock?.trim());
    const isGenerating =
      input.busy &&
      input.generatingSectionIndex === index &&
      !hasResult;
    harnessByRow.set(index, [
      {
        sectionIndex: 0,
        title: "Write section",
        status: hasResult ? "done" : isGenerating ? "generating" : "waiting",
      },
    ]);
  });

  if (sections.length === 0 && input.busy) {
    harnessByRow.set(0, [
      {
        sectionIndex: 0,
        title: input.progress?.label?.trim() || "Pipeline",
        status: "generating",
      },
    ]);
  }

  const presetLabel =
    GSC_REPORTING_COMPARE_PRESET_OPTIONS.find((option) => option.id === input.gscFetchPreset)?.label ??
    input.gscFetchPreset;

  const batchPrepHarnessSections: BulkHarnessSectionUi[] = [
    {
      sectionIndex: 0,
      title: "Fetch GSC bundle",
      status: input.cachedFileCount > 0 ? "done" : input.busy ? "generating" : "waiting",
    },
    {
      sectionIndex: 1,
      title: "Outline",
      status: sections.length > 0 ? "done" : input.busy ? "generating" : "waiting",
    },
  ];

  let currentRow = -1;
  if (input.busy && input.generatingSectionIndex != null) {
    currentRow = input.generatingSectionIndex;
  } else if (input.busy && sections.length === 0) {
    currentRow = 0;
  }

  const status = input.progress?.label?.trim() ?? "";

  return {
    variant: "csv",
    workspaceBusy: input.busy,
    headerProgress: null,
    isProcessing: input.busy,
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
    prepAccordionTitle: "Report prep",
    pipelineSectionTitles: ["Write section"],
    liveMessage: [presetLabel, input.siteName?.trim()].filter(Boolean).join(" · ") || undefined,
  };
}
