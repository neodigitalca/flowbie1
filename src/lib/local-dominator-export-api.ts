import { tasksApi } from "@/lib/tasks-api";

export type LocalDominatorExportResponse = {
  ok?: boolean;
  fileName?: string;
  csvBase64?: string;
  businessName?: string;
  keyword?: string;
  error?: string;
  code?: string;
};

export type LocalDominatorExportJobStatus = "running" | "done" | "error";

export type LocalDominatorExportJobProgress = {
  ok?: boolean;
  status: LocalDominatorExportJobStatus;
  label?: string;
  screenshotBase64?: string | null;
  result?: LocalDominatorExportResponse;
  error?: string;
  jobId?: string;
};

import { resolveLocalDominatorExportKeyword } from "@/lib/local-dominator/local-dominator-export-keyword";

export async function exportLocalDominatorGrid(input: {
  businessName: string;
  keyword: string;
}): Promise<LocalDominatorExportResponse> {
  const res = await tasksApi("/local-dominator/export-grid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessName: input.businessName.trim(),
      keyword: resolveLocalDominatorExportKeyword(input.keyword),
    }),
  });
  return (await res.json()) as LocalDominatorExportResponse;
}

export async function startLocalDominatorExportJob(input: {
  businessName: string;
  keyword: string;
}): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const res = await tasksApi("/local-dominator/export-grid/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessName: input.businessName.trim(),
      keyword: resolveLocalDominatorExportKeyword(input.keyword),
    }),
  });
  const data = (await res.json()) as { ok?: boolean; jobId?: string; error?: string };
  return {
    ok: Boolean(data.ok && data.jobId),
    jobId: data.jobId,
    error: data.error,
  };
}

export async function cancelLocalDominatorExportJob(
  jobId: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await tasksApi(
    `/local-dominator/export-grid/jobs/${encodeURIComponent(jobId)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function cancelAllLocalDominatorExportJobs(): Promise<{ ok: boolean; cancelled?: number }> {
  const res = await tasksApi("/local-dominator/export-grid/jobs/cancel-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json()) as { ok?: boolean; cancelled?: number };
  return { ok: Boolean(data.ok), cancelled: data.cancelled };
}

export async function pollLocalDominatorExportJob(
  jobId: string,
): Promise<LocalDominatorExportJobProgress> {
  const res = await tasksApi(`/local-dominator/export-grid/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    cache: "no-store",
  });
  return (await res.json()) as LocalDominatorExportJobProgress;
}

const POLL_INTERVAL_MS = 400;

export async function waitForLocalDominatorExportJob(
  jobId: string,
  handlers?: {
    onProgress?: (progress: LocalDominatorExportJobProgress) => void | Promise<void>;
    shouldAbort?: () => boolean | Promise<boolean>;
  },
): Promise<LocalDominatorExportResponse> {
  let lastScreenshot: string | null = null;

  while (true) {
    if (handlers?.shouldAbort && (await handlers.shouldAbort())) {
      throw new Error("Cancelled");
    }

    const progress = await pollLocalDominatorExportJob(jobId);
    if (progress.screenshotBase64 && progress.screenshotBase64 !== lastScreenshot) {
      lastScreenshot = progress.screenshotBase64;
    }
    await handlers?.onProgress?.(progress);

    if (progress.status === "done" && progress.result?.ok && progress.result.csvBase64) {
      return progress.result;
    }
    if (progress.status === "error") {
      throw new Error(progress.error ?? "Local Dominator export failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export function decodeLocalDominatorCsvBase64(csvBase64: string): string {
  const binary = atob(csvBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function downloadLocalDominatorCsv(fileName: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
