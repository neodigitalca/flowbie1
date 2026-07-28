import { describe, expect, it } from "vitest";
import { overviewRowUrlPathLabel } from "@/lib/overview/overview-tab-display";

describe("overviewRowUrlPathLabel", () => {
  it("keeps full pathname for pages", () => {
    expect(
      overviewRowUrlPathLabel("https://example.com/service-area/camrose/", { source: "pages" }),
    ).toBe("/service-area/camrose/");
  });

  it("strips entity collection prefix for sap", () => {
    expect(
      overviewRowUrlPathLabel("https://example.com/service-area/camrose/", { source: "sap" }),
    ).toBe("/camrose/");
  });

  it("strips blog prefix for posts", () => {
    expect(
      overviewRowUrlPathLabel("https://example.com/blog/my-post/", { source: "posts" }),
    ).toBe("/my-post/");
  });
});
