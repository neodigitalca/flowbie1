import { describe, expect, it } from "vitest";
import {
  buildInContentImageFigureHtml,
  inContentImageAltFromFocusKeyword,
  inContentImageFilenameFromFocusKeyword,
  inContentImageTitleFromFocusKeyword,
  insertFigureAfterH2,
} from "@/lib/overview/overview-blog-in-content-image-insert";
import { formatInContentImageResultMarkdown } from "@/lib/overview/overview-blog-in-content-image-harness-sections";
import { buildImagePrompt } from "@/lib/image-prompt-builder";
import { htmlBodyToMarkdownH2Projection, resolveForcedH2Section } from "@/lib/in-content-image-generator";
import { parseMarkdownSections } from "@/lib/section-parser";

describe("overview-blog-in-content-image-insert", () => {
  it("inserts figure after matching H2", () => {
    const html =
      "<h2>Intro</h2><p>a</p><h2>Best Blinds</h2><p>b</p><h2>FAQ</h2><p>c</p>";
    const figure = buildInContentImageFigureHtml({
      imageUrl: "https://example.com/x.png",
      alt: "blinds edmonton",
      mediaId: 42,
    });
    const next = insertFigureAfterH2(html, "Best Blinds", figure);
    expect(next).toContain("</h2>\n<figure");
    expect(next.indexOf("Best Blinds")).toBeLessThan(next.indexOf("wp-image-42"));
    expect(next.indexOf("wp-image-42")).toBeLessThan(next.indexOf("<h2>FAQ</h2>"));
    expect(next).toContain('alt="blinds edmonton"');
  });

  it("throws when H2 is missing", () => {
    expect(() =>
      insertFigureAfterH2("<h2>Only</h2><p>x</p>", "Missing", "<figure></figure>"),
    ).toThrow(/not found/i);
  });

  it("builds focus-keyword filename and alt", () => {
    expect(inContentImageFilenameFromFocusKeyword("Blinds Edmonton!")).toBe(
      "blinds-edmonton.png",
    );
    expect(inContentImageAltFromFocusKeyword("blinds edmonton", "Section")).toBe(
      "blinds edmonton",
    );
    expect(inContentImageTitleFromFocusKeyword("blinds edmonton", "Section")).toBe(
      "blinds edmonton - Section",
    );
  });
});

describe("htmlBodyToMarkdownH2Projection", () => {
  it("projects H2 sections to markdown", () => {
    const md = htmlBodyToMarkdownH2Projection(
      "<p>pre</p><h2>One</h2><p>alpha</p><h2>Two</h2><p>beta</p>",
    );
    expect(md).toContain("## One");
    expect(md).toContain("## Two");
    expect(md).toContain("alpha");
  });
});

describe("resolveForcedH2Section", () => {
  it("resolves exact and case-insensitive forced headings", () => {
    const md = htmlBodyToMarkdownH2Projection(
      "<h2>Intro</h2><p>a</p><h2>Best Blinds</h2><p>b</p>",
    );
    const sections = parseMarkdownSections(md);
    const exact = resolveForcedH2Section(sections, "Best Blinds");
    expect(exact.header).toBe("Best Blinds");
    expect(exact.content.toLowerCase()).toContain("b");

    const fuzzy = resolveForcedH2Section(sections, "best blinds");
    expect(fuzzy.header).toBe("Best Blinds");
  });

  it("throws when forced heading is missing", () => {
    const md = htmlBodyToMarkdownH2Projection("<h2>Only</h2><p>x</p>");
    const sections = parseMarkdownSections(md);
    expect(() => resolveForcedH2Section(sections, "Missing")).toThrow(/not found/i);
  });
});

describe("buildImagePrompt realisticBackground", () => {
  it("includes no-people/animals realistic contract when realisticBackground is true", () => {
    const prompt = buildImagePrompt(
      { flowTitle: "Blinds", flowPurpose: "Guide" },
      {
        includeText: false,
        includePeople: false,
        includeAnimals: false,
        includeCars: false,
        isInfographic: false,
        aspectRatio: "16:9",
        style: "professional",
        colorScheme: "vibrant",
        realisticBackground: true,
      },
    );
    expect(prompt.toLowerCase()).toContain("never depict people");
    expect(prompt.toLowerCase()).toContain("animals");
    expect(prompt.toLowerCase()).toContain("photorealistic");
    expect(prompt.toLowerCase()).toContain("absolutely no text");
  });

  it("adds short exclusion when people/animals false without realisticBackground", () => {
    const prompt = buildImagePrompt(
      { flowTitle: "Blinds", flowPurpose: "Guide" },
      {
        includeText: false,
        includePeople: false,
        includeAnimals: false,
        includeCars: false,
        isInfographic: false,
        aspectRatio: "16:9",
        style: "professional",
        colorScheme: "vibrant",
      },
    );
    expect(prompt).toContain("Do NOT include people or animals");
    expect(prompt.toLowerCase()).not.toContain("photorealistic background");
    expect(prompt.toLowerCase()).toContain("absolutely no text");
  });
});

