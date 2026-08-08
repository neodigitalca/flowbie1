import { describe, expect, it } from "vitest";
import { integrateOrphanInternalLinksInHtml } from "../integrate-orphan-internal-links";

const SITE_URL = "https://dental.example.com";
const HREF = "https://dental.example.com/blog/dental-crown-benefits/";

describe("integrateOrphanInternalLinksInHtml", () => {
  it("weaves orphan link paragraph into earlier body copy when anchor phrase exists", () => {
    const html = [
      "<p>Dental crowns offer multiple advantages for your smile restoration.</p>",
      "<p>Our team ensures a precise fit for every patient.</p>",
      `<p><a href="${HREF}">dental crowns offer multiple advantages</a></p>`,
    ].join("");

    const out = integrateOrphanInternalLinksInHtml(html, { siteUrl: SITE_URL });

    expect(out).toContain(`<a href="${HREF}">Dental crowns offer multiple advantages</a>`);
    expect(out).not.toMatch(/<p>\s*<a[^>]+>dental crowns offer multiple advantages<\/a>\s*<\/p>/i);
    expect(out).toContain("Our team ensures a precise fit");
  });

  it("removes orphan link paragraph when anchor phrase is not found in body", () => {
    const html = [
      "<p>Overview of restorative dentistry options.</p>",
      `<p><a href="${HREF}">Benefits of Dental Crowns for Your Smile</a></p>`,
    ].join("");

    const out = integrateOrphanInternalLinksInHtml(html, { siteUrl: SITE_URL });

    expect(out).not.toContain("Benefits of Dental Crowns for Your Smile");
    expect(out).not.toContain(HREF);
    expect(out).toContain("Overview of restorative dentistry");
  });

  it("leaves Overview hash links untouched", () => {
    const html =
      '<div class="flo-overview"><p><a href="#section-one">cost factors</a></p></div>' +
      "<p>Learn about dental crown benefits during your visit.</p>" +
      `<p><a href="${HREF}">dental crown benefits</a></p>`;

    const out = integrateOrphanInternalLinksInHtml(html, { siteUrl: SITE_URL });

    expect(out).toContain('href="#section-one"');
    expect(out).toContain(`<a href="${HREF}">dental crown benefits</a>`);
    expect(out).not.toMatch(/<p>\s*<a[^>]+>dental crown benefits<\/a>\s*<\/p>/i);
  });

  it("strips surviving [[LINK:...]] placeholders", () => {
    const html = "<p>Topic [[LINK:nonexistent page|related topic]] here.</p>";
    const out = integrateOrphanInternalLinksInHtml(html, { siteUrl: SITE_URL });
    expect(out).toContain("related topic");
    expect(out).not.toContain("[[LINK:");
  });
});
