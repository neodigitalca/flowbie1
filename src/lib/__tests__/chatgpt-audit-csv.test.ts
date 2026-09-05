import { describe, expect, it } from "vitest";
import {
  appendChatGptAuditCsvRows,
  buildChatGptAuditCsv,
  chatgptAuditCsvFileName,
  chatgptAuditRowsFromResponses,
  parseChatGptAuditCsv,
} from "@/lib/chatgpt-audit-csv";

describe("chatgptAuditCsvFileName", () => {
  it("uses workflow run id when present", () => {
    expect(chatgptAuditCsvFileName({ runId: 9, workflowRunId: 42 })).toBe(
      "chatgpt-audit-wf-42.csv",
    );
  });

  it("falls back to agent run id", () => {
    expect(chatgptAuditCsvFileName({ runId: 9 })).toBe("chatgpt-audit-run-9.csv");
  });
});

describe("buildChatGptAuditCsv", () => {
  it("quotes cells with commas and newlines", () => {
    const csv = buildChatGptAuditCsv([
      {
        url: "https://example.com/page",
        clientName: "Blind Magic",
        question: "What is wrong?",
        response: 'Line one\nLine two, with comma',
        capturedAt: "2026-08-26T12:00:00.000Z",
      },
    ]);

    expect(csv).toContain('"Line one\nLine two, with comma"');
    expect(parseChatGptAuditCsv(csv)).toEqual([
      {
        url: "https://example.com/page",
        clientName: "Blind Magic",
        question: "What is wrong?",
        response: "Line one\nLine two, with comma",
        capturedAt: "2026-08-26T12:00:00.000Z",
      },
    ]);
  });
});

describe("appendChatGptAuditCsvRows", () => {
  it("appends rows for the next completed URL into the same CSV", () => {
    const first = buildChatGptAuditCsv(
      chatgptAuditRowsFromResponses("https://example.com/a", "Client A", [
        { query: "Q1", response: "R1", capturedAt: "2026-08-26T12:00:00.000Z" },
      ]),
    );
    const combined = appendChatGptAuditCsvRows(
      first,
      chatgptAuditRowsFromResponses("https://example.com/b", "Client B", [
        { query: "Q2", response: "R2", capturedAt: "2026-08-26T12:05:00.000Z" },
      ]),
    );

    const rows = parseChatGptAuditCsv(combined);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.url).toBe("https://example.com/a");
    expect(rows[1]?.url).toBe("https://example.com/b");
    expect(combined.match(/^url,/m)).not.toBeNull();
    expect(combined.split("\n").filter(Boolean)).toHaveLength(3);
  });
});
