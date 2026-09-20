import { isCsvTextPreview } from "@/lib/workflow/csv-rows-types";
import type { WorkflowStepOutput } from "@/lib/workflow/workflow-types";

export type WorkflowRagDownloadableFile = {
  name: string;
  href: string;
  outputKey: string;
  sizeBytes: number | null;
};

export function csvTextToDataHref(text: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(text)}`;
}

export function downloadableCsvFromStepOutput(
  output: WorkflowStepOutput,
): WorkflowRagDownloadableFile | null {
  const preview = output.textPreview?.trim() ?? "";
  if (!isCsvTextPreview(preview)) return null;
  const csvRef = (output.fileRefs ?? []).find(
    (file) => file.mime === "text/csv" || file.name.toLowerCase().endsWith(".csv"),
  );
  const name = csvRef?.name?.trim() || output.label?.trim() || "page-audit.csv";
  const href =
    csvRef?.url && (csvRef.url.startsWith("http") || csvRef.url.startsWith("data:"))
      ? csvRef.url
      : csvTextToDataHref(preview);
  return {
    name,
    href,
    outputKey: output.variableKey,
    sizeBytes: new TextEncoder().encode(preview).length,
  };
}

/** Keep the last file per name so streaming audit CSV updates do not flood the run archive. */
export function dedupeWorkflowRagFilesByName(
  files: WorkflowRagDownloadableFile[],
): WorkflowRagDownloadableFile[] {
  const byName = new Map<string, WorkflowRagDownloadableFile>();
  for (const file of files) {
    const name = file.name.trim();
    if (!name) continue;
    byName.set(name, file);
  }
  return files.filter((file) => {
    const name = file.name.trim();
    return name && byName.get(name) === file;
  });
}
