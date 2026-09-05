import type { TaskExecutionKind, TaskExecutionPayload } from "@/lib/tasks-types";
import type { CsvRowsActionMapping } from "@/lib/workflow/map-csv-rows-to-action";

export type CsvRowsSequentialState = {
  nextNodeId: string;
  kind: TaskExecutionKind | string;
  payloads: TaskExecutionPayload[];
  currentIndex: number;
};

type CsvRowsBulkState = {
  nextNodeId: string;
  mapping: CsvRowsActionMapping;
};

const bulkByRunId = new Map<number, CsvRowsBulkState>();
const sequentialByRunId = new Map<number, CsvRowsSequentialState>();

export function stashWorkflowCsvRowsMapping(
  workflowRunId: number,
  mapping: CsvRowsActionMapping,
  nextNodeId: string,
): void {
  if (workflowRunId <= 0) return;
  bulkByRunId.set(workflowRunId, { mapping, nextNodeId });
}

export function peekWorkflowCsvRowsMapping(
  workflowRunId: number,
  nodeId?: string,
): CsvRowsActionMapping | undefined {
  const stashed = bulkByRunId.get(workflowRunId);
  if (!stashed) return undefined;
  if (nodeId && stashed.nextNodeId !== nodeId) return undefined;
  return stashed.mapping;
}

export function stashWorkflowCsvSequential(
  workflowRunId: number,
  state: CsvRowsSequentialState,
): void {
  if (workflowRunId <= 0) return;
  sequentialByRunId.set(workflowRunId, state);
}

export function peekWorkflowCsvSequential(workflowRunId: number): CsvRowsSequentialState | undefined {
  return sequentialByRunId.get(workflowRunId);
}

export function advanceWorkflowCsvSequential(workflowRunId: number): CsvRowsSequentialState | undefined {
  const current = sequentialByRunId.get(workflowRunId);
  if (!current) return undefined;
  const next: CsvRowsSequentialState = {
    ...current,
    currentIndex: current.currentIndex + 1,
  };
  sequentialByRunId.set(workflowRunId, next);
  return next;
}

export function clearWorkflowCsvRowsStash(workflowRunId: number): void {
  bulkByRunId.delete(workflowRunId);
  sequentialByRunId.delete(workflowRunId);
}
