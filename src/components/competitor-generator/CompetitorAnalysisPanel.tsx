import React, { useCallback, useEffect, useMemo, useState } from "react";
import { notify } from "@/lib/app-notifications";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { WordPressSite } from "@/components/integrations/types";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import { CompetitorGeneratorWorkspaceHeader } from "@/components/competitor-generator/CompetitorGeneratorWorkspaceHeader";
import {
  COMPETITOR_DEFAULT_BUDGET,
  COMPETITOR_DEFAULT_BUDGET_INPUT,
  parseCompetitorBudgetInput,
} from "@/components/competitor-generator/competitor-budget-input";
import { BulkEntityWorkspaceBody } from "@/components/keyword-research/bulk/BulkEntityWorkspaceBody";
import { useCompetitorGeneration } from "@/components/competitor-generation/hooks/useCompetitorGeneration";
import { useCompetitorGridCsv } from "@/components/competitor-generation/hooks/useCompetitorGridCsv";
import type { CompetitorWorkspaceControls } from "@/components/competitor-generation/types";
import { buildCompetitorMicroSnapshot } from "@/lib/competitor-analysis/competitor-comparison-harness-state";
import { allRowIndicesSet } from "@/lib/bulk-processing-order";
import { downloadLocalAnalysisBulkCsv } from "@/lib/local-analysis-csv-export";
import { seedPromptBlogSlots, syncPromptBlogRowsToCount } from "@/lib/bulk/prompt-blog-slots";
import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
  SEO_WORKSPACE_INNER_CLASS,
} from "@/components/seo/seo-workspace-layout";
import { cn } from "@/lib/utils";

export type CompetitorAnalysisPanelProps = {
  site: WordPressSite;
  workspace: CompetitorWorkspaceControls;
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
};

