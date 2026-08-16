import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { UrlOptimizerDetailsPanelProps } from "@/components/research/url-optimizer/UrlOptimizerDetailsPanel";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";
import { sitemapPlanHeaderProgressToBlogImport } from "@/lib/sitemap-optimizer/sitemap-plan-header-progress";
import {
  URL_OPTIMIZER_STEPS,
  urlOptimizerStepStatus,
} from "@/lib/url-optimizer/url-optimizer-progress-display";

function stepStatusToHarness(status: "pending" | "active" | "done"): BulkHarnessSectionUi["status"] {
  if (status === "active") return "generating";
  if (status === "done") return "done";
  return "waiting";
}

export function buildUrlOptimizerBulkGeneratorDetailsProps(
  input: UrlOptimizerDetailsPanelProps,
): BulkGeneratorDetailsPanelProps {
  const title = input.siteName?.trim() || "URL optimizer";
  const displayRows = [{ keyword: title, title, destination_url: title }];

  const harnessSections = input.running
    ? URL_OPTIMIZER_STEPS.map((step, sectionIndex) => ({
        sectionIndex,
        title: step.label,
        status: stepStatusToHarness(urlOptimizerStepStatus(step.id, input.progress.phase)),
        markdown: input.progress.message?.trim() || undefined,
      }))
    : input.result
      ? URL_OPTIMIZER_STEPS.map((step, sectionIndex) => ({
          sectionIndex,
          title: step.label,
          status: "done" as const,
        }))
      : [];

  const harnessByRow = new Map<number, BulkHarnessSectionUi[]>([[0, harnessSections]]);

  const batchPrepHarnessSections: BulkHarnessSectionUi[] = [
    {
      sectionIndex: 0,
      title: "GSC CSV",
      status: input.fileName ? "done" : input.running ? "generating" : "waiting",
    },
    {
      sectionIndex: 1,
      title: "Property",
      status: input.siteName ? "done" : "waiting",
    },
  ];

  const status = input.progress.message?.trim() ?? input.error?.trim() ?? "";
  const phase = input.progress.message?.trim() || status;

  return {
    variant: "csv",
    workspaceBusy: input.running,
    headerProgress: input.running
      ? sitemapPlanHeaderProgressToBlogImport(
          {
            label: "URL optimizer",
            phase,
            completed: input.progress.completed,
            total: Math.max(1, input.progress.total),
          },
          true,
        )
      : null,
    isProcessing: input.running,
    status,
    harnessSections: [],
    harnessByRow,
    batchPrepHarnessSections,
    harnessPlannedSectionCount: harnessSections.length || null,
    currentRow: input.running ? 0 : -1,
    totalRows: 1,
    displayRows,
    postDestination: "local",
    wpConfig: null,
    pipelineSectionTitles: URL_OPTIMIZER_STEPS.map((step) => step.label),
    liveMessage: [
      input.siteName,
      input.fileName ? `${input.fileName} (${input.rowCount} URLs)` : null,
    ]
      .filter(Boolean)
      .join(" · ") || undefined,
  };
}
