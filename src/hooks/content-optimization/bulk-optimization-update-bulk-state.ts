import { stepLabel } from "@/lib/content-optimization/content-optimizer-run-progress";

export function updateBulkStateForPost(
  setBulkOptimizationState: (prev: any) => any,
  batchKey: string,
  url: string,
  index: number,
  currentPost: number,
  totalPosts: number,
  status: "optimizing" | "completed" | "skipped" | "error",
): void {
  setBulkOptimizationState((prev: any) => {
    const current = prev[batchKey];
    if (!current) {
      return prev;
    }

    const stepId = status === "completed" ? "done" : "load";
    const subProgress = status === "completed" ? 1 : 0;
    const message =
      status === "completed"
        ? `Post ${currentPost} of ${totalPosts} completed`
        : status === "optimizing"
          ? current.currentStepProgress?.message?.trim() || undefined
          : status;

    const shouldAdvance = status === "completed" && index + 1 < totalPosts;
    const nextIndex = shouldAdvance ? index + 1 : index;
    const nextUrl =
      shouldAdvance && Array.isArray(current.urls) && current.urls[index + 1]
        ? current.urls[index + 1]
        : url;

    return {
      ...prev,
      [batchKey]: {
        ...current,
        currentIndex: nextIndex,
        currentUrl: nextUrl,
        currentStep: message || stepLabel(stepId),
        currentStepProgress: {
          stepId,
          subProgress,
          step: stepLabel(stepId),
          ...(message ? { message } : {}),
        },
        urlStatuses: {
          ...current.urlStatuses,
          [url]: status,
        },
      },
    };
  });
}
