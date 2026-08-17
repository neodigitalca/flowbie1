import { uploadTaskFileContent, type TaskExecutionCompletePayload } from "@/lib/tasks-api";
import type { AgentRun } from "@/lib/agent-runs-types";

export type TaskArchiveFileInput = {
  fileName: string;
  mime: string;
  content: string;
};

export function archiveFilesBase64(
  files: TaskArchiveFileInput[],
): NonNullable<TaskExecutionCompletePayload["archiveFiles"]> {
  return files.map((file) => {
    const bytes = new TextEncoder().encode(file.content);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return {
      fileName: file.fileName,
      mime: file.mime,
      dataBase64: btoa(binary),
    };
  });
}

export function buildExecutionCompletePayload(input: {
  ok: boolean;
  result?: unknown;
  error?: string;
  run: AgentRun;
  saveLocalArchive: boolean;
  archiveFiles?: TaskArchiveFileInput[];
}): TaskExecutionCompletePayload {
  const payload: TaskExecutionCompletePayload = {
    ok: input.ok,
    result: input.result,
    error: input.error,
  };
  if (input.saveLocalArchive) {
    payload.agentRunId = input.run.id;
    if (input.archiveFiles && input.archiveFiles.length > 0) {
      payload.archiveFiles = archiveFilesBase64(input.archiveFiles);
    }
  }
  return payload;
}

export async function persistTaskArchiveFiles(
  teamId: number,
  taskId: number,
  files: TaskArchiveFileInput[],
): Promise<void> {
  for (const file of files) {
    if (!file.fileName.trim() || !file.content) continue;
    await uploadTaskFileContent(teamId, taskId, file);
  }
}

export function gscReportingFinalReportFile(input: {
  markdown: string;
  siteName: string;
  comparePreset: "mom" | "yoy";
  dateStamp?: number;
}): TaskArchiveFileInput {
  const stamp = input.dateStamp ?? Date.now();
  const slug = input.siteName.replace(/\s+/g, "-").replace(/[^\w-]/g, "").toLowerCase() || "gsc-report";
  const presetTag = input.comparePreset === "yoy" ? "yoy" : "mom";
  return {
    fileName: `gsc-report-${presetTag}-${slug}-${stamp}.md`,
    mime: "text/markdown",
    content: input.markdown.trim(),
  };
}

export function localDominatorArchiveFiles(input: {
  fileName: string;
  csvContent: string;
  businessName: string;
  keyword: string;
}): TaskArchiveFileInput[] {
  const safeName = input.fileName.replace(/[/\\?%*:|"<>]/g, "-");
  return [
    {
      fileName: safeName.endsWith(".csv") ? safeName : `${safeName}.csv`,
      mime: "text/csv",
      content: input.csvContent,
    },
  ];
}

export function gscReportingArchiveFiles(input: {
  markdown: string;
  files: Array<{ name: string; content: string }>;
  siteName: string;
  comparePreset: "mom" | "yoy";
  dateStamp?: number;
}): TaskArchiveFileInput[] {
  const stamp = input.dateStamp ?? Date.now();
  const slug = input.siteName.replace(/\s+/g, "-").replace(/[^\w-]/g, "").toLowerCase() || "gsc-report";
  const presetTag = input.comparePreset === "yoy" ? "yoy" : "mom";
  const out: TaskArchiveFileInput[] = [gscReportingFinalReportFile(input)];
  for (const file of input.files) {
    const base = file.name.split("/").pop() ?? file.name;
    if (!base.endsWith(".csv")) continue;
    const safeName = base.replace(/[/\\?%*:|"<>]/g, "-");
    out.push({
      fileName: `${presetTag}-${safeName}`,
      mime: "text/csv",
      content: file.content,
    });
  }
  return out;
}
