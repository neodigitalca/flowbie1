import { describe, expect, it } from "vitest";
import {
  buildBulkBlogIdeasSystemPrompt,
  buildBulkBlogIdeasUserPrompt,
} from "@/lib/prompt-builders/bulk-ideas";

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

  it("locks a manually entered first-row keyword and does not distill it", () => {
    const slotKeyword = "Skyline Vs. Hunter Douglas Blinds";
    const systemPrompt = buildBulkBlogIdeasSystemPrompt(
      "",
      "",
      1,
      "blank",
      "",
      "per-blog",
      "",
      "",
      "",
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      "content_blog",
      undefined,
      [slotKeyword],
      [""],
    );
    const userPrompt = buildBulkBlogIdeasUserPrompt(
      "Generate 1 blog post ideas",
      1,
      "",
      undefined,
      ["hunter douglas blinds"],
      undefined,
      "content_blog",
      undefined,
      JSON.stringify({ gsc: ["hunter douglas blinds"], semrush: [] }),
      [slotKeyword],
    );

    expect(systemPrompt).toContain(`Keyword is locked to exactly "${slotKeyword}"`);
    expect(systemPrompt).toContain("Do not distill, shorten, reorder, or replace it");
    expect(systemPrompt).toContain("Do not paste this Keyword as Title");
    expect(systemPrompt).not.toContain("distill if longer");
    expect(userPrompt).toContain("MUST FOLLOW LAST");
    expect(userPrompt).toContain(`Keyword is locked to exactly "${slotKeyword}"`);
    expect(userPrompt).toContain("Do not paste a locked Keyword as Title");
    expect(userPrompt).toContain("USER KEYWORD SLOTS override this block");
    expect(userPrompt).toContain("Use GSC keywords from the system prompt ONLY for empty USER KEYWORD SLOTS");
    expect(userPrompt).toContain("not the Keyword pasted as the title");
  });
});
