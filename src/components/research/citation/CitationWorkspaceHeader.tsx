import { useMemo } from "react";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import type { GeneratorWorkspaceChromeBindings } from "@/components/blog-generator/generator-workspace-chrome-bindings";
import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import { BULK_TOOLBAR_GROUP_DIVIDER } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { CitationDetailsPanel, type CitationDetailsPanelProps } from "@/components/research/citation/CitationDetailsPanel";
import { CitationToolbar, type CitationToolbarProps } from "@/components/research/citation/CitationToolbar";
import { ResearchToolbarModeMenu } from "@/components/research/ResearchToolbarModeMenu";
import { useResearchWorkspaceNav } from "@/components/research/ResearchWorkspaceNavContext";
import { buildCitationBulkGeneratorDetailsProps } from "@/lib/research/citation-bulk-details-bindings";
import { buildCitationMicroSnapshot } from "@/lib/research/citation-header-progress";

const DETAILS_PANEL_ID = "citation-details-panel";

export type CitationWorkspaceHeaderProps = GeneratorWorkspaceChromeBindings & {
  busy: boolean;
  canOpenDetails: boolean;
  toolbarProps: CitationToolbarProps;
  detailsProps: CitationDetailsPanelProps;
};

export function CitationWorkspaceHeader({
  activeSection,
  onSectionChange,
  onDetailsOpenChange,
  busy,
  canOpenDetails,
  toolbarProps,
  detailsProps,
}: CitationWorkspaceHeaderProps) {
  const researchNav = useResearchWorkspaceNav();
  const progressSnapshot = useMemo(() => buildCitationMicroSnapshot(busy), [busy]);
  const drawerProps = useMemo(
    () => buildCitationBulkGeneratorDetailsProps({ ...detailsProps, busy }),
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
          <CitationToolbar {...toolbarProps} />
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
