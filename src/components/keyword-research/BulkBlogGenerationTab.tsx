import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BulkAutoGeneratePanel } from "./BulkAutoGeneratePanel";
import { BLOG_GENERATOR_TAB_ROOT_CLASS, BLOG_GENERATOR_WORKSPACE_BODY_CLASS, BLOG_GENERATOR_WORKSPACE_HEADER_CLASS, BULK_GENERATOR_EMPTY_ROW_COUNT } from "@/components/keyword-research/blog-generator-tab-classes";
import { WORKSPACE_DETAILS_DIM_OVERLAY_CLASS } from "@/components/overview/overview-tab/overview-tab-content-constants";
import { cn } from "@/lib/utils";
import { BlogImportWorkspaceHeader } from "@/components/keyword-research/bulk/BlogImportWorkspaceHeader";
import { BulkCsvRunProgressGrid } from "@/components/keyword-research/bulk/BulkCsvRunProgressGrid";
import { BulkCsvWorkspaceHeader } from "@/components/keyword-research/bulk/BulkCsvWorkspaceHeader";
import { BulkPromptWorkspaceHeader } from "@/components/keyword-research/bulk/BulkPromptWorkspaceHeader";
import { BulkGeneratorScheduleMenu } from "@/components/keyword-research/bulk/BulkGeneratorScheduleMenu";
import { BulkGeneratorSitemapMenu } from "@/components/keyword-research/bulk/BulkGeneratorSitemapMenu";
import type { BulkGeneratorWorkspaceBindings } from "@/components/keyword-research/bulk/bulk-generator-workspace-bindings";
import type { BulkGeneratedFile } from "@/lib/bulk-file-manager";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import type { CSVRow } from "@/lib/bulk-auto-generate";
import {
  BLOG_IMPORT_POST_DESTINATION_CHOICES,
  BULK_POST_DESTINATION_CHOICES,
} from "@/lib/bulk-auto-generate";
import type { BlogImportFeaturedImage } from "@/lib/bulk/blog-import-parser";
import {
  buildBlogImportPlaceholderRow,
} from "@/lib/bulk/blog-import-openrouter-run";
import {
  blogImportHeaderProgressFromBulk,
  buildBlogImportMicroSnapshot,
} from "@/lib/bulk/blog-import-header-progress";
import { countBulkCsvRowsDone } from "@/lib/bulk/bulk-csv-row-run-status";
import { PressReleaseTab } from "@/components/keyword-research/PressReleaseTab";
import { PressReleaseWorkspaceBody } from "@/components/press-release/PressReleaseWorkspaceBody";
import { PressReleaseWorkspaceHeader } from "@/components/press-release/PressReleaseWorkspaceHeader";
import {
  buildPressReleaseMicroSnapshot,
  pressReleaseHeaderProgressFromState,
} from "@/lib/press-release/press-release-header-progress";
import { notify } from "@/lib/app-notifications";
import { notifyLoadedCsvX } from "@/lib/notify-messages";

export interface BulkBlogGenerationTabProps {
  variant: "csv" | "prompt" | "blog-import" | "press-release";
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  openRouterApiKey?: string;
  /** DataForSEO key for keyword research (CSV, Prompt, Blog import). */
  dataForSEOApiKey?: string;
  /** @deprecated Use dataForSEOApiKey */
  pressReleaseDataForSeoApiKey?: string;
  selectedModel?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  flowPurpose?: string;
}

const PROGRESS_LABELS = {
  csv: "CSV",
  prompt: "Prompt",
  "blog-import": "Import",
  "press-release": "PR",
} as const;

