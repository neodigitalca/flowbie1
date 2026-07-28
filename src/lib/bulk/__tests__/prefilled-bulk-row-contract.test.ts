import { describe, expect, it } from "vitest";
import {
  formatPrefilledBulkRowContract,
  hasCsvFilledMeta,
  hasCsvFilledTitle,
  hasCsvFilledWikipediaUrl,
} from "@/lib/bulk/prefilled-bulk-row-contract";

describe("formatPrefilledBulkRowContract", () => {
  it("includes filled fields and omits empty ones", () => {
    const block = formatPrefilledBulkRowContract({
      keyword: "dumpster near me Sherwood Park, AB",
      title: "Dumpster Rental Near Me In Sherwood Park",
      entity: "Sherwood Park, AB",
      wikipedia_url: "https://en.wikipedia.org/wiki/Sherwood_Park",
      wikipedia_title: "Sherwood Park, Alberta",
      meta_description: "SEO meta for dumpster rental.",
      target_slug: "dumpster-near-me-sherwood-park-ab",
      publish_date_gmt: "2026-07-09T15:00:00.000Z",
      featuredImage: "google-maps",
      modifier: "",
    });

    expect(block).toContain("PREFILLED BULK ROW");
    expect(block).toContain("title: Dumpster Rental Near Me In Sherwood Park");
    expect(block).toContain("meta_description: SEO meta for dumpster rental.");
    expect(block).toContain("target_slug: dumpster-near-me-sherwood-park-ab");
    expect(block).toContain("wikipedia_url: https://en.wikipedia.org/wiki/Sherwood_Park");
    expect(block).not.toContain("modifier:");
  });

  it("returns empty when no fields filled", () => {
    expect(formatPrefilledBulkRowContract({})).toBe("");
  });
});

describe("hasCsvFilled* predicates", () => {
  it("detects filled title, meta, and wikipedia url", () => {
    expect(hasCsvFilledTitle({ title: "  Hello  " })).toBe(true);
    expect(hasCsvFilledTitle({ title: "   " })).toBe(false);
    expect(hasCsvFilledMeta({ meta_description: "Desc" })).toBe(true);
    expect(hasCsvFilledMeta({})).toBe(false);
    expect(hasCsvFilledWikipediaUrl({ wikipedia_url: "https://en.wikipedia.org/wiki/X" })).toBe(true);
    expect(hasCsvFilledWikipediaUrl({})).toBe(false);
  });
});
