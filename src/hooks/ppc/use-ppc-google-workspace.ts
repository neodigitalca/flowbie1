import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import { overviewGridPageSlice } from "@/components/overview/OverviewGridPagination";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import {
  clampPpcAdGroupCount,
  clampPpcAdsPerAdGroup,
  clampPpcCampaignCount,
  type PpcCampaignRow,
  type PpcGenerateConfig,
  type PpcWpPageContext,
  resolvePpcRowAdGroupKeywords,
  resolvePpcRowCampaignName,
  resolvePpcRowLandingPageUrl,
  ppcRowPatchFromGeneratedCampaign,
  ppcRowUserInputPreserve,
} from "@/lib/ppc/google-ads-types";
import type { PpcGenerateProgressState } from "@/lib/ppc/google-ads-progress-types";
import {
  getPpcGoogleCampaignsSessionCache,
  setPpcGoogleCampaignsSessionCache,
  clearPpcGoogleCampaignsSessionCache,
} from "@/lib/ppc/google-ads-session-cache";
import { loadPpcGoogleWpContext, resolvePpcAllowedLandingPages } from "@/lib/ppc/google-ads-wp-context";
import {
  createPpcPageBucketHostedLink,
  revokePpcPageBucketHostedLink,
  type PpcPageBucketHostedLink,
} from "@/lib/ppc/ppc-page-bucket-inventory";
import {
  ppcGoogleGridRowCount,
  PPC_GOOGLE_PLACEHOLDER_ROW_COUNT,
} from "@/components/ppc/google/google-ads-row-constants";
import { runPpcGoogleCampaignGenerate } from "@/lib/ppc/run-ppc-google-campaign-generate";
import { runPpcGoogleCampaignGenerateBatch } from "@/lib/ppc/run-ppc-google-campaign-generate-batch";
import { mergePpcGeneratedAdGroupIntoCampaign } from "@/lib/ppc/merge-ppc-generated-ad-group";
import {
  summarizePpcAdGroupForAvoidance,
  summarizePpcCampaignForAvoidance,
} from "@/lib/ppc/ppc-campaign-plan-avoidance";
import { runPpcGoogleAdGroupGenerate } from "@/lib/ppc/run-ppc-google-ad-group-generate";
import { runGoogleAdsCampaignPlan } from "@/lib/ppc/run-google-ads-campaign-plan";
import { syncPpcCampaignRowsToCount } from "@/lib/ppc/sync-ppc-campaign-rows";
import {
  buildGoogleAdsEditorCsv,
  googleAdsExportFilename,
  triggerGoogleAdsCsvDownload,
} from "@/lib/ppc/export-google-ads-campaign-csv";
import {
  readPpcGenerateConfig,
  writePpcGenerateConfig,
} from "@/lib/ppc/google-ads-generate-config-storage";

export type UsePpcGoogleWorkspaceOptions = {
  site: WordPressSite;
  apiKey: string;
  selectedModel: string;
};

export type PpcGoogleSortColumn = "title" | "date" | null;

