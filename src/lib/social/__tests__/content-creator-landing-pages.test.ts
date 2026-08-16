import { describe, expect, it } from "vitest";
import { isContentCreatorExcludedLandingPage } from "@/lib/social/content-creator-landing-pages";

describe("isContentCreatorExcludedLandingPage", () => {
  it("excludes careers, thank-you, and elementor help pages", () => {
    expect(
      isContentCreatorExcludedLandingPage({ url: "https://neodigital.ca/careers/" }),
    ).toBe(true);
    expect(
      isContentCreatorExcludedLandingPage({ url: "https://neodigital.ca/thank-you/" }),
    ).toBe(true);
    expect(
      isContentCreatorExcludedLandingPage({
        url: "https://neodigital.ca/elementor-help/something/",
      }),
    ).toBe(true);
    expect(
      isContentCreatorExcludedLandingPage({
        url: "https://neodigital.ca/?elementor_library=search-popup",
      }),
    ).toBe(true);
  });

  it("keeps main service pages and blog posts", () => {
    expect(
      isContentCreatorExcludedLandingPage({
        url: "https://neodigital.ca/website-design/",
        title: "Website Design",
      }),
    ).toBe(false);
    expect(
      isContentCreatorExcludedLandingPage({
        url: "https://neodigital.ca/window-coverings/edmonton/",
        title: "Window Coverings Edmonton",
      }),
    ).toBe(false);
    expect(
      isContentCreatorExcludedLandingPage({
        url: "https://neodigital.ca/blog/local-seo-tips/",
        title: "Local SEO Tips",
      }),
    ).toBe(false);
  });

  it("excludes bare blog hub but keeps nested blog posts via utility filter", () => {
    expect(isContentCreatorExcludedLandingPage({ url: "https://neodigital.ca/blog/" })).toBe(
      true,
    );
  });
});
