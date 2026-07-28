import { describe, expect, it } from "vitest";
import { optimizeBlogMergeDestination } from "@/lib/sitemap-optimizer/optimize-blog-destination";
import { GRID_DESTINATION_MAX_SLUG_CHARS } from "@/lib/sitemap-optimizer/grid-destination-aiseo-policy";

const blogPolicy = { forceBlogPermalink: true, parentPrefix: "blog" };

describe("optimizeBlogMergeDestination", () => {
  it("shortens long redirect-map slug to aiseo blog path", () => {
    const long =
      "https://www.kwbllp.com/blog/profit-improvement-strategies-for-physicians-and-medical-professionals/";
    const memberUrls = [
      "https://www.kwbllp.com/2024/10/02/profit-improvement-strategies-for-physicians-and-medical-professionals/",
    ];
    const out = optimizeBlogMergeDestination(
      long,
      "profit improvement strategies",
      "Profit Improvement Strategies for Medical Professionals",
      memberUrls,
      blogPolicy,
    );
    expect(out).toMatch(/^https:\/\/www\.kwbllp\.com\/blog\//);
    const slug = new URL(out).pathname.split("/").filter(Boolean).pop() ?? "";
    expect(slug.length).toBeLessThanOrEqual(GRID_DESTINATION_MAX_SLUG_CHARS);
    expect(slug).not.toContain("physicians-and-medical-professionals");
  });
});
