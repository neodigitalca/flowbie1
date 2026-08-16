import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type {
  BulkOptimizationState,
  OptimizationProgressState,
} from "@/hooks/content-optimization/use-optimization-state";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { BulkGeneratedFile } from "@/lib/bulk-file-manager";
import type { CSVRow } from "@/lib/bulk-auto-generate";
import {
  blogImportHeaderProgressFromBulk,
  buildBlogImportMicroSnapshot,
  type BlogImportHeaderProgress,
} from "@/lib/bulk/blog-import-header-progress";
import { mergeGeneratedFilesByName } from "@/lib/overview/overview-peer-csv-details";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import type { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { OptimizationFileManager as OptimizationFileManagerClass } from "@/lib/optimization-file-manager";

export type ContentOptimizerBulkGeneratorBindingsInput = {
  siteId: string;
  batchKey: string;
  bulkState: BulkOptimizationState;
  batchProgress?: OptimizationProgressState;
  siteProgress?: OptimizationProgressState;
  overviewRows: OverviewRow[];
  isOptimizingContent: Record<string, boolean>;
  optimizationFileManagers: Record<string, OptimizationFileManager>;
  siteName?: string;
};

const CONTENT_OPTIMIZER_RUN_LABEL = "Content Optimizer";

export function isContentOptimizerBulkRun(
  batchState: BulkOptimizationState | null | undefined,
): boolean {
  if (!batchState?.urls?.length) return false;
  const kind = batchState.runKind;
  return !kind || kind === "content";
}

function toHarnessUi(
  sections: OptimizationProgressState["harnessSections"] | undefined,
): BulkHarnessSectionUi[] {
  return (sections ?? []) as BulkHarnessSectionUi[];
}

export function contentOptimizerLiveStatus(
  input: Pick<
    ContentOptimizerBulkGeneratorBindingsInput,
    "bulkState" | "batchProgress" | "siteProgress"
  >,
): string {
  const siteMsg = input.siteProgress?.message?.trim();
  if (siteMsg) return siteMsg;
  const batchMsg = input.batchProgress?.message?.trim();
  if (batchMsg) return batchMsg;
  const bulkMsg = input.bulkState.currentStepProgress?.message?.trim();
  if (bulkMsg) return bulkMsg;
  return "";
}

function overviewRowByUrl(rows: OverviewRow[]): Map<string, OverviewRow> {
  const map = new Map<string, OverviewRow>();
  for (const row of rows) {
    const key = normalizePageUrlKey(row.url);
    if (key) map.set(key, row);
  }
  return map;
}

function overviewRowToCsvRow(
  row: OverviewRow | undefined,
  url: string,
  bulkState: BulkOptimizationState,
): CSVRow {
  const keyword =
    row?.focusKeyword?.trim() ||
    bulkState.urlKeywords?.[url]?.trim() ||
    "";
  return {
    keyword,
    title: row?.title?.trim() || row?.aiTitle?.trim() || url,
    meta_description: row?.metaDescription?.trim() || undefined,
    publish_date_gmt: row?.dateModifier?.trim() || row?.wpDateGmt?.trim() || undefined,
    destination_url: url,
    entity:
      bulkState.urlEntities?.[url] && bulkState.urlEntities[url] !== "N/A"
        ? String(bulkState.urlEntities[url])
        : undefined,
  };
}

function optimizationFilesToBulkGenerated(
  files: Array<{ name: string; content: string; mimeType: string }>,
  rowIndex: number,
  row: CSVRow,
): BulkGeneratedFile[] {
  const ts = Date.now();
  return files.map((file, fileIndex) => ({
    id: `co-${rowIndex}-${fileIndex}-${file.name}`,
    rowIndex,
    fileName: file.name,
    content: file.content,
    mimeType: file.mimeType,
    status: "completed" as const,
    timestamp: ts + fileIndex,
    rowData: {
      keyword: row.keyword,
      entity: row.entity,
      title: row.title,
      meta_description: row.meta_description,
    },
  }));
}

function buildFilesByRow(input: ContentOptimizerBulkGeneratorBindingsInput): Map<number, BulkGeneratedFile[]> {
  const { bulkState, siteId, siteProgress, optimizationFileManagers } = input;
  const urls = bulkState.urls ?? [];
  const rowByUrl = overviewRowByUrl(input.overviewRows);
  const activeUrl = bulkState.currentUrl?.trim();
  const activeKey = activeUrl ? normalizePageUrlKey(activeUrl) : "";
  const map = new Map<number, BulkGeneratedFile[]>();

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index]!;
    const row = overviewRowToCsvRow(rowByUrl.get(normalizePageUrlKey(url)), url, bulkState);
    const persisted = bulkState.urlGeneratedFiles?.[url] ?? [];
    const isActive = activeKey && normalizePageUrlKey(url) === activeKey;
    const live =
      isActive && siteProgress?.generatedFiles?.length
        ? siteProgress.generatedFiles.map((f) => ({
            name: f.name,
            content: f.content,
            mimeType: f.mimeType,
          }))
        : [];
    const merged = mergeGeneratedFilesByName(persisted, live);
    if (merged.length > 0) {
      map.set(index, optimizationFilesToBulkGenerated(merged, index, row));
    }
  }

  const fm = optimizationFileManagers[siteId];
  if (fm && fm.getFileCount() > 0 && activeUrl) {
    const activeIndex = urls.findIndex((u) => normalizePageUrlKey(u) === activeKey);
    if (activeIndex >= 0) {
      const row = overviewRowToCsvRow(
        rowByUrl.get(normalizePageUrlKey(urls[activeIndex]!)),
        urls[activeIndex]!,
        bulkState,
      );
      const fromFm = fm.getFiles().map((f) => ({
        name: f.name,
        content: f.content,
        mimeType: f.mimeType,
      }));
      const merged = mergeGeneratedFilesByName(
        map.get(activeIndex)?.map((f) => ({
          name: f.fileName,
          content: f.content,
          mimeType: f.mimeType,
        })) ?? [],
        fromFm,
      );
      map.set(activeIndex, optimizationFilesToBulkGenerated(merged, activeIndex, row));
    }
  }

  return map;
}

