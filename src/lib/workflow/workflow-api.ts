import { tasksApi } from "@/lib/tasks-api";
import type {
  WorkflowDefinition,
  WorkflowLibraryEntry,
  WorkflowPendingDispatch,
  WorkflowRun,
  WorkflowStepOutput,
} from "@/lib/workflow/workflow-types";

function workflowsPath(teamId: number, sub = ""): string {
  const base = `/teams/${teamId}/workflows`;
  if (!sub) return base;
  return `${base}/${sub.replace(/^\//, "")}`;
}

async function parseJson<T>(res: Response): Promise<T & { ok?: boolean; error?: string }> {
  try {
    return (await res.json()) as T & { ok?: boolean; error?: string };
  } catch {
    return { ok: false, error: res.status === 404 ? "Workflow API not found" : `Request failed (${res.status})` } as T & {
      ok?: boolean;
      error?: string;
    };
  }
}

function apiError(res: Response, data: { error?: string }): string {
  if (data.error) return data.error;
  if (res.status === 404) return "Workflow API not found. Use npm run dev for local WP or deploy neo-pulse-app for production.";
  if (res.status === 401) return "Unauthorized";
  if (res.status === 403) return "Forbidden";
  return `Request failed (${res.status})`;
}

export async function fetchWorkflows(
  teamId: number,
): Promise<{ workflows: WorkflowDefinition[]; error?: string }> {
  const res = await tasksApi(workflowsPath(teamId));
  const data = await parseJson<{ workflows?: WorkflowDefinition[] }>(res);
  if (!res.ok) return { workflows: [], error: apiError(res, data) };
  return { workflows: data.workflows ?? [] };
}

export async function fetchWorkflow(teamId: number, workflowId: number): Promise<WorkflowDefinition | null> {
  const res = await tasksApi(workflowsPath(teamId, String(workflowId)));
  const data = await parseJson<{ workflow?: WorkflowDefinition }>(res);
  return data.workflow ?? null;
}

