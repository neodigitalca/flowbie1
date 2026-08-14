import { describe, expect, it } from "vitest";
import { validateMetaAdCopyPayload } from "@/lib/ppc/meta-ad-agents";

describe("validateMetaAdCopyPayload", () => {
  it("accepts valid Meta copy JSON", () => {
    const copy = validateMetaAdCopyPayload(
      {
        primaryText: "Grow your local visibility with SEO that converts.",
        headline: "Edmonton SEO That Works",
        description: "Free strategy call",
        cta: "Get Quote",
      },
      "https://example.com/edmonton-seo",
    );

    expect(copy.finalUrl).toBe("https://example.com/edmonton-seo");
    expect(copy.cta).toBe("Get Quote");
    expect(copy.headline.length).toBeLessThanOrEqual(40);
  });

  it("throws when required fields are missing", () => {
    expect(() => validateMetaAdCopyPayload({}, "https://example.com")).toThrow(
      "Meta copy missing primaryText.",
    );
  });
});
