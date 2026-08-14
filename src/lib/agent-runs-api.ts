import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import type {
  AgentRun,
  AgentRunPlan,
  AgentRunResult,
  AgentRunSource,
  AgentRunStatus,
  StartAgentRunPayload,
} from "@/lib/agent-runs-types";

function baseUrl(): string {
  return (import.meta.env.VITE_MCP_API_BASE?.replace(/\/api\/mcp\/?$/, "") || BACKEND_API_BASE || "").replace(
    /\/$/,
    "",
  );
}

async function api(path: string, options?: RequestInit): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${baseUrl()}/api${p}`, { ...options, credentials: "include" });
}

export async function fetchAgentRuns(
  teamId: number,
  filters?: { status?: AgentRunStatus; source?: AgentRunSource; taskId?: number },
): Promise<AgentRun[]> {
  const params = new URLSearchParams({ teamId: String(teamId) });
  if (filters?.status) params.set("status", filters.status);
  if (filters?.source) params.set("source", filters.source);
  if (filters?.taskId) params.set("task_id", String(filters.taskId));
  const res = await api(`/agent-runs?${params.toString()}`);
  const data = (await res.json()) as { ok?: boolean; runs?: AgentRun[] };
  return data.runs ?? [];
}

export async function fetchAgentRun(teamId: number, runId: number): Promise<AgentRun | null> {
  const res = await api(`/agent-runs/${runId}?teamId=${teamId}`);
  const data = (await res.json()) as { ok?: boolean; run?: AgentRun };
  return data.run ?? null;
}

export async function createAgentRun(payload: StartAgentRunPayload): Promise<{ ok: boolean; run?: AgentRun; error?: string }> {
  const res = await api("/agent-runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamId: payload.teamId,
      source: payload.source,
      recipeKey: payload.recipeKey,
      title: payload.title,
      taskId: payload.taskId ?? null,
      context: payload.context ?? {},
      plan: payload.plan ?? {},
    }),
  });
  const data = (await res.json()) as { ok?: boolean; run?: AgentRun; error?: string };
  return { ok: Boolean(data.ok), run: data.run, error: data.error };
}

export async function patchAgentRun(
  teamId: number,
  runId: number,
  patch: {
    status?: AgentRunStatus;
    errorMessage?: string;
    result?: AgentRunResult;
    clientBatchKey?: string;
    taskStatus?: "todo" | "in_progress" | "done";
    step?: { label: string; status?: string; stepIndex?: number; payload?: Record<string, unknown> };
  },
): Promise<{ ok: boolean; run?: AgentRun; error?: string }> {
  const res = await api(`/agent-runs/${runId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, ...patch }),
  });
  const data = (await res.json()) as { ok?: boolean; run?: AgentRun; error?: string };
  return { ok: Boolean(data.ok), run: data.run, error: data.error };
}

export async function cancelAgentRun(teamId: number, runId: number): Promise<{ ok: boolean; run?: AgentRun; error?: string }> {
  const res = await api(`/agent-runs/${runId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId }),
  });
  const data = (await res.json()) as { ok?: boolean; run?: AgentRun; error?: string };
  return { ok: Boolean(data.ok), run: data.run, error: data.error };
}

export type { AgentRunPlan, AgentRunResult };
