/** Re-exports canonical Content Optimizer steps (single path). */
export {
  CONTENT_OPTIMIZER_STEPS,
  CONTENT_OPTIMIZER_URL_STEPS,
  computeUrlProgress,
  computeBatchProgress,
  computePrepProgress,
  stepLabel,
  urlStepIndex,
  isBulkUploadPhaseStepId,
  type ContentOptimizerStepId,
  type ContentOptimizerStepDef,
} from "@/lib/content-optimization/content-optimizer-run-progress";

/** @deprecated Use stepLabel(stepId) from content-optimizer-run-progress. */
export function resolveContentOptimizerStepLabel(step: string): string {
  return step;
}

/** @deprecated Use progress from RunProgressEntry (computed monotonically). */
export function contentOptimizerStepProgress(_step: string): number {
  return 0;
}

/** @deprecated Use urlStepIndex(stepId). */
export function contentOptimizerStepIndex(stepId: string): number {
  const idx = ["load", "plan", "write", "polish", "publish", "done"].indexOf(stepId);
  return idx;
}

/** @deprecated Use isBulkUploadPhaseStepId. */
export function isBulkUploadPhaseStep(step: string): boolean {
  return step.toLowerCase().includes("upload") || step.toLowerCase().includes("publish");
}

/** Legacy alias for UI migration. */
export const CONTENT_OPTIMIZER_STEP_LABELS = [
  { key: "load", label: "Load", progress: 8 },
  { key: "plan", label: "Plan", progress: 30 },
  { key: "write", label: "Write", progress: 70 },
  { key: "polish", label: "Polish", progress: 80 },
  { key: "publish", label: "Publish", progress: 97 },
  { key: "complete", label: "Done", progress: 100 },
] as const;
