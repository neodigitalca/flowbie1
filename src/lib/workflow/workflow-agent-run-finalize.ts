import { fetchAgentRun, patchAgentRun } from "@/lib/agent-runs-api";
import { appendAgentRunStep } from "@/lib/agent-runs/agent-run-step";
import { patchAgentRunInList } from "@/lib/agent-runs/agent-runs-local-patch";
import type { WorkflowDefinition, WorkflowStepOutput } from "@/lib/workflow/workflow-types";

function collectWorkflowAgentRunIds(outputs: WorkflowStepOutput[]): number[] {
  const ids = new Set<number>();
  for (const output of outputs) {
    const agentRunId = output.agentRunId;
    if (typeof agentRunId === "number" && agentRunId > 0) {
      ids.add(agentRunId);
    }
  }
  return [...ids];
}

export async function finalizeWorkflowBoundAgentRunsOnFailure(args: {
  teamId: number;
  workflow: WorkflowDefinition;
  outputs: WorkflowStepOutput[];
  errorMessage?: string | null;
}): Promise<void> {
  const errorMessage = args.errorMessage?.trim() || "Workflow run failed";
  for (const agentRunId of collectWorkflowAgentRunIds(args.outputs)) {
    const run = await fetchAgentRun(args.teamId, agentRunId);
    if (!run || run.source !== "workflow" || run.plan?.workflowThenDelivery !== true) {
      continue;
    }
    if (run.status === "done" || run.status === "failed" || run.status === "cancelled") {
      continue;
    }
    await appendAgentRunStep(
      args.teamId,
      agentRunId,
      { label: errorMessage, status: "error" },
      run,
    );
    patchAgentRunInList(agentRunId, {
      status: "failed",
      errorMessage,
      result: run.result,
      clientBatchKey: run.clientBatchKey,
    });
    await patchAgentRun(args.teamId, agentRunId, {
      status: "failed",
      errorMessage,
      result: run.result ?? undefined,
      clientBatchKey: run.clientBatchKey || undefined,
    });
  }
}
