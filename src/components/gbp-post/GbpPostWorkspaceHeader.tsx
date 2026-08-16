import { useMemo } from "react";
import { Megaphone } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { SitemapSourcePills } from "@/components/shared/SitemapSourcePills";
import { SocialPlatformPills, type SocialPlatformTab } from "@/components/social/SocialPlatformPills";
import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import { GbpPostToolbar, type GbpPostToolbarProps } from "@/components/gbp-post/GbpPostToolbar";
import { GbpConnectGoogleBusinessButton } from "@/components/gbp-post/GbpConnectGoogleBusinessButton";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import type { HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import {
  buildGbpPostMicroSnapshot,
  gbpPostHeaderProgressFromState,
} from "@/lib/gbp-post/gbp-post-header-progress";

const DETAILS_PANEL_ID = "gbp-post-details-panel";

export type GbpPostWorkspaceHeaderProps = {
  workspaceBusy: boolean;
  isProcessing: boolean;
  canOpenDetails: boolean;
  onPlatformChange: (tab: SocialPlatformTab) => void;
  sitemapSource: OverviewSitemapSource;
  onSitemapSourceChange: (source: OverviewSitemapSource) => void;
  sitemapPillsDisabled: boolean;
  postsSourceAvailable: boolean;
  sapSourceAvailable: boolean;
  headerProgressArgs: {
    statusLine: string;
    harnessSections: HarnessSectionListItem[];
    harnessPlannedCount: number | null;
    bulkSlotIndex: number;
    harnessTotalRows: number;
    harnessBySiteId?: Record<string, HarnessSectionListItem[]>;
    parallelSiteCount?: number;
  };
  toolbarProps: GbpPostToolbarProps;
  detailsProps: BulkGeneratorDetailsPanelProps;
};

export function GbpPostWorkspaceHeader({
  workspaceBusy,
  isProcessing,
  canOpenDetails,
  onPlatformChange,
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
      titleRowEnd={
        <div className="flex min-w-0 items-center gap-1">
          <div className="shrink-0">
            <GbpConnectGoogleBusinessButton variant="titleBar" />
          </div>
          <SocialPlatformPills
            active="gbp-post"
            disabled={workspaceBusy}
            onSelect={onPlatformChange}
          />
        </div>
      }
      workspaceBusy={workspaceBusy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId={DETAILS_PANEL_ID}
      toolbar={<GbpPostToolbar {...toolbarProps} />}
      detailsPanel={<BulkGeneratorDetailsDrawer {...detailsProps} />}
    />
  );
}
