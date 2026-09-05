import { describe, expect, it } from "vitest";
import { buildBulkBlogIdeasUserPrompt } from "@/lib/prompt-builders/bulk-ideas";

describe("bulk ideas GSC + inventory ideation", () => {
  it("instructs AI to pick net-new keywords from SITE_KW_JSON when no pre-selected list", () => {
    const siteKw = JSON.stringify({ gsc: ["national seo", "seo audit edmonton"], semrush: [] });
    const inventory = JSON.stringify({
      posts: [
        {
          slug: "national-seo-canada",
          title: "National SEO Strategy: Expanding Your Reach Across Canada",
          link: "https://example.com/blog/national-seo-canada/",
        },
      ],
    });

    const prompt = buildBulkBlogIdeasUserPrompt(
      "Fill content gaps",
      3,
      "",
      inventory,
      undefined,
      undefined,
      "content_blog",
      {
        posts: { json: inventory, rowCount: 1 },
        pages: { json: "", rowCount: 0 },
        sap: { json: "", rowCount: 0 },
      },
      siteKw,
    );

    expect(prompt).toContain("SITE_KW_JSON");
    expect(prompt).toContain("SKIP lines that match existing topics");
    expect(prompt).toContain("national-seo-canada");
    expect(prompt).toContain("Never copy an existing inventory title");
    expect(prompt).not.toContain("Use GSC keywords from the system prompt in order");
  });
});
