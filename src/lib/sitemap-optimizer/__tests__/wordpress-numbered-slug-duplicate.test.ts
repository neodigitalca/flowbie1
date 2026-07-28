import { describe, expect, it } from "vitest";
import {
  filterWordPressNumberedSlugDuplicates,
  isWordPressNumberedSlugDuplicate,
  stripWordPressNumberedSlugSuffix,
} from "@/lib/sitemap-optimizer/wordpress-numbered-slug-duplicate";

describe("isWordPressNumberedSlugDuplicate", () => {
  it("flags -2, -3, and -2-2 slug clones", () => {
    expect(
      isWordPressNumberedSlugDuplicate(
        "https://kwbllp.com/blog/strategic-business-goal-setting-2/",
      ),
    ).toBe(true);
    expect(isWordPressNumberedSlugDuplicate("https://example.com/blog/foo-3/")).toBe(true);
    expect(isWordPressNumberedSlugDuplicate("https://example.com/blog/foo-2-2/")).toBe(true);
    expect(isWordPressNumberedSlugDuplicate("https://example.com/blog/foo-2-2-3/")).toBe(true);
  });

  it("allows primary slugs without numbered clone suffix", () => {
    expect(
      isWordPressNumberedSlugDuplicate("https://kwbllp.com/blog/strategic-business-goal-setting/"),
    ).toBe(false);
    expect(isWordPressNumberedSlugDuplicate("https://example.com/blog/foo-1/")).toBe(false);
  });
});

describe("filterWordPressNumberedSlugDuplicates", () => {
  it("removes clone URLs from destination lists", () => {
    const urls = [
      "https://example.com/blog/primary/",
      "https://example.com/blog/primary-2/",
      "https://example.com/blog/other-2-2-3/",
    ];
    expect(filterWordPressNumberedSlugDuplicates(urls)).toEqual([
      "https://example.com/blog/primary/",
    ]);
  });
});

describe("stripWordPressNumberedSlugSuffix", () => {
  it("strips numbered clone suffix for clean destinations", () => {
    expect(
      stripWordPressNumberedSlugSuffix(
        "https://example.com/service-area/window-shades-altamonte-springs-2/",
      ),
    ).toBe("https://example.com/service-area/window-shades-altamonte-springs/");
    expect(stripWordPressNumberedSlugSuffix("https://example.com/service-area/blinds/")).toBe(
      "https://example.com/service-area/blinds/",
    );
  });
});
