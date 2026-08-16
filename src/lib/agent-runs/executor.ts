import {
  fetchAgentRun,
  patchAgentRun,
} from "@/lib/agent-runs-api";
import { flushAgentRunCheckpointPatch } from "@/lib/agent-runs/agent-run-checkpoint";
import { appendAgentRunStepLocally, patchAgentRunInList } from "@/lib/agent-runs/agent-runs-local-patch";
import {
  clearPostCreatorProof,
  initPostCreatorProof,
  resolvePostCreatorPostCountFromRun,
} from "@/lib/agent-runs/agent-run-post-creator-proof";
import { resolveAgentRunRecipeKey } from "@/lib/agent-runs/agent-run-navigation";
import { runAgentRunHarness } from "@/lib/agent-runs/harness-registry";
import { buildAgentRunBatchKey } from "@/lib/agent-runs/agent-run-batch-key";
import { agentRunHasResumeProgress, getAgentRunResumePoint } from "@/lib/agent-runs/agent-run-resume";
import { appendAgentRunStep } from "@/lib/agent-runs/agent-run-step";
import { AGENT_RUN_STEP_KEYS } from "@/lib/agent-runs/agent-run-step-keys";
import { runTaskExecutionClientHarness } from "@/lib/agent-runs/run-task-execution-client";
import type { AgentRun, AgentRunResult } from "@/lib/agent-runs-types";
import { isAgentRunTerminal } from "@/lib/agent-runs-types";
import type { WordPressSite } from "@/components/integrations/types";
import { completeTaskExecution, fetchTaskExecution, reopenTaskExecutionForResume } from "@/lib/tasks-api";

const activeRunIds = new Set<number>();
const TAB_SESSION_KEY = "neo_pulse_tab_session_id";

