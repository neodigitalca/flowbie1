import React, { useMemo } from "react";
import { GoogleAdsCampaignRowCompact } from "@/components/ppc/google/GoogleAdsCampaignRowCompact";
import { GoogleAdsCampaignRowDetails } from "@/components/ppc/google/GoogleAdsCampaignRowDetails";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { overviewGridPageSlice } from "@/components/overview/OverviewGridPagination";
import {
  buildPpcGoogleGridRows,
} from "@/components/ppc/google/google-ads-row-constants";
import { resolvePpcRowAdGroupKeywords } from "@/lib/ppc/google-ads-types";
import { cn } from "@/lib/utils";
import type { PpcGoogleWorkspaceController } from "@/hooks/ppc/use-ppc-google-workspace";

export type GoogleAdsCampaignsSectionProps = {
  ctrl: PpcGoogleWorkspaceController;
};

export function GoogleAdsCampaignsSection({ ctrl }: GoogleAdsCampaignsSectionProps) {
  const gridRows = useMemo(
    () => buildPpcGoogleGridRows(ctrl.displayCampaigns),
    [ctrl.displayCampaigns],
  );

  const paginatedGridRows = useMemo(
    () => overviewGridPageSlice(gridRows, ctrl.gridPageIndex),
    [gridRows, ctrl.gridPageIndex],
  );

  const renderPlaceholderStripe = (stripeIndex: number) => (
    <div className={cn(contentOptimizerRowStripeClass(stripeIndex), "flex-1")} aria-hidden />
  );

  const realRowCount = paginatedGridRows.filter(Boolean).length;
  const placeholderCount = paginatedGridRows.length - realRowCount;

  const renderCampaignRow = (
    row: PpcGoogleWorkspaceController["campaigns"][number],
    stripeIndex: number,
  ) => {
    const panelId = `neo-pulse-ppc-campaign-${row.id || stripeIndex}`;
    const isExpanded = ctrl.expandedCampaignId === row.id;
    const deleteDisabled = ctrl.isGenerating || row.status === "generating";
    const nameReadOnly = row.status === "generating";
    const keywordReadOnly = row.status === "generating";

    const adGroupCount = ctrl.generateConfig.adGroupCount;
    const adGroupKeywords = resolvePpcRowAdGroupKeywords(row, adGroupCount);

    const handleNameChange = (name: string) => {
      ctrl.updateCampaign(row.id, {
        campaignName: name,
        ...(row.campaign ? { campaign: { ...row.campaign, name } } : {}),
      });
    };

    const handleKeywordChange = (focusKeyword: string) => {
      const next = [...adGroupKeywords];
      next[0] = focusKeyword;
      ctrl.updateCampaign(row.id, { focusKeyword, adGroupKeywords: next });
    };

    const handleAdGroupKeywordChange = (index: number, keyword: string) => {
      const next = [...adGroupKeywords];
      next[index] = keyword;
      ctrl.updateCampaign(row.id, { adGroupKeywords: next });
    };

    const landingPageReadOnly = row.status === "generating";

    const handleLandingPageChange = (landingPageUrl: string) => {
      ctrl.updateCampaign(row.id, { landingPageUrl });
    };

    const generateDisabled = ctrl.isGenerating && row.status !== "generating";
    const isRowGenerating = row.status === "generating";
    const rowGenerateProps = {
      generateDisabled,
      isRowGenerating,
      onGenerate: () => void ctrl.handleGenerateCampaignRow(row.id),
    };
    const adGroupGenerateProps = {
      generatingAdGroupKey: ctrl.generatingAdGroupKey,
      onGenerateAdGroup: (adGroupIndex: number) => void ctrl.handleGenerateAdGroup(row.id, adGroupIndex),
    };

    if (!isExpanded) {
      return (
        <GoogleAdsCampaignRowCompact
          row={row}
          isExpanded={false}
          stripeIndex={stripeIndex}
          panelId={panelId}
          deleteDisabled={deleteDisabled}
          nameReadOnly={nameReadOnly}
          keywordReadOnly={keywordReadOnly}
          landingPageReadOnly={landingPageReadOnly}
          wpPages={ctrl.wpPages}
          wpPagesLoading={ctrl.wpPagesLoading}
          onToggle={() => ctrl.toggleExpandedCampaignId(row.id)}
          onDelete={() => ctrl.handleDeleteCampaign(row.id)}
          onNameChange={handleNameChange}
          onKeywordChange={handleKeywordChange}
          onLandingPageChange={handleLandingPageChange}
          onLoadWpPages={() => void ctrl.loadWpPagesForPicker()}
          {...rowGenerateProps}
        />
      );
    }

    return (
      <GoogleAdsCampaignRowDetails
        row={row}
        adGroupKeywords={adGroupKeywords}
        stripeIndex={stripeIndex}
        panelId={panelId}
        deleteDisabled={deleteDisabled}
        wpPages={ctrl.wpPages}
        wpPagesLoading={ctrl.wpPagesLoading}
        landingPageReadOnly={landingPageReadOnly}
        onCollapse={() => ctrl.toggleExpandedCampaignId(row.id)}
        onDelete={() => ctrl.handleDeleteCampaign(row.id)}
        onUpdateCampaign={(patch) => ctrl.updateCampaign(row.id, patch)}
        onKeywordChange={handleKeywordChange}
        onLandingPageChange={handleLandingPageChange}
        onLoadWpPages={() => void ctrl.loadWpPagesForPicker()}
        onAdGroupKeywordChange={handleAdGroupKeywordChange}
        {...rowGenerateProps}
        {...adGroupGenerateProps}
      />
    );
  };

  return (
    <div
      className={cn(CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS, "flex min-h-full min-w-0 flex-1 flex-col")}
      aria-label="Campaign rows"
    >
      {paginatedGridRows.map((row, index) => {
        if (!row) return null;
        return (
          <div key={row.id} className={cn(CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS, "shrink-0")}>
            {renderCampaignRow(row, index)}
          </div>
        );
      })}
      {placeholderCount > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col" aria-hidden>
          {Array.from({ length: placeholderCount }, (_, offset) =>
            renderPlaceholderStripe(realRowCount + offset),
          )}
        </div>
      ) : null}
    </div>
  );
}
