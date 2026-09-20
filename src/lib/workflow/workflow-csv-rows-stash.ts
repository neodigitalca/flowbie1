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

const bulkByRunId = new Map<number, Map<string, CsvRowsBulkState>>();
const sequentialByRunId = new Map<number, CsvRowsSequentialState>();

function siteKey(siteId?: string): string {
  return siteId?.trim() ?? "";
}

export function stashWorkflowCsvRowsMapping(
  workflowRunId: number,
  mapping: CsvRowsActionMapping,
  nextNodeId: string,
  siteId?: string,
): void {
  if (workflowRunId <= 0) return;
  let bySite = bulkByRunId.get(workflowRunId);
  if (!bySite) {
    bySite = new Map();
    bulkByRunId.set(workflowRunId, bySite);
  }
  bySite.set(siteKey(siteId), { mapping, nextNodeId });
}

export function peekWorkflowCsvRowsMapping(
  workflowRunId: number,
  nodeId?: string,
  siteId?: string,
): CsvRowsActionMapping | undefined {
  const bySite = bulkByRunId.get(workflowRunId);
  if (!bySite) return undefined;
  const stashed = bySite.get(siteKey(siteId));
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