function buildHarnessByRow(
  bulkState: BulkOptimizationState,
): Map<number, BulkHarnessSectionUi[]> {
  const map = new Map<number, BulkHarnessSectionUi[]>();
  const urls = bulkState.urls ?? [];
  const byUrl = bulkState.urlHarnessSections ?? {};
  for (let index = 0; index < urls.length; index += 1) {
    const sections = byUrl[urls[index]!];
    if (sections?.length) {
      map.set(index, sections as BulkHarnessSectionUi[]);
    }
  }
  return map;
}

function resolveCurrentRow(bulkState: BulkOptimizationState): number {
  const urls = bulkState.urls ?? [];
  if (urls.length === 0) return 0;

  for (let i = 0; i < urls.length; i += 1) {
    if (bulkState.urlStatuses?.[urls[i]!] === "optimizing") return i;
  }

  const currentIndex = bulkState.currentIndex ?? 0;
  if (currentIndex >= 0 && currentIndex < urls.length) return currentIndex;

  const currentUrl = bulkState.currentUrl?.trim();
  if (currentUrl) {
    const idx = urls.findIndex((u) => normalizePageUrlKey(u) === normalizePageUrlKey(currentUrl));
    if (idx >= 0) return idx;
  }

  return 0;
}

function liveHarnessSections(
  input: ContentOptimizerBulkGeneratorBindingsInput,
): BulkHarnessSectionUi[] {
  return toHarnessUi(
    input.siteProgress?.harnessSections ?? input.batchProgress?.harnessSections,
  );
}

function harnessPlannedSectionCount(
  input: ContentOptimizerBulkGeneratorBindingsInput,
): number | null {
  const planned =
    input.siteProgress?.harnessPlannedSectionCount ??
    input.batchProgress?.harnessPlannedSectionCount ??
    null;
  return typeof planned === "number" && planned > 0 ? planned : null;
}

export function contentOptimizerHeaderProgressFromRun(
  input: ContentOptimizerBulkGeneratorBindingsInput,
): BlogImportHeaderProgress | null {
  const isProcessing = Boolean(
    input.isOptimizingContent[input.batchKey] || input.isOptimizingContent[input.siteId],
  );
  const status = contentOptimizerLiveStatus(input);
  if (!isProcessing && !status) return null;

  const totalRows = input.bulkState.urls?.length ?? 0;
  const currentRow = resolveCurrentRow(input.bulkState);

  return blogImportHeaderProgressFromBulk({
    status,
    isProcessing,
    harnessSections: liveHarnessSections(input),
    harnessPlannedSectionCount: harnessPlannedSectionCount(input),
    currentRow,
    batchRowProgress:
      isProcessing && totalRows > 0
        ? { current: currentRow, total: totalRows }
        : undefined,
  });
}

export function buildContentOptimizerBulkMicroSnapshot(
  input: ContentOptimizerBulkGeneratorBindingsInput,
): MetaBulkMicroSnapshot | null {
  const headerProgress = contentOptimizerHeaderProgressFromRun(input);
  const siteSuffix = input.siteName?.trim() ? ` - ${input.siteName.trim()}` : "";
  return buildBlogImportMicroSnapshot(headerProgress, `${CONTENT_OPTIMIZER_RUN_LABEL}${siteSuffix}`);
}

export function buildContentOptimizerBulkGeneratorDetailsProps(
  input: ContentOptimizerBulkGeneratorBindingsInput,
  workspaceBusy: boolean,
): BulkGeneratorDetailsPanelProps {
  const urls = input.bulkState.urls ?? [];
  const rowByUrl = overviewRowByUrl(input.overviewRows);
  const displayRows = urls.map((url) =>
    overviewRowToCsvRow(rowByUrl.get(normalizePageUrlKey(url)), url, input.bulkState),
  );
  const currentRow = resolveCurrentRow(input.bulkState);
  const isProcessing = Boolean(
    input.isOptimizingContent[input.batchKey] || input.isOptimizingContent[input.siteId],
  );
  const status = contentOptimizerLiveStatus(input);
  const headerProgress = contentOptimizerHeaderProgressFromRun(input);
  const downloadManager = new OptimizationFileManagerClass();

  return {
    variant: "csv",
    workspaceBusy,
    headerProgress,
    isProcessing,
    status,
    harnessSections: liveHarnessSections(input),
    harnessByRow: buildHarnessByRow(input.bulkState),
    batchPrepHarnessSections: [],
    harnessPlannedSectionCount: harnessPlannedSectionCount(input),
    currentRow,
    totalRows: urls.length,
    displayRows,
    postDestination: "wordpress",
    wpConfig: null,
    filesByRow: buildFilesByRow(input),
    downloadFile: (file) => {
      downloadManager.downloadFile({
        name: file.fileName,
        content: file.content,
        mimeType: file.mimeType,
      });
    },
  };
}
