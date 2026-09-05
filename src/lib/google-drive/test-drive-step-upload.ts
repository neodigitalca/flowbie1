import { tasksApi } from "@/lib/tasks-api";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

export type TestDriveStepUploadInput = {
  title: string;
  siteName: string;
  siteUrl?: string;
  contract: TaskExecutionPayload | Record<string, unknown>;
  executionKind?: string;
};

export type TestDriveStepUploadResult = {
  ok: boolean;
  fileLink?: string;
  folderLink?: string;
  fileName?: string;
  folderLabel?: string;
  created?: string[];
  error?: string;
};

export async function testDriveStepUpload(
  input: TestDriveStepUploadInput,
): Promise<TestDriveStepUploadResult> {
  const contract = input.contract as Record<string, unknown>;
  const response = await tasksApi("/google-mcp/test-step-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      siteName: input.siteName,
      siteUrl: input.siteUrl,
      executionKind: input.executionKind,
      saveToGoogleDrive: true,
      googleDriveFolderSource: contract.googleDriveFolderSource,
      googleDriveFolderId: contract.googleDriveFolderId,
      googleDriveFolderLabel: contract.googleDriveFolderLabel,
      googleDriveFolderPath: contract.googleDriveFolderPath,
      googleDrivePresetKey: contract.googleDrivePresetKey,
      googleDriveFolderVariable: contract.googleDriveFolderVariable,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    fileLink?: string;
    folderLink?: string;
    fileName?: string;
    folderLabel?: string;
    created?: string[];
    error?: string;
    path?: string;
  };
  if (!response.ok || data.success === false) {
    const detail = data.error ?? response.statusText ?? "Google Drive step test failed.";
    const path = typeof data.path === "string" ? data.path.trim() : "";
    return {
      ok: false,
      error: path ? `${detail} (${path})` : detail,
    };
  }
  return {
    ok: true,
    fileLink: data.fileLink?.trim(),
    folderLink: data.folderLink?.trim(),
    fileName: data.fileName?.trim(),
    folderLabel: data.folderLabel?.trim(),
    created: Array.isArray(data.created) ? data.created.map(String) : [],
  };
}
