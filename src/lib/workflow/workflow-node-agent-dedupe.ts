import { fetchAgentRuns } from "@/lib/agent-runs-api";
import type { AgentRun } from "@/lib/agent-runs-types";
import { resolveAgentRunRecipeKey } from "@/lib/agent-runs/agent-run-navigation";
import { readWorkflowAgentBinding } from "@/lib/workflow/workflow-agent-binding";
import type { WorkflowDefinition, WorkflowStepOutput } from "@/lib/workflow/workflow-types";
import { nodeById, outgoingEdges } from "@/lib/workflow/workflow-graph-utils";

function isLocalDominatorExportRun(run: AgentRun): boolean {
  return resolveAgentRunRecipeKey(run) === "local_dominator_export";
}

export async function findWorkflowNodeAgentRun(
  teamId: number,
  workflowRunId: number,
  nodeId: string,
  siteId?: string,
): Promise<AgentRun | null> {
  const wantedSiteId = siteId?.trim() ?? "";
  const runs = await fetchAgentRuns(teamId);
  let ldFailedRun: AgentRun | null = null;
  for (const run of runs) {
    const binding = readWorkflowAgentBinding(run);
    if (!binding) continue;
    if (binding.workflowRunId !== workflowRunId || binding.workflowNodeId !== nodeId) continue;
    if (run.status === "cancelled") continue;
    if (wantedSiteId) {
      const runSiteId = run.context?.siteId?.trim() ?? "";
      if (runSiteId && runSiteId !== wantedSiteId) continue;
    }
    // Prefer live/done runs; keep any failed LD export so we never spawn a second one.
    if (run.status === "failed") {
      if (isLocalDominatorExportRun(run) && !ldFailedRun) {
        ldFailedRun = run;
      }
      continue;
    }
    return run;
  }
  return ldFailedRun;
}

export function downstreamWorkflowActionNodeIds(
  workflow: WorkflowDefinition,
  afterNodeId: string,
): string[] {
  const queue = [afterNodeId];
  const visited = new Set<string>([afterNodeId]);
  const actionNodeIds: string[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const edge of outgoingEdges(workflow.edges, currentId)) {
      const targetId = edge.target;
      if (!targetId || visited.has(targetId)) continue;
      visited.add(targetId);
      const targetNode = nodeById(workflow.nodes, targetId);
      if (!targetNode) continue;
      if (targetNode.kind === "action_agent") {
        const kind = String((targetNode.config as { executionKind?: string })?.executionKind ?? "");
        if (kind !== "local_dominator_export") {
          actionNodeIds.push(targetId);
          continue;
        }
      }
      queue.push(targetId);
    }
  }

  return actionNodeIds;
}

export function workflowStepOutputForNode(
  outputs: WorkflowStepOutput[],
  nodeId: string,
): WorkflowStepOutput | undefined {
  return outputs.find((output) => output.nodeId === nodeId && output.agentRunId);
}

export async function downstreamWorkflowAgentAlreadyStarted(
  teamId: number,
  workflow: WorkflowDefinition,
  workflowRunId: number,
  afterNodeId: string,
  _outputs: WorkflowStepOutput[],
): Promise<boolean> {
  for (const nodeId of downstreamWorkflowActionNodeIds(workflow, afterNodeId)) {
    // Only queued/running/done counts (findWorkflowNodeAgentRun skips failed/cancelled).
    const existing = await findWorkflowNodeAgentRun(teamId, workflowRunId, nodeId);
    if (existing) {
      return true;
    }
  }
  return false;
}
