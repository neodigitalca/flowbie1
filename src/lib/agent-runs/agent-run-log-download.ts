import {
  enrichAgentRunStepsWithServerData,
  formatAgentRunLogJson,
} from "@/lib/agent-runs/agent-run-log-format";
import { fetchAgentRunArtifacts } from "@/lib/agent-runs-api";
import { agentRunIsServerExecution } from "@/lib/agent-runs/agent-run-display";
import type { AgentRun, AgentRunStep } from "@/lib/agent-runs-types";

export function workflowRunIdFromAgentRun(run: AgentRun): number | null {
  const id = Number(run.context?.workflowRunId ?? run.plan?.workflowRunId ?? 0);
  return id > 0 ? id : null;
}

function triggerJsonDownload(filename: string, body: string): void {
  const blob = new Blob([body], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

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
  triggerJsonDownload(`agent-run-${run.id}-log.json`, body);
}

export async function downloadWorkflowRunAgentLogs(
  teamId: number | null | undefined,
  workflowRunId: number,
  runs: AgentRun[],
): Promise<void> {
  const related = runs
    .filter((run) => workflowRunIdFromAgentRun(run) === workflowRunId)
    .sort((a, b) => a.id - b.id);
  if (related.length === 0) return;

  const entries = await Promise.all(
    related.map(async (run) => {
      let steps = run.steps ?? [];
      if (teamId && agentRunIsServerExecution(run)) {
        const artifacts = await fetchAgentRunArtifacts(teamId, run.id);
        steps = enrichAgentRunStepsWithServerData(run, steps, artifacts);
      }
      return {
        agentRunId: run.id,
        siteId: run.context?.siteId?.trim() || null,
        status: run.status,
        title: run.title,
        errorMessage: run.errorMessage?.trim() || null,
        log: formatAgentRunLogJson(run, steps),
      };
    }),
  );

  const body = JSON.stringify(
    {
      workflowRunId,
      exportedAt: new Date().toISOString(),
      runCount: entries.length,
      runs: entries,
    },
    null,
    2,
  );
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  triggerJsonDownload(`workflow-run-${workflowRunId}-agent-logs-${stamp}.json`, body);
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
