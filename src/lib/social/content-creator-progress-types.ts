import type { MetaPipelineStepUi, PipelineStepStatus } from "@/components/overview/overview-tab-constants";

export type ContentGenerateGranularStepId =
  | "schedule"
  | "load-wp"
  | "load-seo-context"
  | "keyword"
  | "social-brief"
  | "fb-instagram-copy"
  | "linkedin-copy"
  | "prompt-modifier";

export type ContentGenerateStepId =
  | "schedule"
  | "load-context"
  | "keyword"
  | "social-copy"
  | "prompt-modifier";

export const CONTENT_CREATOR_PIPELINE_TITLES = [
  "Schedule",
  "Context research",
  "Keyword",
  "Social copy",
  "Prompt modifier",
] as const;

export type ContentCreatorPipelineTitle = (typeof CONTENT_CREATOR_PIPELINE_TITLES)[number];

export const CONTENT_CREATOR_PREP_STEP_IDS = new Set<ContentGenerateStepId>(["schedule", "load-context"]);

const GRANULAR_TO_PHASE: Record<ContentGenerateGranularStepId, ContentGenerateStepId> = {
  schedule: "schedule",
  "load-wp": "load-context",
  "load-seo-context": "load-context",
  keyword: "keyword",
  "social-brief": "social-copy",
  "fb-instagram-copy": "social-copy",
  "linkedin-copy": "social-copy",
  "prompt-modifier": "prompt-modifier",
};

const PHASE_LABELS: Record<ContentGenerateStepId, string> = {
  schedule: "Building schedule",
  "load-context": "Loading page context",
  keyword: "Keyword",
  "social-copy": "Social copy",
  "prompt-modifier": "Prompt modifier",
};

export type ContentGenerateProgressState = {
  steps: MetaPipelineStepUi[];
  activeStepId: ContentGenerateStepId | null;
  completed: number;
  total: number;
  label: string;
  statusMessage?: string;
};

export function mapContentGranularStepToPhase(stepId: ContentGenerateGranularStepId): ContentGenerateStepId {
  return GRANULAR_TO_PHASE[stepId];
}

export function createInitialContentGenerateProgress(): ContentGenerateProgressState {
  const plan: Array<{ id: ContentGenerateStepId; label: string }> = [
    { id: "schedule", label: PHASE_LABELS.schedule },
    { id: "load-context", label: PHASE_LABELS["load-context"] },
    { id: "keyword", label: PHASE_LABELS.keyword },
    { id: "social-copy", label: PHASE_LABELS["social-copy"] },
    { id: "prompt-modifier", label: PHASE_LABELS["prompt-modifier"] },
  ];
  return {
    steps: plan.map((step) => ({ id: step.id, label: step.label, status: "waiting" as const })),
    activeStepId: null,
    completed: 0,
    total: plan.length,
    label: "Generate content calendar",
  };
}

export function patchContentGenerateStep(
  progress: ContentGenerateProgressState,
  stepId: ContentGenerateStepId,
  status: PipelineStepStatus,
  statusMessage?: string,
): ContentGenerateProgressState {
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

export function patchContentGenerateGranularStep(
  progress: ContentGenerateProgressState,
  granularStepId: ContentGenerateGranularStepId,
  status: PipelineStepStatus,
  statusMessage?: string,
): ContentGenerateProgressState {
  return patchContentGenerateStep(
    progress,
    mapContentGranularStepToPhase(granularStepId),
    status,
    statusMessage,
  );
}
