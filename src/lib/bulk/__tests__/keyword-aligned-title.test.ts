import { describe, expect, it } from "vitest";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { mergePromptBulkIdeaSlots } from "@/lib/bulk/merge-prompt-bulk-idea-slots";
import {
  hasKeywordAlignedCsvTitle,
  titleCoversKeyword,
} from "@/lib/bulk/prefilled-bulk-row-contract";

describe("titleCoversKeyword", () => {
  it("accepts a title that contains the keyword words", () => {
    expect(
      titleCoversKeyword("Hire Elementor Experts For WordPress", "elementor experts"),
    ).toBe(true);
  });

  it("rejects a title from a different topic", () => {
    expect(
      titleCoversKeyword("What Is National SEO And How Does It Work?", "elementor experts"),
    ).toBe(false);
  });
});

describe("hasKeywordAlignedCsvTitle", () => {
  it("is false when the CSV title belongs to the next keyword", () => {
    expect(
      hasKeywordAlignedCsvTitle(
        { title: "What Is National SEO And How Does It Work?", keyword: "elementor experts" },
      ),
    ).toBe(false);
  });

  it("is true when title and keyword match", () => {
    expect(
      hasKeywordAlignedCsvTitle({
        title: "Hire Elementor Experts",
        keyword: "elementor experts",
      }),
    ).toBe(true);
  });

  it("is false when the title stitches with a colon", () => {
    expect(
      hasKeywordAlignedCsvTitle({
        title: "Hunter Douglas Vs Alta: Hunter Douglas vs. Alta Shades",
        keyword: "hunter douglas vs alta",
      }),
    ).toBe(false);
  });
});

describe("mergePromptBulkIdeaSlots", () => {
  it("does not copy a kept row title onto a regenerated neighbor", () => {
    const parsed: CSVRow[] = [{ keyword: "wordpress maintenance", title: "WordPress Maintenance For Sites" }];
    const generated: CSVRow[] = [
      { keyword: "elementor experts", title: "What Is National SEO And How Does It Work?" },
      { keyword: "what is national seo", title: "WordPress Maintenance For A Safe Site" },
    ];
    mergePromptBulkIdeaSlots({
      parsedRows: parsed,
      generatedRows: generated,
      slotKeywords: ["what is national seo"],
      slotModifiers: [""],
      keepIndices: [0],
    });
    expect(parsed[0]!.keyword).toBe("what is national seo");
    expect(parsed[0]!.title).toBe("WordPress Maintenance For Sites");
  });
});
