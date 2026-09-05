import { fetchAgentRunCsvContent } from "@/lib/agent-runs-api";
import { fetchWorkflowStepOutputs } from "@/lib/workflow/workflow-api";
import type { WorkflowStepOutput, WorkflowStepOutputFileRef } from "@/lib/workflow/workflow-types";
import {
  peekWorkflowGridCsvText,
  takeWorkflowGridCsvText,
} from "@/lib/workflow/workflow-grid-csv-stash";

export function isGridCsvFileRef(file: WorkflowStepOutputFileRef): boolean {
  const name = file.name?.trim().toLowerCase() ?? "";
  const mime = file.mime?.trim().toLowerCase() ?? "";
  return mime === "text/csv" || name.endsWith(".csv");
}

function pickGridCsvAgentRunId(
  outputs: WorkflowStepOutput[],
  ragInputKeys?: string[],
): number | undefined {
  const runScoped = outputs.filter((output) => output.scope === "run");

  const tryPick = (list: WorkflowStepOutput[]): number | undefined => {
    for (const output of list) {
      const hasCsv = (output.fileRefs ?? []).some((file) => file.url && isGridCsvFileRef(file));
      if (hasCsv && output.agentRunId) {
        return output.agentRunId;
      }
    }
    return undefined;
  };

  if (ragInputKeys && ragInputKeys.length > 0) {
    const keySet = new Set(ragInputKeys);
    const matched = runScoped.filter((output) => keySet.has(output.variableKey));
    const fromKeys = tryPick(matched);
    if (fromKeys) return fromKeys;
  }

  return tryPick(runScoped);
}

function pickGridCsvUrlFromOutputs(
  outputs: WorkflowStepOutput[],
  ragInputKeys?: string[],
): string | undefined {
  const runScoped = outputs.filter((output) => output.scope === "run");

  const tryPick = (list: WorkflowStepOutput[]): string | undefined => {
    for (const output of list) {
      const csvRef = (output.fileRefs ?? []).find((file) => file.url && isGridCsvFileRef(file));
      if (csvRef?.url) return csvRef.url;
    }
    return undefined;
  };

  if (ragInputKeys && ragInputKeys.length > 0) {
    const keySet = new Set(ragInputKeys);
    const matched = runScoped.filter((output) => keySet.has(output.variableKey));
    const fromKeys = tryPick(matched);
    if (fromKeys) return fromKeys;
  }

  return tryPick(runScoped);
}

function pickGridCsvUrl(outputs: WorkflowStepOutput[], ragInputKeys?: string[]): string {
  const url = pickGridCsvUrlFromOutputs(outputs, ragInputKeys);
  if (url) return url;
  throw new Error("Upstream Local Dominator export did not produce a grid CSV.");
}

async function resolveStashedGridCsv(workflowRunId: number): Promise<string | undefined> {
  const peekedText = peekWorkflowGridCsvText(workflowRunId)?.trim();
  if (peekedText) return peekedText;

  const takenText = takeWorkflowGridCsvText(workflowRunId)?.trim();
  if (takenText) return takenText;

  return undefined;
}

export async function resolveUpstreamGridCsvFromWorkflow(args: {
  teamId?: number;
  workflowId?: number;
  workflowRunId?: number;
  ragInputKeys?: string[];
}): Promise<string> {
  const workflowRunId = args.workflowRunId;
  if (workflowRunId) {
    const stashed = await resolveStashedGridCsv(workflowRunId);
    if (stashed) return stashed;
  }

  const teamId = args.teamId;
  const workflowId = args.workflowId;
  if (!teamId || !workflowId || !workflowRunId) {
    throw new Error("Workflow context is required to resolve upstream grid CSV.");
  }

  const outputs = await fetchWorkflowStepOutputs(teamId, workflowId, workflowRunId);
  const agentRunId = pickGridCsvAgentRunId(outputs, args.ragInputKeys);
  if (!agentRunId) {
    throw new Error("Upstream Local Dominator export did not produce a grid CSV.");
  }

  const csvText = await fetchAgentRunCsvContent(teamId, agentRunId);
  if (!csvText) {
    throw new Error("Grid CSV is not available from the Local Dominator export run.");
  }

  return csvText;
}

export function resolveUpstreamGridCsvUrlFromOutputs(
  outputs: WorkflowStepOutput[],
  ragInputKeys?: string[],
): string {
  return pickGridCsvUrl(outputs, ragInputKeys);
}
