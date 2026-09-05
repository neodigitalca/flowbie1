import { pendingParallelWorkflowChainCount } from "@/lib/workflow/workflow-parallel-completion";
import { resolveStepOutputFileRefsWithRetry } from "@/lib/workflow/workflow-step-file-refs";
import { thenConfig } from "@/lib/workflow/workflow-then-utils";
import type { WorkflowNode, WorkflowStepOutput } from "@/lib/workflow/workflow-types";

export type ThenWaitContext = {
  teamId: number;
  workflowId: number;
  runId: number;
};

export function shouldDeferThenStepForParallelWait(
  node: WorkflowNode,
  ctx: ThenWaitContext,
): boolean {
  const config = thenConfig(node);
  if (config.waitMode !== "all_parallel_clients") return false;
  return pendingParallelWorkflowChainCount(ctx.teamId, ctx.workflowId, ctx.runId) > 1;
}

export async function awaitThenUpstreamTerminal(
  node: WorkflowNode,
  outputs: WorkflowStepOutput[],
  teamId: number,
): Promise<boolean> {
  const config = thenConfig(node);
  if (config.waitMode !== "upstream_terminal") return true;

  const upstreamOutputs = outputs.filter((output) => {
    if (config.inputNodeId && output.nodeId === config.inputNodeId) return true;
    const key = config.inputVariableKey.trim();
    if (!key) return false;
    return output.variableKey === key || output.variableKey.startsWith(`${key}__`);
  });

  for (const output of upstreamOutputs) {
    if (!output.agentRunId) continue;
    const refs = await resolveStepOutputFileRefsWithRetry(teamId, output.agentRunId);
    if (refs.length === 0) return false;
  }

  return upstreamOutputs.length > 0 || outputs.some((output) => (output.fileRefs?.length ?? 0) > 0);
}
