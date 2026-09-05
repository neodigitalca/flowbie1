import { tasksApi } from "@/lib/tasks-api";

export type UploadDeliverableToDriveInput = {
  fileName: string;
  content: string;
  folderId: string;
  mime?: string;
  convertToGoogleDoc?: boolean;
};

export type UploadDeliverableToDriveResult = {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  name?: string;
  error?: string;
};

export async function uploadDeliverableToDrive(
  input: UploadDeliverableToDriveInput,
): Promise<UploadDeliverableToDriveResult> {
  const response = await tasksApi("/google-mcp/upload-deliverable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: input.fileName,
      content: input.content,
      folderId: input.folderId,
      mime: input.mime,
      convertToGoogleDoc: input.convertToGoogleDoc,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as UploadDeliverableToDriveResult & {
    error?: string;
    path?: string;
  };
  if (!response.ok) {
    const detail = data.error ?? response.statusText ?? "Upload failed";
    const path = typeof data.path === "string" ? data.path.trim() : "";
    return {
      success: false,
      error: path ? `${detail} (${path})` : detail,
    };
  }
  return data;
}
