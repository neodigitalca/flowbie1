import { describe, expect, it } from "vitest";
import { applySingleLinkAdd } from "@/lib/overview/overview-blog-links-apply-local";
import { findPhraseOutsideTags, plainVisibleTextFromHtml } from "@/lib/overview/overview-blog-links-extract";

describe("HTML entity phrase matching", () => {
  const block = "<p>Understanding the Canadian Entrepreneurs&#8217; Incentive with KWB</p>";

  it("decodes entities in plain visible text", () => {
    expect(plainVisibleTextFromHtml(block)).toBe(
      "Understanding the Canadian Entrepreneurs' Incentive with KWB",
    );
  });

  it("finds anchor when OR uses curly apostrophe", () => {
    const hit = findPhraseOutsideTags(block, "Canadian Entrepreneurs\u2019 Incentive");
    expect(hit).not.toBeNull();
    expect(block.slice(hit!.start, hit!.start + hit!.length)).toBe("Canadian Entrepreneurs&#8217; Incentive");
  });

  it("wraps entity apostrophe in link", () => {
    const { result } = applySingleLinkAdd(
      block,
      0,
      "Canadian Entrepreneurs\u2019 Incentive",
      "https://kwbllp.com/blog/canadian-entrepreneurs-incentive/",
    );
    expect(result.ok).toBe(true);
    expect(result.anchor).toBe("Canadian Entrepreneurs&#8217; Incentive");
  });
});
