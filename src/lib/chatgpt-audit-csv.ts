import type { ChatGptAuditQueryResponse } from "@/lib/chatgpt-audit-api";
import { chatgptAuditResponseMarkdown } from "@/lib/chatgpt-audit-response-markdown";
import type { TaskArchiveFileInput } from "@/lib/task-execution-archive";

export const CHATGPT_AUDIT_CSV_HEADERS = [
  "url",
  "clientName",
  "question",
  "response",
  "capturedAt",
] as const;

export type ChatGptAuditCsvRow = {
  url: string;
  clientName: string;
  question: string;
  response: string;
  capturedAt: string;
};

export function chatgptAuditCsvEscape(value: string): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function chatgptAuditCsvFileName(input: {
  runId: number;
  workflowRunId?: number;
}): string {
  if (input.workflowRunId && input.workflowRunId > 0) {
    return `chatgpt-audit-wf-${input.workflowRunId}.csv`;
  }
  return `chatgpt-audit-run-${input.runId}.csv`;
}

export function chatgptAuditRowsFromResponses(
  url: string,
  clientName: string,
  responses: ChatGptAuditQueryResponse[],
): ChatGptAuditCsvRow[] {
  return responses.map((item) => ({
    url,
    clientName,
    question: String(item.query ?? ""),
    response: chatgptAuditResponseMarkdown(String(item.response ?? "")),
    capturedAt: String(item.capturedAt ?? new Date().toISOString()),
  }));
}

export function buildChatGptAuditCsv(rows: ChatGptAuditCsvRow[]): string {
  const lines: string[] = [CHATGPT_AUDIT_CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        chatgptAuditCsvEscape(row.url),
        chatgptAuditCsvEscape(row.clientName),
        chatgptAuditCsvEscape(row.question),
        chatgptAuditCsvEscape(row.response),
        chatgptAuditCsvEscape(row.capturedAt),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export function parseChatGptAuditCsv(content: string): ChatGptAuditCsvRow[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const records = splitCsvRecords(trimmed);
  if (records.length <= 1) return [];

  const rows: ChatGptAuditCsvRow[] = [];
  for (let i = 1; i < records.length; i += 1) {
    const cells = splitCsvLine(records[i]!);
    if (cells.length < 5) continue;
    rows.push({
      url: cells[0] ?? "",
      clientName: cells[1] ?? "",
      question: cells[2] ?? "",
      response: cells[3] ?? "",
      capturedAt: cells[4] ?? "",
    });
  }
  return rows;
}

function splitCsvRecords(content: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i]!;
    if (inQuotes) {
      current += ch;
      if (ch === '"') {
        if (content[i + 1] === '"') {
          current += content[i + 1];
          i += 1;
        } else {
          inQuotes = false;
        }
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      current += ch;
      continue;
    }
    if (ch === "\n") {
      if (current.trim()) records.push(current);
      current = "";
      continue;
    }
    if (ch === "\r") continue;
    current += ch;
  }
  if (current.trim()) records.push(current);
  return records;
}

export function appendChatGptAuditCsvRows(
  existingContent: string | undefined,
  newRows: ChatGptAuditCsvRow[],
): string {
  const existing = existingContent?.trim() ? parseChatGptAuditCsv(existingContent) : [];
  return buildChatGptAuditCsv([...existing, ...newRows]);
}

export function chatgptAuditCumulativeCsvFile(input: {
  runId: number;
  workflowRunId?: number;
  clientUrl: string;
  clientName: string;
  responses: ChatGptAuditQueryResponse[];
  existingContent?: string;
}): TaskArchiveFileInput {
  const newRows = chatgptAuditRowsFromResponses(input.clientUrl, input.clientName, input.responses);
  const content = appendChatGptAuditCsvRows(input.existingContent, newRows);
  return {
    fileName: chatgptAuditCsvFileName({
      runId: input.runId,
      workflowRunId: input.workflowRunId,
    }),
    mime: "text/csv",
    content,
  };
}
