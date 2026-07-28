import { describe, expect, it } from "vitest";
import {
  extractAnchorDemandPhrasesFromContentOpportunityMatrixMarkdown,
  extractContentOpportunityMatrixRows,
  extractKeywordPhrasesFromCompetitorReportMarkdown,
} from "@/lib/competitor-research/competitor-report-keyword-extract";

const TABLE_BLOCK = `
| Keyword phrase | Volume | Traffic | Position |
| :--- | ---: | ---: | ---: |
| dental implants | 100 | 50 | 5 |
| teeth whitening | 200 | 10 | 12 |
`;

function reportWithH2(headingLine: string): string {
  return `${headingLine}

### **example.com**
${TABLE_BLOCK}
`;
}

describe("extractKeywordPhrasesFromCompetitorReportMarkdown", () => {
  it("extracts from legacy Target competitor keywords H2", () => {
    const md = reportWithH2("## Target competitor keywords that our competitors are ranking for");
    expect(extractKeywordPhrasesFromCompetitorReportMarkdown(md)).toEqual(["dental implants", "teeth whitening"]);
  });

  it("extracts from ## **Keywords They Own** H2", () => {
    const md = reportWithH2("## **Keywords They Own**");
    expect(extractKeywordPhrasesFromCompetitorReportMarkdown(md)).toEqual(["dental implants", "teeth whitening"]);
  });

  it("extracts from plain ## Keywords They Own H2", () => {
    const md = reportWithH2("## Keywords They Own");
    expect(extractKeywordPhrasesFromCompetitorReportMarkdown(md)).toEqual(["dental implants", "teeth whitening"]);
  });

  it("extracts from ## **Non-brand organic keywords (Semrush)** H2", () => {
    const md = reportWithH2("## **Non-brand organic keywords (Semrush)**");
    expect(extractKeywordPhrasesFromCompetitorReportMarkdown(md)).toEqual(["dental implants", "teeth whitening"]);
  });

  it("ignores Metric/Value tables; only collects Keyword phrase rows", () => {
    const md = `## **Keywords They Own**

### **rival.com**

| Metric | Value |
| --- | --- |
| Overlap keywords (vs seed) | 10 |

### **example.com**
${TABLE_BLOCK}
`;
    expect(extractKeywordPhrasesFromCompetitorReportMarkdown(md)).toEqual(["dental implants", "teeth whitening"]);
  });
});

const MATRIX_SAMPLE = `## **Traffic & Intent Gaps**

Some prose.

### **Content Opportunity Matrix**

| Month | What to Produce | Anchor Demand | Why This Wins |
| :--- | :--- | :--- | :--- |
| M1 | How-to blog on implant care | dental implants city, emergency dentist | Gap vs rival |
| M2 | Listicle on whitening options | teeth whitening | Demand |

## **Keywords They Own**
`;

describe("extractAnchorDemandPhrasesFromContentOpportunityMatrixMarkdown", () => {
  it("reads Anchor Demand column and splits comma-separated phrases", () => {
    expect(extractAnchorDemandPhrasesFromContentOpportunityMatrixMarkdown(MATRIX_SAMPLE)).toEqual([
      "dental implants city",
      "emergency dentist",
      "teeth whitening",
    ]);
  });

  it("matches plain ### Content Opportunity Matrix heading", () => {
    const md = MATRIX_SAMPLE.replace("### **Content Opportunity Matrix**", "### Content Opportunity Matrix");
    expect(extractAnchorDemandPhrasesFromContentOpportunityMatrixMarkdown(md)).toEqual([
      "dental implants city",
      "emergency dentist",
      "teeth whitening",
    ]);
  });

  it("returns [] when the matrix section is missing", () => {
    expect(extractAnchorDemandPhrasesFromContentOpportunityMatrixMarkdown("## **Keywords They Own**\n| a | b |\n|---|---|\n| x | 1 |")).toEqual(
      [],
    );
  });
});

describe("extractContentOpportunityMatrixRows", () => {
  it("returns full rows in table order (M1 then M2), no deduplication", () => {
    expect(extractContentOpportunityMatrixRows(MATRIX_SAMPLE)).toEqual([
      {
        month: "M1",
        whatToProduce: "How-to blog on implant care",
        anchorDemand: "dental implants city, emergency dentist",
        why: "Gap vs rival",
      },
      {
        month: "M2",
        whatToProduce: "Listicle on whitening options",
        anchorDemand: "teeth whitening",
        why: "Demand",
      },
    ]);
  });

  const BULK_MATRIX_SAMPLE = `## Traffic & Intent Gaps

### Content Opportunity Matrix

| keyword | entity | title | modifier | featuredImage |
| :--- | :--- | :--- | :--- | :--- |
| dental implants city, emergency dentist | Acme Dental | How-to blog on implant care | Emphasize local trust | y |
| teeth whitening | Acme Dental | Listicle on whitening options | Budget-friendly tips | google-maps |
`;

  it("parses bulk-template matrix columns and synthesizes M1/M2/M3 from row order (three rows per month)", () => {
    expect(extractContentOpportunityMatrixRows(BULK_MATRIX_SAMPLE)).toEqual([
      {
        month: "M1",
        whatToProduce: "How-to blog on implant care",
        anchorDemand: "dental implants city, emergency dentist",
        why: "",
        entity: "Acme Dental",
        modifier: "Emphasize local trust",
        featuredImage: "y",
      },
      {
        month: "M1",
        whatToProduce: "Listicle on whitening options",
        anchorDemand: "teeth whitening",
        why: "",
        entity: "Acme Dental",
        modifier: "Budget-friendly tips",
        featuredImage: "google-maps",
      },
    ]);
  });

  it("synthesizes M2 starting at row four in bulk layout (three posts per plan month)", () => {
    const md = `### Content Opportunity Matrix
| keyword | entity | title | modifier | featuredImage |
| --- | --- | --- | --- | --- |
| k1 | E | t1 | m | y |
| k2 | E | t2 | m | y |
| k3 | E | t3 | m | y |
| k4 | E | t4 | m | y |
`;
    const rows = extractContentOpportunityMatrixRows(md);
    expect(rows[2]?.month).toBe("M1");
    expect(rows[3]?.month).toBe("M2");
  });
});

describe("extractAnchorDemandPhrasesFromContentOpportunityMatrixMarkdown (bulk layout)", () => {
  it("reads keyword column when matrix uses bulk CSV headers", () => {
    const md = `## Traffic & Intent Gaps
### Content Opportunity Matrix
| keyword | entity | title | modifier | featuredImage |
| --- | --- | --- | --- | --- |
| alpha intent | E | T1 | m | y |
| beta, gamma | E | T2 | m | n |
`;
    expect(extractAnchorDemandPhrasesFromContentOpportunityMatrixMarkdown(md)).toEqual(["alpha intent", "beta", "gamma"]);
  });
});
