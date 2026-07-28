import { getStepProgress } from "./optimization-helpers";

export function updateBulkStateForPost(  setBulkOptimizationState: (prev: any) => any,
  batchKey: string,
  url: string,
  index: number,
  currentPost: number,
  totalPosts: number,
  status: "optimizing" | "completed" | "skipped" | "error"
): void {
  setBulkOptimizationState((prev: any) => {
    const current = prev[batchKey];
    if (!current) {
      return prev;
    }

    const stepProgress =
      status === "completed"
        ? 100
        : getStepProgress(status === "optimizing" ? "Targeting Computer" : status);
    const step = status === "completed" ? "Complete" : status === "optimizing" ? "Targeting Computer" : status;

    const harnessFromStep = current.currentStepProgress?.harnessSections;
    const shouldPersistHarness =
      (status === "completed" || status === "error") &&
      Array.isArray(harnessFromStep) &&
      harnessFromStep.length > 0;

    return {
      ...prev,
      [batchKey]: {
        ...current,
        currentIndex: index,
        currentUrl: url,
        currentStep: step,
        currentProgress: stepProgress,
        currentStepProgress: {
          step,
          progress: stepProgress,
          message:
            status === "completed"
              ? `Post ${currentPost} of ${totalPosts} completed`
              : `Processing post ${currentPost} of ${totalPosts}...`,
        },
        urlStatuses: {
          ...current.urlStatuses,
          [url]: status,
        },
        ...(shouldPersistHarness && {
          urlHarnessSections: {
            ...(current.urlHarnessSections || {}),
            [url]: harnessFromStep,
          },
        }),
      },
    };
  });
}
