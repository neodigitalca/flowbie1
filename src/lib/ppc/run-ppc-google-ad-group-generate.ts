import type { WordPressSite } from "@/components/integrations/types";
import type { PpcAdGroup, PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import { loadPpcGoogleGscContext } from "@/lib/ppc/google-ads-gsc-context";
import {
  createPpcAdGroupGenerateProgress,
  patchPpcGenerateStep,
  ppcAdGroupAdStepId,
  ppcAdGroupKeywordsStepId,
  type PpcGenerateProgressState,
  type PpcGenerateStepId,
} from "@/lib/ppc/google-ads-progress-types";
import { loadPpcGoogleMasterRules } from "@/lib/ppc/load-ppc-google-master-rules";
import { loadPpcGoogleWpContext } from "@/lib/ppc/google-ads-wp-context";
import { runGoogleAdsAdGroupKeywords } from "@/lib/ppc/run-google-ads-ad-group-keywords";
import type { PpcCampaignPlanAdGroup } from "@/lib/ppc/run-google-ads-campaign-plan";
import { runGoogleAdsRsaCopy } from "@/lib/ppc/run-google-ads-rsa-copy";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

export type RunPpcGoogleAdGroupGenerateOptions = {
  site: WordPressSite;
  apiKey: string;
  model: string;
  campaignName: string;
  adGroupIndex: number;
  adsPerAdGroup: number;
  planGroup: PpcCampaignPlanAdGroup;
  adGroupKeywordSeed?: string;
  prefetchedWpPages?: PpcWpPageContext[];
  onProgress?: (progress: PpcGenerateProgressState) => void;
  signal?: AbortSignal;
};

function createAdId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function findPageContext(pages: PpcWpPageContext[], url: string): PpcWpPageContext | undefined {
  const key = normalizePageUrlKey(url);
  return pages.find((page) => normalizePageUrlKey(page.url) === key);
}

export async function runPpcGoogleAdGroupGenerate(
  options: RunPpcGoogleAdGroupGenerateOptions,
): Promise<PpcAdGroup> {
  const {
    site,
    apiKey,
    model,
    campaignName,
    adGroupIndex,
    adsPerAdGroup,
    planGroup,
    adGroupKeywordSeed,
    prefetchedWpPages,
    onProgress,
    signal,
  } = options;

  let progress = createPpcAdGroupGenerateProgress(adGroupIndex, adsPerAdGroup);
  onProgress?.(progress);

  const runStep = async <T>(stepId: PpcGenerateStepId, fn: () => Promise<T>): Promise<T> => {
    progress = patchPpcGenerateStep(progress, stepId, "running");
    onProgress?.(progress);
    try {
      const result = await fn();
      progress = patchPpcGenerateStep(progress, stepId, "done");
      onProgress?.(progress);
      return result;
    } catch (err) {
      progress = patchPpcGenerateStep(
        progress,
        stepId,
        "error",
        err instanceof Error ? err.message : "Step failed",
      );
      onProgress?.(progress);
      throw err;
    }
  };

  const wpPages = prefetchedWpPages ?? (await loadPpcGoogleWpContext(site));
  if (!prefetchedWpPages) {
    await loadPpcGoogleMasterRules(site.id);
  }

  const landingPage = findPageContext(wpPages, planGroup.landingPageUrl);
  if (!landingPage) {
    throw new Error(`Landing page not in page bucket: ${planGroup.landingPageUrl}`);
  }

  const gscPages = await runStep("load-gsc", () =>
    loadPpcGoogleGscContext(site, [landingPage], signal),
  );
  const gscPage = gscPages[0];

  const keywordsStepId = ppcAdGroupKeywordsStepId(adGroupIndex);
  const keywordsResult = await runStep(keywordsStepId, () =>
    runGoogleAdsAdGroupKeywords({
      apiKey,
      model,
      siteId: site.id,
      campaignName,
      adGroup: planGroup,
      landingPage,
      gscPage,
      focusKeyword: adGroupKeywordSeed,
      signal,
    }),
  );

  const ads: PpcAdGroup["ads"] = [];
  for (let j = 0; j < adsPerAdGroup; j += 1) {
    const adIndex = j + 1;
    const rsa = await runStep(ppcAdGroupAdStepId(adGroupIndex, adIndex), () =>
      runGoogleAdsRsaCopy({
        apiKey,
        model,
        siteId: site.id,
        campaignName,
        adGroup: planGroup,
        landingPage,
        keywords: keywordsResult.keywords,
        adIndex,
        adsPerAdGroup,
        signal,
      }),
    );

    ads.push({
      id: createAdId(`ad-${adGroupIndex}-${adIndex}`),
      headlines: rsa.headlines,
      descriptions: rsa.descriptions,
      finalUrl: planGroup.landingPageUrl,
      path1: rsa.path1,
      path2: rsa.path2,
    });
  }

  progress = {
    ...progress,
    activeStepId: null,
    label: `Ad group ${adGroupIndex}`,
    statusMessage: "Complete",
  };
  onProgress?.(progress);

  return {
    id: createAdId(`ag-${adGroupIndex}`),
    name: planGroup.name,
    landingPageUrl: planGroup.landingPageUrl,
    keywords: keywordsResult.keywords,
    ads,
  };
}
