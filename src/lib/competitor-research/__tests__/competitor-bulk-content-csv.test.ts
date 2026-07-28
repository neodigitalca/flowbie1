import { describe, expect, it } from "vitest";
import {
  buildCompetitorBulkContentCsvRows,
  buildProposalMatrixContentCsvRows,
} from "@/lib/competitor-research/competitor-bulk-content-csv";
import type { CompetitorResearchSemrushResponse } from "@/lib/competitor-research/types";

describe("buildCompetitorBulkContentCsvRows", () => {
  it("uses What to Produce as title and Anchor Demand (first segment) as keyword", () => {
    const semrush = {
      seedDomain: "dentist.example.com",
      database: "us",
      rows: [],
    } as CompetitorResearchSemrushResponse;

    const reportMd = `
## Traffic & Intent Gaps
### Content Opportunity Matrix
| Month | What to Produce | Anchor Demand | Why This Wins |
| --- | --- | --- | --- |
| M1 | What is dentin exposure? | dentin exposure queries | a |
| M1 | How to manage exposed dentin | exposed dentin care | b |
| M1 | Exposed dentin at gum line FAQs | gum line dentin | c |
`;

    const rows = buildCompetitorBulkContentCsvRows({
      siteName: "Smile Clinic",
      semrush,
      reportMd,
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.title).toBe("What is dentin exposure?");
    expect(rows[0]?.keyword).toBe("dentin exposure queries");
    expect(rows[1]?.title).toBe("How to manage exposed dentin");
    expect(rows[1]?.keyword).toBe("exposed dentin care");
    expect(rows[2]?.title).toBe("Exposed dentin at gum line FAQs");
    expect(rows[2]?.keyword).toBe("gum line dentin");
  });

  it("uses entity, modifier, and featuredImage from bulk-layout matrix when present", () => {
    const semrush = {
      seedDomain: "dentist.example.com",
      database: "us",
      rows: [],
    } as CompetitorResearchSemrushResponse;

    const reportMd = `
## Traffic & Intent Gaps
### Content Opportunity Matrix
| keyword | entity | title | modifier | featuredImage |
| --- | --- | --- | --- | --- |
| dentin exposure queries | Custom Entity Inc | What is dentin exposure? | Focus on reviews and trust | google-maps |
`;

    const rows = buildCompetitorBulkContentCsvRows({
      siteName: "Smile Clinic",
      semrush,
      reportMd,
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.title).toBe("What is dentin exposure?");
    expect(rows[0]?.keyword).toBe("dentin exposure queries");
    expect(rows[0]?.entity).toBe("Custom Entity Inc");
    expect(rows[0]?.modifier).toBe("Focus on reviews and trust");
    expect(rows[0]?.featuredImage).toBe("google-maps");
  });

  it("uses first Anchor Demand segment when the cell lists multiple phrases", () => {
    const semrush = {
      seedDomain: "dentist.example.com",
      database: "us",
      rows: [],
    } as CompetitorResearchSemrushResponse;

    const reportMd = `
## Traffic & Intent Gaps
### Content Opportunity Matrix
| Month | What to Produce | Anchor Demand | Why This Wins |
| --- | --- | --- | --- |
| M1 | Full headline for post one | first query, second query | why |
`;

    const rows = buildCompetitorBulkContentCsvRows({
      siteName: "Smile Clinic",
      semrush,
      reportMd,
    });

    expect(rows[0]?.title).toBe("Full headline for post one");
    expect(rows[0]?.keyword).toBe("first query");
  });

  it("falls back keyword to title when Anchor Demand is empty", () => {
    const semrush = {
      seedDomain: "dentist.example.com",
      database: "us",
      rows: [],
    } as CompetitorResearchSemrushResponse;

    const reportMd = `
## Traffic & Intent Gaps
### Content Opportunity Matrix
| Month | What to Produce | Anchor Demand | Why This Wins |
| --- | --- | --- | --- |
| M1 | Only title no anchor | | why |
`;

    const rows = buildCompetitorBulkContentCsvRows({
      siteName: "Smile Clinic",
      semrush,
      reportMd,
    });

    expect(rows[0]?.title).toBe("Only title no anchor");
    expect(rows[0]?.keyword).toBe("only title no anchor");
  });

  it("falls back to Keywords They Own from keywordsMd when matrix is empty", () => {
    const semrush = {
      seedDomain: "dentist.example.com",
      database: "us",
      rows: [{ domain: "rival.example.com" } as { domain: string }],
    } as CompetitorResearchSemrushResponse;

    const reportMd = `
## Traffic & Intent Gaps
### Content Opportunity Matrix
| Month | What to Produce | Anchor Demand | Why This Wins |
| --- | --- | --- | --- |
`;

    const keywordsMd = `## **Keywords They Own**

### **rival.example.com**

| Keyword phrase | Volume | Traffic | Position |
| --- | ---: | ---: | ---: |
| emergency tooth pain relief | 100 | 10 | 5 |
`;

    const rows = buildCompetitorBulkContentCsvRows({
      siteName: "Smile Clinic",
      semrush,
      reportMd,
      keywordsMd,
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.keyword).toBe("emergency tooth pain relief");
  });

  it("respects maxRows when the matrix has more rows", () => {
    const semrush = {
      seedDomain: "dentist.example.com",
      database: "us",
      rows: [],
    } as CompetitorResearchSemrushResponse;

    const reportMd = `
## Traffic & Intent Gaps
### Content Opportunity Matrix
| Month | What to Produce | Anchor Demand | Why This Wins |
| --- | --- | --- | --- |
| M1 | Post one | one | a |
| M1 | Post two | two | b |
| M1 | Post three | three | c |
| M1 | Post four | four | d |
`;

    const rows = buildCompetitorBulkContentCsvRows({
      siteName: "Smile Clinic",
      semrush,
      reportMd,
      maxRows: 2,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.title).toBe("Post one");
    expect(rows[1]?.title).toBe("Post two");
  });
});

describe("buildProposalMatrixContentCsvRows", () => {
  const MATRIX = `
### Content Opportunity Matrix
| Month | What to Produce | Anchor Demand | Why This Wins |
| --- | --- | --- | --- |
| M1 | First post | alpha | a |
| M2 | Second post | beta | b |
`;

  it("cycles matrix rows when maxRows exceeds usable matrix rows", () => {
    const semrush = {
      seedDomain: "dentist.example.com",
      database: "us",
      rows: [],
    } as CompetitorResearchSemrushResponse;

    const rows = buildProposalMatrixContentCsvRows({
      siteName: "Smile Clinic",
      semrush,
      reportMd: MATRIX,
      maxRows: 5,
    });

    expect(rows).toHaveLength(5);
    expect(rows[0]?.title).toBe("First post");
    expect(rows[1]?.title).toBe("Second post");
    expect(rows[2]?.title).toBe("First post");
    expect(rows[3]?.title).toBe("Second post");
    expect(rows[4]?.title).toBe("First post");
  });

  it("throws when matrix section is missing", () => {
    const semrush = {
      seedDomain: "x.com",
      database: "us",
      rows: [],
    } as CompetitorResearchSemrushResponse;

    expect(() =>
      buildProposalMatrixContentCsvRows({
        siteName: "X",
        semrush,
        reportMd: "## No matrix",
        maxRows: 3,
      }),
    ).toThrow(/Content Opportunity Matrix/);
  });
});
