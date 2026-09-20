import { describe, expect, it } from "vitest";
import { sanitizeHarnessArticleTitle } from "@/lib/overview/overview-content-optimize-pipeline";

describe("sanitizeHarnessArticleTitle", () => {
  it("derives title from slug when article title is a URL", () => {
    expect(
      sanitizeHarnessArticleTitle("https://blindmagic.com/blog/smart-blinds-automation/", {
        pageUrl: "https://blindmagic.com/blog/smart-blinds-automation/",
      }),
    ).toBe("Smart Blinds Automation");
  });

  it("uses keyword when title is URL-like", () => {
    expect(
      sanitizeHarnessArticleTitle("https://example.com/foo/", {
        keyword: "Smart Blinds Automation Vs Traditional Blinds",
      }),
    ).toBe("Smart Blinds Automation Vs Traditional Blinds");
  });
});
