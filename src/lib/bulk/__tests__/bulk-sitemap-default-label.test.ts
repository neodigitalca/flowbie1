import { describe, expect, it } from "vitest";
import {
  bulkSitemapDefaultLabel,
  bulkSitemapModeLabel,
  resolveBulkSitemapDefaultLabel,
} from "@/lib/bulk/bulk-sitemap-default-label";

describe("bulkSitemapDefaultLabel", () => {
  it("maps entity and post types to row labels", () => {
    expect(bulkSitemapDefaultLabel("entity")).toBe("Entity");
    expect(bulkSitemapDefaultLabel("post")).toBe("Posts");
  });
});

describe("bulkSitemapModeLabel", () => {
  it("maps custom mode", () => {
    expect(bulkSitemapModeLabel("custom")).toBe("Custom");
  });
});

describe("resolveBulkSitemapDefaultLabel", () => {
  it("uses configured site sitemap type", () => {
    expect(
      resolveBulkSitemapDefaultLabel({
        siteConfigs: { s1: { sitemapType: "entity" } },
        selectedWordPressSites: new Set(["s1"]),
      }),
    ).toBe("Entity");
  });

  it("defaults to entity when available and unset", () => {
    expect(
      resolveBulkSitemapDefaultLabel({
        siteConfigs: {},
        selectedWordPressSites: new Set(["s1"]),
        entitySitemapAvailable: true,
      }),
    ).toBe("Entity");
  });
});
