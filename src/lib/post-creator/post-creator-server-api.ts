import type {
  AgentRun,
  AgentRunResult,
  AgentRunStepArtifact,
} from "@/lib/agent-runs-types";
import type { AgentRunArtifactRecord } from "@/lib/agent-runs-api";

export type PostCreatorServerApiConfig = {
  apiBase: string;
  bearerToken: string;
  openRouterApiKey?: string;
};

function apiUrl(base: string, path: string): string {
  const trimmed = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (trimmed.endsWith("/api")) {
    return `${trimmed}${p}`;
  }
  return `${trimmed}/api${p}`;
}

async function serverApi(
  config: PostCreatorServerApiConfig,
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const headers = new Headers(options?.headers);
  headers.set("Authorization", `Bearer ${config.bearerToken}`);
  headers.set("Accept", "application/json");
  if (config.openRouterApiKey?.trim()) {
    headers.set("X-OpenRouter-Api-Key", config.openRouterApiKey.trim());
  }
  const method = options?.method ?? "GET";
  const fullUrl = apiUrl(config.apiBase, path);
  try {
    return await fetch(fullUrl, {
      ...options,
      headers,
      cache: "no-store",
    });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`Post creator API fetch failed: ${method} ${fullUrl}: ${cause}`);
  }
}

async function readServerApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 160);
    throw new Error(
      `Post creator API returned non-JSON (${res.status} ${res.statusText}): ${snippet}`,
    );
  }
}

export async function serverFetchAgentRun(
  config: PostCreatorServerApiConfig,
  teamId: number,
  runId: number,
): Promise<AgentRun | null> {
  const res = await serverApi(config, `/agent-runs/${runId}?teamId=${teamId}`);
  const data = await readServerApiJson<{ ok?: boolean; run?: AgentRun }>(res);
  return data.run ?? null;
}

export async function serverPatchAgentRun(
  config: PostCreatorServerApiConfig,
  teamId: number,
  runId: number,
  patch: {
    status?: AgentRun["status"];
    errorMessage?: string;
    result?: AgentRunResult;
    step?: {
      label: string;
      status?: string;
      stepKey?: string;
      payload?: Record<string, unknown>;
    };
  },
): Promise<{ ok: boolean; run?: AgentRun; error?: string }> {
  const res = await serverApi(config, `/agent-runs/${runId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, ...patch }),
  });
  const data = await readServerApiJson<{ ok?: boolean; run?: AgentRun; error?: string }>(res);
  return { ok: Boolean(data.ok), run: data.run, error: data.error };
}

export async function serverFetchAgentRunArtifacts(
  config: PostCreatorServerApiConfig,
  teamId: number,
  runId: number,
): Promise<AgentRunArtifactRecord[]> {
  const res = await serverApi(config, `/agent-runs/${runId}/artifacts?teamId=${teamId}`);
  const data = await readServerApiJson<{ ok?: boolean; artifacts?: AgentRunArtifactRecord[] }>(res);
  return data.artifacts ?? [];
}

export async function serverUploadAgentRunArtifact(
  config: PostCreatorServerApiConfig,
  teamId: number,
  runId: number,
  input: {
    stepKey: string;
    name: string;
    mime: string;
    content: string;
  },
): Promise<{ ok: boolean; artifact?: AgentRunStepArtifact; error?: string }> {
  const res = await serverApi(config, `/agent-runs/${runId}/artifacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, ...input }),
  });
  const data = await readServerApiJson<{
    ok?: boolean;
    artifact?: AgentRunStepArtifact;
    error?: string;
  }>(res);
  return { ok: Boolean(data.ok), artifact: data.artifact, error: data.error };
}
