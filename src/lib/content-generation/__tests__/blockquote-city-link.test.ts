import { describe, expect, it } from "vitest";
import {
  linkWikipediaEntityInBlockquotes,
  sanitizeContentForUpload,
} from "@/lib/content-generation/content-sanitizer";
import { findServiceAreaPageForPlace } from "@/lib/bulk/bulk-generation-wp-inventory";

describe("linkWikipediaEntityInBlockquotes", () => {
  it("does not prepend a leading cite when the entity string is not in the quote", () => {
    const html =
      "<blockquote><p>Eleanor is redecorating her Park Shore condo and needs new roller shades.</p></blockquote>";
    const out = linkWikipediaEntityInBlockquotes(
      html,
      "Park Shore, Naples, FL",
      "https://en.wikipedia.org/wiki/Park_Shore,_Florida",
    );
    expect(out).not.toContain("Park Shore, Naples, FL");
    expect(out).not.toMatch(/<blockquote><a /);
    expect(out).toContain("Eleanor is redecorating her Park Shore condo");
  });

  it("wraps the first in-quote mention when the entity string is present", () => {
    const html =
      "<blockquote><p>Park Shore, Naples, FL homeowners weigh salt air against fabric fade.</p></blockquote>";
    const out = linkWikipediaEntityInBlockquotes(
      html,
      "Park Shore, Naples, FL",
      "https://en.wikipedia.org/wiki/Park_Shore,_Florida",
    );
    expect(out).toContain(
      '<a href="https://en.wikipedia.org/wiki/Park_Shore,_Florida">Park Shore, Naples, FL</a>',
    );
    expect(out).toContain("homeowners weigh salt air");
  });
});

describe("findServiceAreaPageForPlace", () => {
  const posts = [
    {
      title: "Park Shore Window Treatments",
      link: "https://lindseyblindsetc.com/service-area/park-shore/",
      collection: "sap",
      postType: "service-area",
    },
    {
      title: "Hunter Douglas",
      link: "https://lindseyblindsetc.com/hunter-douglas/",
      collection: "pages",
      postType: "page",
    },
  ];

  it("returns the matching service-area page for a comma place label", () => {
    const hit = findServiceAreaPageForPlace(posts, "Park Shore, Naples, FL");
    expect(hit?.title).toBe("Park Shore Window Treatments");
    expect(hit?.link).toBe("https://lindseyblindsetc.com/service-area/park-shore/");
    expect(hit?.anchor).toBe("Park Shore");
  });
});

describe("sanitizeContentForUpload does not rewrite blockquotes", () => {
  it("does not prepend a Wikipedia place cite above the quote", () => {
    const html =
      "<blockquote><p>Eleanor is redecorating her Park Shore condo and needs new roller shades.</p></blockquote>";
    const out = sanitizeContentForUpload(
      html,
      "https://lindseyblindsetc.com",
      [],
      "https://en.wikipedia.org/wiki/Park_Shore,_Florida",
      undefined,
      "Park Shore, Naples, FL",
    );
    expect(out).not.toContain("Park Shore, Naples, FL");
    expect(out).not.toMatch(/<blockquote>\s*<a /);
    expect(out).toContain("Eleanor is redecorating her Park Shore condo");
  });
});

describe("sanitizeContentForUpload service-area inventory", () => {
  it("keeps an inventory service-area href inside a blockquote", () => {
    const html =
      '<blockquote><p>Eleanor is redecorating her <a href="https://lindseyblindsetc.com/service-area/park-shore/">Park Shore</a> condo.</p></blockquote>';
    const out = sanitizeContentForUpload(html, "https://lindseyblindsetc.com", [
      {
        id: 10,
        slug: "park-shore",
        title: "Park Shore Window Treatments",
        excerpt: "",
        link: "https://lindseyblindsetc.com/service-area/park-shore/",
        date_gmt: "2026-01-01",
      },
    ]);
    expect(out).toContain('href="https://lindseyblindsetc.com/service-area/park-shore/"');
    expect(out).toContain(">Park Shore<");
  });
});
