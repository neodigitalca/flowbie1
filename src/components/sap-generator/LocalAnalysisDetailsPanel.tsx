import type { EntityGeographicLevel } from "@/lib/entity-geographic-level";
import type { LocalAnalysisHeaderProgress } from "@/lib/local-analysis/header-progress";
import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { BulkGscKeywordsHostedLink } from "@/lib/bulk/bulk-gsc-keywords-hosted-link";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import {
  CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES,
  CONTENT_PREP_POST_SECTION_TITLES,
  ENTITY_SAP_GSC_PREP_SECTION_TITLE,
} from "@/lib/overview/overview-content-prep-harness-sections";

export type LocalAnalysisDetailsPanelProps = {
  workspaceBusy: boolean;
  headerProgress: LocalAnalysisHeaderProgress | null;
  isProcessing?: boolean;
  status?: string;
  uploadLabel: string;
  keywordTargetCount: number;
  sapRowCount: number;
  entityGeographicLevel: EntityGeographicLevel;
  entityTypeFocus: string[];
  gridSummaryMarkdown: string;
  strategyMarkdown: string;
  hasSapRowsForCsv: boolean;
  displayRows: CSVRow[];
  currentRow: number;
  harnessSections?: BulkHarnessSectionUi[];
  harnessByRow?: Map<number, BulkHarnessSectionUi[]>;
  batchPrepHarnessSections?: BulkHarnessSectionUi[];
  harnessPlannedSectionCount?: number | null;
  sitemapInventoryLinks?: PromptBulkSitemapInventoryLink[];
  gscHostedLink?: BulkGscKeywordsHostedLink | null;
  sitemapInventoryLoading?: boolean;
  prepAccordionTitle?: string;
  pipelineSectionTitles?: readonly string[];
  liveMessage?: string | null;
  onDownloadTargetsCsv: () => void;
  onDownloadStrategyMarkdown: () => void;
};

export function localAnalysisDetailsCanOpen(
  hasData: boolean,
  busy: boolean,
): boolean {
  return workspaceDetailsCanOpen(hasData, busy);
}

const PREP_SOURCE_BY_TITLE: Record<(typeof CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES)[number], OverviewSitemapSource> = {
  "Posts sitemap": "posts",
  "Pages sitemap": "pages",
  "Entity sitemap": "sap",
};

export function buildEntityBatchPrepHarnessSections(
  links: PromptBulkSitemapInventoryLink[],
  sitePrepLoading: boolean,
  workspaceBusy: boolean,
  headerProgress: LocalAnalysisHeaderProgress | null,
  gscHostedLink?: BulkGscKeywordsHostedLink | null,
): BulkHarnessSectionUi[] {
  const linkBySource = new Map(links.map((link) => [link.source, link]));

  const phase = headerProgress?.phase?.trim().toLowerCase() ?? "";
  const loadingInventory =
    sitePrepLoading ||
    (workspaceBusy &&
      (phase.includes("inventory") ||
        phase.includes("cache") ||
        phase.includes("gsc") ||
        headerProgress?.kind === "csv"));

  const sitemapSections = CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES.map((title, sectionIndex) => {
    const source = PREP_SOURCE_BY_TITLE[title];
    const link = linkBySource.get(source);
    const hasLink = Boolean(link);
    let status: BulkHarnessSectionUi["status"] = "waiting";
    if (hasLink) status = "done";
    else if (loadingInventory) status = "generating";
    return {
      sectionIndex,
      title: link ? `${title} (${link.rowCount.toLocaleString()})` : title,
      status,
      ...(link ? { markdown: `${link.filename}\n${link.href}` } : {}),
    };
  });

  let gscStatus: BulkHarnessSectionUi["status"] = "waiting";
  if (gscHostedLink) gscStatus = "done";
  else if (loadingInventory) gscStatus = "generating";

  const gscTitle = gscHostedLink
    ? `${ENTITY_SAP_GSC_PREP_SECTION_TITLE} (${gscHostedLink.rowCount.toLocaleString()})`
    : ENTITY_SAP_GSC_PREP_SECTION_TITLE;

  return [
    ...sitemapSections,
    {
      sectionIndex: sitemapSections.length,
      title: gscTitle,
      status: gscStatus,
      ...(gscHostedLink
        ? { markdown: `${gscHostedLink.filename}\n${gscHostedLink.href}` }
        : {}),
    },
  ];
}

export const ENTITY_DETAILS_PIPELINE_SECTION_TITLES = CONTENT_PREP_POST_SECTION_TITLES;
