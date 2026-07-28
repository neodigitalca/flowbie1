import { describe, expect, it } from "vitest";
import { buildBulkExtraTextItem } from "../overview-bulk-extra-text-payload";

describe("buildBulkExtraTextItem", () => {
  it("returns null for invalid postId", () => {
    expect(buildBulkExtraTextItem({ postId: 0, postType: "page", extraTextRaw: "<p>x</p>" })).toBeNull();
  });

  it("maps extra text to both ACF keys", () => {
    const item = buildBulkExtraTextItem({
      postId: 42,
      postType: "page",
      postTypeEndpoint: "pages",
      extraTextRaw: "<h2>Topic</h2><p>Body copy.</p>",
    });
    expect(item?.postId).toBe(42);
    expect(item?.acf.extra_text).toContain("<h2>");
    expect(item?.acf.seo_extra_text).toBe(item?.acf.extra_text);
  });
});
