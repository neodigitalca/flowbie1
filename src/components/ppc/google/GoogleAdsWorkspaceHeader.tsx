import { Target } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
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
};

export function GoogleAdsWorkspaceHeader({ ctrl }: GoogleAdsWorkspaceHeaderProps) {
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
        <div className="flex min-w-0 flex-nowrap items-center gap-1" role="group" aria-label="PPC platform">
          <WorkspacePill label="Google" active square />
        </div>
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
