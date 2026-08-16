import React, { useMemo, useState } from "react";
import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
} from "@/components/seo/seo-workspace-layout";
import { OverviewPagesSection } from "@/components/overview/OverviewPagesSection";
import { OverviewTabSitemapBulkForm } from "@/components/overview/overview-tab/OverviewTabSitemapBulkForm";
import type { OverviewTabContentProps } from "@/components/overview/overview-tab/overview-tab-content-types";
import {
  CONTENT_OPTIMIZER_BODY_INSET_CLASS,
  CONTENT_OPTIMIZER_WORKSPACE_SHELL_CLASS,
  WORKSPACE_DETAILS_DIM_OVERLAY_CLASS,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { useOverviewTabController } from "@/hooks/overview/use-overview-tab-controller";
import { useOverviewTabShellDerived } from "@/hooks/overview/use-overview-tab-shell-derived";
import { cn } from "@/lib/utils";
import { usePulseAssistOverviewBridge } from "@/hooks/use-pulse-assist-overview-bridge";

export function OverviewTabContent(props: OverviewTabContentProps) {
  const ctrl = useOverviewTabController(props);
  const derived = useOverviewTabShellDerived(ctrl);
  const batchProgress = derived.bulkBatchKey
    ? ctrl.opt.optimizationProgress[derived.bulkBatchKey]
    : undefined;
  const { site } = ctrl;
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);

  const expandedPageTitle = useMemo(() => {
    if (!ctrl.expandedPageUrl) return null;
    const row = ctrl.displayRows.find((r) => r.url === ctrl.expandedPageUrl);
    return row?.title || ctrl.wpTitlesByUrl[ctrl.expandedPageUrl] || null;
  }, [ctrl.displayRows, ctrl.expandedPageUrl, ctrl.wpTitlesByUrl]);

  usePulseAssistOverviewBridge({
    site,
    sitemapSource: ctrl.sitemapSource,
    expandedPageUrl: ctrl.expandedPageUrl,
    expandedPageTitle,
  });

  return (
    <div className={CONTENT_OPTIMIZER_WORKSPACE_SHELL_CLASS}>
      <div className={SEO_WORKSPACE_HEADER_CLASS}>
        <OverviewTabSitemapBulkForm
          ctrl={ctrl}
          metaOptBulkStripBusy={derived.metaOptBulkStripBusy}
          bulkWorkspaceBusy={derived.bulkWorkspaceBusy}
          bulkMicroSnapshot={derived.bulkMicroSnapshot}
          isBatchContentRunning={derived.isBatchContentRunning}
          isSinglePageOptimizing={derived.isSinglePageOptimizing}
          batchBulkState={derived.batchBulkState}
          bulkBatchKey={derived.bulkBatchKey}
          batchProgress={batchProgress}
          opt={ctrl.opt}
          setBulkActionProgress={ctrl.setBulkActionProgress}
          onUploadToWordPress={() => void ctrl.handleBulkUploadToWordPress()}
          optimizerSection={props.optimizerSection}
          onOptimizerSectionChange={props.onOptimizerSectionChange}
          paginationLayoutTotal={props.paginationLayoutTotal}
          onDetailsOpenChange={setDetailsDrawerOpen}
          generatorChrome={props.generatorChrome}
        />
      </div>
      <div
        className={cn(
          SEO_WORKSPACE_BODY_SCROLL_CLASS,
          CONTENT_OPTIMIZER_BODY_INSET_CLASS,
          "relative",
        )}
      >
        {detailsDrawerOpen ? (
          <div className={WORKSPACE_DETAILS_DIM_OVERLAY_CLASS} aria-hidden />
        ) : null}
        <OverviewPagesSection
        site={site}
        sitemapSource={ctrl.sitemapSource}
        rows={ctrl.rows}
        displayRows={ctrl.displayRows}
        gridPageIndex={ctrl.gridPageIndex}
        wpTitlesByUrl={ctrl.wpTitlesByUrl}
        expandedPageUrl={ctrl.expandedPageUrl}
        toggleExpandedPageUrl={ctrl.toggleExpandedPageUrl}
        bindings={ctrl.bindings}
        opt={ctrl.opt}
        bulkAiFaqSeedCount={ctrl.bulkAiFaqSeedCount}
        expandedResearchBriefUrl={ctrl.expandedResearchBriefUrl}
        setExpandedResearchBriefUrl={ctrl.setExpandedResearchBriefUrl}
        expandedContentUrl={ctrl.expandedContentUrl}
        setExpandedContentUrl={ctrl.setExpandedContentUrl}
        updateRow={ctrl.updateRow}
        handleAiUrlRow={ctrl.handleAiUrlRow}
        handleScrapeRow={ctrl.handleScrapeRow}
        handleUpdateWordPressForRow={ctrl.handleUpdateWordPressForRow}
        handleDataForSeoResearch={ctrl.handleDataForSeoResearch}
        handleOptimizeAllSerpRow={ctrl.handleOptimizeAllSerpRow}
        handleAiAllMetaRow={ctrl.handleAiAllMetaRow}
        handleAiTitleRow={ctrl.handleAiTitleRow}
        handleAiMetaRow={ctrl.handleAiMetaRow}
        handleAiKeywordRow={ctrl.handleAiKeywordRow}
        handleSetDateToday={ctrl.handleSetDateToday}
        commitRowDateModifier={ctrl.commitRowDateModifier}
        handleAiFaqRowAll={ctrl.handleAiFaqRowAll}
        handleAiFaqQuestion={ctrl.handleAiFaqQuestion}
        handleAiFaqAnswer={ctrl.handleAiFaqAnswer}
        handleAiHeadersRow={ctrl.handleAiHeadersRow}
        handleAiLinksRow={ctrl.handleAiLinksRow}
        handleAiWikipediaLinkRow={ctrl.handleAiWikipediaLinkRow}
        handleAiOverviewRow={ctrl.handleAiOverviewRow}
        handleAiInContentImageRow={ctrl.handleAiInContentImageRow}
      />
      </div>
    </div>
  );
}
