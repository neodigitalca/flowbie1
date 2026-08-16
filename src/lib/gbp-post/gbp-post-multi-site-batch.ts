import {
  NOTIFY_GBP_BATCH_COMPLETE,
  NOTIFY_OPENROUTER_API_KEY_REQUIRED_IN_API_KEYS_,
  notifyGbpPostsFailedForXPropertxCheckCo,
} from "@/lib/notify-messages";
import type { WordPressSite } from "@/components/integrations/types";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { notify } from "@/lib/app-notifications";
import { filterSitesWithGbpLocation, gbpPostBulkSkipReason } from "@/lib/gbp-post/gbp-site-eligibility";
import { resolveGbpSitemapUrlForSite } from "@/lib/gbp-post/gbp-sitemap-source";
import { runGbpSitePostBatch, type GbpSitePostBatchResult } from "@/lib/gbp-post/gbp-post-one-site";
import type { GbpSchedulerSectionState } from "@/lib/gbp-post/gbp-schedule-plan";
import type { GbpPublishPreview } from "@/components/gbp-post/GbpPostPublishPreview";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";

export type GbpMultiSiteBatchResult = {
  propertiesAttempted: number;
  published: number;
  queued: number;
  failed: number;
  lastError?: string;
  skippedNoGbpLink: number;
  skippedIneligible: number;
};

export type RunGbpMultiSiteBatchParams = {
  sites: WordPressSite[];
  /** Fallback when resolveKeyword is omitted. */
  keyword?: string;
  /** Per-property topic/keyword for the GBP post harness. */
  resolveKeyword?: (site: WordPressSite) => string;
  /** Per-property landing page URL; when set, drives CTA/blog pick. */
  resolveLandingPageUrl?: (site: WordPressSite) => string;
  scheduler: GbpSchedulerSectionState;
  openRouterApiKey: string;
  sitemapSource: OverviewSitemapSource;
  onProgress?: (line: string) => void;
  onHarnessSection?: (site: WordPressSite, payload: BulkHarnessSectionPayload) => void;
  onPreview?: (site: WordPressSite, preview: GbpPublishPreview) => void;
  onPropertyIndex?: (index: number, total: number) => void;
  /** Fresh UI/state for each property before pipeline runs. */
  onPropertyStart?: (site: WordPressSite, index: number, total: number) => void;
  onPropertyComplete?: (site: WordPressSite, result: GbpSitePostBatchResult) => void;
};

/**
 * One GBP post (slot 0) per property that has a GBP Location ID, A–Z by name.
 * Properties run sequentially in that order.
 */
export async function runGbpMultiSiteBatch(
  params: RunGbpMultiSiteBatchParams,
): Promise<GbpMultiSiteBatchResult> {
  const {
    sites,
    keyword = "",
    resolveKeyword,
    resolveLandingPageUrl,
    scheduler,
    openRouterApiKey,
    onProgress,
    onHarnessSection,
    onPreview,
    onPropertyStart,
    onPropertyComplete,
    onPropertyIndex,
    sitemapSource,
  } = params;

  const withGbpLink = filterSitesWithGbpLocation(sites);
  const skippedNoGbpLink = sites.length - withGbpLink.length;
  const runnable: WordPressSite[] = [];
  let skippedIneligible = 0;

  for (const site of withGbpLink) {
    const skipReason = gbpPostBulkSkipReason(site);
    if (skipReason) {
      skippedIneligible += 1;
      onProgress?.(`${site.name}: skipped (${skipReason})`);
      continue;
    }
    if (!resolveGbpSitemapUrlForSite(site, sitemapSource)) {
      skippedIneligible += 1;
      onProgress?.(`${site.name}: skipped (sitemap not configured)`);
      continue;
    }
    runnable.push(site);
  }

  if (!openRouterApiKey.trim()) {
    notify.error(NOTIFY_OPENROUTER_API_KEY_REQUIRED_IN_API_KEYS_);
    return {
      propertiesAttempted: 0,
      published: 0,
      queued: 0,
      failed: 0,
      skippedNoGbpLink,
      skippedIneligible,
    };
  }

  if (runnable.length === 0) {
    return {
      propertiesAttempted: 0,
      published: 0,
      queued: 0,
      failed: 0,
      skippedNoGbpLink,
      skippedIneligible,
    };
  }

  const total = runnable.length;
  let published = 0;
  let queued = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (let i = 0; i < total; i += 1) {
    const site = runnable[i];
    const gbpId = site.gbpLocationId?.trim() ?? "";
    const siteKeyword = resolveKeyword?.(site) ?? keyword;
    const siteLandingPageUrl = resolveLandingPageUrl?.(site) ?? "";

    onPropertyIndex?.(i, total);
    onPropertyStart?.(site, i, total);
    onProgress?.(`${site.name}: starting (GBP location ${gbpId.slice(-8) || "id"})`);

    try {
      const result = await runGbpSitePostBatch({
        site,
        keyword: siteKeyword,
        landingPageUrl: siteLandingPageUrl,
        scheduler,
        openRouterApiKey,
        totalPosts: 1,
        sitemapSource,
        notifyOnSlotFailure: false,
        onStatus: (line) => onProgress?.(`${site.name}: ${line}`),
        onHarnessSection: onHarnessSection
          ? (payload) => onHarnessSection(site, payload)
          : undefined,
        onPreview: onPreview ? (preview) => onPreview(site, preview) : undefined,
      });

      onPropertyComplete?.(site, result);
      published += result.published;
      queued += result.queued;
      failed += result.failed;
      if (result.lastError) {
        lastError = result.lastError;
      }
    } catch (e) {
      failed += 1;
      lastError = e instanceof Error ? e.message : "GBP post failed";
      onProgress?.(`${site.name}: ${lastError}`);
    }
  }

  const propertiesAttempted = runnable.length;
  if (published + queued > 0) {
    notify.success(NOTIFY_GBP_BATCH_COMPLETE);
  } else if (failed > 0) {
    notify.error(notifyGbpPostsFailedForXPropertxCheckCo(failed, failed === 1 ? "y" : "ies"));
  }

  return {
    propertiesAttempted,
    published,
    queued,
    failed,
    lastError,
    skippedNoGbpLink,
    skippedIneligible,
  };
}
