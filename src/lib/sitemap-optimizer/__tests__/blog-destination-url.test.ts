import { describe, expect, it } from "vitest";
import {
  blogDestinationWasNormalized,
  ensureBlogDestinationUrl,
} from "@/lib/sitemap-optimizer/blog-destination-url";

describe("ensureBlogDestinationUrl", () => {
  it("adds blog prefix to root-level slug", () => {
    expect(ensureBlogDestinationUrl("https://www.kwbllp.com/quickbooks-optimization/")).toBe(
      "https://www.kwbllp.com/blog/quickbooks-optimization/",
    );
  });

  it("strips date archive and uses last segment under blog", () => {
    expect(
      ensureBlogDestinationUrl(
        "https://www.kwbllp.com/2022/10/12/canadian-digital-adoption-program-advisor/",
      ),
    ).toBe("https://www.kwbllp.com/blog/canadian-digital-adoption-program-advisor/");
  });

  it("normalizes trailing slash when already under blog", () => {
    expect(
      ensureBlogDestinationUrl("https://www.kwbllp.com/blog/quickbooks-optimization"),
    ).toBe("https://www.kwbllp.com/blog/quickbooks-optimization/");
  });

  it("is idempotent for correct blog URLs", () => {
    const url = "https://www.kwbllp.com/blog/auto-repair-profitability/";
    expect(ensureBlogDestinationUrl(url)).toBe(url);
  });

  it("returns null for homepage-only URLs", () => {
    expect(ensureBlogDestinationUrl("https://www.kwbllp.com/")).toBeNull();
    expect(ensureBlogDestinationUrl("https://www.kwbllp.com")).toBeNull();
  });

  it("detects normalization", () => {
    const before = "https://www.kwbllp.com/quickbooks-optimization/";
    const after = ensureBlogDestinationUrl(before);
    expect(blogDestinationWasNormalized(before, after)).toBe(true);
    expect(
      blogDestinationWasNormalized(
        "https://www.kwbllp.com/blog/quickbooks-optimization/",
        after,
      ),
    ).toBe(false);
  });
});
