import { useMemo } from "react";
import { GitMerge } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { SitemapLegacyToolbar } from "@/components/research/sitemap-optimizer/SitemapLegacyToolbar";
import type { SitemapLegacyRedirectWorkspaceBindings } from "@/components/research/sitemap-optimizer/sitemap-legacy-redirect-workspace-bindings";
import type { SitemapUrlOptimizerWorkspaceBindings } from "@/components/research/sitemap-optimizer/sitemap-url-optimizer-workspace-bindings";
import type { SitemapPlanDetailsPanelProps } from "@/components/research/sitemap-optimizer/SitemapPlanDetailsPanel";
import { SitemapPlanToolbar, type SitemapPlanToolbarProps } from "@/components/research/sitemap-optimizer/SitemapPlanToolbar";
import { SitemapPlanCollectionPills } from "@/components/research/sitemap-optimizer/SitemapPlanCollectionPills";
import { SitemapWorkspaceModePills } from "@/components/research/sitemap-optimizer/SitemapWorkspaceModePills";
import { UrlOptimizerToolbar } from "@/components/research/url-optimizer/UrlOptimizerToolbar";
import { ContentOptimizerDetailsDrawer } from "@/components/overview/overview-tab/ContentOptimizerDetailsDrawer";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { SitemapOptimizerWorkspaceMode } from "@/lib/sitemap-optimizer/types";
import { buildSitemapLegacyBulkGeneratorDetailsProps } from "@/lib/sitemap-optimizer/sitemap-legacy-bulk-details-bindings";
import {
  buildSitemapMergePublishBulkGeneratorDetailsProps,
  type SitemapMergePublishDetailsInput,
} from "@/lib/sitemap-optimizer/sitemap-merge-publish-bulk-details-bindings";
import { buildSitemapPlanBulkGeneratorDetailsProps } from "@/lib/sitemap-optimizer/sitemap-plan-bulk-details-bindings";
import { buildUrlOptimizerBulkGeneratorDetailsProps } from "@/lib/sitemap-optimizer/url-optimizer-bulk-details-bindings";

export type SitemapOptimizerUnifiedHeaderProps = {
  workspaceSubMode: SitemapOptimizerWorkspaceMode;
  onWorkspaceSubModeChange: (mode: SitemapOptimizerWorkspaceMode) => void;
  modeSwitchDisabled: boolean;
  workspaceBusy: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
  planToolbarProps: SitemapPlanToolbarProps;
  planProgressSnapshot: MetaBulkMicroSnapshot | null;
  planCanOpenDetails: boolean;
  planIsProcessing: boolean;
  planDetailsProps: SitemapPlanDetailsPanelProps;
  planBusy: boolean;
  mergePublishActive: boolean;
  mergePublishCanOpenDetails: boolean;
  mergePublishProgressSnapshot: MetaBulkMicroSnapshot | null;
  mergePublishIsProcessing: boolean;
  mergePublishDetailsInput: SitemapMergePublishDetailsInput;
  legacyBindings: SitemapLegacyRedirectWorkspaceBindings | null;
  urlBindings: SitemapUrlOptimizerWorkspaceBindings | null;
};

export function SitemapOptimizerUnifiedHeader({
  workspaceSubMode,
  onWorkspaceSubModeChange,
  modeSwitchDisabled,
  workspaceBusy,
  onDetailsOpenChange,
  planToolbarProps,
  planProgressSnapshot,
  planCanOpenDetails,
  planIsProcessing,
  planDetailsProps,
  planBusy,
  mergePublishActive,
  mergePublishCanOpenDetails,
  mergePublishProgressSnapshot,
  mergePublishIsProcessing,
  mergePublishDetailsInput,
  legacyBindings,
  urlBindings,
}: SitemapOptimizerUnifiedHeaderProps) {
  const isPlan = workspaceSubMode === "plan";
  const isLegacy = workspaceSubMode === "legacy_redirects";
  const isUrl = workspaceSubMode === "url_optimizer";
  const useMergePublish = isPlan && mergePublishActive;

  const progressSnapshot = useMergePublish
    ? mergePublishProgressSnapshot
    : isPlan
      ? planProgressSnapshot
      : isLegacy
        ? (legacyBindings?.progressSnapshot ?? null)
        : (urlBindings?.progressSnapshot ?? null);

  const canOpenDetails = useMergePublish
    ? mergePublishCanOpenDetails
    : isPlan
      ? planCanOpenDetails
      : isLegacy
        ? Boolean(legacyBindings?.canOpenDetails)
        : Boolean(urlBindings?.canOpenDetails);

  const isProcessing = useMergePublish
    ? mergePublishIsProcessing
    : isPlan
      ? planIsProcessing
      : isLegacy
        ? Boolean(legacyBindings?.generating)
        : Boolean(urlBindings?.running);

  const detailsPanelId = useMergePublish
    ? "sitemap-merge-publish-details-panel"
    : isPlan
      ? "sitemap-plan-details-panel"
      : isLegacy
        ? "sitemap-legacy-redirect-details-panel"
        : "sitemap-url-optimizer-details-panel";

  const planDrawerProps = useMemo(
    () => buildSitemapPlanBulkGeneratorDetailsProps({ ...planDetailsProps, busy: planBusy }),
    [planDetailsProps, planBusy],
  );

  const legacyDrawerProps = useMemo(
    () => (legacyBindings ? buildSitemapLegacyBulkGeneratorDetailsProps(legacyBindings) : null),
    [legacyBindings],
  );

  const urlDrawerProps = useMemo(
    () =>
      urlBindings?.detailsProps
        ? buildUrlOptimizerBulkGeneratorDetailsProps(urlBindings.detailsProps)
        : null,
    [urlBindings?.detailsProps],
  );

  const mergePublishDrawerProps = useMemo(
    () => buildSitemapMergePublishBulkGeneratorDetailsProps(mergePublishDetailsInput),
    [mergePublishDetailsInput],
  );

  const activeDrawerProps = useMergePublish
    ? mergePublishDrawerProps
    : isPlan
      ? planDrawerProps
      : isLegacy
        ? legacyDrawerProps
        : urlDrawerProps;

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
      onDetailsOpenChange={onDetailsOpenChange}
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
        activeDrawerProps ? (
          <ContentOptimizerDetailsDrawer
            postDestination={
              useMergePublish && mergePublishDetailsInput.bulkState ? "wordpress" : "local"
            }
            {...activeDrawerProps}
          />
        ) : null
      }
    />
  );
}
