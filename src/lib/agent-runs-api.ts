import { backendApiUrl } from "@/lib/wordpress-api/connection";
import { neoPulseApiHeaders } from "@/lib/neo-pulse-api-headers";
import type {
  AgentRun,
  AgentRunPlan,
  AgentRunResult,
  AgentRunSource,
  AgentRunStatus,
  AgentRunStepArtifact,
  StartAgentRunPayload,
} from "@/lib/agent-runs-types";

async function api(path: string, options?: RequestInit): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const headers = neoPulseApiHeaders(options?.headers);
  return fetch(backendApiUrl(p), { ...options, headers, credentials: "include", cache: "no-store" });
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
  try {
    const data = (await res.json()) as { ok?: boolean; runs?: AgentRun[] };
    return data.runs ?? [];
  } catch {
    return [];
  }
}

export async function fetchAgentRun(teamId: number, runId: number): Promise<AgentRun | null> {
  const res = await api(`/agent-runs/${runId}?teamId=${teamId}`);
  if (res.status === 404) return null;
  try {
    const data = (await res.json()) as { ok?: boolean; run?: AgentRun };
    return data.run ?? null;
  } catch {
    return null;
  }
}

export async function createAgentRun(payload: StartAgentRunPayload): Promise<{ ok: boolean; run?: AgentRun; error?: string }> {
  try {
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
    if (!data.ok) {
      return {
        ok: false,
        error: data.error?.trim() || `Could not create agent run (HTTP ${res.status})`,
      };
    }
    return { ok: true, run: data.run };
  } catch {
    return { ok: false, error: "Could not create agent run (network error)" };
  }
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
    step?: {
      label: string;
      status?: string;
      stepIndex?: number;
      stepKey?: string;
      payload?: Record<string, unknown>;
    };
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

export async function deleteAgentRun(
  teamId: number,
  runId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await api(`/agent-runs/${runId}?teamId=${teamId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function clearAgentRuns(
  teamId: number,
  statuses?: AgentRunStatus[],
): Promise<{ ok: boolean; deleted?: number; error?: string }> {
  const res = await api("/agent-runs/clear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, statuses }),
  });
  const data = (await res.json()) as { ok?: boolean; deleted?: number; error?: string };
  return { ok: Boolean(data.ok), deleted: data.deleted, error: data.error };
}

export type AgentRunArtifactRecord = AgentRunStepArtifact & {
  stepKey?: string;
  createdAt?: string;
};

export async function fetchAgentRunArtifacts(
  teamId: number,
  runId: number,
): Promise<AgentRunArtifactRecord[]> {
  const res = await api(`/agent-runs/${runId}/artifacts?teamId=${teamId}`);
  const data = (await res.json()) as { ok?: boolean; artifacts?: AgentRunArtifactRecord[] };
  return data.artifacts ?? [];
}

export async function fetchAgentRunDeliverableFiles(
  teamId: number,
  runId: number,
): Promise<Array<{ fileName: string; mime: string; content: string }>> {
  const res = await api(`/agent-runs/${runId}/deliverables?teamId=${teamId}`);
  const data = (await res.json()) as {
    ok?: boolean;
    files?: Array<{ fileName: string; mime: string; content: string }>;
  };
  return data.files ?? [];
}

/** Load CSV text from agent run artifacts via WP API (never a public upload URL). */
export async function fetchAgentRunCsvContent(
  teamId: number,
  runId: number,
): Promise<string | undefined> {
  const files = await fetchAgentRunDeliverableFiles(teamId, runId);
  const csvFile = files.find(
    (file) =>
      file.mime?.trim().toLowerCase() === "text/csv"
      || file.fileName.trim().toLowerCase().endsWith(".csv"),
  );
  const content = csvFile?.content?.trim();
  return content || undefined;
}

export async function processAgentRun(
  teamId: number,
  runId: number,
): Promise<{ ok: boolean; run?: AgentRun; error?: string }> {
  const { loadApiKey, loadDataForSEOApiKey } = await import("@/lib/api");
  const openRouterApiKey = loadApiKey().trim();
  const dataForSeoApiKey = loadDataForSEOApiKey().trim();
  const res = await api(`/agent-runs/${runId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamId,
      openRouterApiKey: openRouterApiKey || undefined,
      dataForSeoApiKey: dataForSeoApiKey || undefined,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; run?: AgentRun; error?: string };
  return { ok: Boolean(data.ok), run: data.run, error: data.error };
}

export async function completeServerPostCreatorRowUpload(
  teamId: number,
  runId: number,
  rowIndex: number,
  uploadedPost: { url: string; postId?: number; title?: string },
): Promise<{ ok: boolean; run?: AgentRun; error?: string }> {
  const res = await api(`/agent-runs/${runId}/rows/${rowIndex}/upload-complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, uploadedPost }),
  });
  const data = (await res.json()) as { ok?: boolean; run?: AgentRun; error?: string };
  return { ok: Boolean(data.ok), run: data.run, error: data.error };
}

export async function uploadAgentRunArtifact(
  teamId: number,
  runId: number,
  input: {
    stepKey: string;
    name: string;
    mime: string;
    content: string;
  },
): Promise<{ ok: boolean; artifact?: AgentRunStepArtifact; error?: string }> {
  const res = await api(`/agent-runs/${runId}/artifacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, ...input }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    artifact?: AgentRunStepArtifact;
    error?: string;
  };
  return { ok: Boolean(data.ok), artifact: data.artifact, error: data.error };
}

export type { AgentRunPlan, AgentRunResult };
