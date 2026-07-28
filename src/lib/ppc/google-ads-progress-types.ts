import type { MetaPipelineStepUi, PipelineStepStatus } from "@/components/overview/overview-tab-constants";

export type PpcGenerateStepId =
  | "read-master-rules"
  | "load-wp"
  | "load-gsc"
  | "campaign-plan"
  | `ag-${number}-keywords`
  | `ag-${number}-ad-${number}`;

export type PpcGenerateProgressState = {
  steps: MetaPipelineStepUi[];
  activeStepId: PpcGenerateStepId | null;
  completed: number;
  total: number;
  label: string;
  statusMessage?: string;
};

export function ppcAdGroupKeywordsStepId(adGroupIndex: number): PpcGenerateStepId {
  return `ag-${adGroupIndex}-keywords`;
}

export function ppcAdGroupAdStepId(adGroupIndex: number, adIndex: number): PpcGenerateStepId {
  return `ag-${adGroupIndex}-ad-${adIndex}`;
}

export function buildPpcGenerateStepPlan(config: {
  adGroupCount: number;
  adsPerAdGroup: number;
  includePrefetch?: boolean;
}): Array<{ id: PpcGenerateStepId; label: string }> {
  const includePrefetch = config.includePrefetch !== false;
  const steps: Array<{ id: PpcGenerateStepId; label: string }> = [];
  if (includePrefetch) {
    steps.push({ id: "read-master-rules", label: "Reading master rules" });
    steps.push({ id: "load-wp", label: "Load page bucket" });
  }
  steps.push({ id: "campaign-plan", label: "Campaign plan" });
  steps.push({ id: "load-gsc", label: "Load GSC page queries" });
  for (let i = 1; i <= config.adGroupCount; i += 1) {
    steps.push({ id: ppcAdGroupKeywordsStepId(i), label: `Ad group ${i} · Keywords` });
    for (let j = 1; j <= config.adsPerAdGroup; j += 1) {
      steps.push({ id: ppcAdGroupAdStepId(i, j), label: `Ad group ${i} · Responsive search ad ${j}` });
    }
  }
  return steps;
}

export function createInitialPpcGenerateProgress(config: {
  adGroupCount: number;
  adsPerAdGroup: number;
  includePrefetch?: boolean;
}): PpcGenerateProgressState {
  const plan = buildPpcGenerateStepPlan(config);
  return {
    steps: plan.map((s) => ({ id: s.id, label: s.label, status: "waiting" as const })),
    activeStepId: null,
    completed: 0,
    total: plan.length,
    label: "Generate campaign",
  };
}

export function createPpcAdGroupGenerateProgress(
  adGroupIndex: number,
  adsPerAdGroup: number,
): PpcGenerateProgressState {
  const all = buildPpcGenerateStepPlan({
    adGroupCount: adGroupIndex,
    adsPerAdGroup,
    includePrefetch: false,
  });
  const steps = all.filter(
    (step) =>
      step.id === "load-gsc" ||
      step.id === ppcAdGroupKeywordsStepId(adGroupIndex) ||
      step.id.startsWith(`ag-${adGroupIndex}-ad-`),
  );
  return {
    steps: steps.map((step) => ({ id: step.id, label: step.label, status: "waiting" as const })),
    activeStepId: null,
    completed: 0,
    total: steps.length,
    label: `Ad group ${adGroupIndex}`,
  };
}

export function patchPpcGenerateStep(
  progress: PpcGenerateProgressState,
  stepId: PpcGenerateStepId,
  status: PipelineStepStatus,
  statusMessage?: string,
): PpcGenerateProgressState {
  const steps = progress.steps.map((step) =>
    step.id === stepId ? { ...step, status } : step,
  );
  const completed = steps.filter((step) => step.status === "done").length;
  const active = steps.find((step) => step.status === "running");
  return {
    ...progress,
    steps,
    activeStepId: status === "running" ? stepId : progress.activeStepId,
    completed,
    label: active?.label ?? progress.label,
    statusMessage,
  };
}
