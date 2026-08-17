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

export async function exportLocalDominatorGrid(input: {
  businessName: string;
  keyword: string;
}): Promise<LocalDominatorExportResponse> {
  const res = await tasksApi("/local-dominator/export-grid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessName: input.businessName.trim(),
      keyword: input.keyword.trim(),
    }),
  });
  return (await res.json()) as LocalDominatorExportResponse;
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
