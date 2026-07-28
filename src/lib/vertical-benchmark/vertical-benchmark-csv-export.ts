import Papa from "papaparse";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_NO_ROWS_TO_EXPORT_2 } from "@/lib/notify-messages";
import type { CsvDownloadArtifact } from "@/lib/backlink-research/backlink-bulk-csv-export";
import { triggerCsvDownloadArtifact } from "@/lib/backlink-research/backlink-bulk-csv-export";
import type { GscTop10CsvRow } from "@/lib/vertical-benchmark/vertical-benchmark-types";

const GSC_TOP10_COLUMNS = [
  "site_id",
  "site_name",
  "site_url",
  "client_tag",
  "content_kind",
  "rank",
  "url",
  "clicks",
  "impressions",
  "position",
  "gsc_start_date",
  "gsc_end_date",
] as const;

export function buildGscTop10CsvContent(rows: GscTop10CsvRow[]): string {
  const objects = rows.map((row) => {
    const o: Record<string, string | number> = {};
    for (const col of GSC_TOP10_COLUMNS) {
      const v = row[col];
      o[col] = v != null ? v : "";
    }
    return o;
  });
  return Papa.unparse(objects, { columns: [...GSC_TOP10_COLUMNS] });
}

export function createGscTop10DownloadArtifact(
  rows: GscTop10CsvRow[],
  filename?: string,
): CsvDownloadArtifact | null {
  if (!rows.length) return null;
  const csv = buildGscTop10CsvContent(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  return {
    url: URL.createObjectURL(blob),
    filename: filename ?? `gsc-top10-${stamp}.csv`,
    rowCount: rows.length,
  };
}

export function downloadGscTop10Csv(rows: GscTop10CsvRow[], filename?: string): CsvDownloadArtifact | null {
  const artifact = createGscTop10DownloadArtifact(rows, filename);
  if (!artifact) {
    notify.error(NOTIFY_NO_ROWS_TO_EXPORT_2);
    return null;
  }
  triggerCsvDownloadArtifact(artifact);
  return artifact;
}
