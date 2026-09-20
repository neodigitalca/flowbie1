import { describe, expect, it } from "vitest";
import { shouldUseElementorPageHarness } from "@/lib/elementor-page-content/run-elementor-harness-row";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";

describe("shouldUseElementorPageHarness", () => {
  it("treats every Pages row with a URL as Elementor", () => {
    const row = { url: "https://example.com/about/" } as OverviewRow;
    expect(shouldUseElementorPageHarness("pages", row)).toBe(true);
  });

  it("does not require elementorDataJson on the Pages tab", () => {
    const row = { url: "https://example.com/about/", contentFormat: "html" } as OverviewRow;
    expect(shouldUseElementorPageHarness("pages", row)).toBe(true);
  });

  it("still requires elementor markers on non-pages sources", () => {
    const row = { url: "https://example.com/blog/post/" } as OverviewRow;
    expect(shouldUseElementorPageHarness("posts", row)).toBe(false);
    expect(
      shouldUseElementorPageHarness("posts", {
        ...row,
        contentFormat: "elementor",
      } as OverviewRow),
    ).toBe(true);
  });
});
