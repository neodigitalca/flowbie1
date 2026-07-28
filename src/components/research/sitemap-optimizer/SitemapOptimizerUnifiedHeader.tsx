import { GitMerge } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { SitemapLegacyRedirectDetailsPanel } from "@/components/research/sitemap-optimizer/SitemapLegacyRedirectDetailsPanel";
import { SitemapLegacyToolbar } from "@/components/research/sitemap-optimizer/SitemapLegacyToolbar";
import type { SitemapLegacyRedirectWorkspaceBindings } from "@/components/research/sitemap-optimizer/sitemap-legacy-redirect-workspace-bindings";
import type { SitemapUrlOptimizerWorkspaceBindings } from "@/components/research/sitemap-optimizer/sitemap-url-optimizer-workspace-bindings";
import {
  SitemapPlanDetailsPanel,
  type SitemapPlanDetailsPanelProps,
} from "@/components/research/sitemap-optimizer/SitemapPlanDetailsPanel";
import { SitemapPlanToolbar, type SitemapPlanToolbarProps } from "@/components/research/sitemap-optimizer/SitemapPlanToolbar";
import { SitemapPlanCollectionPills } from "@/components/research/sitemap-optimizer/SitemapPlanCollectionPills";
import { SitemapWorkspaceModePills } from "@/components/research/sitemap-optimizer/SitemapWorkspaceModePills";
import { UrlOptimizerDetailsPanel } from "@/components/research/url-optimizer/UrlOptimizerDetailsPanel";
import { UrlOptimizerToolbar } from "@/components/research/url-optimizer/UrlOptimizerToolbar";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { SitemapOptimizerWorkspaceMode } from "@/lib/sitemap-optimizer/types";

export type SitemapOptimizerUnifiedHeaderProps = {
  workspaceSubMode: SitemapOptimizerWorkspaceMode;
  onWorkspaceSubModeChange: (mode: SitemapOptimizerWorkspaceMode) => void;
  modeSwitchDisabled: boolean;
  workspaceBusy: boolean;
  planToolbarProps: SitemapPlanToolbarProps;
  planProgressSnapshot: MetaBulkMicroSnapshot | null;
  planCanOpenDetails: boolean;
  planIsProcessing: boolean;
  planDetailsProps: SitemapPlanDetailsPanelProps;
  legacyBindings: SitemapLegacyRedirectWorkspaceBindings | null;
  urlBindings: SitemapUrlOptimizerWorkspaceBindings | null;
};

export function SitemapOptimizerUnifiedHeader({
  workspaceSubMode,
  onWorkspaceSubModeChange,
  modeSwitchDisabled,
  workspaceBusy,
  planToolbarProps,
  planProgressSnapshot,
  planCanOpenDetails,
  planIsProcessing,
  planDetailsProps,
  legacyBindings,
  urlBindings,
}: SitemapOptimizerUnifiedHeaderProps) {
  const isPlan = workspaceSubMode === "plan";
  const isLegacy = workspaceSubMode === "legacy_redirects";
  const isUrl = workspaceSubMode === "url_optimizer";

  const progressSnapshot = isPlan
    ? planProgressSnapshot
    : isLegacy
      ? (legacyBindings?.progressSnapshot ?? null)
      : (urlBindings?.progressSnapshot ?? null);

  const canOpenDetails = isPlan
    ? planCanOpenDetails
    : isLegacy
      ? Boolean(legacyBindings?.canOpenDetails)
      : Boolean(urlBindings?.canOpenDetails);

  const isProcessing = isPlan
    ? planIsProcessing
    : isLegacy
      ? Boolean(legacyBindings?.generating)
      : Boolean(urlBindings?.running);

  const detailsPanelId = isPlan
    ? "sitemap-plan-details-panel"
    : isLegacy
      ? "sitemap-legacy-redirect-details-panel"
      : "sitemap-url-optimizer-details-panel";

  return (
    <UnifiedWorkspaceChrome
      icon={GitMerge}
      title="Sitemap"
      titleRowMenu={
        isPlan ? (
          <SitemapPlanCollectionPills
            collectionOptions={planToolbarProps.collectionOptions}
            selected={planToolbarProps.selected}
            selectCollection={planToolbarProps.selectCollection}
            disabled={planToolbarProps.busy}
          />
        ) : null
      }
      titleRowEnd={
        <SitemapWorkspaceModePills
          workspaceSubMode={workspaceSubMode}
          onWorkspaceSubModeChange={onWorkspaceSubModeChange}
          disabled={modeSwitchDisabled}
        />
      }
      workspaceBusy={workspaceBusy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId={detailsPanelId}
      toolbar={
        isPlan ? (
          <SitemapPlanToolbar {...planToolbarProps} />
        ) : isLegacy && legacyBindings ? (
          <SitemapLegacyToolbar {...legacyBindings} />
        ) : isUrl && urlBindings ? (
          <UrlOptimizerToolbar {...urlBindings.toolbarProps} />
        ) : null
      }
      detailsPanel={
        isPlan ? (
          <SitemapPlanDetailsPanel {...planDetailsProps} />
        ) : isLegacy && legacyBindings ? (
          <SitemapLegacyRedirectDetailsPanel
            workspaceBusy={legacyBindings.generating}
            headerProgress={legacyBindings.headerProgress}
            sheetName={legacyBindings.sheetName}
            sheetLineCount={legacyBindings.sheetLineCount}
            matchedCount={legacyBindings.matchedCount}
            processedCount={legacyBindings.processedCount}
            batchProgress={legacyBindings.batchProgress}
            catalogSize={legacyBindings.catalogSize}
            inventoryFilename={legacyBindings.inventoryFilename}
            inventoryRowCount={legacyBindings.inventoryRowCount}
            inventoryHref={legacyBindings.inventoryHref}
          />
        ) : isUrl && urlBindings ? (
          <UrlOptimizerDetailsPanel {...urlBindings.detailsProps} />
        ) : null
      }
    />
  );
}
