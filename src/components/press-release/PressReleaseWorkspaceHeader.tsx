import { Input } from "@/components/ui/input";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import { GeneratorToolbarFrame } from "@/components/blog-generator/GeneratorToolbarFrame";
import {
  GENERATOR_FIELD_KEYWORD,
  GENERATOR_FIELD_TITLE,
} from "@/components/blog-generator/generator-toolbar-theme";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import { BulkGeneratorRunActions } from "@/components/keyword-research/bulk/BulkGeneratorRunActions";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import { PressReleaseContentDetailsDrawer } from "@/components/press-release/PressReleaseContentDetailsDrawer";
import type { PressReleaseDetailsPanelProps } from "@/components/press-release/PressReleaseDetailsPanel";

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
  onDetailsOpenChange?: (open: boolean) => void;
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
  onDetailsOpenChange,
}: PressReleaseWorkspaceHeaderProps) {
  return (
    <BlogGeneratorWorkspaceChrome
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionSwitchDisabled={isProcessing}
      workspaceBusy={workspaceBusy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId="press-release-details-panel"
      onDetailsOpenChange={onDetailsOpenChange}
      toolbar={
        <GeneratorToolbarFrame
          primary={
            <>
              <Input
                type="text"
                placeholder="Keyword"
                value={keyword}
                onChange={(e) => onKeywordChange(e.target.value)}
                className={GENERATOR_FIELD_KEYWORD}
                disabled={workspaceBusy}
                autoComplete="off"
                aria-label="Keyword"
              />
              <Input
                type="text"
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                className={GENERATOR_FIELD_TITLE}
                disabled={workspaceBusy}
                autoComplete="off"
                aria-label="Title override"
              />
            </>
          }
          actions={
            <BulkGeneratorRunActions
              isProcessing={isProcessing}
              canRun={canRun}
              workspaceBusy={workspaceBusy}
              onRun={onRun}
              onCancel={() => {}}
              onClear={onClear}
              runLabel="Generate"
            />
          }
        />
      }
      detailsPanel={
        <PressReleaseContentDetailsDrawer {...detailsProps} workspaceBusy={workspaceBusy} />
      }
    />
  );
}
