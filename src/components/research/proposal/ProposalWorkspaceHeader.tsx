import { useMemo } from "react";
import { FileStack } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import {
  ProposalDetailsPanel,
  type ProposalDetailsPanelProps,
} from "@/components/research/proposal/ProposalDetailsPanel";
import { ProposalToolbar, type ProposalToolbarProps } from "@/components/research/proposal/ProposalToolbar";
import { ResearchSectionPillsFromContext } from "@/components/research/ResearchSectionPillsFromContext";
import { buildProposalMicroSnapshot } from "@/lib/research/proposal-header-progress";
import type { ProposalProgressPhase, ProposalProgressSubphase } from "@/lib/research/proposal-header-progress";

const DETAILS_PANEL_ID = "proposal-details-panel";

export type ProposalWorkspaceHeaderProps = {
  busy: boolean;
  phase: ProposalProgressPhase;
  proposalSubphase: ProposalProgressSubphase;
  competitorPipelineStep: number;
  competitorPipelineLabel: string | null;
  localPipelineStep: number;
  localPipelineLabel: string | null;
  reportMicroLabel: string | null;
  reportProgressPct: number;
  canOpenDetails: boolean;
  toolbarProps: ProposalToolbarProps;
  detailsProps: ProposalDetailsPanelProps;
};

export function ProposalWorkspaceHeader({
  busy,
  phase,
  proposalSubphase,
  competitorPipelineStep,
  competitorPipelineLabel,
  localPipelineStep,
  localPipelineLabel,
  reportMicroLabel,
  reportProgressPct,
  canOpenDetails,
  toolbarProps,
  detailsProps,
}: ProposalWorkspaceHeaderProps) {
  const progressSnapshot = useMemo(
    () =>
      busy
        ? buildProposalMicroSnapshot({
            phase,
            proposalSubphase,
            competitorPipelineStep,
            competitorPipelineLabel,
            localPipelineStep,
            localPipelineLabel,
            reportMicroLabel,
            reportProgressPct,
          })
        : null,
    [
      busy,
      phase,
      proposalSubphase,
      competitorPipelineStep,
      competitorPipelineLabel,
      localPipelineStep,
      localPipelineLabel,
      reportMicroLabel,
      reportProgressPct,
    ],
  );

  return (
    <UnifiedWorkspaceChrome
      icon={FileStack}
      title="Proposal"
      titleRowEnd={<ResearchSectionPillsFromContext />}
      workspaceBusy={busy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={busy}
      detailsPanelId={DETAILS_PANEL_ID}
      toolbar={<ProposalToolbar {...toolbarProps} />}
      detailsPanel={<ProposalDetailsPanel {...detailsProps} />}
    />
  );
}
