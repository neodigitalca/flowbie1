import { useMemo } from "react";
import { FileText } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import {
  GscReportingDetailsPanel,
  type GscReportingDetailsPanelProps,
} from "@/components/research/reporting/GscReportingDetailsPanel";
import { GscReportingToolbar, type GscReportingToolbarProps } from "@/components/research/reporting/GscReportingToolbar";
import { buildGscReportingMicroSnapshot } from "@/lib/gsc-reporting/gsc-reporting-header-progress";
import type { GscReportingPipelineProgress } from "@/lib/gsc-reporting/gsc-reporting-types";

const DETAILS_PANEL_ID = "gsc-reporting-details-panel";

export type GscReportingWorkspaceHeaderProps = {
  busy: boolean;
  progress: GscReportingPipelineProgress | null;
  toolbarProps: GscReportingToolbarProps;
  detailsProps: GscReportingDetailsPanelProps;
  canOpenDetails: boolean;
};

export function GscReportingWorkspaceHeader({
  busy,
  progress,
  toolbarProps,
  detailsProps,
  canOpenDetails,
}: GscReportingWorkspaceHeaderProps) {
  const progressSnapshot = useMemo(
    () => (busy ? buildGscReportingMicroSnapshot(progress) : null),
    [busy, progress],
  );

  return (
    <UnifiedWorkspaceChrome
      icon={FileText}
      title="GSC Reporting"
      titleRowEnd={null}
      workspaceBusy={busy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={busy}
      detailsPanelId={DETAILS_PANEL_ID}
      toolbar={<GscReportingToolbar {...toolbarProps} />}
      detailsPanel={<GscReportingDetailsPanel {...detailsProps} />}
    />
  );
}
