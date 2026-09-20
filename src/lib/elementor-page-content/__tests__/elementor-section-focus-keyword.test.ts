import { describe, expect, it } from "vitest";
import {
  patchElementorSectionKeyword,
  resolveElementorSectionFocusKeyword,
} from "@/lib/elementor-page-content/elementor-section-focus-keyword";

describe("resolveElementorSectionFocusKeyword", () => {
  it("prefers per-section keyword over heading and page keyword", () => {
    expect(
      resolveElementorSectionFocusKeyword(
        {
          focusKeyword: "page keyword",
          title: "Page title",
          elementorSectionKeywords: { sec1: "section keyword" },
        },
        "sec1",
        "Section heading",
      ),
    ).toBe("section keyword");
  });

  it("falls back to section heading when section keyword is blank", () => {
    expect(
      resolveElementorSectionFocusKeyword(
        { focusKeyword: "page keyword", title: "Page title" },
        "sec1",
        "Section heading",
      ),
    ).toBe("Section heading");
  });

  it("falls back to page focus keyword then title", () => {
    expect(
      resolveElementorSectionFocusKeyword(
        { focusKeyword: "page keyword", title: "Page title" },
        "sec1",
        "",
      ),
    ).toBe("page keyword");
    expect(
      resolveElementorSectionFocusKeyword({ title: "Page title" }, "sec1", ""),
    ).toBe("Page title");
  });
});

describe("patchElementorSectionKeyword", () => {
  it("stores and clears section keywords", () => {
    expect(patchElementorSectionKeyword({}, "sec1", "kw")).toEqual({
      elementorSectionKeywords: { sec1: "kw" },
    });
    expect(
      patchElementorSectionKeyword({ elementorSectionKeywords: { sec1: "kw" } }, "sec1", ""),
    ).toEqual({ elementorSectionKeywords: undefined });
  });
});
