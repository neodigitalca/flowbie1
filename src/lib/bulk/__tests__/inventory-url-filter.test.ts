import { describe, expect, it } from "vitest";
import {
  filterInventorySitemapUrls,
  isInventoryExcludedSitemapUrl,
} from "@/lib/bulk/inventory-url-filter";

describe("isInventoryExcludedSitemapUrl", () => {
  it("excludes WordPress ?p=ID URLs", () => {
    expect(isInventoryExcludedSitemapUrl("https://phoenixpainting.ca/?p=2315")).toBe(true);
    expect(isInventoryExcludedSitemapUrl("https://phoenixpainting.ca/?p=2270")).toBe(true);
  });

  it("keeps pretty permalinks", () => {
    expect(isInventoryExcludedSitemapUrl("https://phoenixpainting.ca/exterior-painting/")).toBe(
      false,
    );
    expect(isInventoryExcludedSitemapUrl("https://phoenixpainting.ca/blog/paint-tips/")).toBe(false);
  });

  it("excludes archive pagination paths and ?paged=", () => {
    expect(isInventoryExcludedSitemapUrl("https://phoenixpainting.ca/blog/page/2/")).toBe(true);
    expect(isInventoryExcludedSitemapUrl("https://phoenixpainting.ca/blog/?paged=3")).toBe(true);
  });

  it("excludes Elementor library and preview URLs", () => {
    expect(
      isInventoryExcludedSitemapUrl("https://neodigital.ca/?elementor_library=search-popup"),
    ).toBe(true);
    expect(
      isInventoryExcludedSitemapUrl("https://neodigital.ca/?elementor_library=blog-single"),
    ).toBe(true);
    expect(isInventoryExcludedSitemapUrl("https://neodigital.ca/?elementor-preview=123")).toBe(
      true,
    );
    expect(
      isInventoryExcludedSitemapUrl("https://neodigital.ca/service-area/edmonton/"),
    ).toBe(false);
  });
});

describe("filterInventorySitemapUrls", () => {
  it("drops pagination URLs from export lists", () => {
    const urls = [
      "https://phoenixpainting.ca/?p=2315",
      "https://phoenixpainting.ca/service-areas/edmonton/",
      "https://phoenixpainting.ca/blog/page/2/",
    ];
    expect(filterInventorySitemapUrls(urls)).toEqual([
      "https://phoenixpainting.ca/service-areas/edmonton/",
    ]);
  });

  it("drops Elementor library URLs from export lists", () => {
    const urls = [
      "https://neodigital.ca/?elementor_library=search-popup",
      "https://neodigital.ca/?elementor_library=seo-extra",
      "https://neodigital.ca/inters-goldbar-edmonton/",
    ];
    expect(filterInventorySitemapUrls(urls)).toEqual([
      "https://neodigital.ca/inters-goldbar-edmonton/",
    ]);
  });
});
