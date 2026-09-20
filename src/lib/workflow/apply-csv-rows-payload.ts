import type { TaskExecutionPayload } from "@/lib/tasks-types";
import {
  peekWorkflowCsvRowsMapping,
  peekWorkflowCsvSequential,
} from "@/lib/workflow/workflow-csv-rows-stash";

export function applyCsvRowsPayloadForNode(
  workflowRunId: number,
  nodeId: string,
  payload: TaskExecutionPayload,
  siteId?: string,
): TaskExecutionPayload {
  const sequential = peekWorkflowCsvSequential(workflowRunId);
  if (sequential && sequential.nextNodeId === nodeId) {
    const rowPayload = sequential.payloads[sequential.currentIndex];
    if (rowPayload) return { ...payload, ...rowPayload };
  }
  const mapping = peekWorkflowCsvRowsMapping(workflowRunId, nodeId, siteId);
  if (mapping?.mode === "bulk") {
    return { ...payload, ...mapping.payload };
  }
  return payload;
}
