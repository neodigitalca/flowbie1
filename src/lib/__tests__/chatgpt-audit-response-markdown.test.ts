import { describe, expect, it } from "vitest";
import {
  chatgptAuditPromptQuestion,
  chatgptAuditResponseMarkdown,
} from "@/lib/chatgpt-audit-response-markdown";
import { chatgptAuditRowsFromResponses } from "@/lib/chatgpt-audit-csv";

describe("chatgptAuditPromptQuestion", () => {
  it("returns trimmed setup question text unchanged", () => {
    expect(chatgptAuditPromptQuestion("  Grade this page  ")).toBe("Grade this page");
  });
});

describe("chatgptAuditResponseMarkdown", () => {
  it("extracts markdown from a fenced block", () => {
    const raw = "Here you go:\n```markdown\n# Title\n\nBody copy\n```";
    expect(chatgptAuditResponseMarkdown(raw)).toBe("# Title\n\nBody copy");
  });

  it("extracts from a generic fenced block", () => {
    expect(chatgptAuditResponseMarkdown("```\nHello\n```")).toBe("Hello");
  });
});

describe("chatgptAuditRowsFromResponses", () => {
  it("stores extracted markdown in the response column", () => {
    const rows = chatgptAuditRowsFromResponses("https://example.com", "Client", [
      {
        query: "Q1",
        response: "```markdown\n## Audit\n- item\n```",
        capturedAt: "2026-08-26T12:00:00.000Z",
      },
    ]);
    expect(rows[0]?.response).toBe("## Audit\n- item");
  });
});
