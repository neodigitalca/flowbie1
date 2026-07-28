import { useMemo } from "react";
import { Link2 } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import {
  BacklinkingDetailsPanel,
  type BacklinkingDetailsPanelProps,
} from "@/components/research/backlinking/BacklinkingDetailsPanel";
import { BacklinkingToolbar, type BacklinkingToolbarProps } from "@/components/research/backlinking/BacklinkingToolbar";
import { ResearchSectionPillsFromContext } from "@/components/research/ResearchSectionPillsFromContext";
import { buildBacklinkingMicroSnapshot } from "@/lib/research/backlinking-header-progress";

const DETAILS_PANEL_ID = "backlinking-details-panel";

export type BacklinkingWorkspaceHeaderProps = {
  busy: boolean;
  loadingHint: string | null;
  canOpenDetails: boolean;
  toolbarProps: BacklinkingToolbarProps;
  detailsProps: BacklinkingDetailsPanelProps;
};

export function BacklinkingWorkspaceHeader({
  busy,
  loadingHint,
  canOpenDetails,
  toolbarProps,
  detailsProps,
}: BacklinkingWorkspaceHeaderProps) {
  const progressSnapshot = useMemo(
    () => buildBacklinkingMicroSnapshot(busy, loadingHint),
    [busy, loadingHint],
  );

  return (
    <UnifiedWorkspaceChrome
      icon={Link2}
      title="Backlinking"
      titleRowEnd={<ResearchSectionPillsFromContext />}
      workspaceBusy={busy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={busy}
      detailsPanelId={DETAILS_PANEL_ID}
      toolbar={<BacklinkingToolbar {...toolbarProps} />}
      detailsPanel={<BacklinkingDetailsPanel {...detailsProps} />}
    />
  );
}
