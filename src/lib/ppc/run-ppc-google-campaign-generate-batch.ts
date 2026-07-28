import type { WordPressSite } from "@/components/integrations/types";
import type { PpcCampaign, PpcGenerateConfig } from "@/lib/ppc/google-ads-types";
import {
  createInitialPpcGenerateProgress,
  patchPpcGenerateStep,
  type PpcGenerateProgressState,
} from "@/lib/ppc/google-ads-progress-types";
import { loadPpcGoogleMasterRules } from "@/lib/ppc/load-ppc-google-master-rules";
import { loadPpcGoogleWpContext, resolvePpcAllowedLandingPages } from "@/lib/ppc/google-ads-wp-context";
import {
  summarizePpcCampaignPlanForAvoidance,
  type PpcCampaignPlanAvoidance,
} from "@/lib/ppc/ppc-campaign-plan-avoidance";
import { createPpcBatchProgressReporter } from "@/lib/ppc/ppc-generate-batch-progress";
import { runGoogleAdsCampaignPlan, type PpcCampaignPlanResult } from "@/lib/ppc/run-google-ads-campaign-plan";
import { runPpcGoogleCampaignGenerate } from "@/lib/ppc/run-ppc-google-campaign-generate";

export type PpcCampaignGenerateJob = {
  rowId: string;
  config: PpcGenerateConfig;
  adGroupKeywords?: string[];
  focusKeyword?: string;
};

export type PpcCampaignGenerateJobResult =
  | { rowId: string; ok: true; campaign: PpcCampaign; campaignName: string; config: PpcGenerateConfig }
  | { rowId: string; ok: false; config: PpcGenerateConfig; errorMessage: string };

async function planUniquePpcCampaigns(options: {
  site: WordPressSite;
  apiKey: string;
  model: string;
  jobs: PpcCampaignGenerateJob[];
  wpPages: Awaited<ReturnType<typeof loadPpcGoogleWpContext>>;
  reporter: ReturnType<typeof createPpcBatchProgressReporter>;
  signal?: AbortSignal;
}): Promise<PpcCampaignPlanResult[]> {
  const { site, apiKey, model, jobs, wpPages, reporter, signal } = options;
  const adGroupCount = jobs[0]!.config.adGroupCount;
  const adsPerAdGroup = jobs[0]!.config.adsPerAdGroup;
  const prefetchedPlans: PpcCampaignPlanResult[] = [];
  const avoidPlans: PpcCampaignPlanAvoidance[] = [];

  for (let campaignIndex = 0; campaignIndex < jobs.length; campaignIndex += 1) {
    if (signal?.aborted) break;
    const job = jobs[campaignIndex]!;
    const keywordSeeds = (job.adGroupKeywords ?? []).map((keyword) => keyword.trim()).filter(Boolean);
    const allowedLandingPages = resolvePpcAllowedLandingPages(wpPages, job.config.landingPageUrls);

    let planProgress = createInitialPpcGenerateProgress({
      adGroupCount,
      adsPerAdGroup,
      includePrefetch: false,
    });
    planProgress = patchPpcGenerateStep(planProgress, "campaign-plan", "running");
    reporter.setCampaignProgress(campaignIndex, planProgress);

    const plan = await runGoogleAdsCampaignPlan({
      apiKey,
      model,
      siteId: site.id,
      siteName: site.name,
      adGroupCount: job.config.adGroupCount,
      focusKeyword: job.focusKeyword?.trim() || keywordSeeds[0] || undefined,
      adGroupKeywordSeeds: keywordSeeds,
      landingPages: allowedLandingPages,
      gscPages: [],
      userSelectedLandingUrls: job.config.landingPageUrls,
      campaignIndex: campaignIndex + 1,
      totalCampaigns: jobs.length,
      avoidCampaignPlans: avoidPlans,
      signal,
    });

    prefetchedPlans.push(plan);
    avoidPlans.push(summarizePpcCampaignPlanForAvoidance(plan));

    planProgress = patchPpcGenerateStep(planProgress, "campaign-plan", "done");
    reporter.setCampaignProgress(campaignIndex, planProgress);
  }

  return prefetchedPlans;
}

export async function runPpcGoogleCampaignGenerateBatch(options: {
  site: WordPressSite;
  apiKey: string;
  model: string;
  jobs: PpcCampaignGenerateJob[];
  onProgress: (progress: PpcGenerateProgressState) => void;
  signal?: AbortSignal;
}): Promise<PpcCampaignGenerateJobResult[]> {
  const { site, apiKey, model, jobs, onProgress, signal } = options;
  if (jobs.length === 0) return [];

  const adGroupCount = jobs[0]!.config.adGroupCount;
  const adsPerAdGroup = jobs[0]!.config.adsPerAdGroup;
  const reporter = createPpcBatchProgressReporter({
    campaignCount: jobs.length,
    adGroupCount,
    adsPerAdGroup,
    onProgress,
  });
  reporter.emitInitial();

  if (signal?.aborted) return [];

  reporter.setSharedStep("readMasterRules", "running");
  await loadPpcGoogleMasterRules(site.id);
  reporter.setSharedStep("readMasterRules", "done");

  if (signal?.aborted) return [];

  reporter.setSharedStep("loadWp", "running");
  const wpPages = await loadPpcGoogleWpContext(site);
  reporter.setSharedStep("loadWp", "done");

  if (signal?.aborted) return [];

  const prefetchedPlans = await planUniquePpcCampaigns({
    site,
    apiKey,
    model,
    jobs,
    wpPages,
    reporter,
    signal,
  });

  if (signal?.aborted) return [];

  return Promise.all(
    jobs.map(async (job, campaignIndex) => {
      if (signal?.aborted) {
        return {
          rowId: job.rowId,
          ok: false as const,
          config: job.config,
          errorMessage: "Generation cancelled",
        };
      }

      const prefetchedPlan = prefetchedPlans[campaignIndex];
      if (!prefetchedPlan) {
        return {
          rowId: job.rowId,
          ok: false as const,
          config: job.config,
          errorMessage: "Campaign plan missing",
        };
      }

      try {
        const result = await runPpcGoogleCampaignGenerate({
          site,
          apiKey,
          model,
          config: job.config,
          adGroupKeywords: job.adGroupKeywords,
          focusKeyword: job.focusKeyword,
          prefetchedWpPages: wpPages,
          prefetchedPlan,
          onProgress: (progress) => reporter.setCampaignProgress(campaignIndex, progress),
          signal,
        });
        return {
          rowId: job.rowId,
          ok: true as const,
          campaign: result.campaign,
          campaignName: result.campaignName,
          config: job.config,
        };
      } catch (err) {
        return {
          rowId: job.rowId,
          ok: false as const,
          config: job.config,
          errorMessage: err instanceof Error ? err.message : "Campaign generation failed",
        };
      }
    }),
  );
}
