import { describe, expect, it } from "vitest";
import {
  generateGscReportingDriveDocumentTitle,
  gscReportingDriveDocumentTitle,
  sanitizeGoogleDriveDocumentTitle,
} from "@/lib/gsc-reporting/gsc-reporting-drive-document-title";

describe("gsc-reporting-drive-document-title", () => {
  it("sanitizes illegal Drive characters", () => {
    expect(sanitizeGoogleDriveDocumentTitle("Advance Blinds | GSC Report: Q3")).toBe(
      "Advance Blinds - GSC Report- Q3",
    );
  });

  it("builds the Drive file name from client and report heading", () => {
    expect(
      gscReportingDriveDocumentTitle(
        "Advance Blinds: Blinds, Shades & Drapery In Manitoba",
        [
          "# Neo Digital SEO Report - August 1, 2026 to August 31, 2026",
          "",
          "Neo Digital Inc",
          "Prepared for: Advance Blinds: Blinds, Shades & Drapery In Manitoba",
        ].join("\n"),
      ),
    ).toBe("Advance Blinds - Neo Digital SEO Report - August 1, 2026 to August 31, 2026");
  });

  it("uses the same name from the async helper", async () => {
    await expect(
      generateGscReportingDriveDocumentTitle({
        siteName: "Ridgeline Solar",
        markdown: "# Neo Digital SEO Report - August 1, 2026 to August 31, 2026\n\nBody",
      }),
    ).resolves.toBe("Ridgeline Solar - Neo Digital SEO Report - August 1, 2026 to August 31, 2026");
  });

  it("throws when markdown is missing", async () => {
    await expect(
      generateGscReportingDriveDocumentTitle({
        siteName: "Advance Blinds",
        markdown: "",
      }),
    ).rejects.toThrow("GSC Drive title requires report markdown.");
  });

  it("throws when the heading has no period range", () => {
    expect(() =>
      gscReportingDriveDocumentTitle("Ridgeline Solar", "# Something else\n\nBody"),
    ).toThrow("GSC Drive title requires a Neo Digital SEO Report heading with the current period date range.");
  });
});
