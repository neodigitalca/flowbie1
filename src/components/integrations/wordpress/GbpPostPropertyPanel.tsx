import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type WordPressSite } from "../types";
import {
  NOTIFY_GBP_POST_PUBLISHED,
  NOTIFY_GBP_POST_QUEUED,
  NOTIFY_NO_CLIENTS_SELECTED_SELECT_AT_LEAST_ONE_,
  NOTIFY_OPENROUTER_API_KEY_REQUIRED_IN_API_KEYS_,
  NOTIFY_SET_GOOGLE_BUSINESS_PROFILE_LOCATION_ID_,
  NOTIFY_WORDPRESS_CREDENTIALS_MISSING_PLEASE_UPD,
} from "@/lib/notify-messages";
import { notify, notifyHeaderError } from "@/lib/app-notifications";
import { loadApiKey } from "@/lib/api";
import {
  reduceHarnessSectionList,
  type HarnessSectionListItem,
} from "@/lib/bulk/harness-sections-reducer";
import { GbpPostClientRoster } from "@/components/gbp-post/GbpPostClientRoster";
import type { GbpPublishPreview } from "@/components/gbp-post/GbpPostPublishPreview";
import type { GbpSchedulerSectionState } from "@/lib/gbp-post/gbp-schedule-plan";
import { defaultGbpSchedulerState } from "@/components/gbp-post/GbpPostSchedulerSection";
import { GbpPostWorkspaceHeader } from "@/components/gbp-post/GbpPostWorkspaceHeader";
import { gbpPostDetailsCanOpen } from "@/components/gbp-post/GbpPostDetailsPanel";
import {
  SEO_WORKSPACE_HEADER_CLASS,
  SEO_WORKSPACE_INNER_CLASS,
} from "@/components/seo/seo-workspace-layout";
import { useGbpPostRoster } from "@/hooks/gbp-post/use-gbp-post-roster";
import { useGmbConnectionStatus } from "@/hooks/gbp-post/use-gmb-connection-status";
import { mergeServerGbpLocationIdsIntoLocalSites } from "@/components/integrations/storage";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { clampNumberOfGbpPosts } from "@/lib/gbp-post/gbp-schedule-plan";
import { runGbpSitePostBatch } from "@/lib/gbp-post/gbp-post-one-site";
import { runGbpMultiSiteBatch } from "@/lib/gbp-post/gbp-post-multi-site-batch";
import {
  revokeGbpPostsInventoryHostedLink,
  type GbpPostsInventoryHostedLink,
} from "@/lib/gbp-post/gbp-posts-inventory";
import {
  isOverviewPostsSourceAvailable,
  isOverviewSapSourceAvailable,
  type OverviewSitemapSource,
} from "@/lib/overview/overview-sitemap-source";

interface GbpPostPropertyPanelProps {
  site: WordPressSite;
  /** All WordPress properties; roster shows those with a GBP Location ID. */
  allSites: WordPressSite[];
}

function validateSitePrereqs(target: WordPressSite): string | null {
  // GBP roster is keyed on GBP Location ID; `enabled` is only the single active header connection.
  if (!target.gbpLocationId?.trim()) {
    return NOTIFY_SET_GOOGLE_BUSINESS_PROFILE_LOCATION_ID_;
  }
  if (!target.username?.trim() || !target.appPassword?.trim()) {
    return NOTIFY_WORDPRESS_CREDENTIALS_MISSING_PLEASE_UPD;
  }
  if (!loadApiKey()?.trim() && !import.meta.env.VITE_OPENROUTER_API_KEY) {
    return NOTIFY_OPENROUTER_API_KEY_REQUIRED_IN_API_KEYS_;
  }
  return null;
}

