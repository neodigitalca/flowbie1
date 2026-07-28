import type { PipelineStepStatus } from "@/components/overview/overview-tab-constants";
import {
  buildPpcGenerateStepPlan,
  type PpcGenerateProgressState,
} from "@/lib/ppc/google-ads-progress-types";

export type PpcBatchSharedStepState = {
  readMasterRules: PipelineStepStatus;
  loadWp: PipelineStepStatus;
};

export function createInitialPpcBatchSharedSteps(): PpcBatchSharedStepState {
  return { readMasterRules: "waiting", loadWp: "waiting" };
}

export function mergePpcBatchGenerateProgress(params: {
  campaignCount: number;
  adGroupCount: number;
  adsPerAdGroup: number;
  shared: PpcBatchSharedStepState;
  campaigns: Array<PpcGenerateProgressState | null>;
}): PpcGenerateProgressState {
  const { campaignCount, adGroupCount, adsPerAdGroup, shared, campaigns } = params;
  const campaignOnlyPlan = buildPpcGenerateStepPlan({
    adGroupCount,
    adsPerAdGroup,
    includePrefetch: false,
  });

  const steps = [
    { id: "shared-read-master-rules", label: "Reading master rules", status: shared.readMasterRules },
    { id: "shared-load-wp", label: "Load page bucket", status: shared.loadWp },
  ];

  for (let campaignIndex = 0; campaignIndex < campaignCount; campaignIndex += 1) {
    const prefix = campaignCount > 1 ? `Campaign ${campaignIndex + 1} · ` : "";
    const snapshot = campaigns[campaignIndex];
    for (const step of campaignOnlyPlan) {
      steps.push({
        id: `c${campaignIndex}-${step.id}`,
        label: `${prefix}${step.label}`,
        status: snapshot?.steps.find((row) => row.id === step.id)?.status ?? "waiting",
      });
    }
  }

  const completed = steps.filter((step) => step.status === "done").length;
  const running = steps.find((step) => step.status === "running");
  const errored = steps.find((step) => step.status === "error");

  return {
    steps,
    activeStepId: null,
    completed,
    total: steps.length,
    label: campaignCount > 1 ? "Generate campaigns" : "Generate campaign",
    statusMessage: errored?.label ?? running?.label,
  };
}

export function createPpcBatchProgressReporter(params: {
  campaignCount: number;
  adGroupCount: number;
  adsPerAdGroup: number;
  onProgress: (progress: PpcGenerateProgressState) => void;
}) {
  const shared = createInitialPpcBatchSharedSteps();
  const campaigns: Array<PpcGenerateProgressState | null> = Array.from(
    { length: params.campaignCount },
    () => null,
  );

  const emit = () => {
    params.onProgress(
      mergePpcBatchGenerateProgress({
        campaignCount: params.campaignCount,
        adGroupCount: params.adGroupCount,
        adsPerAdGroup: params.adsPerAdGroup,
        shared,
        campaigns,
      }),
    );
  };

  return {
    emitInitial: emit,
    setSharedStep(step: keyof PpcBatchSharedStepState, status: PipelineStepStatus) {
      shared[step] = status;
      emit();
    },
    setCampaignProgress(campaignIndex: number, progress: PpcGenerateProgressState) {
      campaigns[campaignIndex] = progress;
      emit();
    },
  };
}
