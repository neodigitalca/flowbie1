import {

  NOTIFY_GBP_BATCH_COMPLETE,

  NOTIFY_OPENROUTER_API_KEY_REQUIRED_IN_API_KEYS_,

  notifyGbpPostsFailedForXPropertxCheckCo,

} from "@/lib/notify-messages";

import type { WordPressSite } from "@/components/integrations/types";

import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";

import { notify } from "@/lib/app-notifications";

import { filterSitesWithGbpLocation } from "@/lib/gbp-post/gbp-site-eligibility";

import { runGbpSitePostBatch, type GbpSitePostBatchResult } from "@/lib/gbp-post/gbp-post-one-site";

import type { GbpSchedulerSectionState } from "@/lib/gbp-post/gbp-schedule-plan";

import type { GbpPublishPreview } from "@/components/gbp-post/GbpPostPublishPreview";

import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";



export type GbpMultiSiteBatchResult = {

  propertiesAttempted: number;

  published: number;

  queued: number;

  failed: number;

  skippedNoGbpLink: number;

};



export type RunGbpMultiSiteBatchParams = {

  sites: WordPressSite[];

  /** Fallback when resolveKeyword is omitted. */

  keyword?: string;

  /** Per-property topic/keyword for the GBP post harness. */

  resolveKeyword?: (site: WordPressSite) => string;

  scheduler: GbpSchedulerSectionState;

  openRouterApiKey: string;

  sitemapSource: OverviewSitemapSource;

  onProgress?: (line: string) => void;

  onHarnessSection?: (site: WordPressSite, payload: BulkHarnessSectionPayload) => void;

  onPreview?: (site: WordPressSite, preview: GbpPublishPreview) => void;

  /** @deprecated Sequential-only; unused in parallel batch. */

  onPropertyIndex?: (index: number, total: number) => void;

  /** Fresh UI/state for each property before pipeline runs. */

  onPropertyStart?: (site: WordPressSite, index: number, total: number) => void;

  onPropertyComplete?: (site: WordPressSite, result: GbpSitePostBatchResult) => void;

};



/**

 * One GBP post (slot 0) per property that has a GBP Location ID, A–Z by name.

 * All properties run in parallel with no concurrency cap.

 */

export async function runGbpMultiSiteBatch(

  params: RunGbpMultiSiteBatchParams,

): Promise<GbpMultiSiteBatchResult> {

  const {

    sites,

    keyword = "",

    resolveKeyword,

    scheduler,

    openRouterApiKey,

    onProgress,

    onHarnessSection,

    onPreview,

    onPropertyStart,

    onPropertyComplete,

    sitemapSource,

  } = params;



  const withGbpLink = filterSitesWithGbpLocation(sites);

  const skippedNoGbpLink = sites.length - withGbpLink.length;



  if (!openRouterApiKey.trim()) {

    notify.error(NOTIFY_OPENROUTER_API_KEY_REQUIRED_IN_API_KEYS_);

    return {

      propertiesAttempted: 0,

      published: 0,

      queued: 0,

      failed: 0,

      skippedNoGbpLink,

    };

  }



  if (withGbpLink.length === 0) {

    return {

      propertiesAttempted: 0,

      published: 0,

      queued: 0,

      failed: 0,

      skippedNoGbpLink,

    };

  }



  const total = withGbpLink.length;

  for (let i = 0; i < total; i += 1) {

    const site = withGbpLink[i];

    const gbpId = site.gbpLocationId?.trim() ?? "";

    onPropertyStart?.(site, i, total);

    onProgress?.(

      `${site.name}: starting (GBP location ${gbpId.slice(-8) || "id"})`,

    );

  }



  const settled = await Promise.allSettled(

    withGbpLink.map(async (site) => {
      const siteKeyword = resolveKeyword?.(site) ?? keyword;
      const result = await runGbpSitePostBatch({

        site,

        keyword: siteKeyword,

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
      return result;
    }),

  );



  let published = 0;

  let queued = 0;

  let failed = 0;



  for (const outcome of settled) {

    if (outcome.status === "fulfilled") {

      published += outcome.value.published;

      queued += outcome.value.queued;

      failed += outcome.value.failed;

    } else {

      failed += 1;

    }

  }



  const propertiesAttempted = withGbpLink.length;

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

    skippedNoGbpLink,

  };

}


