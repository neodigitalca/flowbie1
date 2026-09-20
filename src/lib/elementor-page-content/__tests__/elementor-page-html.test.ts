import { describe, expect, it } from "vitest";
import {
  applyElementorPageHtmlToJson,
  buildElementorPageHtml,
  splitElementorPageHtmlBySections,
} from "@/lib/elementor-page-content/elementor-page-html";

const sampleJson = JSON.stringify([
  {
    id: "sec-a",
    elType: "container",
    elements: [
      {
        id: "h-a",
        elType: "widget",
        widgetType: "heading",
        settings: { title: "Services", header_size: "h2" },
      },
      {
        id: "b-a",
        elType: "widget",
        widgetType: "text-editor",
        settings: {
          editor:
            '<p>We install <a href="https://example.com/old/">old blinds</a> across Edmonton.</p>',
        },
      },
    ],
  },
  {
    id: "sec-b",
    elType: "container",
    elements: [
      {
        id: "h-b",
        elType: "widget",
        widgetType: "heading",
        settings: { title: "Contact", header_size: "h2" },
      },
      {
        id: "b-b",
        elType: "widget",
        widgetType: "text-editor",
        settings: { editor: "<p>Reach out today.</p>" },
      },
    ],
  },
]);

describe("buildElementorPageHtml", () => {
  it("builds h2 sections with raw editor HTML including links", () => {
    const html = buildElementorPageHtml(sampleJson);
    expect(html).toContain("<h2>Services</h2>");
    expect(html).toContain('href="https://example.com/old/"');
    expect(html).toContain("<h2>Contact</h2>");
  });
});

describe("applyElementorPageHtmlToJson", () => {
  it("writes linked HTML back into text-editor widgets", () => {
    const pageHtml = buildElementorPageHtml(sampleJson).replace(
      "https://example.com/old/",
      "https://example.com/window-coverings/",
    );
    const nextJson = applyElementorPageHtmlToJson(sampleJson, pageHtml);
    expect(nextJson).toContain("https://example.com/window-coverings/");
    expect(nextJson).not.toContain("https://example.com/old/");
  });

  it("splits page HTML by h2 in order", () => {
    const html = buildElementorPageHtml(sampleJson);
    const sections = splitElementorPageHtmlBySections(html);
    expect(sections).toHaveLength(2);
    expect(sections[0]?.title).toBe("Services");
    expect(sections[1]?.title).toBe("Contact");
  });

  it("returns no sections when HTML has no titled h2", () => {
    expect(splitElementorPageHtmlBySections("<p>Hero only</p><div>Banner</div>")).toEqual([]);
    expect(splitElementorPageHtmlBySections("<h2></h2><p>Empty heading</p>")).toEqual([]);
  });
});
