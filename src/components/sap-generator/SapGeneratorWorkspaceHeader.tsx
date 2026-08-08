import { TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import {
  GENERATOR_WORKSPACE_TITLE,
  type BlogGeneratorSectionId,
} from "@/components/blog-generator/blog-generator-sections";
import { LocalAnalysisDetailsPanel } from "@/components/sap-generator/LocalAnalysisDetailsPanel";
import { EntityDetailsDrawer } from "@/components/sap-generator/EntityDetailsDrawer";
import { SapGeneratorToolbar } from "@/components/sap-generator/SapGeneratorToolbar";
import type { LocalAnalysisWorkspaceControls } from "@/components/sap-generator/LocalAnalysisPanel";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import { BULK_HEADER_FIELD } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { EntityGeographicLevel } from "@/lib/entity-geographic-level";
import { cn } from "@/lib/utils";

export type SapGeneratorWorkspaceHeaderProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  workspace: LocalAnalysisWorkspaceControls;
  workspaceBusy: boolean;
  progressSnapshot: MetaBulkMicroSnapshot | null;
  /** Hide idle progress track when Entity list still has empty rows/placeholders. */
  hideIdleProgressTrack?: boolean;
  canOpenDetails: boolean;
  isProcessing: boolean;
  csvParsing: boolean;
  uploadLabel: string;
  sapPageBudgetInput: string;
  onSapPageBudgetInputChange: (v: string) => void;
  suggestFocusKeyword: string;
  onSuggestFocusKeywordChange: (v: string) => void;
  suggestFocusLocation: string;
  onSuggestFocusLocationChange: (v: string) => void;
  runLoading: boolean;
  onPickFile: (file: File | null) => void;
  onRunClusters: () => void;
  onClear: () => void;
  entityGeographicLevel: EntityGeographicLevel;
  entityTypeFocus: string[];
  onEntityTypeFocusChange: (focus: string[]) => void;
  hasSapRowsForCsv: boolean;
  onDownloadTargetsCsv: () => void;
  detailsProps: Omit<
    React.ComponentProps<typeof LocalAnalysisDetailsPanel>,
    "workspaceBusy" | "headerProgress"
  > & {
    headerProgress: React.ComponentProps<typeof LocalAnalysisDetailsPanel>["headerProgress"];
  };
  onDetailsOpenChange?: (open: boolean) => void;
};

export function SapGeneratorWorkspaceHeader({
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
  suggestFocusLocation,
  onSuggestFocusLocationChange,
  runLoading,
  onPickFile,
  onRunClusters,
  onClear,
  entityGeographicLevel,
  entityTypeFocus,
  onEntityTypeFocusChange,
  hasSapRowsForCsv,
  onDownloadTargetsCsv,
  detailsProps,
  onDetailsOpenChange,
}: SapGeneratorWorkspaceHeaderProps) {
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
      detailsPanelId="sap-local-analysis-details-panel"
      onDetailsOpenChange={onDetailsOpenChange}
      toolbar={
        <SapGeneratorToolbar
          workspaceBusy={workspaceBusy}
          csvParsing={csvParsing}
          uploadLabel={uploadLabel}
          sapPageBudgetInput={sapPageBudgetInput}
          onSapPageBudgetInputChange={onSapPageBudgetInputChange}
          suggestFocusKeyword={suggestFocusKeyword}
          onSuggestFocusKeywordChange={onSuggestFocusKeywordChange}
          suggestFocusLocation={suggestFocusLocation}
          onSuggestFocusLocationChange={onSuggestFocusLocationChange}
          runLoading={runLoading}
          onPickFile={onPickFile}
          onRunClusters={onRunClusters}
          onClear={onClear}
          entityGeographicLevel={entityGeographicLevel}
          entityTypeFocus={entityTypeFocus}
          onEntityTypeFocusChange={onEntityTypeFocusChange}
          hasSapRowsForCsv={hasSapRowsForCsv}
          onDownloadTargetsCsv={onDownloadTargetsCsv}
        />
      }
      detailsPanel={
        <EntityDetailsDrawer workspaceBusy={workspaceBusy} {...detailsProps} />
      }
    />
  );
}
