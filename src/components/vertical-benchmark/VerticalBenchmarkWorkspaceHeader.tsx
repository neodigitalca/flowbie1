import { useMemo, useRef } from "react";
import { BarChart3, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { VerticalBenchmarkContentPills } from "@/components/vertical-benchmark/VerticalBenchmarkContentPills";
import { ContentOptimizerDetailsDrawer } from "@/components/overview/overview-tab/ContentOptimizerDetailsDrawer";
import {
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_SELECT,
  BULK_HEADER_TOOL_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  buildVerticalBenchmarkMicroSnapshot,
  verticalBenchmarkProgressBusy,
} from "@/lib/vertical-benchmark/vertical-benchmark-header-progress";
import { buildVerticalBenchmarkBulkGeneratorDetailsProps } from "@/lib/vertical-benchmark/vertical-benchmark-bulk-details-bindings";
import type { BenchmarkGridCsvContext } from "@/lib/vertical-benchmark/vertical-benchmark-grid-entity";
import type {
  BenchmarkInventoryHostedLink,
  BenchmarkPipelineProgress,
} from "@/lib/vertical-benchmark/vertical-benchmark-pipeline-types";
import type { ContentTypeFilter } from "@/hooks/vertical-benchmark/use-vertical-benchmark-controller";

const DETAILS_PANEL_ID = "vertical-benchmark-details-panel";

export type VerticalBenchmarkWorkspaceHeaderProps = {
  contentTypeFilter: ContentTypeFilter;
  onContentTypeFilterChange: (value: ContentTypeFilter) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  tagFilterOptions: string[];
  onCreateBulkTemplate: () => void | Promise<void>;
  onGridCsvFile: (file: File | null) => void | Promise<void>;
  onClearGridCsv: () => void;
  exporting: boolean;
  generatingBulkTemplate: boolean;
  busy: boolean;
  exportProgress: BenchmarkPipelineProgress | null;
  bulkTemplateProgress: BenchmarkPipelineProgress | null;
  bulkInventoryLinks: BenchmarkInventoryHostedLink[];
  gridCsvContext: BenchmarkGridCsvContext | null;
  gridCsvFileName: string | null;
  gridCsvParsing: boolean;
  rosterCount: number;
  selectedCount: number;
  onDetailsOpenChange?: (open: boolean) => void;
};

export function VerticalBenchmarkWorkspaceHeader({
  contentTypeFilter,
  onContentTypeFilterChange,
  tagFilter,
  onTagFilterChange,
  tagFilterOptions,
  onCreateBulkTemplate,
  onGridCsvFile,
  onClearGridCsv,
  exporting,
  generatingBulkTemplate,
  busy,
  exportProgress,
  bulkTemplateProgress,
  bulkInventoryLinks,
  gridCsvContext,
  gridCsvFileName,
  gridCsvParsing,
  rosterCount,
  selectedCount,
  onDetailsOpenChange,
}: VerticalBenchmarkWorkspaceHeaderProps) {
  const gridFileInputRef = useRef<HTMLInputElement>(null);

  const progressSnapshot = useMemo(
    () =>
      buildVerticalBenchmarkMicroSnapshot({
        exporting,
        generatingBulkTemplate,
        exportProgress,
        bulkTemplateProgress,
      }),
    [exporting, generatingBulkTemplate, exportProgress, bulkTemplateProgress],
  );

  const isProcessing = verticalBenchmarkProgressBusy({
    exporting,
    generatingBulkTemplate,
  });
  const canOpenDetails =
    busy ||
    bulkInventoryLinks.length > 0 ||
    Boolean(gridCsvContext) ||
    selectedCount > 0;

  const drawerProps = useMemo(
    () =>
      buildVerticalBenchmarkBulkGeneratorDetailsProps({
        busy,
        exporting,
        generatingBulkTemplate,
        exportProgress,
        bulkTemplateProgress,
        bulkInventoryLinks,
        selectedCount,
        rosterCount,
        tagFilter,
        gridCsvContext,
        gridCsvFileName,
        contentTypeFilter,
      }),
    [
      busy,
      exporting,
      generatingBulkTemplate,
      exportProgress,
      bulkTemplateProgress,
      bulkInventoryLinks,
      selectedCount,
      rosterCount,
      tagFilter,
      gridCsvContext,
      gridCsvFileName,
      contentTypeFilter,
    ],
  );

  return (
    <UnifiedWorkspaceChrome
      icon={BarChart3}
      title="Industry verticals"
      titleRowEnd={
        <VerticalBenchmarkContentPills
          contentTypeFilter={contentTypeFilter}
          onContentTypeFilterChange={onContentTypeFilterChange}
          disabled={busy}
        />
      }
      workspaceBusy={busy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId={DETAILS_PANEL_ID}
      onDetailsOpenChange={onDetailsOpenChange}
      detailsPanel={
        <ContentOptimizerDetailsDrawer postDestination="local" {...drawerProps} />
      }
      toolbar={
        <>
          <Select value={tagFilter} onValueChange={onTagFilterChange}>
            <SelectTrigger
              className={`${BULK_HEADER_SELECT} w-[11rem]`}
              aria-label="Filter by category tag"
            >
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-base">
                All categories
              </SelectItem>
              {tagFilterOptions.map((label) => (
                <SelectItem key={label} value={label} className="text-base">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={gridFileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void onGridCsvFile(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={BULK_HEADER_TOOL_BTN}
            disabled={gridCsvParsing}
            aria-label="Upload grid CSV"
            title="Upload Local Dominator grid CSV"
            onClick={() => gridFileInputRef.current?.click()}
          >
            {gridCsvParsing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            Grid
          </Button>
          {gridCsvContext ? (
            <span className="flex max-w-[12rem] items-center gap-1.5 text-base text-muted-foreground">
              <span className="truncate" title={gridCsvFileName ?? undefined}>
                {gridCsvFileName ?? "Grid"} ({gridCsvContext.matchedRowCount} rows)
              </span>
              <button
                type="button"
                className="shrink-0 text-primary underline-offset-2 hover:underline"
                onClick={onClearGridCsv}
              >
                Clear
              </button>
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            className={BULK_HEADER_RUN_BTN}
            disabled={busy}
            title="Curate bulk CSV from GSC for selected clients"
            onClick={() => void onCreateBulkTemplate()}
          >
            {generatingBulkTemplate ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : null}
            Curate
          </Button>
        </>
      }
    />
  );
}
