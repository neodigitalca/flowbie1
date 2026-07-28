import { describe, expect, it } from "vitest";
import { buildOverviewRowsCsvForDownload } from "@/lib/export-overview-rows-csv";

describe("buildOverviewRowsCsvForDownload", () => {
  it("includes postContent column after faq", () => {
    const csv = buildOverviewRowsCsvForDownload([
      {
        url: "https://example.com/p/",
        title: "T",
        metaDescription: "d",
        aiTitle: "at",
        aiMeta: "am",
        focusKeyword: "kw",
        faq: "",
        postContent: "<p>hello</p>",
        aiSuggestedPath: "",
        postId: 99,
      },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("<p>hello</p>");
    const headerLine = csv.replace(/^\uFEFF/, "").split(/\r?\n/)[0] ?? "";
    expect(headerLine).toMatch(/faq,blogH2List,postContent,aiSuggestedPath/);
  });

  it("escapes quotes in postContent", () => {
    const csv = buildOverviewRowsCsvForDownload([
      {
        url: "https://example.com/u",
        title: "T",
        metaDescription: "",
        aiTitle: "",
        aiMeta: "",
        postContent: 'class="x"',
        postId: null,
      },
    ]);
    expect(csv).toContain('""');
  });
});