export function usePpcGoogleWorkspace({ site, apiKey, selectedModel }: UsePpcGoogleWorkspaceOptions) {
  const [campaigns, setCampaigns] = useState<PpcCampaignRow[]>(() => {
    return getPpcGoogleCampaignsSessionCache(site.id) ?? [];
  });
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [gridPageIndex, setGridPageIndex] = useState(0);
  const [sortColumn, setSortColumn] = useState<PpcGoogleSortColumn>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [generateConfig, setGenerateConfig] = useState<PpcGenerateConfig>(() =>
    readPpcGenerateConfig(site.id),
  );
  const [generateProgress, setGenerateProgress] = useState<PpcGenerateProgressState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingAdGroupKey, setGeneratingAdGroupKey] = useState<string | null>(null);
  const [wpPages, setWpPages] = useState<PpcWpPageContext[]>([]);
  const [wpPagesLoading, setWpPagesLoading] = useState(false);
  const [pageBucketHostedLink, setPageBucketHostedLink] = useState<PpcPageBucketHostedLink | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pageBucketLinkRef = useRef<string | null>(null);

  useEffect(() => {
    const config = readPpcGenerateConfig(site.id);
    const adGroupCount = clampPpcAdGroupCount(config.adGroupCount);
    setCampaigns(
      syncPpcCampaignRowsToCount(
        getPpcGoogleCampaignsSessionCache(site.id) ?? [],
        clampPpcCampaignCount(config.campaignCount),
        adGroupCount,
      ),
    );
    setExpandedCampaignId(null);
    setGridPageIndex(0);
    setGenerateProgress(null);
    setIsGenerating(false);
    setGenerateConfig(config);
  }, [site.id]);

  useEffect(() => {
    let cancelled = false;
    setWpPages([]);
    setWpPagesLoading(true);
    revokePpcPageBucketHostedLink(pageBucketLinkRef.current);
    pageBucketLinkRef.current = null;
    setPageBucketHostedLink(null);

    loadPpcGoogleWpContext(site)
      .then((pages) => {
        if (cancelled) return;
        setWpPages(pages);
        const link = createPpcPageBucketHostedLink(site.siteUrl, pages);
        pageBucketLinkRef.current = link.href;
        setPageBucketHostedLink(link);
      })
      .catch(() => {
        if (!cancelled) setWpPages([]);
      })
      .finally(() => {
        if (!cancelled) setWpPagesLoading(false);
      });
    return () => {
      cancelled = true;
      revokePpcPageBucketHostedLink(pageBucketLinkRef.current);
      pageBucketLinkRef.current = null;
    };
  }, [site.id, site.siteUrl, site.username, site.appPassword]);

  useEffect(() => {
    writePpcGenerateConfig(site.id, generateConfig);
  }, [generateConfig, site.id]);

  useEffect(() => {
    const target = clampPpcCampaignCount(generateConfig.campaignCount);
    const adGroupCount = clampPpcAdGroupCount(generateConfig.adGroupCount);
    setCampaigns((prev) => syncPpcCampaignRowsToCount(prev, target, adGroupCount));
  }, [generateConfig.campaignCount, generateConfig.adGroupCount]);

  useEffect(() => {
    if (campaigns.length) {
      setPpcGoogleCampaignsSessionCache(site.id, campaigns);
    } else {
      clearPpcGoogleCampaignsSessionCache(site.id);
    }
  }, [campaigns, site.id]);

  useEffect(() => {
    setGridPageIndex(0);
  }, [sortColumn, sortDir, campaigns.length]);

  const displayCampaigns = useMemo(() => {
    const sorted = [...campaigns];
    if (sortColumn === "title") {
      sorted.sort((a, b) => {
        const av = (a.campaignName || a.campaign?.name || "").toLowerCase();
        const bv = (b.campaignName || b.campaign?.name || "").toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    } else if (sortColumn === "date") {
      sorted.sort((a, b) => {
        const av = a.createdAt || "";
        const bv = b.createdAt || "";
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return sorted;
  }, [campaigns, sortColumn, sortDir]);

  const paginatedCampaigns = useMemo(
    () => overviewGridPageSlice(displayCampaigns, gridPageIndex),
    [displayCampaigns, gridPageIndex],
  );

  const toggleExpandedCampaignId = useCallback((id: string) => {
    setExpandedCampaignId((prev) => (prev === id ? null : id));
  }, []);

  const updateCampaign = useCallback((id: string, patch: Partial<PpcCampaignRow>) => {
    setCampaigns((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const handleDeleteCampaign = useCallback(
    (id: string) => {
      if (isGenerating) return;
      const targetCount = clampPpcCampaignCount(generateConfig.campaignCount);
      const adGroupCount = clampPpcAdGroupCount(generateConfig.adGroupCount);
      setCampaigns((prev) =>
        syncPpcCampaignRowsToCount(
          prev.filter((row) => row.id !== id),
          targetCount,
          adGroupCount,
        ),
      );
      setExpandedCampaignId((prev) => (prev === id ? null : prev));
    },
    [isGenerating, generateConfig.campaignCount, generateConfig.adGroupCount],
  );

  const loadWpPagesForPicker = useCallback(async () => {
    if (wpPagesLoading || wpPages.length) return;
    setWpPagesLoading(true);
    try {
      const pages = await loadPpcGoogleWpContext(site);
      setWpPages(pages);
    } catch {
      setWpPages([]);
    } finally {
      setWpPagesLoading(false);
    }
  }, [site, wpPages.length, wpPagesLoading]);

  const handleGenerateCampaign = useCallback(async () => {
    if (isGenerating || !apiKey?.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const config: PpcGenerateConfig = {
      campaignCount: clampPpcCampaignCount(generateConfig.campaignCount),
      adGroupCount: clampPpcAdGroupCount(generateConfig.adGroupCount),
      landingPageUrls: [],
      adsPerAdGroup: clampPpcAdsPerAdGroup(generateConfig.adsPerAdGroup),
    };

    const targetRows = campaigns.slice(0, config.campaignCount);
    const rowIds = targetRows.map((row) => row.id);

    setCampaigns((prev) =>
      prev.map((row) =>
        rowIds.includes(row.id)
          ? { ...row, status: "generating" as const, config, errorMessage: undefined }
          : row,
      ),
    );
    setIsGenerating(true);

    try {
      const jobs = targetRows.map((sourceRow) => {
        const rowLandingUrls = sourceRow?.landingPageUrl?.trim()
          ? [sourceRow.landingPageUrl.trim()]
          : [];
        return {
          rowId: sourceRow.id,
          config: {
            ...config,
            landingPageUrls: rowLandingUrls,
          } satisfies PpcGenerateConfig,
          adGroupKeywords: resolvePpcRowAdGroupKeywords(sourceRow, config.adGroupCount),
          focusKeyword: sourceRow.focusKeyword?.trim() || undefined,
        };
      });

      const patchRowFromCampaign = (row: PpcCampaignRow, campaign: PpcCampaign) =>
        ppcRowPatchFromGeneratedCampaign(campaign, ppcRowUserInputPreserve(row));

      if (jobs.length === 1) {
        const job = jobs[0]!;
        const sourceRow = targetRows[0]!;
        const result = await runPpcGoogleCampaignGenerate({
          site,
          apiKey,
          model: selectedModel,
          config: job.config,
          adGroupKeywords: job.adGroupKeywords,
          focusKeyword: job.focusKeyword,
          onProgress: setGenerateProgress,
          signal: controller.signal,
        });

        updateCampaign(job.rowId, {
          status: "ready",
          campaign: result.campaign,
          config: job.config,
          errorMessage: undefined,
          ...patchRowFromCampaign(sourceRow, result.campaign),
        });
      } else {
        const results = await runPpcGoogleCampaignGenerateBatch({
          site,
          apiKey,
          model: selectedModel,
          jobs,
          onProgress: setGenerateProgress,
          signal: controller.signal,
        });

        for (const outcome of results) {
          if (outcome.ok) {
            const sourceRow = targetRows.find((row) => row.id === outcome.rowId);
            updateCampaign(outcome.rowId, {
              status: "ready",
              campaign: outcome.campaign,
              config: outcome.config,
              errorMessage: undefined,
              ...(sourceRow
                ? patchRowFromCampaign(sourceRow, outcome.campaign)
                : ppcRowPatchFromGeneratedCampaign(outcome.campaign)),
            });
          } else {
            updateCampaign(outcome.rowId, {
              status: "error",
              config: outcome.config,
              errorMessage: outcome.errorMessage,
            });
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Campaign generation failed";
      setCampaigns((prev) =>
        prev.map((row) =>
          rowIds.includes(row.id) && row.status === "generating"
            ? { ...row, status: "error", errorMessage: message }
            : row,
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  }, [
    apiKey,
    campaigns,
    generateConfig,
    isGenerating,
    selectedModel,
    site,
    updateCampaign,
  ]);

  const handleGenerateCampaignRow = useCallback(
    async (rowId: string) => {
      if (isGenerating || !apiKey?.trim()) return;

      const sourceRow = campaigns.find((row) => row.id === rowId);
      if (!sourceRow) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const rowConfig: PpcGenerateConfig = {
        campaignCount: 1,
        adGroupCount: clampPpcAdGroupCount(generateConfig.adGroupCount),
        landingPageUrls: sourceRow.landingPageUrl?.trim() ? [sourceRow.landingPageUrl.trim()] : [],
        adsPerAdGroup: clampPpcAdsPerAdGroup(generateConfig.adsPerAdGroup),
      };

      updateCampaign(rowId, {
        status: "generating",
        config: rowConfig,
        campaign: undefined,
        errorMessage: undefined,
      });
      setIsGenerating(true);

      const avoidCampaignPlans = campaigns
        .filter((row) => row.id !== rowId && row.campaign)
        .map((row) => summarizePpcCampaignForAvoidance(row.campaign!));

      try {
        const result = await runPpcGoogleCampaignGenerate({
          site,
          apiKey,
          model: selectedModel,
          config: rowConfig,
          adGroupKeywords: resolvePpcRowAdGroupKeywords(sourceRow, rowConfig.adGroupCount),
          focusKeyword: sourceRow.focusKeyword?.trim() || undefined,
          avoidCampaignPlans,
          onProgress: setGenerateProgress,
          signal: controller.signal,
        });

        updateCampaign(rowId, {
          status: "ready",
          campaign: result.campaign,
          config: rowConfig,
          errorMessage: undefined,
          ...ppcRowPatchFromGeneratedCampaign(result.campaign, ppcRowUserInputPreserve(sourceRow)),
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Campaign generation failed";
        updateCampaign(rowId, {
          status: "error",
          config: rowConfig,
          errorMessage: message,
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [apiKey, campaigns, generateConfig, isGenerating, selectedModel, site, updateCampaign, wpPages],
  );

  const handleGenerateAdGroup = useCallback(
    async (rowId: string, adGroupIndex: number) => {
      if (isGenerating || !apiKey?.trim()) return;

      const sourceRow = campaigns.find((row) => row.id === rowId);
      if (!sourceRow) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const adGroupCount = clampPpcAdGroupCount(generateConfig.adGroupCount);
      const adsPerAdGroup = clampPpcAdsPerAdGroup(generateConfig.adsPerAdGroup);
      const keywordSeeds = resolvePpcRowAdGroupKeywords(sourceRow, adGroupCount);
      const adGroupKey = `${rowId}:${adGroupIndex}`;

      setGeneratingAdGroupKey(adGroupKey);
      setIsGenerating(true);

      try {
        let pages = wpPages;
        if (!pages.length) {
          pages = await loadPpcGoogleWpContext(site);
          setWpPages(pages);
        }

        const rowLandingUrls = sourceRow.landingPageUrl?.trim() ? [sourceRow.landingPageUrl.trim()] : [];
        const allowedLandingPages = resolvePpcAllowedLandingPages(pages, rowLandingUrls);
        const campaignName = resolvePpcRowCampaignName(sourceRow);
        const defaultLandingPageUrl = resolvePpcRowLandingPageUrl(sourceRow);
        const existingAdGroup = sourceRow.campaign?.adGroups[adGroupIndex];

        let planGroup;
        if (existingAdGroup?.landingPageUrl?.trim()) {
          planGroup = {
            name: existingAdGroup.name,
            landingPageUrl: existingAdGroup.landingPageUrl,
            theme: existingAdGroup.name,
          };
        } else {
          const siblingAvoid = (sourceRow.campaign?.adGroups ?? [])
            .filter((adGroup, index) => index !== adGroupIndex && (adGroup.keywords.length > 0 || adGroup.ads.length > 0))
            .map(summarizePpcAdGroupForAvoidance);

          const plan = await runGoogleAdsCampaignPlan({
            apiKey,
            model: selectedModel,
            siteId: site.id,
            siteName: site.name,
            adGroupCount: 1,
            focusKeyword: keywordSeeds[adGroupIndex]?.trim() || sourceRow.focusKeyword?.trim() || undefined,
            adGroupKeywordSeeds: keywordSeeds[adGroupIndex]?.trim()
              ? [keywordSeeds[adGroupIndex]!.trim()]
              : [],
            landingPages: allowedLandingPages,
            gscPages: [],
            userSelectedLandingUrls: rowLandingUrls,
            avoidCampaignPlans: siblingAvoid,
            signal: controller.signal,
          });
          planGroup = plan.adGroups[0]!;
        }

        const generated = await runPpcGoogleAdGroupGenerate({
          site,
          apiKey,
          model: selectedModel,
          campaignName,
          adGroupIndex: adGroupIndex + 1,
          adsPerAdGroup,
          planGroup,
          adGroupKeywordSeed: keywordSeeds[adGroupIndex]?.trim() || undefined,
          prefetchedWpPages: pages,
          onProgress: setGenerateProgress,
          signal: controller.signal,
        });

        const mergedCampaign = mergePpcGeneratedAdGroupIntoCampaign({
          campaign: sourceRow.campaign,
          adGroupCount,
          adGroupIndex,
          generated,
          keywordSeeds,
          defaultLandingPageUrl,
          campaignName,
        });

        updateCampaign(rowId, {
          status: "ready",
          campaign: mergedCampaign,
          errorMessage: undefined,
          ...ppcRowPatchFromGeneratedCampaign(mergedCampaign, ppcRowUserInputPreserve(sourceRow)),
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Ad group generation failed";
        updateCampaign(rowId, { errorMessage: message });
      } finally {
        setGeneratingAdGroupKey(null);
        setIsGenerating(false);
      }
    },
    [apiKey, campaigns, generateConfig, isGenerating, selectedModel, site, updateCampaign, wpPages],
  );

  const handleExportGoogleAdsCsv = useCallback(() => {
    const csv = buildGoogleAdsEditorCsv(campaigns);
    triggerGoogleAdsCsvDownload(googleAdsExportFilename(site.name), csv);
  }, [campaigns, site.name]);

  const canExportGoogleAdsCsv = useMemo(
    () => campaigns.some((row) => row.status === "ready" && row.campaign),
    [campaigns],
  );

  const bulkMicroSnapshot = useMemo((): MetaBulkMicroSnapshot | null => {
    if (!isGenerating || !generateProgress) return null;
    const active = generateProgress.steps.find((s) => s.status === "running");
    return {
      label: active?.label ?? generateProgress.label,
      completed: generateProgress.completed,
      total: generateProgress.total,
      statusMessage: generateProgress.statusMessage,
      progressPct:
        generateProgress.total > 0
          ? Math.round((generateProgress.completed / generateProgress.total) * 100)
          : 0,
    };
  }, [generateProgress, isGenerating]);

  const canOpenDetails = Boolean(
    pageBucketHostedLink || isGenerating || (generateProgress && generateProgress.completed > 0),
  );

  const workspaceBusy = isGenerating;

  const gridPaginationTotal = useMemo(
    () => ppcGoogleGridRowCount(displayCampaigns.length),
    [displayCampaigns.length],
  );

  const paginationLayoutTotal = PPC_GOOGLE_PLACEHOLDER_ROW_COUNT;

  return {
    site,
    campaigns,
    displayCampaigns,
    paginatedCampaigns,
    expandedCampaignId,
    toggleExpandedCampaignId,
    gridPageIndex,
    setGridPageIndex,
    sortColumn,
    setSortColumn,
    sortDir,
    setSortDir,
    generateConfig,
    setGenerateConfig,
    generateProgress,
    isGenerating,
    wpPages,
    wpPagesLoading,
    pageBucketHostedLink,
    loadWpPagesForPicker,
    handleGenerateCampaign,
    handleGenerateCampaignRow,
    handleGenerateAdGroup,
    handleDeleteCampaign,
    generatingAdGroupKey,
    handleExportGoogleAdsCsv,
    canExportGoogleAdsCsv,
    updateCampaign,
    bulkMicroSnapshot,
    canOpenDetails,
    workspaceBusy,
    gridPaginationTotal,
    paginationLayoutTotal,
  };
}

export type PpcGoogleWorkspaceController = ReturnType<typeof usePpcGoogleWorkspace>;