describe("AI_GENERATED_IMAGE_DISCLAIMER", () => {
  it("uses clear hyphenated wording", async () => {
    const { AI_GENERATED_IMAGE_DISCLAIMER } = await import(
      "@/lib/images/ai-generated-image-disclaimer"
    );
    expect(AI_GENERATED_IMAGE_DISCLAIMER).toBe("This is an AI-generated image");
  });
});

describe("formatInContentImageResultMarkdown", () => {
  it("includes Action, Place, and Source site/page for peer reuse", () => {
    const md = formatInContentImageResultMarkdown({
      sectionHeader: "About 9 Ave SW",
      imageUrl: "https://blindmagic.com/wp-content/uploads/x.png",
      alt: "blinds 9 ave sw edmonton",
      action: "Reused peer image",
      entity: "9 Ave SW Edmonton",
      sourceSiteName: "Phoenix Finishing Touch Painting",
      sourcePageUrl: "https://phoenixpainting.ca/9-ave-sw/",
      referenceImageUrl: "https://phoenixpainting.ca/wp-content/uploads/painter-19.png",
    });
    expect(md).toContain("Action: Reused peer image");
    expect(md).toContain("Place: 9 Ave SW Edmonton");
    expect(md).toContain("Section: About 9 Ave SW");
    expect(md).toContain("Alt: blinds 9 ave sw edmonton");
    expect(md).toContain("URL: https://blindmagic.com/wp-content/uploads/x.png");
    expect(md).toContain("Source site: Phoenix Finishing Touch Painting");
    expect(md).toContain("Source page: https://phoenixpainting.ca/9-ave-sw/");
    expect(md).toContain(
      "Source image: https://phoenixpainting.ca/wp-content/uploads/painter-19.png",
    );
  });

  it("uses Generated from reference action for AI path", () => {
    const md = formatInContentImageResultMarkdown({
      sectionHeader: "Overview",
      imageUrl: "https://blindmagic.com/wp-content/uploads/ai.png",
      alt: "blinds edmonton",
      action: "Generated from reference",
      entity: "Stadium Station Edmonton",
      referenceImageUrl: "https://upload.wikimedia.org/example.jpg",
      referenceSourceUrl: "https://en.wikipedia.org/wiki/Stadium_Station",
    });
    expect(md).toContain("Action: Generated from reference");
    expect(md).toContain("Place: Stadium Station Edmonton");
    expect(md).toContain("Source page: https://en.wikipedia.org/wiki/Stadium_Station");
    expect(md).not.toContain("Source site:");
  });
});

describe("formatLocalImageBatchSummaryMarkdown", () => {
  it("rolls up found, generated, and skipped counts with per-row reports", async () => {
    const { formatLocalImageBatchSummaryMarkdown } = await import(
      "@/lib/overview/overview-blog-in-content-image-harness-sections"
    );
    const md = formatLocalImageBatchSummaryMarkdown({
      rows: [
        {
          url: "https://example.com/a",
          keyword: "blinds a",
          outcome: "found",
          reportMarkdown: "# In Content Image\n\nAction: Reused peer image",
        },
        {
          url: "https://example.com/b",
          keyword: "blinds b",
          outcome: "generated",
          reportMarkdown: "# In Content Image\n\nAction: Generated from reference",
        },
        {
          url: "https://example.com/c",
          keyword: "blinds c",
          outcome: "skipped",
          skipReason: "Skipped — Local Image already present on this page.",
        },
      ],
    });
    expect(md).toContain("# Local Image Summary");
    expect(md).toContain("Found (peer): 1");
    expect(md).toContain("Generated: 1");
    expect(md).toContain("Skipped: 1");
    expect(md).toContain("## 1. blinds a");
    expect(md).toContain("Outcome: found");
    expect(md).toContain("Action: Reused peer image");
    expect(md).toContain("Outcome: generated");
    expect(md).toContain("Reason: Skipped — Local Image already present on this page.");
  });
});
