import type { AgentRun } from "@/lib/agent-runs-types";

export function buildAgentRunBatchKey(runId: number): string {
  return `agent-run-${runId}`;
}

export function isAgentRunBatchKey(batchKey: string | undefined | null): boolean {
  return Boolean(batchKey?.trim().startsWith("agent-run-"));
}

export function agentRunSiteId(run: AgentRun): string {
  return run.plan?.clientRunContract?.siteId?.trim() || run.context.siteId?.trim() || "";
}

export function resolveAgentRunBatchKey(run: AgentRun, siteId?: string): string {
  const stored = run.clientBatchKey?.trim();
  if (stored && isAgentRunBatchKey(stored)) return stored;
  if (run.id > 0) return buildAgentRunBatchKey(run.id);
  const sid = siteId?.trim() || agentRunSiteId(run);
  return sid ? `${sid}-batch` : "";
}