export async function createWorkflow(
  teamId: number,
  payload: {
    name: string;
    description?: string;
    wordpressSiteId?: string | null;
    nodes?: WorkflowDefinition["nodes"];
    edges?: WorkflowDefinition["edges"];
    ragVariables?: WorkflowDefinition["ragVariables"];
  },
): Promise<{ ok: boolean; workflow?: WorkflowDefinition; error?: string }> {
  const res = await tasksApi(workflowsPath(teamId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ workflow?: WorkflowDefinition }>(res);
  if (!res.ok) return { ok: false, error: apiError(res, data) };
  if (data.workflow) return { ok: true, workflow: data.workflow };
  return { ok: false, error: data.error ?? "Could not create workflow" };
}

export async function updateWorkflow(
  teamId: number,
  workflowId: number,
  payload: Partial<
    Pick<WorkflowDefinition, "name" | "description" | "wordpressSiteId" | "nodes" | "edges" | "ragVariables">
  >,
): Promise<{ ok: boolean; workflow?: WorkflowDefinition; error?: string }> {
  const res = await tasksApi(workflowsPath(teamId, String(workflowId)), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ workflow?: WorkflowDefinition }>(res);
  if (!res.ok) return { ok: false, error: apiError(res, data) };
  if (data.workflow) return { ok: true, workflow: data.workflow };
  return { ok: false, error: data.error ?? "Could not save workflow" };
}

export async function deleteWorkflow(
  teamId: number,
  workflowId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await tasksApi(workflowsPath(teamId, String(workflowId)), { method: "DELETE" });
  const data = await parseJson<Record<string, never>>(res);
  return { ok: Boolean(data.ok), error: data.error };
}

export async function publishWorkflow(
  teamId: number,
  workflowId: number,
): Promise<{ ok: boolean; workflow?: WorkflowDefinition; error?: string }> {
  const res = await tasksApi(workflowsPath(teamId, `${workflowId}/publish`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await parseJson<{ workflow?: WorkflowDefinition }>(res);
  return { ok: Boolean(data.ok), workflow: data.workflow, error: data.error };
}

export async function startWorkflowRun(
  teamId: number,
  workflowId: number,
  payload?: { simulated?: boolean; triggerPayload?: Record<string, unknown> },
): Promise<{ ok: boolean; run?: WorkflowRun; error?: string }> {
  const res = await tasksApi(workflowsPath(teamId, `${workflowId}/runs`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  const data = await parseJson<{ run?: WorkflowRun }>(res);
  return { ok: Boolean(data.ok), run: data.run, error: data.error };
}

export async function fetchWorkflowRuns(
  teamId: number,
  workflowId: number,
): Promise<WorkflowRun[]> {
  const res = await tasksApi(workflowsPath(teamId, `${workflowId}/runs`));
  const data = await parseJson<{ runs?: WorkflowRun[] }>(res);
  return data.runs ?? [];
}

export async function deleteWorkflowRun(
  teamId: number,
  workflowId: number,
  runId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await tasksApi(workflowsPath(teamId, `${workflowId}/runs/${runId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delete: true }),
  });
  const data = await parseJson<Record<string, never>>(res);
  if (!res.ok) return { ok: false, error: apiError(res, data) };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function clearWorkflowRuns(
  teamId: number,
  workflowId: number,
): Promise<{ ok: boolean; deleted?: number; error?: string }> {
  const runs = await fetchWorkflowRuns(teamId, workflowId);
  if (runs.length === 0) return { ok: true, deleted: 0 };

  for (const run of runs) {
    const result = await deleteWorkflowRun(teamId, workflowId, run.id);
    if (!result.ok) return result;
  }
  return { ok: true, deleted: runs.length };
}

export async function fetchWorkflowRun(
  teamId: number,
  workflowId: number,
  runId: number,
): Promise<WorkflowRun | null> {
  const res = await tasksApi(workflowsPath(teamId, `${workflowId}/runs/${runId}`));
  const data = await parseJson<{ run?: WorkflowRun }>(res);
  return data.run ?? null;
}

export async function patchWorkflowRun(
  teamId: number,
  workflowId: number,
  runId: number,
  payload: Partial<Pick<WorkflowRun, "status" | "currentNodeId" | "errorMessage">> & {
    context?: Record<string, unknown>;
    delete?: boolean;
  },
): Promise<{ ok: boolean; run?: WorkflowRun; error?: string }> {
  const res = await tasksApi(workflowsPath(teamId, `${workflowId}/runs/${runId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ run?: WorkflowRun }>(res);
  if (!res.ok) return { ok: false, error: apiError(res, data) };
  return { ok: Boolean(data.ok), run: data.run, error: data.error };
}

export async function saveWorkflowStepOutput(
  teamId: number,
  workflowId: number,
  runId: number,
  payload: {
    nodeId: string;
    variableKey: string;
    scope: WorkflowStepOutput["scope"];
    label: string;
    textPreview: string;
    fileRefs?: WorkflowStepOutput["fileRefs"];
    agentRunId?: number | null;
  },
): Promise<{ ok: boolean; output?: WorkflowStepOutput; error?: string }> {
  const res = await tasksApi(workflowsPath(teamId, `${workflowId}/runs/${runId}/outputs`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ output?: WorkflowStepOutput }>(res);
  return { ok: Boolean(data.ok), output: data.output, error: data.error };
}

export async function fetchWorkflowStepOutputs(
  teamId: number,
  workflowId: number,
  runId: number,
): Promise<WorkflowStepOutput[]> {
  const res = await tasksApi(workflowsPath(teamId, `${workflowId}/runs/${runId}/outputs`));
  const data = await parseJson<{ outputs?: WorkflowStepOutput[] }>(res);
  return data.outputs ?? [];
}

export async function fetchWorkflowLibrary(teamId: number): Promise<WorkflowLibraryEntry[]> {
  const res = await tasksApi(workflowsPath(teamId, "library"));
  const data = await parseJson<{ entries?: WorkflowLibraryEntry[] }>(res);
  return data.entries ?? [];
}

export async function promoteWorkflowOutputToLibrary(
  teamId: number,
  key: string,
  payload: { runId: number; outputId: number; label?: string },
): Promise<{ ok: boolean; entry?: WorkflowLibraryEntry; error?: string }> {
  const res = await tasksApi(workflowsPath(teamId, `library/${encodeURIComponent(key)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ entry?: WorkflowLibraryEntry }>(res);
  return { ok: Boolean(data.ok), entry: data.entry, error: data.error };
}

export async function fetchPendingWorkflowTriggers(teamId: number): Promise<WorkflowPendingDispatch[]> {
  const res = await tasksApi(workflowsPath(teamId, "trigger-pending"));
  const data = await parseJson<{ pending?: WorkflowPendingDispatch[] }>(res);
  return data.pending ?? [];
}

export async function ackPendingWorkflowTrigger(
  teamId: number,
  workflowId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await tasksApi(workflowsPath(teamId, `trigger-pending/${workflowId}/ack`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await parseJson<Record<string, never>>(res);
  return { ok: Boolean(data.ok), error: data.error };
}
