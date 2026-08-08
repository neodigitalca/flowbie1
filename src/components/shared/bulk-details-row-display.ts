import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { BulkDetailsDownloadable } from "@/components/shared/bulk-details-tile-sections";
import type { BulkGeneratedFile } from "@/lib/bulk-file-manager";
import type { CSVRow } from "@/lib/bulk-auto-generate";

export function rowFilesToDownloadables(files: BulkGeneratedFile[]): BulkDetailsDownloadable[] {
  return files
    .filter(
      (f) =>
        f.status === "completed" ||
        (f.status === "error" && Boolean(f.content?.trim())),
    )
    .map((f) => ({
      name: f.fileName,
      content: f.content,
      mimeType: f.mimeType,
    }));
}

export function csvRowToOverviewRowDisplay(
  row: CSVRow,
  index: number,
  previewUrl?: string,
  rowKeyPrefix = "csv-row",
): OverviewRow {
  const liveUrl = previewUrl?.trim() || row.destination_url?.trim();
  return {
    url: liveUrl || `#${rowKeyPrefix}-${index}`,
    title: row.title?.trim() || `Row ${index + 1}`,
    metaDescription: row.meta_description ?? "",
    aiTitle: "",
    aiMeta: "",
    status: "idle",
    focusKeyword: row.keyword?.trim(),
    dateModifier: row.publish_date_gmt?.trim() || undefined,
  };
}

export function publishDateLabelForRow(
  index: number,
  publishDateLabelByIndex: Record<number, string> | undefined,
  draftOnly: boolean | undefined,
): string | undefined {
  if (draftOnly) return "Draft";
  return publishDateLabelByIndex?.[index]?.trim() || undefined;
}
