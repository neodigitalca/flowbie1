import type { MetaPipelineStepUi, PipelineStepStatus } from "@/components/overview/overview-tab-constants";

/** Granular internal step ids (logging / runStep). */
export type MetaGenerateGranularStepId =
  | "read-master-rules"
  | "load-wp"
  | "load-seo-context"
  | "load-landing-research"
  | "load-gsc-queries"
  | "instagram-goal"
  | "creative-brief"
  | "copy-checklist"
  | "meta-copy"
  | "image-checklist"
  | "visual-reference-plan"
  | "image-reference"
  | "image-generate";

/** User-facing phase ids in progress UI and Details drawer harness. */
export type MetaGenerateStepId =
  | "read-master-rules"
  | "load-context"
  | "strategy"
  | "copy"
  | "creative-plan"
  | "image-prompt"
  | "image-generate";

export const META_ADS_PREP_STEP_IDS = new Set<MetaGenerateStepId>([
  "read-master-rules",
  "load-context",
]);

export const META_ADS_PIPELINE_TITLES = [
  "Context research",
  "Strategy brief",
  "Ad copy",
  "Creative plan",
  "Image prompt",
  "Creative image",
] as const;

export type MetaAdsPipelineTitle = (typeof META_ADS_PIPELINE_TITLES)[number];

const GRANULAR_TO_PHASE: Record<MetaGenerateGranularStepId, MetaGenerateStepId> = {
  "read-master-rules": "read-master-rules",
  "load-wp": "load-context",
  "load-seo-context": "load-context",
  "load-landing-research": "load-context",
  "load-gsc-queries": "load-context",
  "instagram-goal": "strategy",
  "creative-brief": "strategy",
  "copy-checklist": "copy",
  "meta-copy": "copy",
  "image-checklist": "creative-plan",
  "visual-reference-plan": "creative-plan",
  "image-reference": "creative-plan",
  "image-generate": "image-generate",
};

const PHASE_LABELS: Record<MetaGenerateStepId, string> = {
  "read-master-rules": "Reading master rules",
  "load-context": "Loading page context",
  strategy: "Strategy brief",
  copy: "Ad copy",
  "creative-plan": "Creative plan",
  "image-prompt": "Image prompt",
  "image-generate": "Generate image",
};

export type MetaGenerateProgressState = {
  steps: MetaPipelineStepUi[];
  activeStepId: MetaGenerateStepId | null;
  completed: number;
  total: number;
  label: string;
  statusMessage?: string;
};

export function mapGranularStepToPhase(stepId: MetaGenerateGranularStepId): MetaGenerateStepId {
  return GRANULAR_TO_PHASE[stepId];
}

export function buildMetaGenerateStepPlan(options?: {
  includePrefetch?: boolean;
  includeLoadContext?: boolean;
  includeImageSteps?: boolean;
}): Array<{ id: MetaGenerateStepId; label: string }> {
  const includePrefetch = options?.includePrefetch !== false;
  const includeLoadContext = options?.includeLoadContext !== false;
  const includeImageSteps = options?.includeImageSteps !== false;
  const steps: Array<{ id: MetaGenerateStepId; label: string }> = [];

  if (includePrefetch) {
    steps.push({ id: "read-master-rules", label: PHASE_LABELS["read-master-rules"] });
  }
  if (includeLoadContext) {
    steps.push({ id: "load-context", label: PHASE_LABELS["load-context"] });
  }

  steps.push(
    { id: "strategy", label: PHASE_LABELS.strategy },
    { id: "copy", label: PHASE_LABELS.copy },
  );

  if (includeImageSteps) {
    steps.push(
      { id: "creative-plan", label: PHASE_LABELS["creative-plan"] },
      { id: "image-prompt", label: PHASE_LABELS["image-prompt"] },
      { id: "image-generate", label: PHASE_LABELS["image-generate"] },
    );
  }

  return steps;
}

export function createInitialMetaGenerateProgress(options?: {
  includePrefetch?: boolean;
  includeLoadContext?: boolean;
  includeImageSteps?: boolean;
}): MetaGenerateProgressState {
  const plan = buildMetaGenerateStepPlan(options);
  return {
    steps: plan.map((step) => ({ id: step.id, label: step.label, status: "waiting" as const })),
    activeStepId: null,
    completed: 0,
    total: plan.length,
    label: "Generate Meta ad",
  };
}

export function patchMetaGenerateStep(
  progress: MetaGenerateProgressState,
  stepId: MetaGenerateStepId,
  status: PipelineStepStatus,
  statusMessage?: string,
): MetaGenerateProgressState {
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

export function patchMetaGenerateGranularStep(
  progress: MetaGenerateProgressState,
  granularStepId: MetaGenerateGranularStepId,
  status: PipelineStepStatus,
  statusMessage?: string,
): MetaGenerateProgressState {
  return patchMetaGenerateStep(progress, mapGranularStepToPhase(granularStepId), status, statusMessage);
}

/** @deprecated Use includeLoadContext */
export function createInitialMetaGenerateProgressLegacy(options?: {
  includePrefetch?: boolean;
  includeLoadWp?: boolean;
  includeLoadSeoContext?: boolean;
  includeImageSteps?: boolean;
}): MetaGenerateProgressState {
  return createInitialMetaGenerateProgress({
    includePrefetch: options?.includePrefetch,
    includeLoadContext: options?.includeLoadSeoContext,
    includeImageSteps: options?.includeImageSteps,
  });
}
