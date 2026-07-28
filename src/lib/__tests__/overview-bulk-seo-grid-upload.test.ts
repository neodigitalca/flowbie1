import { describe, expect, it } from "vitest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import {
  buildOverviewBulkSeoItem,
  buildOverviewUploadPayloadBundle,
  collectOverviewBulkSeoItemsFromGrid,
  overviewBindingForRow,
  overviewDateModifierTodayIso,
  resolveOverviewBindingForRow,
} from "@/lib/overview/overview-bulk-seo-payload";
import { WP_UPLOAD_HARNESS_TOTAL_SECTIONS } from "@/lib/overview/overview-wp-upload-harness-sections";

describe("collectOverviewBulkSeoItemsFromGrid", () => {
  it("builds one item per bound row with SEO fields", () => {
    const rows: OverviewRow[] = [
      {
        url: "https://example.com/a",
        title: "Title A",
        metaDescription: "Meta A",
        aiTitle: "",
        aiMeta: "",
        status: "idle",
        focusKeyword: "kw a",
      },
      {
        url: "https://example.com/b",
        title: "",
        metaDescription: "",
        aiTitle: "",
        aiMeta: "",
        status: "idle",
      },
    ];
    const bindings: Record<string, OverviewBinding> = {
      "https://example.com/a": { postId: 10, subtype: "post" },
      "https://example.com/b": { postId: 20, subtype: "page" },
    };
    const { items, rowIndices } = collectOverviewBulkSeoItemsFromGrid(rows, bindings);
    expect(rowIndices).toEqual([0]);
    expect(items).toHaveLength(1);
    expect(items[0].postId).toBe(10);
    expect(items[0].postTypeEndpoint).toBe("posts");
    expect(items[0].postTitle).toBeTruthy();
  });

  it("uses row postId when bindings map is empty", () => {
    const rows: OverviewRow[] = [
      {
        url: "https://example.com/page",
        title: "Page title",
        metaDescription: "",
        aiTitle: "",
        aiMeta: "",
        status: "idle",
        focusKeyword: "kw",
        postId: 42,
        postType: "page",
      },
    ];
    const { items, rowIndices } = collectOverviewBulkSeoItemsFromGrid(rows, {});
    expect(rowIndices).toEqual([0]);
    expect(items[0].postId).toBe(42);
    expect(items[0].postTypeEndpoint).toBe("pages");
    expect(overviewBindingForRow(rows[0], {})?.postId).toBe(42);
  });

  it("skips unbound URLs without resolving", () => {
    const rows: OverviewRow[] = [
      {
        url: "https://example.com/x",
        title: "T",
        metaDescription: "M",
        aiTitle: "",
        aiMeta: "",
        status: "idle",
      },
    ];
    const { items } = collectOverviewBulkSeoItemsFromGrid(rows, {});
    expect(items).toHaveLength(0);
  });

  it("matches buildOverviewBulkSeoItem per row", () => {
    const row: OverviewRow = {
      url: "https://example.com/z",
      title: "Z",
      metaDescription: "Desc",
      aiTitle: "",
      aiMeta: "",
      status: "idle",
      focusKeyword: "focus",
    };
    const binding: OverviewBinding = { postId: 99, subtype: "post" };
    const collected = collectOverviewBulkSeoItemsFromGrid([row], { [row.url]: binding });
    expect(collected.items[0]).toEqual(buildOverviewBulkSeoItem(row, binding));
  });
});

describe("buildOverviewBulkSeoItem semrushScope", () => {
  it("meta scope sends postExcerpt only", () => {
    const row: OverviewRow = {
      url: "https://example.com/a",
      title: "Title",
      metaDescription: "Old meta",
      aiTitle: "AI Title",
      aiMeta: "New excerpt",
      status: "idle",
      focusKeyword: "kw",
      faq: "Q?",
      seoResearch: "{}",
    };
    const binding: OverviewBinding = { postId: 1, subtype: "post" };
    const item = buildOverviewBulkSeoItem(row, binding, { semrushScope: "meta" });
    expect(item).toEqual({
      postId: 1,
      postType: "post",
      postTypeEndpoint: "posts",
      postExcerpt: "New excerpt",
      acf: {},
    });
  });
});

