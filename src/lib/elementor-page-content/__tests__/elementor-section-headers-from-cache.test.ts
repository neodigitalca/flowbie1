import { describe, expect, it } from "vitest";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { createEmptyOverviewRow } from "@/lib/overview/overview-row-helpers";
import {
  applyCachedElementorFieldsToOverviewRows,
  elementorSectionHeadersFromCachedRow,
  richestSectionBodyForOptimize,
} from "@/lib/elementor-page-content/elementor-section-headers-from-cache";

describe("elementorSectionHeadersFromCachedRow", () => {
  it("uses saved elementorSectionHeaders without network", () => {
    const row: OverviewRow = {
      ...createEmptyOverviewRow("https://example.com/page/"),
      elementorSectionHeaders: [{ id: "abc", title: "Cached band", depth: 0 }],
    };
    expect(elementorSectionHeadersFromCachedRow(row)).toEqual([
      { id: "abc", title: "Cached band", depth: 0 },
    ]);
  });

  it("prefers elementor JSON body over saved title-only headers", () => {
    const row: OverviewRow = {
      ...createEmptyOverviewRow("https://example.com/page/"),
      elementorDataJson: JSON.stringify([
        {
          id: "band-1",
          elType: "container",
          elements: [
            {
              id: "h1",
              elType: "widget",
              widgetType: "heading",
              settings: { title: "Fully Custom" },
            },
            {
              id: "b1",
              elType: "widget",
              widgetType: "text-editor",
              settings: {
                editor: "<p>Every space tells a story.</p>",
              },
            },
          ],
        },
      ]),
      elementorSectionHeaders: [{ id: "old", title: "Fully Custom", depth: 0, bodyHtml: "", bodyText: "" }],
    };
    const headers = elementorSectionHeadersFromCachedRow(row);
    expect(headers[0]?.title).toBe("Fully Custom");
    expect(headers[0]?.bodyHtml).toContain("Every space tells a story");
  });

  it("derives sections from cached post HTML with text-editor prose only", () => {
    const row: OverviewRow = {
      ...createEmptyOverviewRow("https://example.com/page/"),
      postContent:
        "<h2>First</h2>" +
        '<div class="elementor-widget elementor-widget-text-editor" data-e-type="widget" data-widgettype="text-editor.default">' +
        '<div class="elementor-widget-container"><p>Body one</p></div></div>' +
        "<h2>Second</h2><p>Body two</p>",
    };
    const headers = elementorSectionHeadersFromCachedRow(row);
    expect(headers.map((h) => h.title)).toEqual(["First", "Second"]);
    expect(headers[0]?.bodyHtml).toContain("<p>Body one</p>");
    expect(headers[0]?.bodyHtml).not.toContain("data-e-type");
  });

  it("refreshes stale bodyHtml on saved headers from postContent", () => {
    const row: OverviewRow = {
      ...createEmptyOverviewRow("https://example.com/page/"),
      postContent:
        "<h2>Band A</h2>" +
        '<div class="elementor-widget-text-editor"><div class="elementor-widget-container"><p>Fresh copy</p></div></div>',
      elementorSectionHeaders: [
        {
          id: "abc",
          title: "Band A",
          depth: 0,
          bodyHtml: 'type="widget" data-e-type="widget" data-widgettype="video.default">',
          bodyText: "junk",
        },
      ],
    };
    const headers = elementorSectionHeadersFromCachedRow(row);
    expect(headers[0]?.bodyHtml).toContain("Fresh copy");
    expect(headers[0]?.bodyHtml).not.toContain("data-e-type");
  });

  it("does not fail sitemap hydrate when cached HTML has no h2", () => {
    const row: OverviewRow = {
      ...createEmptyOverviewRow("https://example.com/page/"),
      postContent: "<p>Hero banner only</p><div class='elementor-widget-image'></div>",
    };
    expect(elementorSectionHeadersFromCachedRow(row)).toEqual([]);
    const [next] = applyCachedElementorFieldsToOverviewRows([row], "pages");
    expect(next).toEqual(row);
  });

  it("stamps cached headers onto pages rows after inventory merge", () => {
    const row: OverviewRow = {
      ...createEmptyOverviewRow("https://example.com/page/"),
      postContent: "<h2>Band A</h2><p>Text</p>",
    };
    const [next] = applyCachedElementorFieldsToOverviewRows([row], "pages");
    expect(next.contentFormat).toBe("elementor");
    expect(next.elementorSectionHeaders?.map((h) => h.title)).toEqual(["Band A"]);
    expect(next.blogH2List).toEqual(["Band A"]);
  });
});

describe("richestSectionBodyForOptimize", () => {
  it("prefers the longest cached section body over a thin JSON outline", () => {
    const jsonSection = {
      id: "band-1",
      title: "Current Promotions",
      hasHeadingWidget: false,
      headingInBodyHtml: false,
      headingHtml: "",
      depth: 0,
      bodyHtml: "<p>Short json body.</p>",
      bodyText: "Short json body.",
    };
    const row: OverviewRow = {
      ...createEmptyOverviewRow("https://example.com/promotions/"),
      postContent: [
        "<h2>Current Promotions</h2>",
        "<p>Paragraph one about premium window treatments and savings.</p>",
        "<p>Paragraph two about ALTA Window Fashions and seasonal offers.</p>",
        "<p>Paragraph three about checking back for the latest deals.</p>",
      ].join(""),
      elementorDataJson: JSON.stringify([
        {
          id: "band-1",
          elType: "container",
          elements: [
            {
              id: "body",
              elType: "widget",
              widgetType: "text-editor",
              settings: { editor: "<p>Short json body.</p>" },
            },
          ],
        },
      ]),
    };

    const enriched = richestSectionBodyForOptimize(row, jsonSection);
    expect(enriched.bodyHtml).toContain("Paragraph three");
    expect(enriched.bodyHtml).not.toBe("<p>Short json body.</p>");
  });
});
