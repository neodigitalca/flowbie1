import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { BlogGeneratorSectionPills } from "@/components/blog-generator/BlogGeneratorSectionPills";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { MetaBulkActionKey, BulkProgressSlice } from "@/components/overview/overview-tab-constants";

export type BlogGeneratorWorkspaceChromeProps = {
  icon: LucideIcon;
  title: string;
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  sectionSwitchDisabled?: boolean;
  showOpt?: boolean;
  titleRowMenu?: ReactNode;
  workspaceBusy: boolean;
  progressBand?: "full" | "empty";
  progressLeading?: ReactNode;
  progressSnapshot?: MetaBulkMicroSnapshot | null;
  bulkActionProgress?: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>;
  hideIdleProgressTrack?: boolean;
  canOpenDetails?: boolean;
  isProcessing?: boolean;
  detailsPanelId?: string;
  detailsPanel?: ReactNode;
  detailsOpenSignal?: number | string | null;
  onDetailsOpenChange?: (open: boolean) => void;
  toolbar: ReactNode | null;
  /** Hide the black toolbar band (entry controls live in the body grid). */
  hideToolbar?: boolean;
};

export function BlogGeneratorWorkspaceChrome({
  icon,
  title,
  activeSection,
  onSectionChange,
  sectionSwitchDisabled = false,
  showOpt = true,
  titleRowMenu,
  workspaceBusy,
  progressBand = "full",
  progressLeading,
  progressSnapshot = null,
  bulkActionProgress,
  hideIdleProgressTrack = false,
  canOpenDetails = false,
  isProcessing = false,
  detailsPanelId = "blog-generator-details",
  detailsPanel = null,
  detailsOpenSignal,
  onDetailsOpenChange,
  toolbar,
  hideToolbar = false,
}: BlogGeneratorWorkspaceChromeProps) {
  const sectionPills = (
    <BlogGeneratorSectionPills
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      disabled={sectionSwitchDisabled || workspaceBusy}
      showOpt={showOpt}
    />
  );

  if (progressBand === "empty") {
    return (
      <UnifiedWorkspaceChrome
        icon={icon}
        title={title}
        titleRowMenu={titleRowMenu}
        titleRowEnd={sectionPills}
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
      titleRowEnd={sectionPills}
      toolbar={toolbar}
      hideToolbar={hideToolbar}
      workspaceBusy={workspaceBusy}
      progressLeading={progressLeading}
      progressSnapshot={progressSnapshot}
      bulkActionProgress={bulkActionProgress}
      hideIdleProgressTrack={hideIdleProgressTrack}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId={detailsPanelId}
      detailsPanel={detailsPanel}
      detailsOpenSignal={detailsOpenSignal}
      onDetailsOpenChange={onDetailsOpenChange}
    />
  );
}
