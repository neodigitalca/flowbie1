import Papa from "papaparse";
import {
  CSV_ROWS_COLUMN_FIELDS,
  CSV_ROWS_HEADER_ALIASES,
  normalizeCsvHeaderKey,
  type CsvRowsColumnField,
  type CsvRowsColumnMap,
} from "@/lib/workflow/csv-rows-types";

export type WorkflowCsvRecord = Record<string, string>;

export type ParseWorkflowCsvRowsResult = {
  headers: string[];
  records: WorkflowCsvRecord[];
};

export function parseWorkflowCsvRows(csvText: string): ParseWorkflowCsvRowsResult {
  const trimmed = csvText.trim();
  if (!trimmed) {
    throw new Error("CSV is empty.");
  }

  const parsed = Papa.parse<Record<string, unknown>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const msg = parsed.errors.map((e) => e.message).join("; ");
    throw new Error(msg || "Failed to parse CSV.");
  }

  const headers = (parsed.meta.fields ?? []).map((h) => String(h ?? "").trim()).filter(Boolean);
  if (headers.length === 0) {
    throw new Error("CSV has no header row.");
  }

  const records: WorkflowCsvRecord[] = [];
  for (const raw of parsed.data) {
    if (!raw || typeof raw !== "object") continue;
    const record: WorkflowCsvRecord = {};
    let hasValue = false;
    for (const header of headers) {
      const value = String(raw[header] ?? "").trim();
      record[header] = value;
      if (value) hasValue = true;
    }
    if (hasValue) records.push(record);
  }

  if (records.length === 0) {
    throw new Error("CSV has no data rows.");
  }

  return { headers, records };
}

export function autoCsvColumnMap(headers: string[]): CsvRowsColumnMap {
  const map: CsvRowsColumnMap = {};
  const normalized = headers.map((header) => ({
    header,
    key: normalizeCsvHeaderKey(header),
  }));

  for (const field of CSV_ROWS_COLUMN_FIELDS) {
    const aliases = CSV_ROWS_HEADER_ALIASES[field];
    const hit = normalized.find((item) => aliases.includes(item.key));
    if (hit) map[field] = hit.header;
  }

  return map;
}

export function pickCsvMappedCell(
  record: WorkflowCsvRecord,
  columnMap: CsvRowsColumnMap,
  field: CsvRowsColumnField,
): string {
  const header = columnMap[field]?.trim();
  if (!header) return "";
  return String(record[header] ?? "").trim();
}

export function splitCsvQuestionsCell(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
