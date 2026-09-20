import { describe, expect, it } from "vitest";
import {
  parseElementorSectionOutline,
  assertSameTopLevelCount,
  elementorTreePlainText,
} from "@/lib/elementor-page-content/parse-elementor-section-outline";
import { detectHarnessSlotsFromElementor } from "@/lib/elementor-page-content/detect-harness-slots";

describe("parseElementorSectionOutline", () => {
  it("extracts top-level container headings", () => {
    const data = [
      {
        id: "hero",
        elType: "container",
        elements: [
          {
            id: "h1w",
            elType: "widget",
            widgetType: "heading",
            settings: { title: "Welcome to Flowbie" },
          },
        ],
      },
      {
        id: "faq",
        elType: "container",
        elements: [
          {
            id: "h2w",
            elType: "widget",
            widgetType: "heading",
            settings: { title: "FAQ" },
          },
        ],
      },
    ];
    const outline = parseElementorSectionOutline(data);
    expect(outline).toHaveLength(2);
    expect(outline[0]?.title).toBe("Welcome to Flowbie");
    expect(outline[1]?.title).toBe("FAQ");
  });

  it("supports classic section/column trees", () => {
    const data = [
      {
        id: "sec1",
        elType: "section",
        elements: [
          {
            id: "col1",
            elType: "column",
            elements: [
              {
                id: "hw",
                elType: "widget",
                widgetType: "heading",
                settings: { title: "Services" },
              },
            ],
          },
        ],
      },
    ];
    expect(parseElementorSectionOutline(data)[0]?.title).toBe("Services");
  });

  it("prefers h2 over rating-like h3 headings and includes body text", () => {
    const data = [
      {
        id: "reviews",
        elType: "container",
        elements: [
          {
            id: "rating",
            elType: "widget",
            widgetType: "heading",
            settings: { title: "4.9", header_size: "h3" },
          },
          {
            id: "title",
            elType: "widget",
            widgetType: "heading",
            settings: { title: "What Our Clients Say", header_size: "h2" },
          },
          {
            id: "body",
            elType: "widget",
            widgetType: "text-editor",
            settings: {
              editor:
                "<p>Fantastic experience! I am totally recommending Blind Magic to my friends and family.</p>",
            },
          },
        ],
      },
    ];
    const outline = parseElementorSectionOutline(data);
    expect(outline[0]?.title).toBe("What Our Clients Say");
    expect(outline[0]?.bodyText).toMatch(/Fantastic experience/i);
    expect(outline[0]?.bodyHtml).toMatch(/Fantastic experience/i);
  });

  it("models giving-back style charity sections with text-editor body", () => {
    const data = [
      {
        id: "habitat",
        elType: "container",
        elements: [
          {
            id: "h2-habitat",
            elType: "widget",
            widgetType: "heading",
            settings: { title: "Habitat For Humanity", header_size: "h2" },
          },
          {
            id: "habitat-body",
            elType: "widget",
            widgetType: "text-editor",
            settings: {
              editor:
                "<p>In partnership with Hunter Douglas Canada, we’ve been providing window coverings and installation services for Habitat for Humanity builds since 2011.</p>",
            },
          },
        ],
      },
      {
        id: "humane",
        elType: "container",
        elements: [
          {
            id: "h2-humane",
            elType: "widget",
            widgetType: "heading",
            settings: { title: "Edmonton Humane Society", header_size: "h2" },
          },
          {
            id: "humane-body",
            elType: "widget",
            widgetType: "text-editor",
            settings: {
              editor:
                "<p>Blind Magic Window Coverings is lucky to have a canine mascot at both our gallery showroom and commercial office!</p>",
            },
          },
        ],
      },
    ];
    const outline = parseElementorSectionOutline(data);
    expect(outline.map((s) => s.title)).toEqual([
      "Habitat For Humanity",
      "Edmonton Humane Society",
    ]);
    expect(outline[0]?.bodyText).toMatch(/Hunter Douglas Canada/i);
    expect(outline[1]?.bodyText).toMatch(/canine mascot/i);
  });

  it("uses inline h2 in text-editor as section title and strips it from body", () => {
    const data = [
      {
        id: "smart-home",
        elType: "container",
        elements: [
          {
            id: "body",
            elType: "widget",
            widgetType: "text-editor",
            settings: {
              editor:
                "<h2>Built for Smart Homes</h2>\n<p>PowerView integrates seamlessly with smart home systems.</p>",
            },
          },
        ],
      },
    ];
    const outline = parseElementorSectionOutline(data);
    expect(outline[0]?.title).toBe("Built for Smart Homes");
    expect(outline[0]?.headingInBodyHtml).toBe(true);
    expect(outline[0]?.hasHeadingWidget).toBe(false);
    expect(outline[0]?.headingHtml).toMatch(/<h2>Built for Smart Homes<\/h2>/i);
    expect(outline[0]?.bodyHtml).toMatch(/PowerView integrates/i);
    expect(outline[0]?.bodyHtml).not.toMatch(/<h2>/i);
  });

  it("leaves title empty when band has no heading widget (body stays in bodyText)", () => {
    const bodyCopy =
      "Altex provides innovative solutions for commercial spaces. Their advanced product range excels in quality.";
    const data = [
      {
        id: "hero",
        elType: "container",
        elements: [
          {
            id: "body",
            elType: "widget",
            widgetType: "text-editor",
            settings: { editor: `<p>${bodyCopy}</p>` },
          },
        ],
      },
    ];
    const outline = parseElementorSectionOutline(data);
    expect(outline[0]?.title).toBe("");
    expect(outline[0]?.hasHeadingWidget).toBe(false);
    expect(outline[0]?.headingInBodyHtml).toBe(false);
    expect(outline[0]?.bodyText).toBe(bodyCopy);
  });

  it("sets hasHeadingWidget true when heading widget exists", () => {
    const data = [
      {
        id: "hero",
        elType: "container",
        elements: [
          {
            id: "h1w",
            elType: "widget",
            widgetType: "heading",
            settings: { title: "Commercial Window Coverings" },
          },
          {
            id: "body",
            elType: "widget",
            widgetType: "text-editor",
            settings: { editor: "<p>Body copy here.</p>" },
          },
        ],
      },
    ];
    const outline = parseElementorSectionOutline(data);
    expect(outline[0]?.hasHeadingWidget).toBe(true);
    expect(outline[0]?.title).toBe("Commercial Window Coverings");
    expect(outline[0]?.bodyText).toMatch(/Body copy here/i);
  });
});

describe("assertSameTopLevelCount", () => {
  it("throws when root count changes", () => {
    expect(() => assertSameTopLevelCount([{ id: "a" }], [{ id: "a" }, { id: "b" }])).toThrow(
      /top-level section count changed/,
    );
  });
});

describe("detectHarnessSlotsFromElementor", () => {
  it("detects answer heading in widgets", () => {
    const data = [
      {
        id: "band",
        elType: "container",
        elements: [
          {
            id: "w1",
            elType: "widget",
            widgetType: "heading",
            settings: { title: "Answer" },
          },
          {
            id: "w2",
            elType: "widget",
            widgetType: "text-editor",
            settings: { editor: "<p>Direct answer for AISEO.</p>" },
          },
        ],
      },
    ];
    const slots = detectHarnessSlotsFromElementor(data);
    expect(elementorTreePlainText(data)).toMatch(/answer/i);
    expect(slots.answer).toBe(true);
  });
});
