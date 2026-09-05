import { describe, expect, it } from "vitest";
import {
  formatLlmAuditSummaryForPrompt,
  injectLlmAuditIntoChecklist,
} from "@/lib/llm-audit/summarize-llm-audit-for-content";

describe("injectLlmAuditIntoChecklist", () => {
  it("does not add checklist lines (audit facts are prompt-only)", () => {
    const checklist = ["Intro section", "Body section", "Conclusion section"];
    const next = injectLlmAuditIntoChecklist(checklist, [
      "Prairie frost at entry doors",
      "[LLM AUDIT]: Main Street rhythm",
    ]);
    expect(next).toEqual(checklist);
  });
});

describe("formatLlmAuditSummaryForPrompt", () => {
  it("includes summary and checklist angles", () => {
    const text = formatLlmAuditSummaryForPrompt({
      summary: "Locals mention frost on porch steps in winter.",
      checklistItems: ["[LLM AUDIT]: Mention frost on entry steps"],
      blueprintNotes: "Spread local seasonal detail across intro and one body H2.",
    });
    expect(text).toContain("frost on porch steps");
    expect(text).toContain("Mandatory checklist angles");
    expect(text).toContain("Blueprint distribution");
  });
});
