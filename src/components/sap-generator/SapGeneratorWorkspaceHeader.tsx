import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import type { LocalAnalysisDetailsPanelProps } from "@/components/sap-generator/LocalAnalysisDetailsPanel";
import { EntityDetailsDrawer } from "@/components/sap-generator/EntityDetailsDrawer";
import { SapGeneratorToolbar } from "@/components/sap-generator/SapGeneratorToolbar";
import type { LocalAnalysisWorkspaceControls } from "@/components/sap-generator/LocalAnalysisPanel";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { EntityGeographicLevel } from "@/lib/entity-geographic-level";

export type SapGeneratorWorkspaceHeaderProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  workspace: LocalAnalysisWorkspaceControls;
  workspaceBusy: boolean;
  progressSnapshot: MetaBulkMicroSnapshot | null;
  hideIdleProgressTrack?: boolean;
  canOpenDetails: boolean;
  isProcessing: boolean;
  csvParsing: boolean;
  uploadLabel: string;
  entityAdGroupCountInput: string;
  onEntityAdGroupCountInputChange: (v: string) => void;
  entityAdsPerGroupInput: string;
  onEntityAdsPerGroupInputChange: (v: string) => void;
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
    LocalAnalysisDetailsPanelProps,
    "workspaceBusy" | "headerProgress"
  > & {
    headerProgress: LocalAnalysisDetailsPanelProps["headerProgress"];
  };
  onDetailsOpenChange?: (open: boolean) => void;
  detailsOpenSignal?: number | string | null;
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
  entityAdGroupCountInput,
  onEntityAdGroupCountInputChange,
  entityAdsPerGroupInput,
  onEntityAdsPerGroupInputChange,
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
  detailsOpenSignal,
}: SapGeneratorWorkspaceHeaderProps) {
  const showTempUrl =
    workspace.mode === "temp" || (!workspace.showConnectedToggle && workspace.mode !== "connected");

  return (
    <BlogGeneratorWorkspaceChrome
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionSwitchDisabled={isProcessing}
      workspaceBusy={workspaceBusy}
      progressSnapshot={progressSnapshot}
      hideIdleProgressTrack={hideIdleProgressTrack}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId="sap-local-analysis-details-panel"
      onDetailsOpenChange={onDetailsOpenChange}
      detailsOpenSignal={detailsOpenSignal}
      toolbar={
        <SapGeneratorToolbar
          workspaceBusy={workspaceBusy}
          csvParsing={csvParsing}
          uploadLabel={uploadLabel}
          entityAdGroupCountInput={entityAdGroupCountInput}
          onEntityAdGroupCountInputChange={onEntityAdGroupCountInputChange}
          entityAdsPerGroupInput={entityAdsPerGroupInput}
          onEntityAdsPerGroupInputChange={onEntityAdsPerGroupInputChange}
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
          showTempUrl={showTempUrl}
          tempSeedUrl={workspace.tempSeedUrl}
          onTempSeedUrlChange={workspace.onTempSeedUrlChange}
        />
      }
      detailsPanel={
        <EntityDetailsDrawer workspaceBusy={workspaceBusy} {...detailsProps} />
      }
    />
  );
}
