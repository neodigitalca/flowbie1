import { TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import {
  GENERATOR_WORKSPACE_TITLE,
  type BlogGeneratorSectionId,
} from "@/components/blog-generator/blog-generator-sections";
import { BulkGeneratorRunActions } from "@/components/keyword-research/bulk/BulkGeneratorRunActions";
import { BULK_HEADER_FIELD } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import {
  PressReleaseDetailsPanel,
  type PressReleaseDetailsPanelProps,
} from "@/components/press-release/PressReleaseDetailsPanel";
import { cn } from "@/lib/utils";

export type PressReleaseWorkspaceHeaderProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  workspaceBusy: boolean;
  progressSnapshot: MetaBulkMicroSnapshot | null;
  canOpenDetails: boolean;
  isProcessing: boolean;
  keyword: string;
  onKeywordChange: (value: string) => void;
  title: string;
  onTitleChange: (value: string) => void;
  canRun: boolean;
  onRun: () => void;
  onClear: () => void;
  detailsProps: PressReleaseDetailsPanelProps;
  /** Keyword, title, and Details live in row 1 of the body grid. */
  entryInFirstRow?: boolean;
};

export function PressReleaseWorkspaceHeader({
  activeSection,
  onSectionChange,
  workspaceBusy,
  progressSnapshot,
  canOpenDetails,
  isProcessing,
  keyword,
  onKeywordChange,
  title,
  onTitleChange,
  canRun,
  onRun,
  onClear,
  detailsProps,
  entryInFirstRow = false,
}: PressReleaseWorkspaceHeaderProps) {
  const toolbar = entryInFirstRow ? null : (
    <>
      <Input
        type="text"
        placeholder="Keyword"
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        className={cn(BULK_HEADER_FIELD, "w-[10rem] shrink-0 text-base")}
        disabled={workspaceBusy}
        autoComplete="off"
        aria-label="Keyword"
      />
      <Input
        type="text"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className={cn(BULK_HEADER_FIELD, "w-[10rem] shrink-0 text-base")}
        disabled={workspaceBusy}
        autoComplete="off"
        aria-label="Title override"
      />
      <BulkGeneratorRunActions
        isProcessing={isProcessing}
        canRun={canRun}
        workspaceBusy={workspaceBusy}
        onRun={onRun}
        onCancel={() => {}}
        onClear={onClear}
        runLabel="Generate"
      />
    </>
  );

  return (
    <BlogGeneratorWorkspaceChrome
      icon={TrendingUp}
      title={GENERATOR_WORKSPACE_TITLE}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionSwitchDisabled={isProcessing}
      workspaceBusy={workspaceBusy}
      progressBand={entryInFirstRow ? "empty" : "full"}
      hideToolbar={entryInFirstRow}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId="press-release-details-panel"
      toolbar={toolbar}
      detailsPanel={<PressReleaseDetailsPanel {...detailsProps} />}
    />
  );
}
