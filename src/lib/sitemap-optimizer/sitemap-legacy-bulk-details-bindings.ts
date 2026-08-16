import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { SitemapLegacyRedirectWorkspaceBindings } from "@/components/research/sitemap-optimizer/sitemap-legacy-redirect-workspace-bindings";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";
import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import {
  activeLegacyRedirectPhaseIndex,
  LEGACY_REDIRECT_PHASES,
} from "@/lib/sitemap-optimizer/legacy-redirect-header-progress";
import { sitemapPlanHeaderProgressToBlogImport } from "@/lib/sitemap-optimizer/sitemap-plan-header-progress";
import type { LegacyRedirectBatchStatus, LegacyRedirectHeaderProgress } from "@/lib/sitemap-optimizer/types";

function batchStatusToHarness(status: LegacyRedirectBatchStatus): BulkHarnessSectionUi["status"] {
  if (status === "running") return "generating";
  if (status === "done") return "done";
  if (status === "error") return "skipped";
  return "waiting";
}

function legacyHeaderProgressToBlogImport(
  progress: LegacyRedirectHeaderProgress | null,
  isProcessing: boolean,
) {
  if (!progress?.phase?.trim()) return null;
  return sitemapPlanHeaderProgressToBlogImport(
    {
      label: progress.phase.trim(),
      phase: progress.phase.trim(),
      completed: progress.completed,
      total: progress.total,
      progressPct: progress.progressPct,
    },
    isProcessing,
  );
}

function legacyInventoryLinks(
  bindings: SitemapLegacyRedirectWorkspaceBindings,
): PromptBulkSitemapInventoryLink[] {
  if (!bindings.inventoryHref?.trim() || !bindings.inventoryFilename?.trim()) return [];
  return [
    {
      siteId: "legacy-redirect",
      siteName: bindings.sheetName?.trim() || "Legacy redirects",
      href: bindings.inventoryHref,
      filename: bindings.inventoryFilename,
      rowCount: bindings.inventoryRowCount ?? 0,
      source: "posts",
      label: "Site inventory",
    },
  ];
}

export function buildSitemapLegacyBulkGeneratorDetailsProps(
  bindings: SitemapLegacyRedirectWorkspaceBindings,
): BulkGeneratorDetailsPanelProps {
  const displayRows =
    bindings.batchProgress.length > 0
      ? bindings.batchProgress.map((batch) => ({
          keyword: `Batch ${batch.batchIndex + 1}`,
          title: `Batch ${batch.batchIndex + 1} (${batch.lineCount} lines)`,
          destination_url: `batch-${batch.batchIndex}`,
        }))
      : bindings.sheetName
        ? [
            {
              keyword: bindings.sheetName,
              title: bindings.sheetName,
              destination_url: bindings.sheetName,
            },
          ]
        : [{ keyword: "Legacy redirects", title: "Legacy redirects", destination_url: "legacy" }];

  const harnessByRow = new Map<number, BulkHarnessSectionUi[]>();
  bindings.batchProgress.forEach((batch, index) => {
    harnessByRow.set(index, [
      {
        sectionIndex: 0,
        title: "Match redirects",
        status: batchStatusToHarness(batch.status),
        markdown: batch.error?.trim() || undefined,
      },
    ]);
  });

  const activePhaseIdx =
    bindings.generating && bindings.headerProgress
      ? activeLegacyRedirectPhaseIndex(bindings.headerProgress.phase)
      : -1;

  const batchPrepHarnessSections: BulkHarnessSectionUi[] = LEGACY_REDIRECT_PHASES.map(
    (phase, sectionIndex) => ({
      sectionIndex,
      title: phase,
      status:
        activePhaseIdx > sectionIndex
          ? "done"
          : activePhaseIdx === sectionIndex
            ? "generating"
            : "waiting",
    }),
  );

  let currentRow = -1;
  if (bindings.generating) {
    const runningIdx = bindings.batchProgress.findIndex((batch) => batch.status === "running");
    currentRow = runningIdx >= 0 ? runningIdx : 0;
  }

  const status = bindings.headerProgress?.phase?.trim() ?? bindings.error?.trim() ?? "";

  return {
    variant: "csv",
    workspaceBusy: bindings.generating,
    headerProgress: legacyHeaderProgressToBlogImport(bindings.headerProgress, bindings.generating),
    isProcessing: bindings.generating,
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
    sitemapInventoryLinks: legacyInventoryLinks(bindings),
    pipelineSectionTitles: ["Match redirects"],
    liveMessage: [
      bindings.sheetName,
      bindings.sheetLineCount > 0 ? `${bindings.sheetLineCount} lines` : null,
      bindings.matchedCount > 0 ? `${bindings.matchedCount} matched` : null,
    ]
      .filter(Boolean)
      .join(" · ") || undefined,
  };
}
