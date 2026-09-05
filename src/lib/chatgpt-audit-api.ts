import { tasksApi } from "@/lib/tasks-api";

export type ChatGptAuditQueryResponse = {
  queryId?: string;
  query?: string;
  prompt?: string;
  response?: string;
  capturedAt?: string;
};

export type ChatGptAuditJobStatus = "running" | "done" | "error";

export type ChatGptAuditJobProgress = {
  ok?: boolean;
  status: ChatGptAuditJobStatus;
  label?: string;
  screenshotBase64?: string | null;
  screenshotCapturedAt?: string | null;
  newChatReady?: boolean;
  newChatUrl?: string | null;
  result?: Record<string, unknown>;
  error?: string;
  jobId?: string;
  sessionReady?: boolean;
  responses?: ChatGptAuditQueryResponse[];
};

export async function startChatGptAuditJob(input: {
  clientName: string;
  clientUrl: string;
}): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const res = await tasksApi("/chatgpt-audit/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientName: input.clientName.trim(),
      clientUrl: input.clientUrl.trim(),
    }),
  });
  const data = (await res.json()) as { ok?: boolean; jobId?: string; error?: string };
  return {
    ok: Boolean(data.ok && data.jobId),
    jobId: data.jobId,
    error: data.error,
  };
}

export async function pollChatGptAuditJob(jobId: string): Promise<ChatGptAuditJobProgress> {
  const res = await tasksApi(`/chatgpt-audit/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    cache: "no-store",
  });
  return (await res.json()) as ChatGptAuditJobProgress;
}

export async function submitChatGptAuditQuery(
  jobId: string,
  text: string,
  clientUrl = "",
): Promise<{ ok: boolean; queryId?: string; error?: string }> {
  const res = await tasksApi(`/chatgpt-audit/jobs/${encodeURIComponent(jobId)}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.trim(),
      ...(clientUrl.trim() ? { clientUrl: clientUrl.trim() } : {}),
    }),
  });
  const data = (await res.json()) as { ok?: boolean; queryId?: string; error?: string };
  return {
    ok: Boolean(data.ok),
    queryId: data.queryId,
    error: data.error,
  };
}

export async function finishChatGptAuditJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await tasksApi(`/chatgpt-audit/jobs/${encodeURIComponent(jobId)}/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function startNewChatForAuditJob(
  jobId: string,
  clientUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await tasksApi(`/chatgpt-audit/jobs/${encodeURIComponent(jobId)}/new-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientUrl: clientUrl.trim() }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function cancelChatGptAuditJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await tasksApi(`/chatgpt-audit/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}

const POLL_INTERVAL_MS = 1500;

export async function waitForChatGptAuditJob(
  jobId: string,
  handlers?: {
    onProgress?: (progress: ChatGptAuditJobProgress) => void | Promise<void>;
  },
): Promise<ChatGptAuditJobProgress> {
  while (true) {
    const progress = await pollChatGptAuditJob(jobId);
    await handlers?.onProgress?.(progress);

    if (progress.status === "done") return progress;
    if (progress.status === "error") {
      throw new Error(progress.error ?? "ChatGPT audit session failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
