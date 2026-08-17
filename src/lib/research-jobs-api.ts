import { fetchTaskExecution, tasksApi } from "@/lib/tasks-api";

export type ResearchJobKey = "local_dominator_export";

export type DispatchResearchJobInput = {
  teamId: number;
  jobKey: ResearchJobKey;
  executionId: number;
  agentRunId?: number;
  payload: Record<string, unknown>;
};

export async function dispatchResearchJob(
  input: DispatchResearchJobInput,
): Promise<{ ok: boolean; status?: string; error?: string; code?: string }> {
  const res = await tasksApi("/research-jobs/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await res.json()) as {
    ok?: boolean;
    status?: string;
    error?: string;
    code?: string;
  };
}

export async function pollResearchExecution(
  teamId: number,
  executionId: number,
  options?: { intervalMs?: number; timeoutMs?: number },
): Promise<{ ok: boolean; error?: string }> {
  const intervalMs = options?.intervalMs ?? 3000;
  const timeoutMs = options?.timeoutMs ?? 15 * 60 * 1000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const { execution, error } = await fetchTaskExecution(teamId, executionId);
    if (!execution) {
      return { ok: false, error: error ?? "Execution not found." };
    }
    if (execution.status === "completed") {
      return { ok: true };
    }
    if (execution.status === "failed" || execution.status === "cancelled") {
      return {
        ok: false,
        error: execution.error || execution.progress?.error || "Research job failed.",
      };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { ok: false, error: "Research job timed out waiting for GitHub Actions." };
}
