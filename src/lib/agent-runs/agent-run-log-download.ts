import {
  enrichAgentRunStepsWithServerData,
  formatAgentRunLogJson,
} from "@/lib/agent-runs/agent-run-log-format";
import { fetchAgentRunArtifacts } from "@/lib/agent-runs-api";
import { agentRunIsServerExecution } from "@/lib/agent-runs/agent-run-display";
import type { AgentRun, AgentRunStep } from "@/lib/agent-runs-types";

export async function downloadAgentRunLog(
  run: AgentRun,
  steps: AgentRunStep[],
  teamId?: number | null,
): Promise<void> {
  let enriched = steps;
  if (teamId && agentRunIsServerExecution(run)) {
    const artifacts = await fetchAgentRunArtifacts(teamId, run.id);
    enriched = enrichAgentRunStepsWithServerData(run, steps, artifacts);
  }
  const body = JSON.stringify(formatAgentRunLogJson(run, enriched), null, 2);
  const blob = new Blob([body], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agent-run-${run.id}-log.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function dedupeAgentRunLogLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export { formatAgentRunLogJson };