function tabSessionId(): string {
  const existing = sessionStorage.getItem(TAB_SESSION_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  sessionStorage.setItem(TAB_SESSION_KEY, next);
  return next;
}

function tryAcquireRunLease(runId: number): boolean {
  const key = `neo_pulse_agent_run_${runId}`;
  const owner = tabSessionId();
  const existing = sessionStorage.getItem(key);
  if (existing && existing !== owner) return false;
  sessionStorage.setItem(key, owner);
  return true;
}

function releaseRunLease(runId: number): void {
  const key = `neo_pulse_agent_run_${runId}`;
  if (sessionStorage.getItem(key) === tabSessionId()) {
    sessionStorage.removeItem(key);
  }
}

class AgentRunCancelledError extends Error {
  constructor() {
    super("Cancelled");
    this.name = "AgentRunCancelledError";
  }
}

async function isRunCancelled(teamId: number, runId: number): Promise<boolean> {
  const run = await fetchAgentRun(teamId, runId);
  return run?.status === "cancelled";
}

async function markRunCancelled(teamId: number, run: AgentRun): Promise<void> {
  await patchAgentRun(teamId, run.id, {
    status: "cancelled",
    step: { label: "Run was cancelled.", status: "error" },
  });
}

async function closeRunFromTaskExecution(run: AgentRun): Promise<AgentRunResult | "cancelled" | "failed" | null> {
  const executionId = run.plan?.taskExecutionId;
  if (!executionId || !run.teamId) return null;

  const { execution } = await fetchTaskExecution(run.teamId, executionId);
  if (!execution) return null;

  if (execution.status === "completed") {
    const updated =
      typeof run.result?.updated === "number"
        ? run.result.updated
        : run.result?.checkpoint?.uploadedUrls?.length ||
          run.result?.checkpoint?.completedUrls?.length ||
          1;
    await patchAgentRun(run.teamId, run.id, {
      status: "done",
      result: {
        ...(run.result ?? {}),
        updated,
        message: execution.progress?.message || "Task execution completed",
        batchKey: run.clientBatchKey || run.result?.batchKey,
      },
      clientBatchKey: run.clientBatchKey || run.result?.batchKey,
      step: { label: "Complete", status: "done" },
    });
    return {
      updated,
      message: execution.progress?.message || "Task execution completed",
      batchKey: run.clientBatchKey || run.result?.batchKey,
    };
  }

  if (execution.status === "failed") {
    if (agentRunHasResumeProgress(run)) {
      await reopenTaskExecutionForResume(run.teamId, executionId);
      return null;
    }
    const message = execution.error || execution.progress?.error || "Task execution failed";
    await patchAgentRun(run.teamId, run.id, {
      status: "failed",
      errorMessage: message,
      step: { label: message, status: "error" },
    });
    return "failed";
  }

  if (execution.status === "cancelled") {
    await markRunCancelled(run.teamId, run);
    return "cancelled";
  }

  return null;
}

function isServerExecutionRun(run: AgentRun): boolean {
  return run.result?.executionMode === "server" || run.plan?.executionMode === "server";
}

export async function executeAgentRun(
  run: AgentRun,
  sites: WordPressSite[],
): Promise<void> {
  if (activeRunIds.has(run.id)) return;
  if (!tryAcquireRunLease(run.id)) return;
  activeRunIds.add(run.id);

  const teamId = run.teamId;
  let activeRun = run;

  try {
    if (await isRunCancelled(teamId, run.id)) {
      return;
    }

    if (isServerExecutionRun(run)) {
      return;
    }

    const latestForResume = (await fetchAgentRun(teamId, run.id)) ?? run;
    activeRun = latestForResume;
    const resumePoint = getAgentRunResumePoint(latestForResume);
    const isResume = resumePoint != null;

    const closed = await closeRunFromTaskExecution(activeRun);
    if (closed && closed !== "failed" && closed !== "cancelled") {
      return;
    }
    if (closed === "failed" || closed === "cancelled") {
      return;
    }

    patchAgentRunInList(activeRun.id, { status: "running" });

    if (!isResume) {
      clearPostCreatorProof(activeRun.id);
      if (resolveAgentRunRecipeKey(activeRun) === "post_creator") {
        const postCount = resolvePostCreatorPostCountFromRun(activeRun);
        if (postCount >= 1) {
          initPostCreatorProof(
            activeRun.id,
            postCount,
            activeRun.plan?.clientRunContract?.featuredImage !== false,
          );
        }
      }
      await appendAgentRunStep(
        teamId,
        activeRun.id,
        { label: "Starting…", status: "running", stepKey: AGENT_RUN_STEP_KEYS.starting },
        activeRun,
      );
      await patchAgentRun(teamId, activeRun.id, { status: "running" });
    } else {
      await patchAgentRun(teamId, activeRun.id, { status: "running" });
      if (resolveAgentRunRecipeKey(activeRun) === "post_creator") {
        const postCount =
          typeof resumePoint!.payload.postCount === "number"
            ? resumePoint!.payload.postCount
            : resolvePostCreatorPostCountFromRun(activeRun);
        if (postCount >= 1) {
          initPostCreatorProof(
            activeRun.id,
            postCount,
            activeRun.plan?.clientRunContract?.featuredImage !== false,
          );
        }
      }
    }

    const ctx = {
      onStep: async (
        label: string,
        status: "pending" | "running" | "done" | "error" = "running",
        resumePayload?: Record<string, unknown>,
        stepKey?: string,
      ) => {
        const current = (await fetchAgentRun(teamId, activeRun.id)) ?? activeRun;
        await appendAgentRunStep(teamId, activeRun.id, { label, status, resumePayload, stepKey }, current);
      },
      isCancelled: () => isRunCancelled(teamId, activeRun.id),
      resumePoint,
      isResume,
    };

    if (activeRun.id > 0) {
      const clientBatchKey = buildAgentRunBatchKey(activeRun.id);
      if (activeRun.clientBatchKey !== clientBatchKey) {
        patchAgentRunInList(activeRun.id, { clientBatchKey });
        await patchAgentRun(teamId, activeRun.id, { clientBatchKey });
        activeRun = { ...activeRun, clientBatchKey };
      }
    }

    let result: AgentRunResult;

    if (activeRun.plan?.completedOnServer) {
      result = { message: "Completed on server", updated: 1 };
    } else if (activeRun.plan?.clientRunContract && activeRun.plan?.taskExecutionId) {
      result = await runTaskExecutionClientHarness(activeRun, sites, ctx);
    } else {
      result = await runAgentRunHarness(activeRun, ctx);
    }

    if (await isRunCancelled(teamId, run.id)) {
      await markRunCancelled(teamId, activeRun);
      return;
    }

    const terminalStatus =
      result.postCount != null &&
      result.updated != null &&
      (result.updated < result.postCount || (result.failed ?? 0) > 0)
        ? "failed"
        : "done";

    patchAgentRunInList(activeRun.id, {
      status: terminalStatus,
      result,
      clientBatchKey: result.batchKey,
    });
    await appendAgentRunStep(
      teamId,
      activeRun.id,
      {
        label: "Complete",
        status: terminalStatus === "done" ? "done" : "error",
        stepKey: AGENT_RUN_STEP_KEYS.complete,
      },
      activeRun,
    );
    await patchAgentRun(teamId, activeRun.id, {
      status: terminalStatus,
      result,
      clientBatchKey: result.batchKey,
    });
  } catch (err) {
    if (err instanceof AgentRunCancelledError || (err instanceof Error && err.message === "Cancelled")) {
      await markRunCancelled(teamId, activeRun);
      return;
    }

    if (await isRunCancelled(teamId, run.id)) {
      await markRunCancelled(teamId, activeRun);
      return;
    }

    const message = err instanceof Error ? err.message : "Agent run failed";
    await flushAgentRunCheckpointPatch(teamId, activeRun.id);
    const latest = await fetchAgentRun(teamId, activeRun.id);
    patchAgentRunInList(activeRun.id, {
      status: "failed",
      errorMessage: message,
      ...(latest?.result ? { result: latest.result } : {}),
    });
    await appendAgentRunStep(
      teamId,
      activeRun.id,
      { label: message, status: "error" },
      latest ?? activeRun,
    );
    await patchAgentRun(teamId, activeRun.id, {
      status: "failed",
      errorMessage: message,
      ...(latest?.result ? { result: latest.result } : {}),
    });

    const executionId = activeRun.plan?.taskExecutionId;
    if (executionId && teamId > 0) {
      await completeTaskExecution(teamId, executionId, { ok: false, error: message });
    }
  } finally {
    activeRunIds.delete(run.id);
    releaseRunLease(run.id);
  }
}

export function isAgentRunActive(runId: number): boolean {
  return activeRunIds.has(runId);
}

export function filterRunnableRuns(runs: AgentRun[]): AgentRun[] {
  return runs.filter(
    (r) =>
      (r.status === "queued" || r.status === "running") &&
      !activeRunIds.has(r.id) &&
      r.result?.executionMode !== "server" &&
      r.plan?.executionMode !== "server",
  );
}

export function hasActiveRuns(runs: AgentRun[]): boolean {
  return runs.some((r) => r.status === "queued" || r.status === "running");
}

export function hasPollingRuns(runs: AgentRun[]): boolean {
  return runs.some((r) => !isAgentRunTerminal(r.status));
}

export function hasTerminalRuns(runs: AgentRun[]): boolean {
  return runs.some((r) => isAgentRunTerminal(r.status));
}
