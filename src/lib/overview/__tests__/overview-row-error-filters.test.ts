import { describe, expect, it } from "vitest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  buildOverviewRowErrorFilterContext,
  countOverviewRowsByErrorFilter,
  overviewRowHasError,
  overviewRowMatchesErrorFilters,
} from "@/lib/overview/overview-row-error-filters";

function row(partial: Partial<OverviewRow>): OverviewRow {
  return {
    url: "https://kwbllp.com/blog/do-you-still-need-a-holding-company/",
    title: "",
    metaDescription: "",
    aiTitle: "",
    aiMeta: "",
    focusKeyword: "need a holding company",
    status: "idle",
    ...partial,
  };
}

describe("overviewRowHasError", () => {
  it("detects missing keyword", () => {
    expect(overviewRowHasError(row({ focusKeyword: "" }), "no_keyword")).toBe(true);
    expect(overviewRowHasError(row({ focusKeyword: "  " }), "no_keyword")).toBe(true);
    expect(overviewRowHasError(row({}), "no_keyword")).toBe(false);
  });

  it("detects URL longer than keyword slug", () => {
    expect(overviewRowHasError(row({}), "url_longer_than_keyword")).toBe(true);
    expect(
      overviewRowHasError(
        row({
          url: "https://kwbllp.com/blog/need-a-holding-company/",
          focusKeyword: "need a holding company",
        }),
        "url_longer_than_keyword",
      ),
    ).toBe(false);
  });

  it("does not flag url_longer when keyword is missing", () => {
    expect(
      overviewRowHasError(row({ focusKeyword: "" }), "url_longer_than_keyword"),
    ).toBe(false);
  });

  it("detects empty fields", () => {
    expect(overviewRowHasError(row({ title: "" }), "empty_title")).toBe(true);
    expect(overviewRowHasError(row({ title: "Holding Company Guide" }), "empty_title")).toBe(
      false,
    );
    expect(overviewRowHasError(row({ metaDescription: "" }), "empty_meta")).toBe(true);
    expect(overviewRowHasError(row({ metaDescription: "Desc" }), "empty_meta")).toBe(false);
    expect(overviewRowHasError(row({ faq: "" }), "empty_faq")).toBe(true);
    expect(
      overviewRowHasError(row({ faq: "Q: What?\nA: Because." }), "empty_faq"),
    ).toBe(false);
    expect(overviewRowHasError(row({ dateModifier: "" }), "empty_date")).toBe(true);
    expect(overviewRowHasError(row({ dateModifier: "2026-01-01" }), "empty_date")).toBe(false);
    expect(overviewRowHasError(row({ seoResearch: "" }), "empty_brief")).toBe(true);
    expect(overviewRowHasError(row({ seoResearch: "{}" }), "empty_brief")).toBe(false);
  });

  it("detects duplicate keyword and title via context", () => {
    const context = buildOverviewRowErrorFilterContext([
      row({ url: "https://example.com/a/", focusKeyword: "Foo Bar", title: "Same Title" }),
      row({ url: "https://example.com/b/", focusKeyword: "foo   bar", title: "same title" }),
      row({
        url: "https://example.com/c/",
        focusKeyword: "Unique",
        title: "Unique Title",
      }),
    ]);
    expect(
      overviewRowHasError(
        row({ url: "https://example.com/a/", focusKeyword: "Foo Bar" }),
        "duplicate_keyword",
        context,
      ),
    ).toBe(true);
    expect(
      overviewRowHasError(
        row({ url: "https://example.com/c/", focusKeyword: "Unique" }),
        "duplicate_keyword",
        context,
      ),
    ).toBe(false);
    expect(
      overviewRowHasError(
        row({ url: "https://example.com/b/", title: "same title" }),
        "duplicate_title",
        context,
      ),
    ).toBe(true);
    expect(
      overviewRowHasError(
        row({
          url: "https://example.com/a/",
          metaDescription: "Same meta description here.",
        }),
        "duplicate_meta",
        buildOverviewRowErrorFilterContext([
          row({
            url: "https://example.com/a/",
            metaDescription: "Same meta description here.",
          }),
          row({
            url: "https://example.com/b/",
            metaDescription: "same   meta description here.",
          }),
        ]),
      ),
    ).toBe(true);
  });
});

describe("overviewRowMatchesErrorFilters", () => {
  it("matches all rows when no filters active", () => {
    expect(overviewRowMatchesErrorFilters(row({}), new Set())).toBe(true);
  });

  it("uses OR logic across selected filters", () => {
    const active = new Set(["no_keyword", "url_longer_than_keyword"] as const);
    expect(overviewRowMatchesErrorFilters(row({ focusKeyword: "" }), active)).toBe(true);
    expect(overviewRowMatchesErrorFilters(row({}), active)).toBe(true);
    expect(
      overviewRowMatchesErrorFilters(
        row({
          url: "https://kwbllp.com/blog/need-a-holding-company/",
          focusKeyword: "need a holding company",
        }),
        active,
      ),
    ).toBe(false);
  });

  it("matches empty meta when that filter is active", () => {
    const active = new Set(["empty_meta"] as const);
    const rows = [
      row({ url: "https://example.com/a/", metaDescription: "" }),
      row({ url: "https://example.com/b/", metaDescription: "Filled" }),
    ];
    expect(overviewRowMatchesErrorFilters(rows[0]!, active, rows)).toBe(true);
    expect(overviewRowMatchesErrorFilters(rows[1]!, active, rows)).toBe(false);
  });
});

describe("countOverviewRowsByErrorFilter", () => {
  it("counts errors per type", () => {
    const rows = [
      row({ focusKeyword: "" }),
      row({}),
      row({
        url: "https://kwbllp.com/blog/need-a-holding-company/",
        focusKeyword: "need a holding company",
      }),
    ];
    const counts = countOverviewRowsByErrorFilter(rows);
    expect(counts.no_keyword).toBe(1);
    expect(counts.url_longer_than_keyword).toBe(1);
    expect(counts.empty_title).toBe(3);
    expect(counts.empty_meta).toBe(3);
  });

  it("counts duplicate keyword rows", () => {
    const rows = [
      row({ url: "https://example.com/a/", focusKeyword: "shared kw" }),
      row({ url: "https://example.com/b/", focusKeyword: "shared kw" }),
      row({ url: "https://example.com/c/", focusKeyword: "solo" }),
    ];
    expect(countOverviewRowsByErrorFilter(rows).duplicate_keyword).toBe(2);
  });

  it("counts duplicate meta rows", () => {
    const rows = [
      row({ url: "https://example.com/a/", metaDescription: "Shared meta copy." }),
      row({ url: "https://example.com/b/", metaDescription: "Shared meta copy." }),
      row({ url: "https://example.com/c/", metaDescription: "Unique meta." }),
    ];
    expect(countOverviewRowsByErrorFilter(rows).duplicate_meta).toBe(2);
  });

  it("counts WordPress numbered slug clone URLs", () => {
    const rows = [
      row({ url: "https://example.com/blog/canadian-digital-adoption-program/" }),
      row({ url: "https://example.com/blog/canadian-digital-adoption-program-2/" }),
      row({ url: "https://example.com/blog/strategic-business-goal-setting-3/" }),
    ];
    expect(countOverviewRowsByErrorFilter(rows).duplicate_url).toBe(2);
    expect(
      overviewRowHasError(
        row({ url: "https://example.com/blog/canadian-digital-adoption-program/" }),
        "duplicate_url",
      ),
    ).toBe(false);
  });
});
