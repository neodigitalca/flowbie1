import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { PressReleaseDetailsPanelProps } from "@/components/press-release/PressReleaseDetailsPanel";
import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";

export function buildPressReleaseBulkGeneratorDetailsProps(
  input: PressReleaseDetailsPanelProps & { workspaceBusy?: boolean },
): BulkGeneratorDetailsPanelProps {
  const keyword = input.keyword.trim();
  const title = input.title.trim();
  const siteUrl = input.wordPressSite?.siteUrl?.trim() ?? "";
  const displayRows = [
    {
      keyword,
      title: title || keyword || "Press release",
      destination_url: siteUrl || title || keyword || "press-release",
    },
  ];

  const harnessByRow = new Map<number, BulkHarnessSectionUi[]>();
  if (input.harnessSections.length > 0) {
    harnessByRow.set(0, input.harnessSections);
  }

  const sitemapInventoryLinks: PromptBulkSitemapInventoryLink[] = input.inventoryJsonLink
    ? [
        {
          href: input.inventoryJsonLink.href,
          filename: input.inventoryJsonLink.filename,
          rowCount: input.inventoryJsonLink.rowCount,
          source: "posts",
          label: "Post inventory",
        },
      ]
    : [];

  const isProcessing = input.isProcessing;
  const livePhase = input.runPhase?.trim();

  return {
    variant: "csv",
    workspaceBusy: input.workspaceBusy ?? isProcessing,
    headerProgress: null,
    isProcessing,
    status: livePhase || "",
    harnessSections: [],
    harnessByRow,
    batchPrepHarnessSections: [],
    harnessPlannedSectionCount: input.harnessPlannedSectionCount,
    currentRow: isProcessing ? 0 : -1,
    totalRows: 1,
    displayRows,
    postDestination: "wordpress",
    wpConfig: null,
    sitemapInventoryLinks,
    pipelineSectionTitles: input.harnessSections.map((section) => section.title),
    liveMessage:
      isProcessing && livePhase && input.harnessSections.length === 0 ? livePhase : undefined,
  };
}
