import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { WordPressPostDestination } from "@/lib/bulk-auto-generate";

/** Normalize legacy stored bulk destinations to supported values. */
export function normalizeBulkPostDestination(value: unknown): WordPressPostDestination {
  if (value === "local") return "local";
  if (value === "direct") return "direct";
  if (value === "bank" || value === "hybrid") return "wordpress";
  return "wordpress";
}

export function resolveRowPostDestination(
  row: Pick<CSVRow, "post_destination">,
  header: WordPressPostDestination,
): WordPressPostDestination {
  return normalizeBulkPostDestination(row.post_destination ?? header);
}

export function rowNeedsWordPressUpload(
  row: Pick<CSVRow, "post_destination">,
  header: WordPressPostDestination,
): boolean {
  return resolveRowPostDestination(row, header) !== "local";
}

export function batchNeedsWordPressUpload(
  rows: ReadonlyArray<Pick<CSVRow, "post_destination">>,
  header: WordPressPostDestination,
): boolean {
  return rows.some((row) => rowNeedsWordPressUpload(row, header));
}

export function batchIsDirectOnly(
  rows: ReadonlyArray<Pick<CSVRow, "post_destination">>,
  header: WordPressPostDestination,
): boolean {
  return rows.length > 0 && rows.every((row) => resolveRowPostDestination(row, header) === "direct");
}