export function CompetitorAnalysisPanel({
  site,
  workspace,
  activeSection,
  onSectionChange,
}: CompetitorAnalysisPanelProps) {
  const {
    gridPlaces,
    gridCsvName,
    csvParsing,
    loadGridCsvFile,
    clearGridCsv,
  } = useCompetitorGridCsv();

  const {
    isGenerating,
    progress,
    generatedRows,
    handleGenerate,
    clearResults,
    updateGeneratedRowAt,
  } = useCompetitorGeneration();

  const [sapPageBudgetInput, setSapPageBudgetInput] = useState(COMPETITOR_DEFAULT_BUDGET_INPUT);
  const [suggestFocusKeyword, setSuggestFocusKeyword] = useState("");
  const [entitySlotRows, setEntitySlotRows] = useState<CSVRow[]>(() =>
    seedPromptBlogSlots(COMPETITOR_DEFAULT_BUDGET),
  );
  const [entitySelectedRowIndices, setEntitySelectedRowIndices] = useState<Set<number>>(() => new Set());
  const parsedBudget = useMemo(
    () => parseCompetitorBudgetInput(sapPageBudgetInput),
    [sapPageBudgetInput],
  );

  useEffect(() => {
    if (generatedRows.length > 0) return;
    if (parsedBudget === null) {
      setEntitySlotRows([]);
      return;
    }
    setEntitySlotRows((prev) => syncPromptBlogRowsToCount(prev, parsedBudget));
  }, [parsedBudget, generatedRows.length]);

  const workspaceBusy = isGenerating || csvParsing;
  const hasGeneratedRows = generatedRows.length > 0;
  const displayRows = hasGeneratedRows ? generatedRows : entitySlotRows;
  const entityHasEmptyKeywordRow = displayRows.some((r) => !r.keyword?.trim());
  const hideIdleProgressTrack = !progress && (!hasGeneratedRows || entityHasEmptyKeywordRow);

  const progressSnapshot = useMemo(() => {
    if (!progress?.currentMessage?.trim()) return null;
    return buildCompetitorMicroSnapshot({
      phase: progress.currentMessage,
      harnessGroups: progress.harnessGroups ?? [],
    });
  }, [progress]);

  const gridUploadLabel = gridCsvName ?? "";

  const canOpenDetails = useMemo(
    () =>
      workspaceBusy ||
      Boolean(progress?.harnessGroups?.length) ||
      Boolean(gridUploadLabel.trim()) ||
      hasGeneratedRows ||
      gridPlaces.length > 0,
    [
      workspaceBusy,
      progress?.harnessGroups?.length,
      gridUploadLabel,
      hasGeneratedRows,
      gridPlaces.length,
    ],
  );

  const onDownloadTargetsCsv = useCallback(() => {
    if (generatedRows.length === 0) return;
    const siteName = site.name?.trim();
    if (!siteName) return;
    downloadLocalAnalysisBulkCsv(generatedRows, `competitor-${siteName}`, {
      marketHint: suggestFocusKeyword.trim() || undefined,
    });
  }, [generatedRows, site.name, suggestFocusKeyword]);

  const onRunClusters = useCallback(() => {
    const count = parseCompetitorBudgetInput(sapPageBudgetInput);
    if (count === null) {
      notify.error("Enter a competitor count.");
      return;
    }
    const keyword = suggestFocusKeyword.trim();
    if (!keyword) {
      notify.error("Enter a keyword.");
      return;
    }
    if (gridPlaces.length === 0) {
      notify.error("Upload a Local Dominator grid CSV first.");
      return;
    }
    void handleGenerate(site, gridPlaces, keyword, count, undefined, (rows) => {
      setEntitySelectedRowIndices(allRowIndicesSet(rows.length));
    });
  }, [
    handleGenerate,
    site,
    gridPlaces,
    sapPageBudgetInput,
    suggestFocusKeyword,
  ]);

  const onClear = useCallback(() => {
    clearGridCsv();
    clearResults();
    setSapPageBudgetInput(COMPETITOR_DEFAULT_BUDGET_INPUT);
    setEntitySlotRows(seedPromptBlogSlots(COMPETITOR_DEFAULT_BUDGET));
    setEntitySelectedRowIndices(new Set());
  }, [clearGridCsv, clearResults]);

  const onPickFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      const count = parseCompetitorBudgetInput(sapPageBudgetInput);
      if (count === null) {
        notify.error("Enter a competitor count before uploading a grid CSV.");
        return;
      }
      void (async () => {
        const loaded = await loadGridCsvFile(file, count, site);
        if (loaded.ok && loaded.keyword) {
          setSuggestFocusKeyword(loaded.keyword);
        }
      })();
    },
    [loadGridCsvFile, sapPageBudgetInput, site],
  );

  const updateSapRowAt = useCallback(
    (globalIdx: number, patch: Partial<CSVRow>) => {
      updateGeneratedRowAt(globalIdx, patch);
    },
    [updateGeneratedRowAt],
  );

  const updateEntitySlotRowAt = useCallback((globalIdx: number, patch: Partial<CSVRow>) => {
    setEntitySlotRows((prev) => {
      if (globalIdx < 0 || globalIdx >= prev.length) return prev;
      const next = [...prev];
      next[globalIdx] = { ...next[globalIdx], ...patch };
      return next;
    });
  }, []);

  const listRows = hasGeneratedRows ? generatedRows : entitySlotRows;

  return (
    <div className={cn(SEO_WORKSPACE_INNER_CLASS, "local-analysis-panel")}>
      <div className={SEO_WORKSPACE_HEADER_CLASS}>
        <CompetitorGeneratorWorkspaceHeader
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          workspace={workspace}
          workspaceBusy={workspaceBusy}
          progressSnapshot={progressSnapshot}
          hideIdleProgressTrack={hideIdleProgressTrack}
          canOpenDetails={canOpenDetails}
          isProcessing={workspaceBusy}
          csvParsing={csvParsing}
          uploadLabel={gridUploadLabel}
          sapPageBudgetInput={sapPageBudgetInput}
          onSapPageBudgetInputChange={setSapPageBudgetInput}
          suggestFocusKeyword={suggestFocusKeyword}
          onSuggestFocusKeywordChange={setSuggestFocusKeyword}
          runLoading={isGenerating}
          onPickFile={onPickFile}
          onRunClusters={onRunClusters}
          onClear={onClear}
          hasSapRowsForCsv={generatedRows.length > 0}
          onDownloadTargetsCsv={onDownloadTargetsCsv}
          detailsProps={{
            workspaceBusy,
            progress,
            displayRows: listRows,
            keyword: suggestFocusKeyword,
          }}
        />
      </div>

      <div
        className={cn(
          SEO_WORKSPACE_BODY_SCROLL_CLASS,
          "relative flex w-full min-w-0 flex-col",
          listRows.length === 0 && "overflow-y-hidden",
        )}
      >
        <BulkEntityWorkspaceBody
          hasGeneratedSapRows={hasGeneratedRows}
          generatedRows={listRows}
          selectedRowIndices={entitySelectedRowIndices}
          setSelectedRowIndices={setEntitySelectedRowIndices}
          isGenerating={isGenerating}
          isProcessing={workspaceBusy}
          showBusySpinner={false}
          onRowChange={hasGeneratedRows ? updateSapRowAt : updateEntitySlotRowAt}
          directionsSiteName={site.name?.trim() || ""}
        />
      </div>
    </div>
  );
}
