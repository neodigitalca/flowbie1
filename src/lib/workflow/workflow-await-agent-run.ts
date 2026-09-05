import { fetchAgentRun } from "@/lib/agent-runs-api";
import { isAgentRunTerminal } from "@/lib/agent-runs-types";
import type { AgentRun } from "@/lib/agent-runs-types";

const POLL_MS = 1500;
const MAX_WAIT_MS = 6 * 60 * 60 * 1000;

export async function awaitAgentRunTerminal(
  teamId: number,
  agentRunId: number,
  maxWaitMs = MAX_WAIT_MS,
): Promise<AgentRun | null> {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const run = await fetchAgentRun(teamId, agentRunId);
    if (!run) return null;
    if (isAgentRunTerminal(run.status)) return run;
    await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
  }
  const run = await fetchAgentRun(teamId, agentRunId);
  if (!run || isAgentRunTerminal(run.status)) return run;
  return run;
}
