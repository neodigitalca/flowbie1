import { describe, expect, it } from "vitest";
import type { WordPressPostingOptions } from "@/lib/bulk-auto-generate";
import type { WordPressSite } from "@/components/IntegrationsTab";
import {
  applyRowSitemapToPosting,
  inferBulkSitemapModeFromRows,
  parseBulkRowSitemapCell,
  pickSitemapTypeFromRow,
  resolveRowSitemapType,
  seedCustomRowSitemaps,
} from "@/lib/bulk/bulk-sitemap-mode";

describe("parseBulkRowSitemapCell", () => {
  it("normalizes common aliases", () => {
    expect(parseBulkRowSitemapCell("Posts")).toBe("post");
    expect(parseBulkRowSitemapCell("entity")).toBe("entity");
    expect(parseBulkRowSitemapCell("SAP")).toBe("entity");
    expect(parseBulkRowSitemapCell("")).toBeUndefined();
    expect(parseBulkRowSitemapCell("unknown")).toBeUndefined();
  });
});

describe("pickSitemapTypeFromRow", () => {
  it("reads sitemap header aliases", () => {
    expect(pickSitemapTypeFromRow({ sitemap: "entity" })).toBe("entity");
    expect(pickSitemapTypeFromRow({ post_destination: "posts" })).toBe("post");
  });
});

describe("resolveRowSitemapType", () => {
  it("uses site mode when not custom", () => {
    expect(resolveRowSitemapType("post", { sitemap_type: "entity" }, "entity")).toBe("post");
    expect(resolveRowSitemapType("entity", { sitemap_type: "post" }, "post")).toBe("entity");
  });

  it("uses row value in custom mode with fallback", () => {
    expect(resolveRowSitemapType("custom", { sitemap_type: "entity" }, "post")).toBe("entity");
    expect(resolveRowSitemapType("custom", {}, "post")).toBe("post");
  });
});

describe("applyRowSitemapToPosting", () => {
  it("overrides sitemapType on posting and sites", () => {
    const site = { id: "s1", name: "Test" } as WordPressSite;
    const posting: WordPressPostingOptions = {
      enabled: true,
      site,
      sitemapType: "post",
      frequency: "daily",
      startDate: new Date(),
      startTime: "09:00",
      totalRows: 1,
      sites: [{ site, sitemapType: "post" }],
    };
    const next = applyRowSitemapToPosting(posting, "entity");
    expect(next?.sitemapType).toBe("entity");
    expect(next?.sites?.[0]?.sitemapType).toBe("entity");
  });
});

describe("inferBulkSitemapModeFromRows", () => {
  it("returns post when no explicit column", () => {
    expect(inferBulkSitemapModeFromRows([{ keyword: "a", title: "A" }])).toEqual({
      mode: "post",
      rows: [{ keyword: "a", title: "A" }],
    });
  });

  it("returns unified mode when all rows match", () => {
    const rows = [
      { keyword: "a", title: "A", sitemap_type: "entity" as const },
      { keyword: "b", title: "B", sitemap_type: "entity" as const },
    ];
    expect(inferBulkSitemapModeFromRows(rows).mode).toBe("entity");
  });

  it("returns custom when mixed", () => {
    const rows = [
      { keyword: "a", title: "A", sitemap_type: "entity" as const },
      { keyword: "b", title: "B", sitemap_type: "post" as const },
    ];
    expect(inferBulkSitemapModeFromRows(rows).mode).toBe("custom");
  });
});

describe("seedCustomRowSitemaps", () => {
  it("fills missing row sitemap_type", () => {
    const rows = seedCustomRowSitemaps(
      [{ keyword: "a", title: "A" }, { keyword: "b", title: "B", sitemap_type: "entity" }],
      "post",
    );
    expect(rows[0]?.sitemap_type).toBe("post");
    expect(rows[1]?.sitemap_type).toBe("entity");
  });
});
