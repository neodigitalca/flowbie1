import { describe, expect, it } from "vitest";
import {
  adsReportingDriveDocumentTitle,
  buildAdsReportDocumentHeading,
  generateAdsReportingDriveDocumentTitle,
} from "@/lib/ads-reporting/ads-reporting-document-title";

describe("ads-reporting-document-title", () => {
  it("builds the PPC heading from the compare period", () => {
    expect(buildAdsReportDocumentHeading("August 1, 2026 to August 31, 2026 vs July 1–31, 2026")).toBe(
      "Neo Digital PPC Report - August 1, 2026 to August 31, 2026",
    );
  });

  it("builds the Drive file name from client and PPC heading", () => {
    expect(
      adsReportingDriveDocumentTitle(
        "Blinds West: Window Coverings",
        [
          "# Neo Digital PPC Report - August 1, 2026 to August 31, 2026",
          "",
          "## Executive Summary",
        ].join("\n"),
      ),
    ).toBe("Blinds West - Neo Digital PPC Report - August 1, 2026 to August 31, 2026");
  });

  it("uses the same name from the async helper", async () => {
    await expect(
      generateAdsReportingDriveDocumentTitle({
        siteName: "Blinds West",
        markdown: "# Neo Digital PPC Report - August 1, 2026 to August 31, 2026\n\nBody",
      }),
    ).resolves.toBe("Blinds West - Neo Digital PPC Report - August 1, 2026 to August 31, 2026");
  });

  it("rejects a GSC heading", () => {
    expect(() =>
      adsReportingDriveDocumentTitle(
        "Blinds West",
        "# Neo Digital SEO Report - August 1, 2026 to August 31, 2026\n\nBody",
      ),
    ).toThrow("PPC Drive title requires a Neo Digital PPC Report heading with the current period date range.");
  });
});
