import { describe, expect, it } from "vitest";
import { missingTemplateAuditToCsv } from "@/lib/content-optimization/missing-new-template";
import { mapCsvRecordsToAction, recordsForOptimizerMapping } from "@/lib/workflow/map-csv-rows-to-action";
import { autoCsvColumnMap, parseWorkflowCsvRows } from "@/lib/workflow/parse-workflow-csv-rows";
import { isCsvTextPreview, pageAuditCsvFromOutputs } from "@/lib/workflow/workflow-csv-rows-runner";

describe("workflow csv rows site audit", () => {
  it("sends the full H2 scrape and only works old-template URLs", () => {
    const csv = missingTemplateAuditToCsv({
      scanned: 2,
      missing: ["https://a.test/old/"],
      alreadyNew: ["https://a.test/new/"],
      h2sByUrl: {
        "https://a.test/old/": ["Overview", "We Care About Town"],
        "https://a.test/new/": ["Answer", "Overview"],
      },
    });
    const parsed = parseWorkflowCsvRows(csv);
    expect(recordsForOptimizerMapping(parsed.records)).toHaveLength(1);
    const mapping = mapCsvRecordsToAction({
      kind: "content_optimizer",
      records: parsed.records,
      columnMap: autoCsvColumnMap(parsed.headers),
      csvText: csv,
      csvFileName: "missing-template-posts.csv",
    });
    expect(mapping.payload.targetUrls).toEqual(["https://a.test/old/"]);
    expect(mapping.payload.prefilledUrlResearch?.["https://a.test/old/"]).toBe(
      "Overview | We Care About Town",
    );
    expect(mapping.payload.prefilledUrlResearch?.["https://a.test/new/"]).toBe("Answer | Overview");
    expect(mapping.payload.csvFileName).toBe("missing-template-posts.csv");
    expect(mapping.payload.csvBase64).toBeTruthy();
  });

  it("returns an empty target list when every URL already has the template", () => {
    const csv = missingTemplateAuditToCsv({
      scanned: 1,
      missing: [],
      alreadyNew: ["https://a.test/new/"],
      h2sByUrl: { "https://a.test/new/": ["Answer"] },
    });
    const parsed = parseWorkflowCsvRows(csv);
    const mapping = mapCsvRecordsToAction({
      kind: "content_optimizer",
      records: parsed.records,
      columnMap: autoCsvColumnMap(parsed.headers),
    });
    expect(mapping.payload.targetUrls).toEqual([]);
  });

  it("maps ChatGPT website audit CSV url and response columns", () => {
    const csv = [
      "url,clientName,question,response,capturedAt",
      "https://a.test/old/,Acme,Does this page include an H2 titled Answer?,no missing the new template,2026-09-11T00:00:00.000Z",
      "https://a.test/new/,Acme,Does this page include an H2 titled Answer?,yes <h2>Answer</h2>,2026-09-11T00:00:00.000Z",
    ].join("\n");
    const parsed = parseWorkflowCsvRows(csv);
    const mapping = mapCsvRecordsToAction({
      kind: "content_optimizer",
      records: parsed.records,
      columnMap: { ...autoCsvColumnMap(parsed.headers), research: "response" },
    });
    expect(mapping.payload.targetUrls).toEqual(["https://a.test/old/", "https://a.test/new/"]);
    expect(mapping.payload.prefilledUrlResearch?.["https://a.test/old/"]).toContain("missing the new template");
  });

  it("treats a run RAG preview that starts with url as CSV text", () => {
    expect(isCsvTextPreview("url,status,research\nhttps://a.test/,missing,note")).toBe(true);
    expect(isCsvTextPreview("3 rows. First URL: https://a.test/")).toBe(false);
  });

  it("reads the page audit CSV from the run output", () => {
    const csv = pageAuditCsvFromOutputs(
      [
        {
          id: 1,
          runId: 8,
          nodeId: "csv_audit",
          variableKey: "csv_rows_1",
          scope: "run",
          label: "Page audit",
          textPreview: "url,H2\nhttps://a.test/old/,\n",
          fileRefs: [{ name: "missing-template-posts.csv", mime: "text/csv" }],
          createdAt: "",
        },
      ],
      "csv_audit",
    );
    expect(csv?.fileName).toBe("missing-template-posts.csv");
    expect(csv?.content).toContain("https://a.test/old/");
  });
});
