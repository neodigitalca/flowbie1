import type { TaskExecutionKind, TaskExecutionPayload } from "@/lib/tasks-types";

export const CSV_ROWS_ACTION_KEYWORD = "csv-rows";

export type CsvRowsInputSource = "upload" | "workflow";

export type CsvRowsColumnField = "url" | "research" | "questions" | "keyword" | "title";

export type CsvRowsColumnMap = Partial<Record<CsvRowsColumnField, string>>;

export const CSV_ROWS_COLUMN_FIELDS: CsvRowsColumnField[] = [
  "url",
  "research",
  "questions",
  "keyword",
  "title",
];

export const CSV_ROWS_HEADER_ALIASES: Record<CsvRowsColumnField, string[]> = {
  url: ["url", "page", "link"],
  research: ["response", "research", "seo_research", "seoresearch"],
  questions: ["questions", "proposed_questions", "proposedquestions", "faqs", "faq"],
  keyword: ["keyword", "keyword_focus", "keywordfocus", "focus_keyword", "focuskeyword"],
  title: ["title"],
};

export type WorkflowCsvRowsConfig = {
  csvInputSource?: CsvRowsInputSource;
  csvBase64?: string;
  csvFileName?: string;
  csvHeaders?: string[];
  csvColumnMap?: CsvRowsColumnMap;
  ragVariableKey?: string;
};

export const CSV_ROWS_BULK_KINDS = new Set<TaskExecutionKind>([
  "content_optimizer",
  "content_optimizer_meta",
  "post_creator",
  "entity_page_creator",
  "entity_generator",
  "sap_generator",
]);

export const CSV_ROWS_SEQUENTIAL_KINDS = new Set<TaskExecutionKind>([
  "dfs_llm_article_audit",
  "browser_automation",
]);

export function isCsvRowsKind(kind: string): boolean {
  return kind === "csv_rows";
}

export function isCsvRowsActionKeyword(keyword: string | undefined): boolean {
  return (keyword ?? "").trim() === CSV_ROWS_ACTION_KEYWORD;
}

export function csvRowsKindConsumesRows(kind: TaskExecutionKind | string): boolean {
  const trimmed = String(kind ?? "").trim() as TaskExecutionKind;
  return CSV_ROWS_BULK_KINDS.has(trimmed) || CSV_ROWS_SEQUENTIAL_KINDS.has(trimmed);
}

export function csvRowsKindIsSequential(kind: TaskExecutionKind | string): boolean {
  return CSV_ROWS_SEQUENTIAL_KINDS.has(String(kind ?? "").trim() as TaskExecutionKind);
}

export function defaultCsvRowsConfig(): WorkflowCsvRowsConfig {
  return {
    csvInputSource: "upload",
    csvColumnMap: {},
  };
}

export function csvRowsConfigFromPayload(payload: TaskExecutionPayload | undefined): WorkflowCsvRowsConfig {
  return {
    csvInputSource: payload?.csvInputSource === "workflow" ? "workflow" : "upload",
    csvBase64: payload?.csvBase64,
    csvFileName: payload?.csvFileName,
    csvHeaders: payload?.csvHeaders,
    csvColumnMap: payload?.csvColumnMap ?? {},
  };
}

export function csvRowsPayloadFromConfig(config: WorkflowCsvRowsConfig): TaskExecutionPayload {
  return {
    csvInputSource: config.csvInputSource === "workflow" ? "workflow" : "upload",
    csvBase64: config.csvBase64,
    csvFileName: config.csvFileName,
    csvHeaders: config.csvHeaders,
    csvColumnMap: config.csvColumnMap ?? {},
  };
}

export function decodeCsvBase64(csvBase64: string): string {
  const trimmed = csvBase64.trim();
  if (!trimmed) return "";
  const binary = atob(trimmed);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

export function encodeCsvUtf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function normalizeCsvHeaderKey(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}
