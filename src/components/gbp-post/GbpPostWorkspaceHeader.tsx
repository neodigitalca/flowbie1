import { useMemo } from "react";
import { Megaphone } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { SitemapSourcePills } from "@/components/shared/SitemapSourcePills";
import {
  GbpPostDetailsPanel,
  type GbpPostDetailsPanelProps,
} from "@/components/gbp-post/GbpPostDetailsPanel";
import { GbpPostToolbar, type GbpPostToolbarProps } from "@/components/gbp-post/GbpPostToolbar";
import { GbpConnectGoogleBusinessButton } from "@/components/gbp-post/GbpConnectGoogleBusinessButton";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import {
  buildGbpPostMicroSnapshot,
  gbpPostHeaderProgressFromState,
} from "@/lib/gbp-post/gbp-post-header-progress";

const DETAILS_PANEL_ID = "gbp-post-details-panel";

export type GbpPostWorkspaceHeaderProps = {
  workspaceBusy: boolean;
  isProcessing: boolean;
  canOpenDetails: boolean;
  sitemapSource: OverviewSitemapSource;
  onSitemapSourceChange: (source: OverviewSitemapSource) => void;
  sitemapPillsDisabled: boolean;
  postsSourceAvailable: boolean;
  sapSourceAvailable: boolean;
  headerProgressArgs: {
    statusLine: string;
    harnessSections: GbpPostDetailsPanelProps["harnessSections"];
    harnessPlannedCount: number | null;
    bulkSlotIndex: number;
    harnessTotalRows: number;
    harnessBySiteId?: Record<string, GbpPostDetailsPanelProps["harnessSections"][number][]>;
    parallelSiteCount?: number;
  };
  toolbarProps: GbpPostToolbarProps;
  detailsProps: GbpPostDetailsPanelProps;
};

export function GbpPostWorkspaceHeader({
  workspaceBusy,
  isProcessing,
  canOpenDetails,
  sitemapSource,
  onSitemapSourceChange,
  sitemapPillsDisabled,
  postsSourceAvailable,
  sapSourceAvailable,
  headerProgressArgs,
  toolbarProps,
  detailsProps,
}: GbpPostWorkspaceHeaderProps) {
  const headerProgress = useMemo(
    () =>
      gbpPostHeaderProgressFromState({
        isProcessing,
        statusLine: headerProgressArgs.statusLine,
        harnessSections: headerProgressArgs.harnessSections,
        harnessPlannedSectionCount: headerProgressArgs.harnessPlannedCount,
        currentRow: headerProgressArgs.bulkSlotIndex,
        totalRows: headerProgressArgs.harnessTotalRows,
        harnessBySiteId: headerProgressArgs.harnessBySiteId,
        parallelSiteCount: headerProgressArgs.parallelSiteCount,
      }),
    [isProcessing, headerProgressArgs],
  );

  const progressSnapshot = useMemo(
    () => (workspaceBusy ? buildGbpPostMicroSnapshot(headerProgress) : null),
    [workspaceBusy, headerProgress],
  );

  return (
    <UnifiedWorkspaceChrome
      icon={Megaphone}
      title="GBP"
      titleRowMenu={
        <SitemapSourcePills
          value={sitemapSource}
          onChange={onSitemapSourceChange}
          disabled={sitemapPillsDisabled}
          postsAvailable={postsSourceAvailable}
          sapAvailable={sapSourceAvailable}
        />
      }
      titleRowEnd={<GbpConnectGoogleBusinessButton variant="titleBar" />}
      workspaceBusy={workspaceBusy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId={DETAILS_PANEL_ID}
      toolbar={<GbpPostToolbar {...toolbarProps} />}
      detailsPanel={<GbpPostDetailsPanel {...detailsProps} />}
    />
  );
}
