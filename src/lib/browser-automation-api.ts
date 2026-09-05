import { tasksApi } from "@/lib/tasks-api";

export type BrowserAutomationJobStatus = "running" | "done" | "error";

export type BrowserAutomationJobProgress = {
  ok?: boolean;
  status: BrowserAutomationJobStatus;
  label?: string;
  screenshotBase64?: string | null;
  result?: Record<string, unknown>;
  error?: string;
  jobId?: string;
  deliverable?: BrowserAutomationProgressDeliverable;
};

export type BrowserAutomationProgressDeliverable = {
  filename?: string;
  label?: string;
  mime?: string;
  kind?: string;
  content?: string;
  base64?: string;
  url?: string | null;
  rowIndex?: number;
  rowTotal?: number;
};

export type ResidentialProxyStatus = {
  ok?: boolean;
  configured?: boolean;
  host?: string;
  port?: string;
  username?: string;
  ip?: string;
  error?: string;
};

export async function startBrowserAutomationJob(input: {
  targetUrl: string;
  browserInstructionsHtml: string;
}): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const res = await tasksApi("/browser-automation/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetUrl: input.targetUrl.trim(),
      browserInstructionsHtml: input.browserInstructionsHtml.trim(),
    }),
  });
  const data = (await res.json()) as { ok?: boolean; jobId?: string; error?: string };
  return {
    ok: Boolean(data.ok && data.jobId),
    jobId: data.jobId,
    error: data.error,
  };
}

export async function pollBrowserAutomationJob(jobId: string): Promise<BrowserAutomationJobProgress> {
  const res = await tasksApi(`/browser-automation/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    cache: "no-store",
  });
  return (await res.json()) as BrowserAutomationJobProgress;
}

export async function cancelBrowserAutomationJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await tasksApi(`/browser-automation/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function waitForBrowserAutomationJob(
  jobId: string,
  options?: {
    pollMs?: number;
    onProgress?: (progress: BrowserAutomationJobProgress) => void | Promise<void>;
  },
): Promise<BrowserAutomationJobProgress> {
  const pollMs = options?.pollMs ?? 400;

  while (true) {
    const progress = await pollBrowserAutomationJob(jobId);
    await options?.onProgress?.(progress);
    if (progress.status === "done" || progress.status === "error") {
      if (progress.status === "error") {
        throw new Error(progress.error ?? "Browser automation failed.");
      }
      return progress;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

export async function fetchResidentialProxyStatus(probe = false): Promise<ResidentialProxyStatus> {
  const query = probe ? "?probe=1" : "";
  const res = await tasksApi(`/residential-proxy/status${query}`, {
    method: "GET",
    cache: "no-store",
  });
  return (await res.json()) as ResidentialProxyStatus;
}
