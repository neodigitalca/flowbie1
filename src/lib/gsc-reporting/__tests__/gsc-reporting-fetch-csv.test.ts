import { describe, expect, it } from "vitest";
import {
  gscCompactPeriodLabelFromIsoRange,
  gscIndexedUrlsCsvFromPages,
  gscPagesToCsv,
  gscQueriesMomComparisonCsv,
  gscQueriesToCsv,
  gscSitemapsToCsv,
} from "@/lib/gsc-reporting/gsc-reporting-fetch";

describe("gscCompactPeriodLabelFromIsoRange", () => {
  it("uses Mon YYYY for a full calendar month", () => {
    expect(gscCompactPeriodLabelFromIsoRange("2026-03-01", "2026-03-31")).toBe("Mar 2026");
  });
  it("uses ISO span for partial ranges", () => {
    expect(gscCompactPeriodLabelFromIsoRange("2026-03-05", "2026-03-20")).toBe("2026-03-05–2026-03-20");
  });
});

describe("gsc-reporting CSV builders", () => {
  it("gscPagesToCsv includes Page header and rows", () => {
    const csv = gscPagesToCsv([
      {
        page: "https://example.com/a",
        clicks: 1,
        impressions: 10,
        ctr: 0.1,
        position: 5.5,
        date: "2026-01-01 to 2026-04-01",
      },
    ]);
    expect(csv).toContain("Page,Clicks,Impressions,CTR,Position");
    expect(csv).toContain("https://example.com/a");
    expect(csv).toContain("10.00%");
  });

  it("gscIndexedUrlsCsvFromPages dedupes and sorts URLs", () => {
    const csv = gscIndexedUrlsCsvFromPages(
      [
        { page: "https://example.com/b", clicks: 0, impressions: 1, ctr: 0, position: 1, date: "" },
        { page: "https://example.com/a", clicks: 0, impressions: 1, ctr: 0, position: 1, date: "" },
        { page: "https://example.com/b", clicks: 0, impressions: 1, ctr: 0, position: 1, date: "" },
      ],
      "2026-01-01",
      "2026-04-01",
    );
    expect(csv).toContain("# Indexed pages proxy");
    expect(csv).toContain("URL");
    const lines = csv.split("\n").filter((l) => l.startsWith("http"));
    expect(lines).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("gscSitemapsToCsv flattens web contents", () => {
    const csv = gscSitemapsToCsv([
      {
        path: "https://example.com/sitemap.xml",
        lastSubmitted: "2026-01-01",
        errors: 0,
        warnings: 1,
        contents: [{ type: "web", submitted: "100", indexed: "95" }],
      },
    ]);
    expect(csv).toContain("Path,LastSubmitted");
    expect(csv).toContain("https://example.com/sitemap.xml");
    expect(csv).toContain("100");
  });

  it("gscQueriesToCsv matches existing query export shape", () => {
    const csv = gscQueriesToCsv([
      {
        query: "test",
        clicks: 2,
        impressions: 20,
        ctr: 0.1,
        position: 4,
        date: "a to b",
      },
    ]);
    expect(csv.split("\n")[0]).toBe("Query,Clicks,Impressions,CTR,Position");
    expect(csv).toContain("test");
  });

  it("gscQueriesMomComparisonCsv merges periods and includes change columns", () => {
    const csv = gscQueriesMomComparisonCsv(
      [{ query: "a", clicks: 100, impressions: 1000, ctr: 0.1, position: 5 }],
      [{ query: "a", clicks: 80, impressions: 800, ctr: 0.1, position: 6 }],
      { start: "2026-03-01", end: "2026-03-31" },
      { start: "2026-02-01", end: "2026-02-28" },
    );
       const headerLine = csv.split("\n").find((l) => l.startsWith("Query,")) ?? "";
    expect(headerLine).toMatch(
      /Clicks \(Mar 2026\),Clicks \(Feb 2026\),Clicks Δ%,Impressions \(Mar 2026\),Impressions \(Feb 2026\),Impr Δ%,CTR \(Mar 2026\),CTR \(Feb 2026\),CTR Δ%,Position \(Mar 2026\),Position \(Feb 2026\),Pos Δ%$/,
    );
    expect(csv).toContain(
      "a,100,80,+25.0%,1000,800,+25.0%,10.00%,10.00%,+0.0%,5.00,6.00,-16.7%",
    );
  });
});
