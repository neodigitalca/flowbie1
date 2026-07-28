import { describe, expect, it } from "vitest";
import { ensureWhatWeOfferTablePageLinks } from "../what-we-offer-table-page-links";

const pages = [
  {
    id: 1,
    slug: "motorized-shades",
    title: "Motorized Window Shades",
    excerpt: "",
    link: "https://example.com/motorized-shades/",
    date_gmt: "",
    postType: "page" as const,
  },
  {
    id: 2,
    slug: "motorized-blinds",
    title: "Motorized Blinds",
    excerpt: "",
    link: "https://example.com/motorized-blinds/",
    date_gmt: "",
    postType: "page" as const,
  },
];

describe("ensureWhatWeOfferTablePageLinks", () => {
  it("links Product Category cells to pages with title attributes", () => {
    const html = `<h2>What We Offer</h2><table><thead><tr><th>Product Category</th><th>Key Benefits</th></tr></thead><tbody><tr><td>Motorized Shades</td><td>Light control</td></tr><tr><td>Motorized Blinds</td><td>Precise slats</td></tr></tbody></table>`;

    const out = ensureWhatWeOfferTablePageLinks(
      html,
      pages,
      "https://example.com/north-kildonan/",
      "https://example.com",
    );

    expect(out).toContain('href="https://example.com/motorized-shades/"');
    expect(out).toContain('title="Motorized Window Shades"');
    expect(out).toContain('href="https://example.com/motorized-blinds/"');
    expect(out).toContain('title="Motorized Blinds"');
  });

  it("replaces non-pages-bucket table links with pages inventory URLs", () => {
    const html = `<table><thead><tr><th>Service/Product Name</th><th>Description</th></tr></thead><tbody><tr><td><a href="https://example.com/services/blinds/">Blind Repair</a></td><td>Fix blinds</td></tr></tbody></table>`;

    const out = ensureWhatWeOfferTablePageLinks(
      html,
      [
        {
          id: 10,
          slug: "about-us",
          title: "About Us",
          excerpt: "",
          link: "https://example.com/about-us/",
          date_gmt: "",
          postType: "page" as const,
        },
      ],
      "https://example.com/brooklands/",
      "https://example.com",
    );

    expect(out).toContain('href="https://example.com/about-us/"');
    expect(out).toContain('title="About Us"');
    expect(out).not.toContain("/services/blinds/");
  });
});
