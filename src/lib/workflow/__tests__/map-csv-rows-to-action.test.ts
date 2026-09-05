import { describe, expect, it } from "vitest";
import { autoCsvColumnMap, parseWorkflowCsvRows } from "@/lib/workflow/parse-workflow-csv-rows";
import { dfsRowNeedsQuestionExtract, mapCsvRecordsToAction } from "@/lib/workflow/map-csv-rows-to-action";

const AUDIT_CSV = `url,clientName,question,response,capturedAt
https://example.com/blinds/,Blind Magic,"Grade this article","SWOT one",2026-08-01
https://example.com/blinds/,Blind Magic,"Grade this article","SWOT two",2026-08-01
https://example.com/shades/,Blind Magic,"Grade this article","SWOT shades",2026-08-02
`;

const QUESTIONS_CSV = `url,questions,keyword
https://example.com/blinds/,"What are blinds?
How much do blinds cost?",window blinds
`;

describe("mapCsvRecordsToAction", () => {
  it("merges duplicate optimizer URLs into one research blob", () => {
    const parsed = parseWorkflowCsvRows(AUDIT_CSV);
    const mapping = mapCsvRecordsToAction({
      kind: "content_optimizer",
      records: parsed.records,
      columnMap: autoCsvColumnMap(parsed.headers),
    });
    expect(mapping.mode).toBe("bulk");
    expect(mapping.payload.targetUrls).toEqual([
      "https://example.com/blinds/",
      "https://example.com/shades/",
    ]);
    expect(mapping.payload.prefilledUrlResearch?.["https://example.com/blinds/"]).toContain("SWOT one");
    expect(mapping.payload.prefilledUrlResearch?.["https://example.com/blinds/"]).toContain("SWOT two");
  });

  it("maps post creator rows and keeps SWOT off unless useUpstreamContext is on", () => {
    const parsed = parseWorkflowCsvRows(AUDIT_CSV);
    const off = mapCsvRecordsToAction({
      kind: "post_creator",
      records: parsed.records,
      columnMap: autoCsvColumnMap(parsed.headers),
      useUpstreamContext: false,
    });
    expect(off.payload.postCount).toBe(3);
    expect(off.payload.useUpstreamContext).toBe(false);
    expect(off.payload.prefilledImportRows?.[0]?.prompt_modifier).toBeUndefined();

    const on = mapCsvRecordsToAction({
      kind: "post_creator",
      records: parsed.records,
      columnMap: autoCsvColumnMap(parsed.headers),
      useUpstreamContext: true,
    });
    expect(on.payload.useUpstreamContext).toBe(true);
    expect(on.payload.prefilledImportRows?.[0]?.prompt_modifier).toContain("MANDATORY SOURCE FACTS");
    expect(on.payload.prefilledImportRows?.[0]?.seo_research).toContain("SWOT one");
  });

  it("maps DFS questions from the questions column, not the grade-prompt question column", () => {
    const parsed = parseWorkflowCsvRows(QUESTIONS_CSV);
    const mapping = mapCsvRecordsToAction({
      kind: "dfs_llm_article_audit",
      records: parsed.records,
      columnMap: autoCsvColumnMap(parsed.headers),
    });
    expect(mapping.mode).toBe("sequential");
    expect(mapping.sequentialPayloads).toHaveLength(1);
    expect(mapping.payload.targetUrl).toBe("https://example.com/blinds/");
    expect(mapping.payload.auditQuestions).toEqual([
      "What are blinds?",
      "How much do blinds cost?",
    ]);
    expect(mapping.payload.auditQuestions?.join(" ")).not.toContain("Grade");
  });

  it("does not treat the audit question column as FAQs", () => {
    const parsed = parseWorkflowCsvRows(AUDIT_CSV);
    const map = autoCsvColumnMap(parsed.headers);
    expect(dfsRowNeedsQuestionExtract(parsed.records[0]!, map)).toBe(true);
    expect(() =>
      mapCsvRecordsToAction({
        kind: "dfs_llm_article_audit",
        records: parsed.records,
        columnMap: map,
      }),
    ).toThrow(/no proposed questions/i);
  });

  it("fails fast for unsupported next kinds", () => {
    const parsed = parseWorkflowCsvRows(AUDIT_CSV);
    expect(() =>
      mapCsvRecordsToAction({
        kind: "gsc_reporting",
        records: parsed.records,
        columnMap: autoCsvColumnMap(parsed.headers),
      }),
    ).toThrow(/cannot run gsc_reporting/i);
  });
});
