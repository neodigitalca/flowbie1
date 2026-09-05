import { describe, expect, it } from "vitest";
import {
  blogIntroHarnessTitle,
  sanitizeHarnessArticleTitle,
} from "@/lib/overview/overview-content-optimize-pipeline";

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

  it("builds intro harness title without raw URL", () => {
    expect(
      blogIntroHarnessTitle(
        "https://blindmagic.com/blog/smart-blinds-automation/",
        "https://blindmagic.com/blog/smart-blinds-automation/",
      ),
    ).toBe("How Smart Blinds Automation works");
  });

  it("shortens comparison titles for intro harness", () => {
    expect(
      blogIntroHarnessTitle("Smart Blinds Automation Vs Traditional Blinds", undefined, "Smart Blinds Automation Vs Traditional Blinds"),
    ).toBe("How Smart Blinds Automation works");
  });
});