export const GbpPostPropertyPanel: React.FC<GbpPostPropertyPanelProps> = ({
  site,
  allSites: _allSites,
}) => {
  const { sites: integrationSites, reloadSitesFromStorage } = useWordPressSites();
  const roster = useGbpPostRoster(integrationSites);
  const { connected: gmbConnected } = useGmbConnectionStatus();

  const syncGbpFromServer = useCallback(() => {
    void mergeServerGbpLocationIdsIntoLocalSites().then((merged) => {
      if (merged) reloadSitesFromStorage();
    });
  }, [reloadSitesFromStorage]);

  useEffect(() => {
    syncGbpFromServer();
  }, [syncGbpFromServer]);

  useEffect(() => {
    if (roster.rosterSites.length > 0) return;
    syncGbpFromServer();
  }, [roster.rosterSites.length, syncGbpFromServer]);
  const [scheduler, setScheduler] = useState<GbpSchedulerSectionState>(defaultGbpSchedulerState);
  const [isPosting, setIsPosting] = useState(false);
  const [multiPropertyRun, setMultiPropertyRun] = useState(false);
  const [harnessSections, setHarnessSections] = useState<HarnessSectionListItem[]>([]);
  const [harnessSectionsBySiteId, setHarnessSectionsBySiteId] = useState<
    Record<string, HarnessSectionListItem[]>
  >({});
  const [harnessPlannedCount, setHarnessPlannedCount] = useState<number | null>(3);
  const [bulkSlotIndex, setBulkSlotIndex] = useState(0);
  const [resolvedTopic, setResolvedTopic] = useState("");
  const [publishPipelineActive, setPublishPipelineActive] = useState(false);
  const [publishStepIndex, setPublishStepIndex] = useState(0);
  const [previewBySiteId, setPreviewBySiteId] = useState<Record<string, GbpPublishPreview | null>>({});
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
  const [postingSiteIds, setPostingSiteIds] = useState<Set<string>>(() => new Set());
  const [statusLine, setStatusLine] = useState("");
  const [bulkSummary, setBulkSummary] = useState<{ published: number; queued: number; failed: number } | null>(
    null,
  );
  const [inventoryLink, setInventoryLink] = useState<GbpPostsInventoryHostedLink | null>(null);
  const [sitemapSource, setSitemapSource] = useState<OverviewSitemapSource>("pages");
  const inventoryHrefRef = useRef<string | null>(null);

  const clearInventoryHostedLink = useCallback(() => {
    revokeGbpPostsInventoryHostedLink(inventoryHrefRef.current);
    inventoryHrefRef.current = null;
    setInventoryLink(null);
  }, []);

  useEffect(() => () => clearInventoryHostedLink(), [clearInventoryHostedLink]);

  const disabled = site.enabled === false;
  const totalPosts = clampNumberOfGbpPosts(scheduler.numberOfPosts);
  const isMultiSlot = totalPosts > 1;
  const isBusy = isPosting;
  const selectedCount = roster.selectedSites.length;
  const rosterSiteCount = roster.rosterSites.length;
  const allClientsSelected =
    rosterSiteCount > 0 && roster.rosterSites.every((s) => roster.selectedSiteIds.has(s.id));
  const someClientsSelected = roster.rosterSites.some((s) => roster.selectedSiteIds.has(s.id));
  const postsSourceAvailable = roster.rosterSites.some((s) => isOverviewPostsSourceAvailable(s));
  const sapSourceAvailable = roster.rosterSites.some((s) => isOverviewSapSourceAvailable(s));

  useEffect(() => {
    if (sitemapSource === "posts" && !postsSourceAvailable) {
      setSitemapSource("pages");
    }
    if (sitemapSource === "sap" && !sapSourceAvailable) {
      setSitemapSource("pages");
    }
  }, [sitemapSource, postsSourceAvailable, sapSourceAvailable]);

  const displaySite = roster.selectedSites[0] ?? site;
  const displayTopic = roster.topicForSite(displaySite.id);
  const harnessTotalRows = multiPropertyRun
    ? Math.max(selectedCount, 1)
    : totalPosts;

  const publishPreview = useMemo(
    () => previewBySiteId[displaySite.id] ?? null,
    [previewBySiteId, displaySite.id],
  );

  const setPreviewForSite = useCallback((siteId: string, preview: GbpPublishPreview | null) => {
    setPreviewBySiteId((prev) => ({ ...prev, [siteId]: preview }));
  }, []);

  const toggleExpandedSiteId = useCallback((siteId: string) => {
    setExpandedSiteId((prev) => (prev === siteId ? null : siteId));
  }, []);

  const resetRunState = useCallback(() => {
    setHarnessSections([]);
    setHarnessSectionsBySiteId({});
    setHarnessPlannedCount(3);
    setBulkSlotIndex(0);
    setResolvedTopic("");
    setPreviewBySiteId({});
    setBulkSummary(null);
    setPublishPipelineActive(false);
    setPublishStepIndex(0);
    setPostingSiteIds(new Set());
    clearInventoryHostedLink();
  }, [clearInventoryHostedLink]);

  const handlePostSelected = async () => {
    if (!roster.selectedSites.length) {
      notify.error(NOTIFY_NO_CLIENTS_SELECTED_SELECT_AT_LEAST_ONE_);
      return;
    }

    for (const target of roster.selectedSites) {
      const err = validateSitePrereqs(target);
      if (err) {
        notify.error(err);
        return;
      }
    }

    const targets = roster.selectedSites;

    const apiKey = loadApiKey()?.trim() || import.meta.env.VITE_OPENROUTER_API_KEY || "";
    resetRunState();
    setIsPosting(true);

    const onHarnessSection = (payload: Parameters<typeof reduceHarnessSectionList>[1]) => {
      setHarnessSections((prev) => reduceHarnessSectionList(prev, payload));
    };

    try {
      if (targets.length === 1) {
        const target = targets[0];
        setMultiPropertyRun(false);
        setPublishPipelineActive(true);
        setPostingSiteIds(new Set([target.id]));
        setExpandedSiteId(target.id);

        const result = await runGbpSitePostBatch({
          site: target,
          keyword: roster.topicForSite(target.id),
          scheduler,
          openRouterApiKey: apiKey,
          totalPosts,
          sitemapSource,
          onStatus: setStatusLine,
          onHarnessSection,
          onResolvedTopic: setResolvedTopic,
          onPreview: (preview) => setPreviewForSite(target.id, preview),
          onSlotIndex: setBulkSlotIndex,
          notifyOnSlotFailure: true,
        });

        if (result.inventoryHosted) {
          inventoryHrefRef.current = result.inventoryHosted.href;
          setInventoryLink(result.inventoryHosted);
        }

        setPublishPipelineActive(false);
        setPublishStepIndex(4);

        const { published, queued, failed } = result;
        const hasOutcome = published + queued + failed > 0;
        if (hasOutcome) {
          setBulkSummary({ published, queued, failed });
        }
        if (failed === 0) {
          notify.success(
            isMultiSlot
              ? NOTIFY_GBP_POST_PUBLISHED
              : queued > 0
                ? NOTIFY_GBP_POST_QUEUED
                : NOTIFY_GBP_POST_PUBLISHED,
          );
        }
        if (hasOutcome) {
          setStatusLine(
            `Done: ${published} published, ${queued} queued${failed > 0 ? `, ${failed} failed` : ""}.`,
          );
        }
      } else {
        setMultiPropertyRun(true);
        setPostingSiteIds(new Set(targets.map((t) => t.id)));
        setHarnessSectionsBySiteId({});
        setStatusLine(`Posting ${targets.length} sites in parallel…`);

        const result = await runGbpMultiSiteBatch({
          sites: targets,
          resolveKeyword: (s) => roster.topicForSite(s.id),
          scheduler,
          openRouterApiKey: apiKey,
          sitemapSource,
          onProgress: setStatusLine,
          onHarnessSection: (activeSite, payload) => {
            setHarnessSectionsBySiteId((prev) => ({
              ...prev,
              [activeSite.id]: reduceHarnessSectionList(prev[activeSite.id] ?? [], payload),
            }));
          },
          onPreview: (activeSite, preview) => setPreviewForSite(activeSite.id, preview),
          onPropertyStart: (activeSite) => {
            setHarnessSectionsBySiteId((prev) => ({ ...prev, [activeSite.id]: [] }));
            setPreviewBySiteId((prev) => ({ ...prev, [activeSite.id]: null }));
          },
          onPropertyComplete: (activeSite, propertyResult) => {
            if (propertyResult.inventoryHosted) {
              clearInventoryHostedLink();
              inventoryHrefRef.current = propertyResult.inventoryHosted.href;
              setInventoryLink(propertyResult.inventoryHosted);
            }
            if (propertyResult.resolvedTopic) {
              setResolvedTopic(`${activeSite.name}: ${propertyResult.resolvedTopic}`);
            }
          },
        });

        const hasOutcome = result.published + result.queued + result.failed > 0;
        if (hasOutcome) {
          setBulkSummary({
            published: result.published,
            queued: result.queued,
            failed: result.failed,
          });
          setStatusLine(
            `Done: ${result.published} published, ${result.queued} queued${result.failed > 0 ? `, ${result.failed} failed` : ""}.`,
          );
        } else {
          setBulkSummary(null);
          setStatusLine("");
        }
      }
    } catch (e) {
      notifyHeaderError("GBP post failed", e);
      setStatusLine("");
    } finally {
      setIsPosting(false);
      setMultiPropertyRun(false);
      setPublishPipelineActive(false);
      setPostingSiteIds(new Set());
    }
  };

  const postLabel = isPosting
    ? multiPropertyRun
      ? `Posting ${selectedCount} sites…`
      : isMultiSlot
        ? `Posting ${bulkSlotIndex + 1}/${totalPosts}…`
        : "Posting…"
    : isMultiSlot && selectedCount === 1
      ? `Schedule ${totalPosts}`
      : "Post";

  const setNumberOfPosts = useCallback((n: number) => {
    const count = clampNumberOfGbpPosts(n);
    setScheduler((prev) => ({
      ...prev,
      numberOfPosts: count,
      rowOrder: Array.from({ length: count }, (_, i) => i),
    }));
  }, []);

  const canOpenDetails = useMemo(
    () =>
      gbpPostDetailsCanOpen(
        roster.rosterSites.length,
        isBusy,
        Boolean(resolvedTopic),
        selectedCount > 0,
        Boolean(bulkSummary),
      ),
    [roster.rosterSites.length, isBusy, resolvedTopic, selectedCount, bulkSummary],
  );

  const detailsProps = useMemo(
    () => ({
      site: displaySite,
      sitemapSource,
      isBusy,
      statusLine,
      resolvedTopic,
      harnessSections,
      harnessPlannedCount,
      bulkSlotIndex,
      harnessTotalRows,
      multiSitePosting: multiPropertyRun,
      batchActiveSite: null,
      inventoryLink,
      bulkSummary,
      publishPreview,
      keyword: displayTopic,
      numberOfPosts: totalPosts,
      selectedCount,
      rosterCount: roster.rosterSites.length,
      publishPipelineActive,
      publishStepIndex,
    }),
    [
      displaySite,
      sitemapSource,
      isBusy,
      statusLine,
      resolvedTopic,
      harnessSections,
      harnessPlannedCount,
      bulkSlotIndex,
      harnessTotalRows,
      multiPropertyRun,
      inventoryLink,
      bulkSummary,
      publishPreview,
      displayTopic,
      totalPosts,
      selectedCount,
      roster.rosterSites.length,
      publishPipelineActive,
      publishStepIndex,
    ],
  );

  return (
    <div className={SEO_WORKSPACE_INNER_CLASS}>
      <div className={SEO_WORKSPACE_HEADER_CLASS}>
        <GbpPostWorkspaceHeader
          workspaceBusy={isBusy}
          isProcessing={isBusy}
          canOpenDetails={canOpenDetails}
          sitemapSource={sitemapSource}
          onSitemapSourceChange={setSitemapSource}
          sitemapPillsDisabled={isBusy}
          postsSourceAvailable={postsSourceAvailable}
          sapSourceAvailable={sapSourceAvailable}
          headerProgressArgs={{
            statusLine,
            harnessSections,
            harnessPlannedCount,
            bulkSlotIndex,
            harnessTotalRows,
            harnessBySiteId: multiPropertyRun ? harnessSectionsBySiteId : undefined,
            parallelSiteCount: multiPropertyRun ? selectedCount : undefined,
          }}
          toolbarProps={{
            disabled,
            isBusy,
            isPosting,
            postLabel,
            selectedCount,
            rosterSiteCount,
            allClientsSelected,
            someClientsSelected,
            onSelectAllChange: (selectAll) => {
              if (selectAll) roster.loadAllClients();
              else roster.selectNoClients();
            },
            numberOfPosts: totalPosts,
            onNumberOfPostsChange: setNumberOfPosts,
            onPost: () => void handlePostSelected(),
          }}
          detailsProps={detailsProps}
        />
      </div>

      <GbpPostClientRoster
        sites={roster.rosterSites}
        selectedSiteIds={roster.selectedSiteIds}
        topicBySiteId={roster.topicBySiteId}
        expandedSiteId={expandedSiteId}
        previewBySiteId={previewBySiteId}
        postingSiteIds={postingSiteIds}
        isPosting={isPosting}
        disabled={disabled}
        gmbConnected={gmbConnected}
        onTopicChange={roster.setTopicForSite}
        onToggleSite={roster.toggleSiteSelected}
        onToggleExpandedSiteId={toggleExpandedSiteId}
        className="h-0 min-h-0 flex-1 w-full"
      />
    </div>
  );
};
