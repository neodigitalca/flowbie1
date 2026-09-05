function parallelRunKey(teamId: number, workflowId: number, runId: number): string {
  return `${teamId}:${workflowId}:${runId}`;
}

const pendingParallelChains = new Map<string, number>();

export function registerParallelWorkflowChains(
  teamId: number,
  workflowId: number,
  runId: number,
  count: number,
): void {
  if (count <= 0) return;
  const key = parallelRunKey(teamId, workflowId, runId);
  pendingParallelChains.set(key, (pendingParallelChains.get(key) ?? 0) + count);
}

export function completeParallelWorkflowChain(
  teamId: number,
  workflowId: number,
  runId: number,
): boolean {
  const key = parallelRunKey(teamId, workflowId, runId);
  const pending = pendingParallelChains.get(key);
  if (pending == null) return true;
  if (pending <= 1) {
    pendingParallelChains.delete(key);
    return true;
  }
  pendingParallelChains.set(key, pending - 1);
  return false;
}

export function clearParallelWorkflowChains(
  teamId: number,
  workflowId: number,
  runId: number,
): void {
  pendingParallelChains.delete(parallelRunKey(teamId, workflowId, runId));
}

export function pendingParallelWorkflowChainCount(
  teamId: number,
  workflowId: number,
  runId: number,
): number {
  return pendingParallelChains.get(parallelRunKey(teamId, workflowId, runId)) ?? 0;
}
