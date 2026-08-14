import { Target } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { PpcPlatformPills } from "@/components/ppc/PpcPlatformPills";
import { OverviewGridPagination } from "@/components/overview/OverviewGridPagination";
import { OverviewContentSortControls } from "@/components/overview/overview-tab/OverviewContentSortControls";
import { CONTENT_PAGINATION_SLOT_CLASS } from "@/components/overview/overview-tab/OverviewContentChromeReserve";
import { GoogleAdsGenerateToolbar } from "@/components/ppc/google/GoogleAdsGenerateToolbar";
import {
  GoogleAdsDetailsPanel,
  googleAdsDetailsCanOpen,
} from "@/components/ppc/google/GoogleAdsDetailsPanel";
import type { PpcGoogleWorkspaceController } from "@/hooks/ppc/use-ppc-google-workspace";

export type GoogleAdsWorkspaceHeaderProps = {
  ctrl: PpcGoogleWorkspaceController;
  onPlatformChange: (tab: "ppc-google" | "ppc-meta") => void;
};

export function GoogleAdsWorkspaceHeader({ ctrl, onPlatformChange }: GoogleAdsWorkspaceHeaderProps) {
  const canOpenDetails = googleAdsDetailsCanOpen(
    ctrl.generateProgress,
    ctrl.isGenerating,
    ctrl.pageBucketHostedLink,
  );

  return (
    <UnifiedWorkspaceChrome
      icon={Target}
      title="PPC"
      titleRowMenu={
        <PpcPlatformPills
          active="ppc-google"
          disabled={ctrl.workspaceBusy}
          onSelect={onPlatformChange}
        />
      }
      titleRowEnd={
        <OverviewContentSortControls
          sortColumn={ctrl.sortColumn}
          sortDir={ctrl.sortDir}
          setSortColumn={ctrl.setSortColumn}
          setSortDir={ctrl.setSortDir}
          disabled={ctrl.workspaceBusy || ctrl.displayCampaigns.length === 0}
          showSortLabel={false}
        />
      }
      toolbar={<GoogleAdsGenerateToolbar ctrl={ctrl} disabled={ctrl.workspaceBusy} />}
      workspaceBusy={ctrl.workspaceBusy}
      progressLeading={
        <OverviewGridPagination
          className={CONTENT_PAGINATION_SLOT_CLASS}
          pageIndex={ctrl.gridPageIndex}
          totalCount={ctrl.gridPaginationTotal}
          layoutTotalCount={ctrl.paginationLayoutTotal}
          onPageChange={ctrl.setGridPageIndex}
        />
      }
      progressSnapshot={ctrl.bulkMicroSnapshot}
      bulkActionProgress={{}}
      canOpenDetails={canOpenDetails}
      isProcessing={ctrl.isGenerating}
      detailsPanelId="ppc-google-generate-details"
      detailsPanel={
        <GoogleAdsDetailsPanel
          generateProgress={ctrl.generateProgress}
          isGenerating={ctrl.isGenerating}
          pageBucketHostedLink={ctrl.pageBucketHostedLink}
        />
      }
    />
  );
}
