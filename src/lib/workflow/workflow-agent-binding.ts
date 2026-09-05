import type { AgentRun } from "@/lib/agent-runs-types";

export type WorkflowAgentBindingFields = {
  workflowId: number;
  workflowRunId: number;
  workflowNodeId: string;
};

const bindingByAgentRunId = new Map<number, WorkflowAgentBindingFields>();

export function rememberWorkflowAgentBinding(runId: number, binding: WorkflowAgentBindingFields): void {
  if (runId > 0) bindingByAgentRunId.set(runId, binding);
}

export function readWorkflowAgentBinding(run: AgentRun): WorkflowAgentBindingFields | null {
  const cached = bindingByAgentRunId.get(run.id);
  if (cached) return cached;

  const ctx = run.context ?? {};
  const plan = run.plan ?? {};
  const workflowId = Number(ctx.workflowId ?? plan.workflowId ?? 0);
  const workflowRunId = Number(ctx.workflowRunId ?? plan.workflowRunId ?? 0);
  const workflowNodeId = String(ctx.workflowNodeId ?? plan.workflowNodeId ?? "").trim();
  if (!workflowId || !workflowRunId || !workflowNodeId) return null;
  return { workflowId, workflowRunId, workflowNodeId };
}
