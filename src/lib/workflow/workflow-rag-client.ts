import { workflowClientVariableSuffix } from "@/lib/workflow/workflow-client-config";
import type { WorkflowNode, WorkflowStepOutput } from "@/lib/workflow/workflow-types";

function uniqueOutputSiteIds(outputs: WorkflowStepOutput[]): string[] {
  return [
    ...new Set(
      outputs.map((output) => output.siteId?.trim()).filter((id): id is string => Boolean(id)),
    ),
  ];
}

/** All client site ids for this workflow run (explicit list or inferred from stored outputs). */
export function effectiveClientSiteIds(
  outputs: WorkflowStepOutput[],
  clientSiteIds: string[],
): string[] {
  if (clientSiteIds.length > 1) return clientSiteIds;
  const fromOutputs = uniqueOutputSiteIds(outputs);
  return fromOutputs.length > 1 ? fromOutputs : clientSiteIds;
}

function outputBelongsToSite(
  output: WorkflowStepOutput,
  siteId: string,
  allSiteIds: string[],
): boolean {
  if (output.siteId?.trim() === siteId) return true;
  const suffix = workflowClientVariableSuffix(allSiteIds, siteId);
  if (suffix && output.variableKey.endsWith(suffix)) return true;
  return !allSiteIds.some(
    (id) =>
      id !== siteId &&
      (output.siteId?.trim() === id ||
        output.variableKey.endsWith(workflowClientVariableSuffix(allSiteIds, id))),
  );
}

function actionAgentNodeIds(nodes: WorkflowNode[]): Set<string> {
  return new Set(nodes.filter((node) => node.kind === "action_agent").map((node) => node.id));
}

function archiveNodeIds(nodes: WorkflowNode[]): Set<string> {
  return new Set(nodes.filter((node) => node.kind === "rag_archive").map((node) => node.id));
}

export function parseClientSiteIdFromOutput(
  output: WorkflowStepOutput,
  knownSiteIds: string[],
): string | null {
  if (output.siteId?.trim()) return output.siteId.trim();
  const key = output.variableKey.trim();
  for (const siteId of knownSiteIds) {
    const suffix = workflowClientVariableSuffix(knownSiteIds, siteId);
    if (suffix && key.endsWith(suffix)) return siteId;
  }
  return null;
}

export function groupWorkflowOutputsByClient(
  outputs: WorkflowStepOutput[],
  clientSiteIds: string[],
): Map<string, WorkflowStepOutput[]> {
  const grouped = new Map<string, WorkflowStepOutput[]>();
  for (const siteId of clientSiteIds) {
    grouped.set(siteId, []);
  }
  for (const output of outputs) {
    const siteId = parseClientSiteIdFromOutput(output, clientSiteIds);
    if (!siteId) continue;
    grouped.get(siteId)?.push(output);
  }
  return grouped;
}

function isActionOrArchiveOutput(
  output: WorkflowStepOutput,
  nodes: WorkflowNode[],
): boolean {
  const agentIds = actionAgentNodeIds(nodes);
  const archiveIds = archiveNodeIds(nodes);
  return agentIds.has(output.nodeId) || archiveIds.has(output.nodeId);
}

export function clientDeliverableOutputs(
  outputs: WorkflowStepOutput[],
  nodes: WorkflowNode[],
  siteId: string,
  clientSiteIds: string[],
): WorkflowStepOutput[] {
  if (!siteId.trim()) return outputs.filter((output) => isActionOrArchiveOutput(output, nodes));
  const allSiteIds = effectiveClientSiteIds(outputs, clientSiteIds);
  if (allSiteIds.length <= 1) {
    return outputs.filter((output) => isActionOrArchiveOutput(output, nodes));
  }
  return outputs.filter(
    (output) =>
      isActionOrArchiveOutput(output, nodes) && outputBelongsToSite(output, siteId, allSiteIds),
  );
}

export function filterWorkflowOutputsForSite(
  outputs: WorkflowStepOutput[],
  siteId: string,
  clientSiteIds: string[],
): WorkflowStepOutput[] {
  const targetSiteId = siteId.trim();
  if (!targetSiteId) return outputs;
  const allSiteIds = effectiveClientSiteIds(outputs, clientSiteIds);
  if (allSiteIds.length <= 1) return outputs;
  return outputs.filter((output) => outputBelongsToSite(output, targetSiteId, allSiteIds));
}
