import { TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import {
  GENERATOR_WORKSPACE_TITLE,
  type BlogGeneratorSectionId,
} from "@/components/blog-generator/blog-generator-sections";
import { CompetitorDetailsDrawer } from "@/components/competitor-generator/CompetitorDetailsDrawer";
import { CompetitorGeneratorToolbar } from "@/components/competitor-generator/CompetitorGeneratorToolbar";
import type { CompetitorWorkspaceControls } from "@/components/competitor-generation/types";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import { BULK_HEADER_FIELD } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { cn } from "@/lib/utils";
import type { CompetitorDetailsDrawerProps } from "@/components/competitor-generator/CompetitorDetailsDrawer";

export type CompetitorGeneratorWorkspaceHeaderProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  workspace: CompetitorWorkspaceControls;
  workspaceBusy: boolean;
  progressSnapshot: MetaBulkMicroSnapshot | null;
  hideIdleProgressTrack?: boolean;
  canOpenDetails: boolean;
  isProcessing: boolean;
  csvParsing: boolean;
  uploadLabel: string;
  sapPageBudgetInput: string;
  onSapPageBudgetInputChange: (v: string) => void;
  suggestFocusKeyword: string;
  onSuggestFocusKeywordChange: (v: string) => void;
  runLoading: boolean;
  onPickFile: (file: File | null) => void;
  onRunClusters: () => void;
  onClear: () => void;
  hasSapRowsForCsv: boolean;
  onDownloadTargetsCsv: () => void;
  detailsProps: CompetitorDetailsDrawerProps;
  detailsOpenSignal?: number | string | null;
  onDetailsOpenChange?: (open: boolean) => void;
};

export function CompetitorGeneratorWorkspaceHeader({
  activeSection,
  onSectionChange,
  workspace,
  workspaceBusy,
  progressSnapshot,
  hideIdleProgressTrack = false,
  canOpenDetails,
  isProcessing,
  csvParsing,
  uploadLabel,
  sapPageBudgetInput,
  onSapPageBudgetInputChange,
  suggestFocusKeyword,
  onSuggestFocusKeywordChange,
  runLoading,
  onPickFile,
  onRunClusters,
  onClear,
  hasSapRowsForCsv,
  onDownloadTargetsCsv,
  detailsProps,
  detailsOpenSignal,
  onDetailsOpenChange,
}: CompetitorGeneratorWorkspaceHeaderProps) {
  const showTempUrl =
    workspace.mode === "temp" || (!workspace.showConnectedToggle && workspace.mode !== "connected");

  return (
    <BlogGeneratorWorkspaceChrome
      icon={TrendingUp}
      title={GENERATOR_WORKSPACE_TITLE}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionSwitchDisabled={isProcessing}
      titleRowMenu={
        showTempUrl ? (
          <div className="min-w-0 max-w-md">
            <Input
              type="url"
              className={cn(BULK_HEADER_FIELD, "font-mono text-base")}
              placeholder="https://example.com"
              value={workspace.tempSeedUrl}
              onChange={(e) => workspace.onTempSeedUrlChange(e.target.value)}
              disabled={workspaceBusy}
              aria-label="Website URL"
            />
          </div>
        ) : null
      }
      workspaceBusy={workspaceBusy}
      progressSnapshot={progressSnapshot}
      hideIdleProgressTrack={hideIdleProgressTrack}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId="competitor-generator-details-panel"
      detailsOpenSignal={detailsOpenSignal}
      onDetailsOpenChange={onDetailsOpenChange}
      toolbar={
        <CompetitorGeneratorToolbar
          workspaceBusy={workspaceBusy}
          csvParsing={csvParsing}
          uploadLabel={uploadLabel}
          sapPageBudgetInput={sapPageBudgetInput}
          onSapPageBudgetInputChange={onSapPageBudgetInputChange}
          suggestFocusKeyword={suggestFocusKeyword}
          onSuggestFocusKeywordChange={onSuggestFocusKeywordChange}
          runLoading={runLoading}
          onPickFile={onPickFile}
          onRunClusters={onRunClusters}
          onClear={onClear}
          hasSapRowsForCsv={hasSapRowsForCsv}
          onDownloadTargetsCsv={onDownloadTargetsCsv}
        />
      }
      detailsPanel={<CompetitorDetailsDrawer {...detailsProps} />}
    />
  );
}
