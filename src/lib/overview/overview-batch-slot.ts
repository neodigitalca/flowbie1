/** True only while a batch worker is actively running (not when finished harness is still open). */
export function isOverviewBatchRunning(
  isOptimizingContent: Record<string, boolean>,
  batchKey: string,
): boolean {
  return Boolean(isOptimizingContent[batchKey]);
}
