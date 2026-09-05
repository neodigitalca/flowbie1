import { fetchAgentRuns } from "@/lib/agent-runs-api";
import type { AgentRun } from "@/lib/agent-runs-types";
import { fetchWorkflowStepOutputs } from "@/lib/workflow/workflow-api";
import type { WorkflowStepOutput } from "@/lib/workflow/workflow-types";

export function agentRunMatchesWorkflowRun(
  run: Pick<AgentRun, "context" | "plan">,
  workflowId: number,
  workflowRunId: number,
): boolean {
  const ctxWorkflowId = Number(run.context?.workflowId ?? run.plan?.workflowId ?? 0);
  const ctxRunId = Number(run.context?.workflowRunId ?? run.plan?.workflowRunId ?? 0);
  return ctxWorkflowId === workflowId && ctxRunId === workflowRunId;
}

export function findAgentRunIdInOutputs(outputs: WorkflowStepOutput[]): number | undefined {
  const withAgent = outputs.find((output) => output.agentRunId);
  return withAgent?.agentRunId ?? undefined;
}

export async function findAgentRunForWorkflowRun(
  teamId: number,
  workflowId: number,
  workflowRunId: number,
): Promise<number | undefined> {
  const outputs = await fetchWorkflowStepOutputs(teamId, workflowId, workflowRunId);
  const fromOutputs = findAgentRunIdInOutputs(outputs);
  if (fromOutputs) return fromOutputs;

  const agentRuns = await fetchAgentRuns(teamId);
  const bound = agentRuns.find((run) => agentRunMatchesWorkflowRun(run, workflowId, workflowRunId));
  return bound?.id;
}
