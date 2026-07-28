import { describe, expect, it } from "vitest";
import { resolveCatalogPostId } from "@/lib/sitemap-optimizer/resolve-catalog-post-id";

describe("resolveCatalogPostId", () => {
  const catalog = ["wp:10773", "csv:1", "slug:my-post"];

  it("returns exact catalog id", () => {
    expect(resolveCatalogPostId("wp:10773", catalog)).toBe("wp:10773");
  });

  it("maps bare numeric id to wp prefix", () => {
    expect(resolveCatalogPostId("10773", catalog)).toBe("wp:10773");
  });

  it("returns null for unknown ids", () => {
    expect(resolveCatalogPostId("wp:99999", catalog)).toBeNull();
  });
});
