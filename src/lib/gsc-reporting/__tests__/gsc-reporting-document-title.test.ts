import { describe, expect, it } from "vitest";
import {
  buildGscReportDocumentHeading,
  formatGscReportTitleMonthYear,
  formatGscReportTitlePeriod,
  reportPeriodFromMarkdownHeading,
} from "@/lib/gsc-reporting/gsc-reporting-document-title";

describe("gsc-reporting-document-title", () => {
  it("extracts the current period range from the compare label", () => {
    expect(formatGscReportTitlePeriod("April 1, 2026 to April 30, 2026 vs March 1–31, 2026")).toBe(
      "April 1, 2026 to April 30, 2026",
    );
  });

  it("extracts month and year from compare label", () => {
    expect(formatGscReportTitleMonthYear("July 1–31, 2026 vs June 1–30, 2026")).toBe("July 2026");
    expect(formatGscReportTitleMonthYear("April 1, 2026 to April 30, 2026 vs March 1–31, 2026")).toBe(
      "April 2026",
    );
  });

  it("builds the report H1 with Neo Digital SEO Report and the full current range", () => {
    expect(buildGscReportDocumentHeading("August 1, 2026 to August 31, 2026 vs July 1–31, 2026")).toBe(
      "Neo Digital SEO Report - August 1, 2026 to August 31, 2026",
    );
  });

  it("reads period back from markdown heading", () => {
    expect(
      reportPeriodFromMarkdownHeading(
        "# Neo Digital SEO Report - August 1, 2026 to August 31, 2026\n\nNeo Digital Inc",
      ),
    ).toBe("August 1, 2026 to August 31, 2026");
  });
});
