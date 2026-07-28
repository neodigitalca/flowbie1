import { describe, expect, it } from "vitest";
import {
  entityCompressionBucketKey,
  entityLocationSlugFromRow,
  entityMetroAnchorFromRow,
} from "@/lib/sitemap-optimizer/entity-compression-buckets";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

function entityRow(url: string, title = ""): SitemapOptimizerPostRow {
  return {
    postId: `wp:${url}`,
    url,
    collection: "service-area",
    title,
    keyword: "",
    meta: "",
    contentSnippet: "",
    gscQueries: [],
    gscFetched: true,
  };
}

describe("entity-compression-buckets", () => {
  it("parses service-area slug from URL path", () => {
    const row = entityRow(
      "https://advanceblindsanddrapery.com/service-area/charleswood-blinds/",
      "Charleswood Blinds",
    );
    expect(entityLocationSlugFromRow(row)).toBe("charleswood-blinds");
    expect(entityMetroAnchorFromRow(row)).toBe("winnipeg");
  });

  it("aggressive metro merge buckets suburbs together", () => {
    const charleswood = entityRow(
      "https://example.com/service-area/charleswood-blinds/",
      "Charleswood",
    );
    const transcona = entityRow(
      "https://example.com/service-area/transcona-shades/",
      "Transcona",
    );
    const keyA = entityCompressionBucketKey(charleswood, "aggressive", true);
    const keyB = entityCompressionBucketKey(transcona, "aggressive", true);
    expect(keyA).toBe("metro:winnipeg");
    expect(keyB).toBe(keyA);
  });

  it("basic mode keeps distinct place buckets", () => {
    const charleswood = entityRow("https://example.com/service-area/charleswood/");
    const transcona = entityRow("https://example.com/service-area/transcona/");
    expect(entityCompressionBucketKey(charleswood, "none", false)).not.toBe(
      entityCompressionBucketKey(transcona, "none", false),
    );
  });
});
