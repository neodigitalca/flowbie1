import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { OverviewRow, RowStatus } from "@/components/overview/overview-meta-row-types";
import type {
  BulkProgressSlice,
  MetaBulkActionKey,
} from "@/components/overview/overview-tab-constants";
import {
  META_BULK_MICRO_LABELS,
  META_BULK_MICRO_ORDER,
} from "@/components/overview/overview-tab-constants";
import type {
  BulkOptimizationState,
  OptimizationProgressState,
} from "@/hooks/content-optimization/use-optimization-state";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { BulkGeneratedFile } from "@/lib/bulk-file-manager";
import type { CSVRow } from "@/lib/bulk-auto-generate";
import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { BulkGscKeywordsHostedLink } from "@/lib/bulk/bulk-gsc-keywords-hosted-link";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import {
  buildContentOptimizerBulkGeneratorDetailsProps,
  buildContentOptimizerBulkMicroSnapshot,
  contentOptimizerHeaderProgressFromRun,
  contentOptimizerLiveStatus,
  isContentOptimizerBulkRun,
  type ContentOptimizerBulkGeneratorBindingsInput,
} from "@/lib/content-optimization/content-optimizer-bulk-generator-bindings";
import {
  CONTENT_PREP_POST_SECTION_TITLES,
  resolveContentPrepBatchSectionTitles,
} from "@/lib/overview/overview-content-prep-harness-sections";
import { RESEARCH_HARNESS_SECTION_TITLES } from "@/lib/overview/overview-research-harness-sections";
import { HEADERS_HARNESS_SECTION_TITLES } from "@/lib/overview/overview-blog-headers-harness-sections";
import { OVERVIEW_HARNESS_SECTION_TITLES } from "@/lib/overview/overview-blog-overview-harness-sections";
import { IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES } from "@/lib/overview/overview-blog-in-content-image-harness-sections";
import { WP_UPLOAD_HARNESS_SECTION_TITLES } from "@/lib/overview/overview-wp-upload-harness-sections";
import { linksHarnessSectionTitle } from "@/lib/overview/overview-blog-links-harness-sections";
import type { BlogLinksCatalogRow } from "@/lib/overview/overview-blog-links-catalog";
import { overviewBulkRowEntries } from "@/lib/overview/overview-bulk-row-scope";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import type { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { OptimizationFileManager as OptimizationFileManagerClass } from "@/lib/optimization-file-manager";

export {
  buildContentOptimizerBulkGeneratorDetailsProps,
  buildContentOptimizerBulkMicroSnapshot,
  contentOptimizerHeaderProgressFromRun,
  contentOptimizerLiveStatus,
  isContentOptimizerBulkRun,
  type ContentOptimizerBulkGeneratorBindingsInput,
};

export type OverviewBulkDetailsBindingsInput = ContentOptimizerBulkGeneratorBindingsInput & {
  sitemapInventoryLinks?: PromptBulkSitemapInventoryLink[];
  siteKwHostedLink?: BulkGscKeywordsHostedLink | null;
  sitemapInventoryLoading?: boolean;
  sitemapSource?: OverviewSitemapSource;
  bulkActionProgress?: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>;
  bulkScopeUrlKeys?: Set<string>;
};

export function isOverviewBulkDetailsRun(
  batchState: BulkOptimizationState | null | undefined,
): boolean {
  return Boolean(batchState?.urls?.length);
}

const LINKS_PIPELINE_TITLES = [
  linksHarnessSectionTitle({} as BlogLinksCatalogRow, 0),
  linksHarnessSectionTitle({} as BlogLinksCatalogRow, 1),
] as const;

const MICRO_ACTION_SINGLE_STEP: Partial<Record<MetaBulkActionKey, readonly string[]>> = {
  scrape: ["Scraping live titles & meta"],
  dates: ["Updating dates"],
  entityKw: ["Entity keywords"],
  contentKw: ["AI keywords (content)"],
  aiTitle: ["AI titles"],
  aiMeta: ["AI meta"],
  aiUrl: ["AI URL paths"],
  optimizeAll: ["Full-page batch optimize"],
  loadSitemap: ["Loading sitemap"],
  inventoryHydrate: ["Applying WordPress inventory"],
};

const MICRO_KEY_ACTIVE_ROW_STATUS: Partial<Record<MetaBulkActionKey, RowStatus>> = {
  scrape: "scraping",
  entityKw: "ai-focus-kw",
  contentKw: "ai-focus-kw",
  aiTitle: "ai-title",
  aiMeta: "ai-meta",
  aiUrl: "ai-url",
};

function resolveMicroRowPipelineTitle(key: MetaBulkActionKey): string {
  const single = MICRO_ACTION_SINGLE_STEP[key];
  if (single?.[0]) return single[0];
  return META_BULK_MICRO_LABELS[key] ?? "Processing";
}

function microRowHarnessStatus(
  row: OverviewRow,
  microKey: MetaBulkActionKey,
  isProcessing: boolean,
  displayIndex: number,
  slice: BulkProgressSlice,
): BulkHarnessSectionUi["status"] {
  if (row.status === "error") return "error";
  const activeStatus = MICRO_KEY_ACTIVE_ROW_STATUS[microKey];
  if (activeStatus) {
    if (row.status === activeStatus) return "generating";
    if (!isProcessing) return "done";
    return "waiting";
  }
  if (!isProcessing) return "done";
  const completed = Math.min(slice.completed, slice.total);
  if (displayIndex < completed) return "done";
  if (displayIndex === completed && completed < slice.total) return "generating";
  return "waiting";
}

function buildMicroHarnessByRow(
  scopedEntries: Array<{ row: OverviewRow; index: number }>,
  microKey: MetaBulkActionKey,
  isProcessing: boolean,
  slice: BulkProgressSlice,
): Map<number, BulkHarnessSectionUi[]> {
  const title = resolveMicroRowPipelineTitle(microKey);
  const map = new Map<number, BulkHarnessSectionUi[]>();
  scopedEntries.forEach(({ row }, displayIndex) => {
    map.set(displayIndex, [
      {
        sectionIndex: 0,
        title,
        status: microRowHarnessStatus(row, microKey, isProcessing, displayIndex, slice),
      },
    ]);
  });
  return map;
}

function resolveMicroCurrentRow(harnessByRow: Map<number, BulkHarnessSectionUi[]>): number {
  for (const [index, sections] of harnessByRow) {
    if (sections.some((section) => section.status === "generating")) return index;
  }
  return -1;
}

export function resolveOverviewBulkPipelineTitles(
  runKind: BulkOptimizationState["runKind"] | undefined,
  bulkState?: BulkOptimizationState,
): readonly string[] | undefined {
  switch (runKind) {
    case undefined:
    case "content":
    case "extraText":
      return [...CONTENT_PREP_POST_SECTION_TITLES];
    case "research":
      return [...RESEARCH_HARNESS_SECTION_TITLES];
    case "aiHeaders":
      return [...HEADERS_HARNESS_SECTION_TITLES];
    case "aiLinks":
      return [...LINKS_PIPELINE_TITLES];
    case "aiOverview":
      return [...OVERVIEW_HARNESS_SECTION_TITLES];
    case "aiInContentImage":
      return [...IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES];
    case "wpUpload":
      return [...WP_UPLOAD_HARNESS_SECTION_TITLES];
    case "contentCleanup":
      return ["Clean Up"];
    case "aiWikipediaLink":
      return ["Wikipedia link"];
    case "aiAllMeta":
    case "aiFaq":
      return undefined;
    default:
      if (bulkState?.batchPrepHarnessSections?.length) {
        return resolveContentPrepBatchSectionTitles(
          bulkState.runKind === "content" && Boolean(bulkState.urlEntities),
        );
      }
      return undefined;
  }
}

function activeMicroActionKey(
  bulkActionProgress: Partial<Record<MetaBulkActionKey, BulkProgressSlice>> | undefined,
): MetaBulkActionKey | null {
  if (!bulkActionProgress) return null;
  for (const key of META_BULK_MICRO_ORDER) {
    const slice = bulkActionProgress[key];
    if (!slice || slice.total <= 0) continue;
    if (slice.completed < slice.total) return key;
  }
  return null;
}

function isActiveMicroSlice(slice: BulkProgressSlice | undefined): boolean {
  if (!slice || slice.total <= 0) return false;
  return slice.completed < slice.total;
}

function overviewRowToCsvRowFromOverview(
  row: OverviewRow,
  bulkState?: BulkOptimizationState,
): CSVRow {
  const url = row.url?.trim() ?? "";
  const keyword = row.focusKeyword?.trim() || bulkState?.urlKeywords?.[url]?.trim() || "";
  return {
    keyword,
    title: row.title?.trim() || row.aiTitle?.trim() || url,
    meta_description: row.metaDescription?.trim() || undefined,
    publish_date_gmt: row.dateModifier?.trim() || row.wpDateGmt?.trim() || undefined,
    destination_url: url,
    entity:
      bulkState?.urlEntities?.[url] && bulkState.urlEntities[url] !== "N/A"
        ? String(bulkState.urlEntities[url])
        : undefined,
  };
}

export function buildOverviewMicroActionDetailsProps(
  input: Pick<
    OverviewBulkDetailsBindingsInput,
    | "siteId"
    | "batchKey"
    | "overviewRows"
    | "isOptimizingContent"
    | "optimizationFileManagers"
    | "siteName"
    | "bulkActionProgress"
    | "sitemapInventoryLinks"
    | "siteKwHostedLink"
    | "sitemapInventoryLoading"
    | "sitemapSource"
    | "bulkScopeUrlKeys"
  >,
  microKey: MetaBulkActionKey,
  slice: BulkProgressSlice,
): BulkGeneratorDetailsPanelProps {
  const scopeKeys = input.bulkScopeUrlKeys ?? new Set<string>();
  const scopedEntries = overviewBulkRowEntries(input.overviewRows, scopeKeys);
  const displayRows = scopedEntries.map(({ row }) => overviewRowToCsvRowFromOverview(row));
  const pipelineSectionTitles = [resolveMicroRowPipelineTitle(microKey)];
  const isProcessing = isActiveMicroSlice(slice);
  const harnessByRow = buildMicroHarnessByRow(scopedEntries, microKey, isProcessing, slice);
  const currentRow =
    typeof slice.currentRow === "number" && slice.currentRow >= 0
      ? slice.currentRow
      : resolveMicroCurrentRow(harnessByRow);
  const status = slice.statusMessage?.trim() || META_BULK_MICRO_LABELS[microKey];
  const downloadManager = new OptimizationFileManagerClass();

  return {
    variant: "csv",
    workspaceBusy: isProcessing,
    headerProgress: null,
    isProcessing,
    status,
    harnessSections: [],
    harnessByRow,
    batchPrepHarnessSections: [],
    harnessPlannedSectionCount: pipelineSectionTitles.length,
    currentRow,
    totalRows: slice.total ?? displayRows.length,
    displayRows,
    postDestination: "wordpress",
    wpConfig: null,
    sitemapInventoryLinks: input.sitemapInventoryLinks,
    siteKwHostedLink: input.siteKwHostedLink ?? null,
    sitemapInventoryLoading: input.sitemapInventoryLoading ?? false,
    pipelineSectionTitles: [...pipelineSectionTitles],
    entitySapRowDisplay: input.sitemapSource === "sap",
    filesByRow: new Map(),
    downloadFile: (file) => {
      downloadManager.downloadFile({
        name: file.fileName,
        content: file.content,
        mimeType: file.mimeType,
      });
    },
  };
}

function attachInventoryProps(
  props: BulkGeneratorDetailsPanelProps,
  input: Pick<
    OverviewBulkDetailsBindingsInput,
    "sitemapInventoryLinks" | "siteKwHostedLink" | "sitemapInventoryLoading" | "sitemapSource"
  >,
  pipelineSectionTitles?: readonly string[],
): BulkGeneratorDetailsPanelProps {
  return {
    ...props,
    sitemapInventoryLinks: input.sitemapInventoryLinks,
    siteKwHostedLink: input.siteKwHostedLink ?? null,
    sitemapInventoryLoading: input.sitemapInventoryLoading ?? false,
    pipelineSectionTitles: pipelineSectionTitles ? [...pipelineSectionTitles] : props.pipelineSectionTitles,
    entitySapRowDisplay: input.sitemapSource === "sap",
  };
}

export function buildOverviewWarmInventoryDetailsProps(
  input: Pick<
    OverviewBulkDetailsBindingsInput,
    | "sitemapInventoryLinks"
    | "siteKwHostedLink"
    | "sitemapInventoryLoading"
    | "sitemapSource"
    | "overviewRows"
  >,
): BulkGeneratorDetailsPanelProps {
  const displayRows = input.overviewRows.map((row) => overviewRowToCsvRowFromOverview(row));
  return {
    variant: "csv",
    workspaceBusy: Boolean(input.sitemapInventoryLoading),
    headerProgress: null,
    isProcessing: false,
    status: "",
    harnessSections: [],
    harnessByRow: new Map(),
    batchPrepHarnessSections: [],
    harnessPlannedSectionCount: null,
    currentRow: -1,
    totalRows: displayRows.length,
    displayRows,
    postDestination: "wordpress",
    wpConfig: null,
    sitemapInventoryLinks: input.sitemapInventoryLinks,
    siteKwHostedLink: input.siteKwHostedLink ?? null,
    sitemapInventoryLoading: input.sitemapInventoryLoading ?? false,
    entitySapRowDisplay: input.sitemapSource === "sap",
    filesByRow: new Map(),
  };
}

export function buildOverviewBulkGeneratorDetailsProps(
  input: OverviewBulkDetailsBindingsInput,
  workspaceBusy: boolean,
): BulkGeneratorDetailsPanelProps | null {
  const microKey = activeMicroActionKey(input.bulkActionProgress);
  if (!isOverviewBulkDetailsRun(input.bulkState) && microKey && input.bulkActionProgress?.[microKey]) {
    return buildOverviewMicroActionDetailsProps(input, microKey, input.bulkActionProgress[microKey]!);
  }

  if (!isOverviewBulkDetailsRun(input.bulkState)) {
    return null;
  }

  const base = buildContentOptimizerBulkGeneratorDetailsProps(input, workspaceBusy);
  const pipelineSectionTitles = resolveOverviewBulkPipelineTitles(input.bulkState.runKind, input.bulkState);
  return attachInventoryProps(base, input, pipelineSectionTitles);
}

export function buildOverviewBulkMicroSnapshot(
  input: OverviewBulkDetailsBindingsInput,
): MetaBulkMicroSnapshot | null {
  if (!isOverviewBulkDetailsRun(input.bulkState)) {
    return null;
  }
  return buildContentOptimizerBulkMicroSnapshot(input);
}

export function overviewBulkDetailsCanOpenFromWarm(
  sitemapInventoryLinks: PromptBulkSitemapInventoryLink[],
  gscHostedLink: BulkGscKeywordsHostedLink | null,
  sitemapInventoryLoading: boolean,
): boolean {
  if (sitemapInventoryLoading) return true;
  return sitemapInventoryLinks.length > 0 || Boolean(gscHostedLink);
}

export function overviewRowByUrlMap(rows: OverviewRow[]): Map<string, OverviewRow> {
  const map = new Map<string, OverviewRow>();
  for (const row of rows) {
    const key = normalizePageUrlKey(row.url);
    if (key) map.set(key, row);
  }
  return map;
}

export type MultiSiteBulkDetailsInput = {
  siteId: string;
  batchKey: string;
  bulkState: BulkOptimizationState;
  batchProgress?: OptimizationProgressState;
  siteProgress?: OptimizationProgressState;
  overviewRows: OverviewRow[];
  isOptimizingContent: Record<string, boolean>;
  optimizationFileManagers: Record<string, OptimizationFileManager>;
  siteName?: string;
  sitemapInventoryLinks?: PromptBulkSitemapInventoryLink[];
  siteKwHostedLink?: BulkGscKeywordsHostedLink | null;
  sitemapInventoryLoading?: boolean;
};

export function buildMultiSiteBulkGeneratorDetailsProps(
  input: MultiSiteBulkDetailsInput,
  workspaceBusy: boolean,
): BulkGeneratorDetailsPanelProps | null {
  if (!isOverviewBulkDetailsRun(input.bulkState)) return null;
  const base = buildContentOptimizerBulkGeneratorDetailsProps(input, workspaceBusy);
  const pipelineSectionTitles = resolveOverviewBulkPipelineTitles(input.bulkState.runKind, input.bulkState);
  return attachInventoryProps(
    base,
    {
      sitemapInventoryLinks: input.sitemapInventoryLinks,
      siteKwHostedLink: input.siteKwHostedLink,
      sitemapInventoryLoading: input.sitemapInventoryLoading,
      sitemapSource: undefined,
    },
    pipelineSectionTitles,
  );
}
