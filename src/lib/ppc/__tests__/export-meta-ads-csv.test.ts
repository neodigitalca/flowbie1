import { describe, expect, it } from "vitest";
import {
  buildMetaAdsExportCsv,
  metaAdsExportFilename,
} from "@/lib/ppc/export-meta-ads-csv";
import type { MetaAdRow } from "@/lib/ppc/meta-ads-types";

function readyRow(overrides: Partial<MetaAdRow> = {}): MetaAdRow {
  return {
    id: "ppc-meta-ad-test",
    adName: "Test Ad",
    focusKeyword: "AI SEO Edmonton",
    landingPageUrl: "https://example.com/ai-seo",
    status: "ready",
    createdAt: "2026-08-11T00:00:00.000Z",
    copy: {
      primaryText: "Primary text for the ad.",
      headline: "AI SEO Edmonton",
      description: "Grow local search",
      cta: "Learn More",
      finalUrl: "https://example.com/ai-seo",
    },
    creative: {
      aspectRatio: "feed_1x1",
    },
    ...overrides,
  };
}

describe("buildMetaAdsExportCsv", () => {
  it("exports ready rows with copy fields", () => {
    const csv = buildMetaAdsExportCsv([readyRow()]);
    expect(csv).toContain("AI SEO Edmonton");
    expect(csv).toContain("Primary text for the ad.");
    expect(csv).toContain("Feed 1:1");
    expect(csv).toContain("Context source");
    expect(csv).toContain("Context URL");
  });

  it("throws when no generated ads are exportable", () => {
    expect(() =>
      buildMetaAdsExportCsv([
        {
          id: "idle",
          adName: "",
          focusKeyword: "",
          landingPageUrl: "",
          status: "idle",
          createdAt: "",
        },
      ]),
    ).toThrow("No generated ads to export.");
  });

  it("exports rows with copy even when still generating", () => {
    const csv = buildMetaAdsExportCsv([
      readyRow({ adName: "Generating Ad", status: "generating" }),
    ]);
    expect(csv).toContain("Generating Ad");
  });

  it("exports only rows with copy from a mixed list", () => {
    const csv = buildMetaAdsExportCsv([
      readyRow({ adName: "Ready Ad" }),
      {
        id: "idle",
        adName: "Idle Ad",
        focusKeyword: "skip me",
        landingPageUrl: "",
        status: "idle",
        createdAt: "",
      },
    ]);
    expect(csv).toContain("Ready Ad");
    expect(csv).not.toContain("skip me");
  });

  it("escapes commas and quotes in cell values", () => {
    const csv = buildMetaAdsExportCsv([
      readyRow({
        copy: {
          primaryText: 'Say "hello", world',
          headline: "Headline",
          description: "Desc",
          cta: "Learn More",
          finalUrl: "https://example.com",
        },
      }),
    ]);
    expect(csv).toContain('"Say ""hello"", world"');
  });
});

describe("metaAdsExportFilename", () => {
  it("builds a slugged filename with date stamp", () => {
    expect(metaAdsExportFilename("Neo Digital Inc.")).toMatch(/^meta-ads-neo-digital-inc-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