export function BulkBlogGenerationTab({
  variant,
  activeSection,
  onSectionChange,
  openRouterApiKey,
  dataForSEOApiKey,
  pressReleaseDataForSeoApiKey,
  selectedModel,
  temperature,
  maxTokens,
  topP,
  flowPurpose,
}: BulkBlogGenerationTabProps) {
  const effectiveDataForSeoApiKey = dataForSEOApiKey ?? pressReleaseDataForSeoApiKey;

  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);

  const isCsv = variant === "csv";
  const isBlogImport = variant === "blog-import";
  const isPrompt = variant === "prompt";
  const isPressRelease = variant === "press-release";

  const [importedRows, setImportedRows] = useState<CSVRow[]>([]);
  const [uploadedImportFile, setUploadedImportFile] = useState<File | null>(null);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [focusKeyword, setFocusKeyword] = useState("");
  const [titleOverride, setTitleOverride] = useState("");
  const [featuredImageMode, setFeaturedImageMode] = useState<BlogImportFeaturedImage>("y");
  const [entity, setEntity] = useState("");
  const [bulkBindings, setBulkBindings] = useState<BulkGeneratorWorkspaceBindings | null>(null);
  const [pressReleaseBindings, setPressReleaseBindings] =
    useState<PressReleaseWorkspaceBindings | null>(null);

  const importForm = useMemo(
    () => ({ focusKeyword, titleOverride, featuredImageMode, entity }),
    [focusKeyword, titleOverride, featuredImageMode, entity],
  );

  const handleImportClear = useCallback(() => {
    setUploadedImportFile(null);
    setImportedRows([]);
    setImportedFileName(null);
    setFocusKeyword("");
    setTitleOverride("");
    setFeaturedImageMode("y");
    setEntity("");
  }, [importedFileName, importedRows.length]);

  useEffect(() => {
    if (!uploadedImportFile || !importedFileName) return;
    setImportedRows([buildBlogImportPlaceholderRow(importedFileName, importForm)]);
  }, [uploadedImportFile, importedFileName, importForm]);

  const handlePickImportFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      setUploadedImportFile(file);
      setImportedFileName(file.name);
      setImportedRows([buildBlogImportPlaceholderRow(file.name, importForm)]);
    },
    [importForm],
  );

  const onBulkGeneratorWorkspaceBindings = useCallback((bindings: BulkGeneratorWorkspaceBindings) => {
    setBulkBindings(bindings);
  }, []);

  const onPressReleaseWorkspaceBindings = useCallback((bindings: PressReleaseWorkspaceBindings) => {
    setPressReleaseBindings(bindings);
  }, []);

  const workspaceBusy = isPressRelease
    ? Boolean(pressReleaseBindings?.isProcessing)
    : Boolean(bulkBindings?.isProcessing) ||
      Boolean(bulkBindings?.isGeneratingChecklist);

  const headerProgress = useMemo(() => {
    if (isPressRelease) {
      return pressReleaseHeaderProgressFromState({
        isProcessing: Boolean(pressReleaseBindings?.isProcessing),
        runPhase: pressReleaseBindings?.runPhase,
        harnessSections: pressReleaseBindings?.harnessSections ?? [],
        harnessPlannedSectionCount: pressReleaseBindings?.harnessPlannedSectionCount ?? null,
      });
    }
    return blogImportHeaderProgressFromBulk({
      status: bulkBindings?.status,
      isProcessing: bulkBindings?.isProcessing,
      harnessSections: bulkBindings?.harnessSections,
      harnessPlannedSectionCount: bulkBindings?.harnessPlannedSectionCount,
      currentRow: bulkBindings?.currentRow ?? 0,
      batchRowProgress:
        (isPrompt || isBlogImport) &&
        Boolean(bulkBindings?.isProcessing) &&
        (bulkBindings?.totalRows ?? 0) > 0
          ? {
              current: bulkBindings!.currentRow,
              total: bulkBindings!.totalRows,
            }
          : undefined,
      csvRowProgress:
        isCsv &&
        Boolean(bulkBindings?.isProcessing) &&
        (bulkBindings?.displayRows.length ?? 0) > 0
          ? {
              total: bulkBindings!.displayRows.length,
              done: countBulkCsvRowsDone({
                totalRows: bulkBindings!.displayRows.length,
                currentRow: bulkBindings!.currentRow,
                isProcessing: true,
                filesByRow: bulkBindings!.filesByRow,
                failedRowIndices: bulkBindings!.failedRowIndices,
              }),
            }
          : undefined,
    });
  }, [isPressRelease, pressReleaseBindings, bulkBindings, isCsv, isPrompt, isBlogImport]);

  const progressSnapshot = useMemo(() => {
    if (isBlogImport) return null;
    if (isPressRelease) {
      return buildPressReleaseMicroSnapshot(headerProgress);
    }
    return buildBlogImportMicroSnapshot(headerProgress, PROGRESS_LABELS[variant]);
  }, [headerProgress, variant, isPressRelease, isBlogImport]);

  const postDestinationChoices = isBlogImport
    ? BLOG_IMPORT_POST_DESTINATION_CHOICES
    : BULK_POST_DESTINATION_CHOICES;

  const postDestination = bulkBindings?.bulkPostDestination ?? (isBlogImport ? "local" : "wordpress");

  const wpConfig = bulkBindings
    ? {
        selectedWordPressSites: bulkBindings.selectedWordPressSites,
        setSelectedWordPressSites: bulkBindings.setSelectedWordPressSites,
        siteConfigs: bulkBindings.siteConfigs,
        setSiteConfigs: bulkBindings.setSiteConfigs,
        scheduleFrequency: bulkBindings.scheduleFrequency,
        setScheduleFrequency: bulkBindings.setScheduleFrequency,
        customInterval: bulkBindings.customInterval,
        setCustomInterval: bulkBindings.setCustomInterval,
        dayOfWeek: bulkBindings.dayOfWeek,
        setDayOfWeek: bulkBindings.setDayOfWeek,
        startDateOption: bulkBindings.startDateOption,
        setStartDateOption: bulkBindings.setStartDateOption,
        customStartDate: bulkBindings.customStartDate,
        setCustomStartDate: bulkBindings.setCustomStartDate,
        startTime: bulkBindings.startTime,
        setStartTime: bulkBindings.setStartTime,
        useCsvPublishDates: bulkBindings.useCsvPublishDates,
        setUseCsvPublishDates: bulkBindings.setUseCsvPublishDates,
        wordpressDraftOnly: bulkBindings.wordpressDraftOnly,
        setWordpressDraftOnly: bulkBindings.setWordpressDraftOnly,
        previewRows: bulkBindings.previewRows,
        rowOrder: bulkBindings.rowOrder,
        setRowOrder: bulkBindings.setRowOrder,
        connectedSite: bulkBindings.connectedSite,
        postDestination: bulkBindings.bulkPostDestination,
        setPostDestination: bulkBindings.setBulkPostDestination,
        postDestinationChoices,
        scheduleOccupancy: bulkBindings.scheduleOccupancy,
        scheduleOccupancyLoading: bulkBindings.scheduleOccupancyLoading,
      }
    : null;

  const sitemapMenu = useMemo(() => {
    if (!bulkBindings || isPressRelease) return null;
    if (!isCsv && !isPrompt) return null;
    return (
      <BulkGeneratorSitemapMenu
        postDestination={postDestination}
        connectedSite={bulkBindings.connectedSite}
        selectedWordPressSites={bulkBindings.selectedWordPressSites}
        siteConfigs={bulkBindings.siteConfigs}
        setSiteConfigs={bulkBindings.setSiteConfigs}
        onSwitchToCustom={bulkBindings.onSwitchToCustom}
        isDisabled={workspaceBusy}
      />
    );
  }, [bulkBindings, isCsv, isPrompt, isPressRelease, postDestination, workspaceBusy]);

  const csvSitemapGridProps = useMemo(() => {
    if (!bulkBindings) {
      return {
        sitemapMode: "post" as const,
        siteFallbackSitemapType: "post" as const,
        onRowSitemapChange: undefined,
        sitemapControlDisabled: true,
      };
    }
    return {
      sitemapMode: bulkBindings.sitemapMode,
      siteFallbackSitemapType: bulkBindings.siteFallbackSitemapType,
      onRowSitemapChange: bulkBindings.onRowSitemapChange,
      sitemapControlDisabled: workspaceBusy,
    };
  }, [bulkBindings, workspaceBusy]);

  const scheduleMenu = useMemo(() => {
    if (!bulkBindings) return null;
    const useGapScheduling =
      bulkBindings.startDateOption === "immediate" &&
      postDestination !== "local" &&
      bulkBindings.scheduleFrequency !== "immediately" &&
      Boolean(bulkBindings.scheduleOccupancy);
    return (
      <BulkGeneratorScheduleMenu
        postDestination={postDestination}
        inventoryDownloadFileName={null}
        scheduleFrequency={bulkBindings.scheduleFrequency}
        setScheduleFrequency={bulkBindings.setScheduleFrequency}
        customInterval={bulkBindings.customInterval}
        setCustomInterval={bulkBindings.setCustomInterval}
        dayOfWeek={bulkBindings.dayOfWeek}
        setDayOfWeek={bulkBindings.setDayOfWeek}
        startDateOption={bulkBindings.startDateOption}
        setStartDateOption={bulkBindings.setStartDateOption}
        customStartDate={bulkBindings.customStartDate}
        setCustomStartDate={bulkBindings.setCustomStartDate}
        startTime={bulkBindings.startTime}
        setStartTime={bulkBindings.setStartTime}
        useCsvPublishDates={bulkBindings.useCsvPublishDates}
        setUseCsvPublishDates={bulkBindings.setUseCsvPublishDates}
        wordpressDraftOnly={bulkBindings.wordpressDraftOnly}
        setWordpressDraftOnly={bulkBindings.setWordpressDraftOnly}
        useGapScheduling={useGapScheduling}
        scheduleOccupancyLoading={bulkBindings.scheduleOccupancyLoading}
        isDisabled={workspaceBusy}
      />
    );
  }, [bulkBindings, postDestination, workspaceBusy]);

  const placeholderOnlyBody =
    (isCsv && (bulkBindings?.displayRows?.length ?? 0) < BULK_GENERATOR_EMPTY_ROW_COUNT) ||
    (isBlogImport && (bulkBindings?.displayRows?.length ?? 0) === 0) ||
    (isPrompt && !bulkBindings?.hasGeneratedChecklist) ||
    (isPressRelease && !pressReleaseBindings?.resultMarkdown);

  const pressReleaseEntryInFirstRow = isPressRelease && !pressReleaseBindings?.resultMarkdown;

  const baseDetailsProps = {
    workspaceBusy,
    headerProgress,
    isProcessing: Boolean(bulkBindings?.isProcessing),
    status: bulkBindings?.status ?? "",
    processingStepLog: bulkBindings?.processingStepLog ?? [],
    harnessSections: bulkBindings?.harnessSections ?? [],
    harnessByRow: bulkBindings?.harnessByRow ?? new Map(),
    harnessPlannedSectionCount: bulkBindings?.harnessPlannedSectionCount ?? null,
    currentRow: bulkBindings?.currentRow ?? 0,
    totalRows: bulkBindings?.totalRows ?? 0,
    displayRows: bulkBindings?.displayRows ?? [],
    postDestination,
    wpConfig,
  };

  const canOpenDetails = isPressRelease
    ? workspaceBusy ||
      Boolean(pressReleaseBindings?.inventoryJsonLink) ||
      Boolean(pressReleaseBindings?.resultMarkdown) ||
      Boolean(pressReleaseBindings?.keyword.trim()) ||
      Boolean(pressReleaseBindings?.title.trim())
    : workspaceBusy ||
      Boolean(importedFileName) ||
      Boolean(bulkBindings?.csvFileName) ||
      Boolean(bulkBindings?.hasGeneratedChecklist) ||
      (bulkBindings?.sitemapInventoryLinks?.length ?? 0) > 0 ||
      Boolean(bulkBindings?.siteKwHostedLink) ||
      Boolean(bulkBindings && bulkBindings.stats.completed > 0);

  const canRunCsv =
    Boolean((bulkBindings?.rows.length ?? 0) > 0 && !bulkBindings?.isProcessing);

  const canRunImport = Boolean(uploadedImportFile && !bulkBindings?.isProcessing);

  const blogContentFile = useMemo((): BulkGeneratedFile | undefined => {
    if (!bulkBindings) return undefined;
    const files = bulkBindings.filesByRow.get(bulkBindings.currentRow) ?? [];
    const completed = files.filter(
      (f) =>
        f.status === "completed" &&
        f.fileName.startsWith("content-") &&
        f.fileName.endsWith(".md"),
    );
    if (completed.length === 0) return undefined;
    return completed.reduce((latest, f) => (f.timestamp >= latest.timestamp ? f : latest));
  }, [bulkBindings?.filesByRow, bulkBindings?.currentRow]);

  const canDownloadBlog = Boolean(
    blogContentFile || bulkBindings?.runContentCsvAvailable,
  );

  const handleDownloadBlog = useCallback(() => {
    if (!bulkBindings) return;
    if (blogContentFile) {
      bulkBindings.downloadFile(blogContentFile);
      return;
    }
    if (bulkBindings.runContentCsvAvailable) {
      bulkBindings.downloadRunContentCsv();
    }
  }, [bulkBindings, blogContentFile]);

  const canRunPressRelease = Boolean(
    effectiveDataForSeoApiKey?.trim() &&
      openRouterApiKey?.trim() &&
      pressReleaseBindings?.keyword.trim() &&
      pressReleaseBindings?.wordPressSite &&
      !pressReleaseBindings?.isProcessing,
  );

  const handleCsvClear = () => {
    bulkBindings?.onClearCsv();
  };

  const handlePromptClear = () => {
    bulkBindings?.onClearPrompt();
  };

  const handleCsvPick = async (file: File | null) => {
    if (!file || !bulkBindings) return;
    try {
      await bulkBindings.onPickCsvFile(file);
      notify.success(notifyLoadedCsvX(file.name));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to load CSV");
    }
  };

  return (
    <div className={BLOG_GENERATOR_TAB_ROOT_CLASS}>
      <div className={BLOG_GENERATOR_WORKSPACE_HEADER_CLASS}>
        {isCsv ? (
          <BulkCsvWorkspaceHeader
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            workspaceBusy={workspaceBusy}
            progressSnapshot={progressSnapshot}
            canOpenDetails={canOpenDetails}
            isProcessing={Boolean(bulkBindings?.isProcessing)}
            csvFileName={bulkBindings?.csvFileName ?? null}
            rowCount={bulkBindings?.rows.length ?? 0}
            onPickCsvFile={handleCsvPick}
            postDestination={postDestination}
            onPostDestinationChange={(v) => bulkBindings?.setBulkPostDestination(v)}
            postDestinationChoices={postDestinationChoices}
            canRun={canRunCsv}
            onRun={() => void bulkBindings?.handleStartProcessing()}
            onCancel={() => bulkBindings?.cancelProcessing()}
            onClear={handleCsvClear}
            sitemapMenu={sitemapMenu}
            scheduleMenu={scheduleMenu}
            detailsProps={{
              ...baseDetailsProps,
              variant: "csv",
              csvFileName: bulkBindings?.csvFileName ?? null,
              rowCount: bulkBindings?.rows.length ?? 0,
              filesByRow: bulkBindings?.filesByRow,
              downloadFile: bulkBindings?.downloadFile,
              publishDateLabelByIndex: bulkBindings?.publishDateLabelByIndex,
              draftOnly: bulkBindings?.wordpressDraftOnly,
              directionsSiteName: bulkBindings?.connectedSite?.name,
            }}
            onDetailsOpenChange={setDetailsDrawerOpen}
          />
        ) : null}

        {isPrompt ? (
          <BulkPromptWorkspaceHeader
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            workspaceBusy={workspaceBusy}
            progressSnapshot={progressSnapshot}
            canOpenDetails={canOpenDetails}
            isProcessing={Boolean(bulkBindings?.isProcessing)}
            generalIntent={bulkBindings?.generalIntent ?? ""}
            onGeneralIntentChange={(v) => bulkBindings?.setGeneralIntent(v)}
            numberOfBlogs={bulkBindings?.numberOfBlogs ?? 3}
            onNumberOfBlogsChange={(v) => bulkBindings?.setNumberOfBlogs(v)}
            optionalPrompt={bulkBindings?.optionalPrompt ?? ""}
            onOptionalPromptChange={(v) => bulkBindings?.setOptionalPrompt(v)}
            featuredImagePerBlog={bulkBindings?.featuredImagePerBlog ?? true}
            onFeaturedImagePerBlogChange={(v) => bulkBindings?.setFeaturedImagePerBlog(v)}
            featuredImageType={bulkBindings?.featuredImageType ?? "ai-generated"}
            onFeaturedImageTypeChange={(v) => bulkBindings?.setFeaturedImageType(v)}
            isGeneratingChecklist={Boolean(bulkBindings?.isGeneratingChecklist)}
            hasGeneratedChecklist={Boolean(bulkBindings?.hasGeneratedChecklist)}
            onGenerateChecklist={() => void bulkBindings?.handleGenerateChecklist()}
            onApprove={() => void bulkBindings?.handleApprove()}
            postDestination={postDestination}
            onPostDestinationChange={(v) => bulkBindings?.setBulkPostDestination(v)}
            postDestinationChoices={postDestinationChoices}
            onCancel={() => bulkBindings?.cancelProcessing()}
            onClear={handlePromptClear}
            scheduleMenu={scheduleMenu}
            sitemapMenu={sitemapMenu}
            detailsProps={{
              ...baseDetailsProps,
              variant: "prompt",
              generatedRowCount: bulkBindings?.generatedRows.length ?? 0,
              selectedCount: bulkBindings?.selectedBlogIndices.size ?? 0,
              sitemapInventoryLinks: bulkBindings?.sitemapInventoryLinks ?? [],
              siteKwHostedLink: bulkBindings?.siteKwHostedLink ?? null,
              filesByRow: bulkBindings?.filesByRow,
              downloadFile: bulkBindings?.downloadFile,
              publishDateLabelByIndex: bulkBindings?.publishDateLabelByIndex,
              draftOnly: bulkBindings?.wordpressDraftOnly,
              directionsSiteName: bulkBindings?.connectedSite?.name,
            }}
            onDetailsOpenChange={setDetailsDrawerOpen}
          />
        ) : null}

        {isBlogImport ? (
          <BlogImportWorkspaceHeader
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            workspaceBusy={workspaceBusy}
            progressSnapshot={progressSnapshot}
            canOpenDetails={canOpenDetails}
            focusKeyword={focusKeyword}
            onFocusKeywordChange={setFocusKeyword}
            titleOverride={titleOverride}
            onTitleOverrideChange={setTitleOverride}
            featuredImageMode={featuredImageMode}
            onFeaturedImageModeChange={setFeaturedImageMode}
            entity={entity}
            onEntityChange={setEntity}
            isParsing={false}
            importedFileName={importedFileName}
            onPickFile={handlePickImportFile}
            postDestination={postDestination}
            onPostDestinationChange={(v) => bulkBindings?.setBulkPostDestination(v)}
            postDestinationChoices={postDestinationChoices}
            canRun={canRunImport}
            isProcessing={Boolean(bulkBindings?.isProcessing)}
            onRun={() => void bulkBindings?.handleStartProcessing()}
            onCancel={() => bulkBindings?.cancelProcessing()}
            onClear={handleImportClear}
            canDownloadBlog={canDownloadBlog}
            onDownloadBlog={handleDownloadBlog}
            scheduleMenu={scheduleMenu}
            detailsProps={{
              ...baseDetailsProps,
              variant: "blog-import",
              importedFileName,
              filesByRow: bulkBindings?.filesByRow,
              downloadFile: bulkBindings?.downloadFile,
              canDownloadBlog,
              onDownloadBlog: handleDownloadBlog,
              publishDateLabelByIndex: bulkBindings?.publishDateLabelByIndex,
              draftOnly: bulkBindings?.wordpressDraftOnly,
              directionsSiteName: bulkBindings?.connectedSite?.name,
            }}
            onDetailsOpenChange={setDetailsDrawerOpen}
          />
        ) : null}

        {isPressRelease ? (
          <PressReleaseWorkspaceHeader
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            workspaceBusy={workspaceBusy}
            progressSnapshot={progressSnapshot}
            canOpenDetails={canOpenDetails}
            isProcessing={Boolean(pressReleaseBindings?.isProcessing)}
            keyword={pressReleaseBindings?.keyword ?? ""}
            onKeywordChange={(v) => pressReleaseBindings?.setKeyword(v)}
            title={pressReleaseBindings?.title ?? ""}
            onTitleChange={(v) => pressReleaseBindings?.setTitle(v)}
            canRun={canRunPressRelease}
            onRun={() => pressReleaseBindings?.onRun()}
            onClear={() => pressReleaseBindings?.onClear()}
            entryInFirstRow={pressReleaseEntryInFirstRow}
            detailsProps={{
              isProcessing: Boolean(pressReleaseBindings?.isProcessing),
              runPhase: pressReleaseBindings?.runPhase ?? "",
              keyword: pressReleaseBindings?.keyword ?? "",
              title: pressReleaseBindings?.title ?? "",
              wordPressSite: pressReleaseBindings?.wordPressSite ?? null,
              harnessSections: pressReleaseBindings?.harnessSections ?? [],
              harnessPlannedSectionCount: pressReleaseBindings?.harnessPlannedSectionCount ?? null,
              inventoryJsonLink: pressReleaseBindings?.inventoryJsonLink ?? null,
            }}
            onDetailsOpenChange={setDetailsDrawerOpen}
          />
        ) : null}
      </div>

      <div
        className={cn(
          BLOG_GENERATOR_WORKSPACE_BODY_CLASS,
          "relative flex flex-col",
          placeholderOnlyBody && "overflow-y-hidden",
        )}
      >
        {detailsDrawerOpen ? (
          <div className={WORKSPACE_DETAILS_DIM_OVERLAY_CLASS} aria-hidden />
        ) : null}
        {isCsv ? (
          <BulkCsvRunProgressGrid
            displayRows={bulkBindings?.displayRows ?? []}
            filesByRow={bulkBindings?.filesByRow ?? new Map()}
            currentRow={bulkBindings?.currentRow ?? 0}
            isProcessing={Boolean(bulkBindings?.isProcessing)}
            processingStatus={bulkBindings?.status ?? ""}
            failedRowIndices={bulkBindings?.failedRowIndices ?? new Set()}
            failedRowMessages={bulkBindings?.failedRowMessages ?? {}}
            downloadFile={bulkBindings?.downloadFile ?? (() => {})}
            downloadRowFiles={bulkBindings?.downloadRowFiles ?? (() => {})}
            downloadRunContentCsv={bulkBindings?.downloadRunContentCsv ?? (() => {})}
            runContentCsvAvailable={bulkBindings?.runContentCsvAvailable ?? false}
            placeholderRowCount={BULK_GENERATOR_EMPTY_ROW_COUNT}
            sitemapMode={csvSitemapGridProps.sitemapMode}
            siteFallbackSitemapType={csvSitemapGridProps.siteFallbackSitemapType}
            onRowSitemapChange={csvSitemapGridProps.onRowSitemapChange}
            sitemapControlDisabled={csvSitemapGridProps.sitemapControlDisabled}
            onRowChange={bulkBindings?.onCsvRowChange}
            directionsSiteName={bulkBindings?.connectedSite?.name}
            publishDateLabelByIndex={bulkBindings?.publishDateLabelByIndex}
            draftOnly={
              Boolean(bulkBindings?.wordpressDraftOnly) &&
              (bulkBindings?.bulkPostDestination ?? "wordpress") !== "local"
            }
          />
        ) : null}

        {isBlogImport ? (
          <BulkCsvRunProgressGrid
            displayRows={bulkBindings?.displayRows ?? []}
            filesByRow={bulkBindings?.filesByRow ?? new Map()}
            currentRow={bulkBindings?.currentRow ?? 0}
            isProcessing={Boolean(bulkBindings?.isProcessing)}
            processingStatus={bulkBindings?.status ?? ""}
            failedRowIndices={bulkBindings?.failedRowIndices ?? new Set()}
            failedRowMessages={bulkBindings?.failedRowMessages ?? {}}
            downloadFile={bulkBindings?.downloadFile ?? (() => {})}
            downloadRowFiles={bulkBindings?.downloadRowFiles ?? (() => {})}
            downloadRunContentCsv={bulkBindings?.downloadRunContentCsv ?? (() => {})}
            runContentCsvAvailable={bulkBindings?.runContentCsvAvailable ?? false}
            placeholderRowCount={BULK_GENERATOR_EMPTY_ROW_COUNT}
            sitemapMode={csvSitemapGridProps.sitemapMode}
            siteFallbackSitemapType={csvSitemapGridProps.siteFallbackSitemapType}
            onRowSitemapChange={csvSitemapGridProps.onRowSitemapChange}
            sitemapControlDisabled={csvSitemapGridProps.sitemapControlDisabled}
            publishDateLabelByIndex={bulkBindings?.publishDateLabelByIndex}
            draftOnly={
              Boolean(bulkBindings?.wordpressDraftOnly) &&
              (bulkBindings?.bulkPostDestination ?? "wordpress") !== "local"
            }
          />
        ) : null}

        {isPressRelease ? (
          <>
            <PressReleaseTab
              pressReleaseWorkspace
              onPressReleaseWorkspaceBindings={onPressReleaseWorkspaceBindings}
              dataForSEOApiKey={effectiveDataForSeoApiKey ?? ""}
              openRouterApiKey={openRouterApiKey ?? ""}
              selectedModel={selectedModel}
              temperature={temperature}
              maxTokens={maxTokens}
              topP={topP}
            />
            {pressReleaseBindings ? (
              <PressReleaseWorkspaceBody
                keyword={pressReleaseBindings.keyword}
                onKeywordChange={(v) => pressReleaseBindings.setKeyword(v)}
                title={pressReleaseBindings.title}
                onTitleChange={(v) => pressReleaseBindings.setTitle(v)}
                workspaceBusy={workspaceBusy}
                isProcessing={pressReleaseBindings.isProcessing}
                canRun={canRunPressRelease}
                canOpenDetails={canOpenDetails}
                onRun={() => pressReleaseBindings.onRun()}
                onClear={() => pressReleaseBindings.onClear()}
                resultMarkdown={pressReleaseBindings.resultMarkdown}
                detailsProps={{
                  isProcessing: pressReleaseBindings.isProcessing,
                  runPhase: pressReleaseBindings.runPhase,
                  keyword: pressReleaseBindings.keyword,
                  title: pressReleaseBindings.title,
                  wordPressSite: pressReleaseBindings.wordPressSite,
                  harnessSections: pressReleaseBindings.harnessSections,
                  harnessPlannedSectionCount: pressReleaseBindings.harnessPlannedSectionCount,
                  inventoryJsonLink: pressReleaseBindings.inventoryJsonLink,
                }}
                placeholderRowCount={BULK_GENERATOR_EMPTY_ROW_COUNT}
              />
            ) : null}
          </>
        ) : (
          <BulkAutoGeneratePanel
            forcedInputMode={isBlogImport ? "csv" : variant}
            injectedRows={isBlogImport ? importedRows : undefined}
            blogImportSourceFile={isBlogImport ? uploadedImportFile : null}
            blogImportForm={isBlogImport ? importForm : undefined}
            apiKey={effectiveDataForSeoApiKey}
            openRouterApiKey={openRouterApiKey}
            selectedModel={selectedModel}
            temperature={temperature}
            maxTokens={maxTokens}
            topP={topP}
            flowPurpose={flowPurpose}
            initialBulkPostDestination={isBlogImport ? "local" : undefined}
            postDestinationChoices={isBlogImport ? BLOG_IMPORT_POST_DESTINATION_CHOICES : undefined}
            bulkGeneratorWorkspace
            onBulkGeneratorWorkspaceBindings={onBulkGeneratorWorkspaceBindings}
          />
        )}
      </div>
    </div>
  );
}