describe("buildOverviewBulkSeoItem forWordPressUpload", () => {
  it("always includes today's date_modifier on WordPress upload", () => {
    const row: OverviewRow = {
      url: "https://example.com/a",
      title: "Title",
      metaDescription: "",
      aiTitle: "",
      aiMeta: "",
      status: "idle",
      dateModifier: "2020-01-01",
    };
    const binding: OverviewBinding = { postId: 1, subtype: "post" };
    const item = buildOverviewBulkSeoItem(row, binding, { forWordPressUpload: true });
    expect(item?.acf.date_modifier).toBe(overviewDateModifierTodayIso());
  });

  it("uploads bound rows even when grid SEO fields are empty", () => {
    const row: OverviewRow = {
      url: "https://example.com/a",
      title: "",
      metaDescription: "",
      aiTitle: "",
      aiMeta: "",
      status: "idle",
    };
    const binding: OverviewBinding = { postId: 1, subtype: "page" };
    const item = buildOverviewBulkSeoItem(row, binding, { forWordPressUpload: true });
    expect(item).not.toBeNull();
    expect(item!.postId).toBe(1);
    expect(item!.acf.date_modifier).toBe(overviewDateModifierTodayIso());
  });

  it("does not add date_modifier for CSV/grid export when row date is empty", () => {
    const row: OverviewRow = {
      url: "https://example.com/a",
      title: "Title",
      metaDescription: "",
      aiTitle: "",
      aiMeta: "",
      status: "idle",
    };
    const binding: OverviewBinding = { postId: 1, subtype: "post" };
    const item = buildOverviewBulkSeoItem(row, binding);
    expect(item?.acf.date_modifier).toBeUndefined();
  });
});

describe("buildOverviewUploadPayloadBundle", () => {
  it("serializes premade JSON with pageUrl, postId, meta, and acf", () => {
    const row: OverviewRow = {
      url: "https://example.com/a",
      title: "Title",
      metaDescription: "Meta",
      aiTitle: "",
      aiMeta: "",
      status: "idle",
      focusKeyword: "kw",
    };
    const binding: OverviewBinding = { postId: 10, subtype: "post" };
    const bundle = buildOverviewUploadPayloadBundle(row, binding, { forWordPressUpload: true });
    expect(bundle).not.toBeNull();
    expect(bundle!.item).toEqual(buildOverviewBulkSeoItem(row, binding, { forWordPressUpload: true }));
    const parsed = JSON.parse(bundle!.payloadJson) as Record<string, unknown>;
    expect(parsed.pageUrl).toBe("https://example.com/a");
    expect(parsed.postId).toBe(10);
    expect(parsed.postTitle).toBeTruthy();
    expect(parsed.acf).toBeTruthy();
    expect((parsed.acf as { date_modifier?: string }).date_modifier).toBe(overviewDateModifierTodayIso());
  });
});

describe("WP upload harness sections", () => {
  it("uses a single WordPress upload section per row", () => {
    expect(WP_UPLOAD_HARNESS_TOTAL_SECTIONS).toBe(1);
  });
});

describe("resolveOverviewBindingForRow", () => {
  it("uses inventory match when bindings map and row postId are empty", () => {
    const row: OverviewRow = {
      url: "https://example.com/",
      title: "Home",
      metaDescription: "",
      aiTitle: "",
      aiMeta: "",
      status: "idle",
    };
    const binding = resolveOverviewBindingForRow(row, {}, {
      row: { id: 7, date_gmt: "2026-06-04T12:00:00" },
      subtype: "page",
    });
    expect(binding?.postId).toBe(7);
    expect(binding?.subtype).toBe("page");
  });

  it("prefers inventory URL match over a stale row.postId", () => {
    const row: OverviewRow = {
      url: "https://example.com/blog/other-post/",
      title: "Other",
      metaDescription: "",
      aiTitle: "",
      aiMeta: "",
      status: "idle",
      postId: 18226,
      postType: "post",
    };
    const binding = resolveOverviewBindingForRow(row, {}, {
      row: { id: 9911, date_gmt: "2026-07-01T00:00:00" },
      subtype: "post",
    });
    expect(binding?.postId).toBe(9911);
  });

  it("reuses binding when row URL changed but postId still matches map entry", () => {
    const row: OverviewRow = {
      url: "https://example.com/blog/other-post/",
      title: "Other",
      metaDescription: "",
      aiTitle: "",
      aiMeta: "",
      status: "idle",
      postId: 18226,
      postType: "post",
    };
    const binding = resolveOverviewBindingForRow(
      row,
      { "https://example.com/blog/battery-wand-repair/": { postId: 18226, subtype: "post" } },
      null,
    );
    expect(binding?.postId).toBe(18226);
    expect(binding?.subtype).toBe("post");
  });
});
