import { describe, expect, it } from "vitest";
import { computeBlogLinksBudget, WORDS_PER_LINK_ADD } from "@/lib/overview/overview-blog-links-budget";
import {
  applyBlogLinksPlanLocally,
  verifyLocalLinksApply,
} from "@/lib/overview/overview-blog-links-apply-local";
import {
  countVisibleWordsInHtml,
  extractInternalLinksFromHtml,
  paragraphHtmlForInternalLink,
} from "@/lib/overview/overview-blog-links-extract";

const SITE = "https://example.com";

describe("countVisibleWordsInHtml", () => {
  it("strips tags and counts words", () => {
    const html = "<p>One two three</p><p>four five</p>";
    expect(countVisibleWordsInHtml(html)).toBe(5);
  });
});

describe("computeBlogLinksBudget", () => {
  it("adds max of section headings and 1 per 100 words — ignores existing links", () => {
    const words = Array.from({ length: 284 }, (_, i) => `w${i}`).join(" ");
    const html = `<h2>One</h2><p>${words}</p><h3>Two</h3>`;
    const budget = computeBlogLinksBudget(html);
    expect(budget.sectionHeadings).toBe(2);
    expect(budget.linksToAdd).toBe(Math.max(2, Math.ceil(budget.wordCount / WORDS_PER_LINK_ADD)));
  });
});

describe("extractInternalLinksFromHtml", () => {
  it("returns ordered internal links with anchors", () => {
    const html =
      '<p>See <a href="/post-a/">first link</a> and <a href="https://example.com/post-b">second</a>.</p>';
    const links = extractInternalLinksFromHtml(html, SITE);
    expect(links).toHaveLength(2);
    expect(links[0]?.anchor).toBe("first link");
    expect(links[1]?.anchor).toBe("second");
  });

  it("excludes self URL", () => {
    const html = '<a href="https://example.com/current/">self</a><a href="/other/">other</a>';
    const links = extractInternalLinksFromHtml(html, SITE, "https://example.com/current/");
    expect(links).toHaveLength(1);
    expect(links[0]?.anchor).toBe("other");
  });

  it("returns full paragraph html for a link inside p", () => {
    const html =
      '<div><p>Intro text <a href="https://example.com/old/">tax tips</a> for business.</p></div>';
    const para = paragraphHtmlForInternalLink(html, 0, SITE);
    expect(para).toContain("<p>");
    expect(para).toContain("tax tips");
    expect(para).toContain("for business");
  });
});

describe("applyBlogLinksPlanLocally", () => {
  it("replaces all three links in sequence", () => {
    const html = [
      '<p><a href="https://example.com/year-end-reporting/personal-tax-returns/">This article is an</a> overview.</p>',
      '<p>Read more <a href="https://example.com/2016/08/23/top-7-overlooked-tax-deductions/0">here</a>.</p>',
      '<p><a href="https://example.com/consultation/">Schedule an introductory meeting</a> today.</p>',
    ].join("");
    const existing = extractInternalLinksFromHtml(html, SITE);
    const { updatedHtml, replacements } = applyBlogLinksPlanLocally(
      html,
      {
        linkActions: [
          { action: "replace", index: 0, proposedUrl: "https://example.com/blog/tax-season-2026/", rationale: "" },
          { action: "replace", index: 1, proposedUrl: "https://example.com/blog/maximize-tax-deductions/", rationale: "" },
          { action: "replace", index: 2, proposedUrl: "https://example.com/blog/need-an-accountant/", rationale: "" },
        ],
      },
      existing,
      SITE,
    );
    expect(replacements.every((r) => r.ok)).toBe(true);
    expect(updatedHtml).toContain("blog/tax-season-2026");
    expect(updatedHtml).toContain("blog/maximize-tax-deductions");
    expect(updatedHtml).toContain("blog/need-an-accountant");
    expect(verifyLocalLinksApply(html, updatedHtml, SITE, undefined, { adds: 0, replacements: 3 })).toEqual({ ok: true });
  });

  it("replaces href by index without changing anchor", () => {
    const html = '<p><a href="https://example.com/old-post/">tax tips</a></p>';
    const existing = extractInternalLinksFromHtml(html, SITE);
    const { updatedHtml, finalLinks, replacements } = applyBlogLinksPlanLocally(
      html,
      {
        linkActions: [
          { action: "replace", index: 0, proposedUrl: "https://example.com/new-post/", rationale: "" },
        ],
      },
      existing,
      SITE,
    );
    expect(replacements[0]?.ok).toBe(true);
    expect(updatedHtml).toContain('href="https://example.com/new-post/"');
    expect(updatedHtml).toContain(">tax tips</a>");
    expect(finalLinks[0]?.normalizedHref).toBe("https://example.com/new-post");
    expect(verifyLocalLinksApply(html, updatedHtml, SITE)).toEqual({ ok: true });
  });

  it("skips when proposed URL equals current", () => {
    const html = '<a href="https://example.com/same/">anchor</a>';
    const existing = extractInternalLinksFromHtml(html, SITE);
    const { updatedHtml, replacements } = applyBlogLinksPlanLocally(
      html,
      {
        linkActions: [
          { action: "replace", index: 0, proposedUrl: "https://example.com/same", rationale: "" },
        ],
      },
      existing,
      SITE,
    );
    expect(replacements[0]?.ok).toBe(false);
    expect(updatedHtml).toBe(html);
  });

  it("adds link by wrapping GSC-style anchor phrase in paragraph", () => {
    const html = "<p>Learn about tax deductions for small business owners today.</p>";
    const { updatedHtml, additions, finalLinks } = applyBlogLinksPlanLocally(
      html,
      {
        linkActions: [
          {
            action: "add",
            paragraphIndex: 0,
            anchorText: "tax deductions",
            proposedUrl: "https://example.com/tax-guide/",
            rationale: "",
          },
        ],
      },
      [],
      SITE,
    );
    expect(additions[0]?.ok).toBe(true);
    expect(updatedHtml).toContain('<a href="https://example.com/tax-guide/">tax deductions</a>');
    expect(finalLinks).toHaveLength(1);
    expect(verifyLocalLinksApply(html, updatedHtml, SITE, undefined, { adds: 1, replacements: 0 })).toEqual({
      ok: true,
    });
  });

  it("skips external anchors when indexing internal links", () => {
    const html =
      '<p><a href="https://other.com/page">External</a> <a href="https://example.com/old/">tax tips</a></p>';
    const existing = extractInternalLinksFromHtml(html, SITE);
    const { updatedHtml, replacements } = applyBlogLinksPlanLocally(
      html,
      {
        linkActions: [
          { action: "replace", index: 0, proposedUrl: "https://example.com/blog/new/", rationale: "" },
        ],
      },
      existing,
      SITE,
    );
    expect(replacements[0]?.ok).toBe(true);
    expect(updatedHtml).toContain('href="https://example.com/blog/new/"');
    expect(updatedHtml).toContain("other.com/page");
  });

  it("ignores invalid replace index on empty link list", () => {
    const html = "<p>No links here.</p>";
    const { updatedHtml, replacements } = applyBlogLinksPlanLocally(
      html,
      {
        linkActions: [{ action: "replace", index: 0, proposedUrl: "https://example.com/x/", rationale: "" }],
      },
      [],
      SITE,
    );
    expect(replacements).toHaveLength(0);
    expect(updatedHtml).toBe(html);
  });
});
