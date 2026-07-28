import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { BlogGeneratorSectionPills } from "@/components/blog-generator/BlogGeneratorSectionPills";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";

export type BlogGeneratorWorkspaceChromeProps = {
  icon: LucideIcon;
  title: string;
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  sectionSwitchDisabled?: boolean;
  titleRowMenu?: ReactNode;
  workspaceBusy: boolean;
  progressBand?: "full" | "empty";
  progressSnapshot?: MetaBulkMicroSnapshot | null;
  hideIdleProgressTrack?: boolean;
  canOpenDetails?: boolean;
  isProcessing?: boolean;
  detailsPanelId?: string;
  toolbar: ReactNode | null;
  detailsPanel?: ReactNode;
  /** Hide the black toolbar band (entry controls live in the body grid). */
  hideToolbar?: boolean;
};

export function BlogGeneratorWorkspaceChrome({
  icon,
  title,
  activeSection,
  onSectionChange,
  sectionSwitchDisabled = false,
  titleRowMenu,
  workspaceBusy,
  progressBand = "full",
  progressSnapshot = null,
  hideIdleProgressTrack = false,
  canOpenDetails = false,
  isProcessing = false,
  detailsPanelId = "blog-generator-details",
  toolbar,
  detailsPanel = null,
  hideToolbar = false,
}: BlogGeneratorWorkspaceChromeProps) {
  if (progressBand === "empty") {
    return (
      <UnifiedWorkspaceChrome
        icon={icon}
        title={title}
        titleRowMenu={titleRowMenu}
        titleRowEnd={
          <BlogGeneratorSectionPills
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            disabled={sectionSwitchDisabled || workspaceBusy}
          />
        }
        toolbar={toolbar}
        hideToolbar={hideToolbar}
        workspaceBusy={workspaceBusy}
        progressBand="empty"
      />
    );
  }

  return (
    <UnifiedWorkspaceChrome
      icon={icon}
      title={title}
      titleRowMenu={titleRowMenu}
      titleRowEnd={
        <BlogGeneratorSectionPills
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          disabled={sectionSwitchDisabled || workspaceBusy}
        />
      }
      toolbar={toolbar}
      hideToolbar={hideToolbar}
      workspaceBusy={workspaceBusy}
      progressSnapshot={progressSnapshot}
      hideIdleProgressTrack={hideIdleProgressTrack}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId={detailsPanelId}
      detailsPanel={detailsPanel}
    />
  );
}
