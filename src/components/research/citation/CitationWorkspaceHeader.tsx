import { useMemo } from "react";
import { BookMarked } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { CitationDetailsPanel, type CitationDetailsPanelProps } from "@/components/research/citation/CitationDetailsPanel";
import { CitationToolbar, type CitationToolbarProps } from "@/components/research/citation/CitationToolbar";
import { ResearchSectionPillsFromContext } from "@/components/research/ResearchSectionPillsFromContext";
import { buildCitationMicroSnapshot } from "@/lib/research/citation-header-progress";

const DETAILS_PANEL_ID = "citation-details-panel";

export type CitationWorkspaceHeaderProps = {
  busy: boolean;
  canOpenDetails: boolean;
  toolbarProps: CitationToolbarProps;
  detailsProps: CitationDetailsPanelProps;
};

export function CitationWorkspaceHeader({
  busy,
  canOpenDetails,
  toolbarProps,
  detailsProps,
}: CitationWorkspaceHeaderProps) {
  const progressSnapshot = useMemo(() => buildCitationMicroSnapshot(busy), [busy]);

  return (
    <UnifiedWorkspaceChrome
      icon={BookMarked}
      title="Citation"
      titleRowEnd={<ResearchSectionPillsFromContext />}
      workspaceBusy={busy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={busy}
      detailsPanelId={DETAILS_PANEL_ID}
      toolbar={<CitationToolbar {...toolbarProps} />}
      detailsPanel={<CitationDetailsPanel {...detailsProps} />}
    />
  );
}
