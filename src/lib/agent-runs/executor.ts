import {
  cancelAgentRun,
  fetchAgentRun,
  patchAgentRun,
} from "@/lib/agent-runs-api";
import { runAgentRunHarness } from "@/lib/agent-runs/harness-registry";
import { runTaskExecutionClientHarness } from "@/lib/agent-runs/run-task-execution-client";
import type { AgentRun, AgentRunResult } from "@/lib/agent-runs-types";
import { isAgentRunTerminal } from "@/lib/agent-runs-types";
import type { WordPressSite } from "@/components/integrations/types";
import {
  completeTaskExecution,
  patchTaskExecutionProgress,
} from "@/lib/tasks-api";

const activeRunIds = new Set<number>();

async function isRunCancelled(teamId: number, runId: number): Promise<boolean> {
  const run = await fetchAgentRun(teamId, runId);
  return run?.status === "cancelled";
}

async function appendStep(
  teamId: number,
  runId: number,
  label: string,
  status: "pending" | "running" | "done" | "error" = "running",
): Promise<void> {
  await patchAgentRun(teamId, runId, { step: { label, status } });
}

export async function executeAgentRun(
  run: AgentRun,
  sites: WordPressSite[],
): Promise<void> {
  if (activeRunIds.has(run.id)) return;
  activeRunIds.add(run.id);

  const teamId = run.teamId;
  try {
    await patchAgentRun(teamId, run.id, {
      status: "running",
      taskStatus: run.taskId > 0 ? "in_progress" : undefined,
      step: { label: "Starting…", status: "running" },
    });

    const ctx = {
      onStep: async (label: string, status: "pending" | "running" | "done" | "error" = "running") => {
        await appendStep(teamId, run.id, label, status);
      },
      isCancelled: () => isRunCancelled(teamId, run.id),
    };

    let result: AgentRunResult;

    if (run.plan?.completedOnServer) {
      result = { message: "Completed on server", updated: 1 };
      await ctx.onStep?.("Complete", "done");
    } else if (run.plan?.clientRunContract && run.plan?.taskExecutionId) {
      result = await runTaskExecutionClientHarness(run, sites, ctx);
    } else {
      result = await runAgentRunHarness(run, ctx);
    }

    if (await isRunCancelled(teamId, run.id)) return;

    await patchAgentRun(teamId, run.id, {
      status: "done",
      result,
      clientBatchKey: result.batchKey,
      taskStatus: run.taskId > 0 ? "done" : undefined,
      step: { label: "Complete", status: "done" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent run failed";
    await patchAgentRun(teamId, run.id, {
      status: "failed",
      errorMessage: message,
      step: { label: message, status: "error" },
    });

    const executionId = run.plan?.taskExecutionId;
    if (executionId && teamId > 0) {
      await completeTaskExecution(teamId, executionId, { ok: false, error: message });
    }
  } finally {
    activeRunIds.delete(run.id);
  }
}

export async function syncTaskExecutionProgress(
  teamId: number,
  executionId: number,
  patch: { stepId?: string; message?: string; progress?: number; subProgress?: number },
): Promise<void> {
  await patchTaskExecutionProgress(teamId, executionId, patch);
}

export async function cancelAgentRunExecution(teamId: number, runId: number): Promise<void> {
  await cancelAgentRun(teamId, runId);
}

export function isAgentRunActive(runId: number): boolean {
  return activeRunIds.has(runId);
}

export function filterRunnableRuns(runs: AgentRun[]): AgentRun[] {
  return runs.filter((r) => r.status === "queued" && !activeRunIds.has(r.id));
}

export function hasActiveRuns(runs: AgentRun[]): boolean {
  return runs.some((r) => r.status === "queued" || r.status === "running");
}

export function hasPollingRuns(runs: AgentRun[]): boolean {
  return runs.some((r) => !isAgentRunTerminal(r.status));
}
