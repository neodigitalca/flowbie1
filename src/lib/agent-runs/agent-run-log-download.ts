import {
  enrichAgentRunStepsWithServerData,
  formatAgentRunLogJson,
  type AgentRunLogJsonExport,
} from "@/lib/agent-runs/agent-run-log-format";
import { fetchAgentRun, fetchAgentRunArtifacts } from "@/lib/agent-runs-api";
import { agentRunIsServerExecution } from "@/lib/agent-runs/agent-run-display";
import { agentRunSiteId } from "@/lib/agent-runs/agent-run-batch-key";
import { mergeAgentRunSiteFromSeed, resolveAgentRunSiteIdentity } from "@/lib/agent-runs/resolve-agent-run-site";
import type { AgentRun, AgentRunStep } from "@/lib/agent-runs-types";

export type AgentRunShareRow = {
  run: AgentRun;
  clientName?: string | null;
};

export type AgentRunShareBundleEntry = {
  agentRunId: number;
  clientName: string | null;
  siteId: string | null;
  status: AgentRun["status"];
  title: string;
  errorMessage: string | null;
  log: AgentRunLogJsonExport;
};

export type AgentRunShareBundle = {
  workflowRunId: number | null;
  exportedAt: string;
  runCount: number;
  runs: AgentRunShareBundleEntry[];
};

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

function stampForFilename(exportedAt: string): string {
  return exportedAt.replace(/[:.]/g, "-");
}

export function buildAgentRunsShareBundle(
  entries: AgentRunShareBundleEntry[],
  options?: { workflowRunId?: number | null; exportedAt?: string },
): AgentRunShareBundle {
  return {
    workflowRunId: options?.workflowRunId ?? null,
    exportedAt: options?.exportedAt ?? new Date().toISOString(),
    runCount: entries.length,
    runs: entries,
  };
}

async function enrichRunForShare(
  teamId: number | null | undefined,
  row: AgentRunShareRow,
): Promise<AgentRunShareBundleEntry> {
  const seed = row.run;
  let full = seed;
  if (teamId && seed.id > 0) {
    const fetched = await fetchAgentRun(teamId, seed.id);
    if (fetched) full = mergeAgentRunSiteFromSeed(fetched, seed);
  }
  let steps = full.steps ?? seed.steps ?? [];
  if (teamId && agentRunIsServerExecution(full)) {
    const artifacts = await fetchAgentRunArtifacts(teamId, full.id);
    steps = enrichAgentRunStepsWithServerData(full, steps, artifacts);
  }
  const siteId = agentRunSiteId(full) || null;
  const identityName = resolveAgentRunSiteIdentity(full).siteName.trim();
  const clientName = row.clientName?.trim() || identityName || null;
  return {
    agentRunId: full.id,
    clientName,
    siteId,
    status: full.status,
    title: full.title,
    errorMessage: full.errorMessage?.trim() || null,
    log: formatAgentRunLogJson(full, steps),
  };
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

export async function downloadAgentRunsShareBundle(
  teamId: number | null | undefined,
  rows: AgentRunShareRow[],
  options?: { workflowRunId?: number | null; filenamePrefix?: string },
): Promise<void> {
  if (rows.length === 0) return;
  const entries = await Promise.all(rows.map((row) => enrichRunForShare(teamId, row)));
  entries.sort((a, b) => a.agentRunId - b.agentRunId);
  const workflowIds = new Set<number>();
  for (const row of rows) {
    const id = workflowRunIdFromAgentRun(row.run);
    if (id) workflowIds.add(id);
  }
  const workflowRunId =
    options?.workflowRunId ?? (workflowIds.size === 1 ? [...workflowIds][0]! : null);
  const bundle = buildAgentRunsShareBundle(entries, { workflowRunId });
  const prefix = options?.filenamePrefix?.trim() || "agent-runs-all-clients";
  triggerJsonDownload(`${prefix}-${stampForFilename(bundle.exportedAt)}.json`, JSON.stringify(bundle, null, 2));
}

export async function downloadWorkflowRunAgentLogs(
  teamId: number | null | undefined,
  workflowRunId: number,
  runs: AgentRun[],
): Promise<void> {
  const related = runs
    .filter((run) => workflowRunIdFromAgentRun(run) === workflowRunId)
    .sort((a, b) => a.id - b.id);
  await downloadAgentRunsShareBundle(
    teamId,
    related.map((run) => ({ run })),
    {
      workflowRunId,
      filenamePrefix: `workflow-run-${workflowRunId}-agent-logs`,
    },
  );
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
