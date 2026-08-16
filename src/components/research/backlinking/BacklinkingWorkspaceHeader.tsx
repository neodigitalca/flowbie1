import { useMemo } from "react";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import type { GeneratorWorkspaceChromeBindings } from "@/components/blog-generator/generator-workspace-chrome-bindings";
import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import { BULK_TOOLBAR_GROUP_DIVIDER } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  BacklinkingDetailsPanelProps,
} from "@/components/research/backlinking/BacklinkingDetailsPanel";
import { BacklinkingToolbar, type BacklinkingToolbarProps } from "@/components/research/backlinking/BacklinkingToolbar";
import { ResearchToolbarModeMenu } from "@/components/research/ResearchToolbarModeMenu";
import { useResearchWorkspaceNav } from "@/components/research/ResearchWorkspaceNavContext";
import { buildBacklinkingBulkGeneratorDetailsProps } from "@/lib/research/backlinking-bulk-details-bindings";
import { buildBacklinkingMicroSnapshot } from "@/lib/research/backlinking-header-progress";

const DETAILS_PANEL_ID = "backlinking-details-panel";

export type BacklinkingWorkspaceHeaderProps = GeneratorWorkspaceChromeBindings & {
  busy: boolean;
  loadingHint: string | null;
  canOpenDetails: boolean;
  toolbarProps: BacklinkingToolbarProps;
  detailsProps: BacklinkingDetailsPanelProps;
};

export function BacklinkingWorkspaceHeader({
  activeSection,
  onSectionChange,
  onDetailsOpenChange,
  busy,
  loadingHint,
  canOpenDetails,
  toolbarProps,
  detailsProps,
}: BacklinkingWorkspaceHeaderProps) {
  const researchNav = useResearchWorkspaceNav();
  const progressSnapshot = useMemo(
    () => buildBacklinkingMicroSnapshot(busy, loadingHint),
    [busy, loadingHint],
  );
  const drawerProps = useMemo(
    () => buildBacklinkingBulkGeneratorDetailsProps({ ...detailsProps, busy }),
    [detailsProps, busy],
  );

  return (
    <BlogGeneratorWorkspaceChrome
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionSwitchDisabled={busy}
      workspaceBusy={busy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={busy}
      detailsPanelId={DETAILS_PANEL_ID}
      onDetailsOpenChange={onDetailsOpenChange}
      toolbar={
        <>
          {researchNav ? (
            <ResearchToolbarModeMenu
              activeSection={researchNav.activeSection}
              onSectionChange={researchNav.onSectionChange}
              disabled={busy}
            />
          ) : (
            <div className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
          )}
          <BacklinkingToolbar {...toolbarProps} />
        </>
      }
      detailsPanel={
        <BulkGeneratorDetailsDrawer
          variant="csv"
          postDestination="local"
          wpConfig={null}
          {...drawerProps}
        />
      }
    />
  );
}
