import { useMemo } from "react";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import type { GeneratorWorkspaceChromeBindings } from "@/components/blog-generator/generator-workspace-chrome-bindings";
import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import { BULK_TOOLBAR_GROUP_DIVIDER } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  type ProposalDetailsPanelProps,
} from "@/components/research/proposal/ProposalDetailsPanel";
import { ProposalToolbar, type ProposalToolbarProps } from "@/components/research/proposal/ProposalToolbar";
import { ResearchToolbarModeMenu } from "@/components/research/ResearchToolbarModeMenu";
import { useResearchWorkspaceNav } from "@/components/research/ResearchWorkspaceNavContext";
import { buildProposalBulkGeneratorDetailsProps } from "@/lib/research/proposal-bulk-details-bindings";
import { buildProposalMicroSnapshot } from "@/lib/research/proposal-header-progress";
import type { ProposalProgressPhase, ProposalProgressSubphase } from "@/lib/research/proposal-header-progress";

const DETAILS_PANEL_ID = "proposal-details-panel";

export type ProposalWorkspaceHeaderProps = GeneratorWorkspaceChromeBindings & {
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
  activeSection,
  onSectionChange,
  onDetailsOpenChange,
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
  const researchNav = useResearchWorkspaceNav();
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

  const drawerProps = useMemo(
    () => buildProposalBulkGeneratorDetailsProps({ ...detailsProps, busy }),
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
          <ProposalToolbar {...toolbarProps} />
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
