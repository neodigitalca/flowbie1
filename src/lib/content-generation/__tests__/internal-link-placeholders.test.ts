import { describe, expect, it, beforeEach } from "vitest";
import {
  resolveInternalLinkPlaceholdersInHtml,
  resolveInternalLinkPlaceholdersInMarkdown,
  INTERNAL_LINK_PLACEHOLDER_RE,
} from "../internal-link-placeholders";
import { setSiteCacheForTest, clearSiteCache } from "@/lib/wordpress-site-cache";

const SITE_ID = "placeholder-test-site";
const SITE_URL = "https://kwbllp.com";

const POSTS = [
  {
    id: 1,
    slug: "employment-expenses-checklist-canada",
    title: "Employment Expenses Checklist Canada",
    excerpt: "Checklist for employment expenses",
    link: "https://kwbllp.com/blog/employment-expenses-checklist-canada/",
    date_gmt: "2026-01-01",
  },
  {
    id: 2,
    slug: "alberta-productivity-grant",
    title: "Alberta Productivity Grant How To Apply",
    excerpt: "Grant program overview",
    link: "https://kwbllp.com/blog/alberta-productivity-grant/",
    date_gmt: "2026-01-02",
  },
  {
    id: 3,
    slug: "deductible-employment-expenses",
    title: "Deductible Employment Expenses Overview",
    excerpt: "employment expenses overview",
    link: "https://kwbllp.com/blog/deductible-employment-expenses/",
    date_gmt: "2026-01-03",
  },
];

describe("INTERNAL_LINK_PLACEHOLDER_RE", () => {
  it("matches multiple tokens", () => {
    const text =
      "See [[LINK:employment expenses|expense rules]] and [[LINK:Alberta productivity grant|productivity grant]].";
    const matches = [...text.matchAll(INTERNAL_LINK_PLACEHOLDER_RE)];
    expect(matches).toHaveLength(2);
  });
});

describe("resolveInternalLinkPlaceholdersInHtml", () => {
  beforeEach(() => {
    clearSiteCache(SITE_ID);
    setSiteCacheForTest(SITE_ID, SITE_URL, POSTS);
  });

  it("resolves placeholder to anchor tag via sitemap grep", () => {
    const html =
      "<p>Review [[LINK:employment expenses checklist|employment expense rules]] before filing.</p>";
    const out = resolveInternalLinkPlaceholdersInHtml(html, {
      siteId: SITE_ID,
      siteUrl: SITE_URL,
      wordPressPosts: POSTS,
    });
    expect(out).toContain(
      '<a href="https://kwbllp.com/blog/employment-expenses-checklist-canada/">employment expense rules</a>',
    );
    expect(out).not.toContain("[[LINK:");
    expect(out).toContain("Review ");
    expect(out).toContain(" before filing.");
  });

  it("skips self-link and uses next candidate", () => {
    const html = "<p>See [[LINK:employment expenses|expense guide]].</p>";
    const out = resolveInternalLinkPlaceholdersInHtml(html, {
      siteId: SITE_ID,
      siteUrl: SITE_URL,
      currentPageUrl: "https://kwbllp.com/blog/employment-expenses-checklist-canada/",
      wordPressPosts: POSTS,
    });
    expect(out).not.toContain("employment-expenses-checklist-canada");
    expect(out).not.toContain("[[LINK:");
    expect(out).toContain("deductible-employment-expenses");
  });

  it("strips unresolved token to anchor text only", () => {
    const html = "<p>Topic [[LINK:nonexistent xyzzy page|related topic]] here.</p>";
    const out = resolveInternalLinkPlaceholdersInHtml(html, {
      siteId: SITE_ID,
      siteUrl: SITE_URL,
      wordPressPosts: POSTS,
    });
    expect(out).toContain("related topic");
    expect(out).not.toContain("[[LINK:");
  });

  it("leaves Overview hash links untouched", () => {
    const html =
      '<div class="flo-overview"><a href="#section-one">cost factors</a></div><p>[[LINK:Alberta productivity|productivity grant]]</p>';
    const out = resolveInternalLinkPlaceholdersInHtml(html, {
      siteId: SITE_ID,
      siteUrl: SITE_URL,
      wordPressPosts: POSTS,
    });
    expect(out).toContain('href="#section-one"');
    expect(out).toContain("alberta-productivity-grant");
  });

  it("retries grep with anchor text when query has no match", () => {
    const html = "<p>See [[LINK:nonexistent xyzzy page|Alberta productivity grant]] for details.</p>";
    const out = resolveInternalLinkPlaceholdersInHtml(html, {
      siteId: SITE_ID,
      siteUrl: SITE_URL,
      wordPressPosts: POSTS,
    });
    expect(out).toContain(
      '<a href="https://kwbllp.com/blog/alberta-productivity-grant/">Alberta productivity grant</a>',
    );
    expect(out).not.toContain("[[LINK:");
  });

  it("picks next candidate when first URL is already used", () => {
    const html =
      "<p>[[LINK:employment expenses|expense guide]] and [[LINK:employment expenses|expense overview]].</p>";
    const out = resolveInternalLinkPlaceholdersInHtml(html, {
      siteId: SITE_ID,
      siteUrl: SITE_URL,
      wordPressPosts: POSTS,
    });
    expect(out).toContain("employment-expenses-checklist-canada");
    expect(out).toContain("deductible-employment-expenses");
    expect(out).not.toContain("[[LINK:");
  });
});

describe("resolveInternalLinkPlaceholdersInMarkdown", () => {
  beforeEach(() => {
    clearSiteCache(SITE_ID);
    setSiteCacheForTest(SITE_ID, SITE_URL, POSTS);
  });

  it("resolves to markdown link syntax", () => {
    const md = "Read [[LINK:Alberta productivity grant|productivity grant guide]] for details.";
    const out = resolveInternalLinkPlaceholdersInMarkdown(md, {
      siteId: SITE_ID,
      siteUrl: SITE_URL,
      wordPressPosts: POSTS,
    });
    expect(out).toContain(
      "[productivity grant guide](https://kwbllp.com/blog/alberta-productivity-grant/)",
    );
    expect(out).not.toContain("[[LINK:");
  });
});
