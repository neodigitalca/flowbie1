import { describe, expect, it } from "vitest";
import { autoCsvColumnMap, parseWorkflowCsvRows, pickCsvMappedCell } from "@/lib/workflow/parse-workflow-csv-rows";

const AUDIT_CSV = `url,clientName,question,response,capturedAt
https://example.com/blinds/,Blind Magic,"Grade this article",Neighborhood facts and FAQs.,2026-08-01
https://example.com/shades/,Blind Magic,"Grade this article","More SWOT",2026-08-02
`;

describe("parseWorkflowCsvRows", () => {
  it("parses ChatGPT audit CSV rows", () => {
    const parsed = parseWorkflowCsvRows(AUDIT_CSV);
    expect(parsed.headers).toEqual(["url", "clientName", "question", "response", "capturedAt"]);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]?.url).toBe("https://example.com/blinds/");
  });

  it("auto-maps audit headers without using the grade-prompt column as questions", () => {
    const parsed = parseWorkflowCsvRows(AUDIT_CSV);
    const map = autoCsvColumnMap(parsed.headers);
    expect(map.url).toBe("url");
    expect(map.research).toBe("response");
    expect(map.questions).toBeUndefined();
    expect(pickCsvMappedCell(parsed.records[0]!, map, "research")).toContain("Neighborhood facts");
    expect(pickCsvMappedCell(parsed.records[0]!, map, "questions")).toBe("");
  });

  it("fails fast on empty CSV", () => {
    expect(() => parseWorkflowCsvRows("   ")).toThrow("CSV is empty.");
  });
});
