import type { BulkGeneratedFile } from "@/lib/bulk-file-manager";

export type AgentRunHostedFile = {
  id: string;
  name: string;
  href: string;
  rowIndex: number;
  mimeType: string;
};

const hostedByRunId = new Map<number, AgentRunHostedFile[]>();
const blobUrlsByRunId = new Map<number, Map<string, string>>();
const listenersByRunId = new Map<number, Set<() => void>>();

function notify(runId: number): void {
  for (const listener of listenersByRunId.get(runId) ?? []) {
    listener();
  }
}

function revokeRunBlobUrls(runId: number): void {
  const byFileId = blobUrlsByRunId.get(runId);
  if (!byFileId) return;
  for (const href of byFileId.values()) {
    if (href.startsWith("blob:")) {
      URL.revokeObjectURL(href);
    }
  }
  blobUrlsByRunId.delete(runId);
}

export function clearAgentRunHostedFiles(runId: number): void {
  revokeRunBlobUrls(runId);
  hostedByRunId.delete(runId);
  listenersByRunId.delete(runId);
  notify(runId);
}

function hrefForBulkFile(file: BulkGeneratedFile, runId: number): string {
  if (file.mimeType.startsWith("image/") && file.content.startsWith("data:")) {
    return file.content;
  }
  let byFileId = blobUrlsByRunId.get(runId);
  if (!byFileId) {
    byFileId = new Map();
    blobUrlsByRunId.set(runId, byFileId);
  }
  const existing = byFileId.get(file.id);
  if (existing) return existing;
  const blob = new Blob([file.content], { type: file.mimeType || "application/octet-stream" });
  const href = URL.createObjectURL(blob);
  byFileId.set(file.id, href);
  return href;
}

export function bulkGeneratedFilesToHosted(
  runId: number,
  files: readonly BulkGeneratedFile[],
): AgentRunHostedFile[] {
  return files
    .filter(
      (file) =>
        file.status === "completed" ||
        (file.status === "error" && Boolean(file.content?.trim())),
    )
    .map((file) => ({
      id: file.id,
      name: file.fileName,
      href: hrefForBulkFile(file, runId),
      rowIndex: file.rowIndex,
      mimeType: file.mimeType,
    }));
}

export function createHostedHrefForBulkFile(runId: number, file: BulkGeneratedFile): string {
  return hrefForBulkFile(file, runId);
}

export function syncAgentRunHostedFilesFromBulk(
  runId: number,
  files: readonly BulkGeneratedFile[],
): AgentRunHostedFile[] {
  const next = bulkGeneratedFilesToHosted(runId, files);
  hostedByRunId.set(runId, next);
  notify(runId);
  return next;
}

export function getAgentRunHostedFiles(runId: number): AgentRunHostedFile[] {
  return hostedByRunId.get(runId) ?? [];
}

export function subscribeAgentRunHostedFiles(runId: number, listener: () => void): () => void {
  let set = listenersByRunId.get(runId);
  if (!set) {
    set = new Set();
    listenersByRunId.set(runId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}
