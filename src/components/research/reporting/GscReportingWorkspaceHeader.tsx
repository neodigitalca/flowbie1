import { useMemo } from "react";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import type { GeneratorWorkspaceChromeBindings } from "@/components/blog-generator/generator-workspace-chrome-bindings";
import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import {
  GscReportingDetailsPanel,
  type GscReportingDetailsPanelProps,
} from "@/components/research/reporting/GscReportingDetailsPanel";
import { GscReportingToolbar, type GscReportingToolbarProps } from "@/components/research/reporting/GscReportingToolbar";
import { buildGscReportingBulkGeneratorDetailsProps } from "@/lib/gsc-reporting/gsc-reporting-bulk-details-bindings";
import { buildGscReportingMicroSnapshot } from "@/lib/gsc-reporting/gsc-reporting-header-progress";
import type { GscReportingPipelineProgress } from "@/lib/gsc-reporting/gsc-reporting-types";
import type { GscReportingSectionPlan, GscReportingSectionResult } from "@/lib/gsc-reporting/gsc-reporting-types";

const DETAILS_PANEL_ID = "gsc-reporting-details-panel";

export type GscReportingWorkspaceHeaderProps = GeneratorWorkspaceChromeBindings & {
  busy: boolean;
  progress: GscReportingPipelineProgress | null;
  toolbarProps: GscReportingToolbarProps;
  detailsProps: GscReportingDetailsPanelProps;
  canOpenDetails: boolean;
  outlineSections?: GscReportingSectionPlan[];
  sectionMap?: Record<number, GscReportingSectionResult>;
  generatingSectionIndex?: number | null;
};

export function GscReportingWorkspaceHeader({
  activeSection,
  onSectionChange,
  onDetailsOpenChange,
  busy,
  progress,
  toolbarProps,
  detailsProps,
  canOpenDetails,
  outlineSections,
  sectionMap,
  generatingSectionIndex,
}: GscReportingWorkspaceHeaderProps) {
  const progressSnapshot = useMemo(
    () => (busy ? buildGscReportingMicroSnapshot(progress) : null),
    [busy, progress],
  );

  const drawerProps = useMemo(
    () =>
      buildGscReportingBulkGeneratorDetailsProps({
        ...detailsProps,
        outlineSections,
        sectionMap,
        generatingSectionIndex,
      }),
    [detailsProps, outlineSections, sectionMap, generatingSectionIndex],
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
      toolbar={<GscReportingToolbar {...toolbarProps} />}
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
