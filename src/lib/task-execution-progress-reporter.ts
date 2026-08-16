import {
  patchTaskExecutionProgress,
  type TaskExecution,
} from "@/lib/tasks-api";
import type { ContentOptimizerStepId, RunProgressPatch } from "@/lib/content-optimization/content-optimizer-run-progress";

export function createExecutionProgressReporter(
  teamId: number,
  executionId: number,
): (patch: RunProgressPatch) => void {
  return (patch: RunProgressPatch) => {
    void patchTaskExecutionProgress(teamId, executionId, {
      stepId: patch.stepId,
      subProgress: patch.subProgress,
      progress: patch.progress,
      message: patch.message,
      error: patch.error,
    });
  };
}

export type { TaskExecution, ContentOptimizerStepId };
