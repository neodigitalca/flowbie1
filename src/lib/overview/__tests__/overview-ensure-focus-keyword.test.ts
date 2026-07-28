import { describe, expect, it, vi } from "vitest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  ensureOverviewFocusKeyword,
  needsOverviewResearchRefresh,
  parseBriefFocusKeyword,
} from "@/lib/overview/overview-ensure-focus-keyword";

function baseRow(overrides: Partial<OverviewRow> = {}): OverviewRow {
  return {
    url: "https://example.com/winter-blinds/",
    title: "Winter Blinds",
    metaDescription: "Meta",
    aiTitle: "",
    aiMeta: "",
    status: "idle",
    ...overrides,
  };
}

describe("parseBriefFocusKeyword", () => {
  it("reads focusKeyword from brief JSON", () => {
    const brief = JSON.stringify({ version: 1, focusKeyword: "Roller Shades" });
    expect(parseBriefFocusKeyword(brief)).toBe("Roller Shades");
  });
});

describe("needsOverviewResearchRefresh", () => {
  it("returns true when brief is missing", () => {
    expect(needsOverviewResearchRefresh(baseRow(), "roller shades")).toBe(true);
  });

  it("returns true when brief keyword differs", () => {
    const brief = JSON.stringify({ focusKeyword: "cellular shades" });
    expect(needsOverviewResearchRefresh(baseRow({ seoResearch: brief }), "roller shades")).toBe(
      true,
    );
  });

  it("returns false when brief keyword matches", () => {
    const brief = JSON.stringify({ focusKeyword: "Roller Shades" });
    expect(
      needsOverviewResearchRefresh(baseRow({ seoResearch: brief }), "roller shades"),
    ).toBe(false);
  });
});

describe("ensureOverviewFocusKeyword", () => {
  it("returns existing keyword without calling derive helpers", async () => {
    const deriveEntity = vi.fn();
    const deriveContent = vi.fn();
    const result = await ensureOverviewFocusKeyword(baseRow({ focusKeyword: "Existing Kw" }), {
      sitemapSource: "pages",
      deriveEntityKeyword: deriveEntity,
      deriveFocusKeywordFromPageContext: deriveContent,
    });
    expect(result).toEqual({ keyword: "Existing Kw", wasDerived: false });
    expect(deriveEntity).not.toHaveBeenCalled();
    expect(deriveContent).not.toHaveBeenCalled();
  });

  it("routes SAP to entity derivation", async () => {
    const deriveEntity = vi.fn().mockResolvedValue("Entity Keyword");
    const deriveContent = vi.fn();
    const result = await ensureOverviewFocusKeyword(baseRow(), {
      sitemapSource: "sap",
      deriveEntityKeyword: deriveEntity,
      deriveFocusKeywordFromPageContext: deriveContent,
    });
    expect(deriveEntity).toHaveBeenCalled();
    expect(deriveContent).not.toHaveBeenCalled();
    expect(result.keyword).toBe("Entity Keyword");
    expect(result.wasDerived).toBe(true);
    expect(result.patch?.focusKeyword).toBe("Entity Keyword");
  });

  it("routes pages to content derivation", async () => {
    const deriveEntity = vi.fn();
    const deriveContent = vi.fn().mockResolvedValue("Content Keyword");
    const result = await ensureOverviewFocusKeyword(baseRow(), {
      sitemapSource: "pages",
      deriveEntityKeyword: deriveEntity,
      deriveFocusKeywordFromPageContext: deriveContent,
    });
    expect(deriveContent).toHaveBeenCalled();
    expect(deriveEntity).not.toHaveBeenCalled();
    expect(result.keyword).toBe("Content Keyword");
  });

  it("falls back to path slug hint when AI returns empty", async () => {
    const deriveContent = vi.fn().mockResolvedValue("");
    const result = await ensureOverviewFocusKeyword(baseRow(), {
      sitemapSource: "posts",
      deriveEntityKeyword: vi.fn(),
      deriveFocusKeywordFromPageContext: deriveContent,
    });
    expect(result.keyword).toBe("winter blinds");
    expect(result.wasDerived).toBe(true);
  });
});
