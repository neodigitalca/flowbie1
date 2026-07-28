import { describe, expect, it } from "vitest";
import {
  filterOverviewUtilityInventoryRows,
  filterOverviewUtilityUrls,
  isOverviewUtilityPage,
} from "@/lib/overview/overview-utility-page-filter";

describe("overview-utility-page-filter", () => {
  it("flags privacy policy and TOC pages", () => {
    expect(
      isOverviewUtilityPage({
        url: "https://example.com/privacy-policy/",
        slug: "privacy-policy",
        title: "Privacy Policy",
      }),
    ).toBe(true);
    expect(
      isOverviewUtilityPage({
        url: "https://example.com/table-of-contents/",
        slug: "table-of-contents",
        title: "Table of Contents",
      }),
    ).toBe(true);
  });

  it("flags terms-conditions and other legal/nav hub pages from real sites", () => {
    expect(
      isOverviewUtilityPage({
        url: "https://advanceblindsanddrapery.com/terms-conditions/",
        title: "Terms &amp; Conditions",
      }),
    ).toBe(true);
    expect(
      isOverviewUtilityPage({ url: "https://advanceblindsanddrapery.com/contact/" }),
    ).toBe(true);
    expect(
      isOverviewUtilityPage({ url: "https://advanceblindsanddrapery.com/faq/" }),
    ).toBe(true);
    expect(
      isOverviewUtilityPage({ url: "https://advanceblindsanddrapery.com/blog/" }),
    ).toBe(true);
    expect(
      isOverviewUtilityPage({ url: "https://advanceblindsanddrapery.com/promotion/" }),
    ).toBe(true);
    expect(
      isOverviewUtilityPage({ url: "https://advanceblindsanddrapery.com/service-area/" }),
    ).toBe(true);
  });

  it("keeps nested location and service pages", () => {
    expect(
      isOverviewUtilityPage({
        url: "https://advanceblindsanddrapery.com/locations/plum-coulee/",
        title: "Plum Coulee, MB",
      }),
    ).toBe(false);
    expect(
      isOverviewUtilityPage({
        url: "https://advanceblindsanddrapery.com/services/custom-drapery/",
        title: "Drapery Repair",
      }),
    ).toBe(false);
  });

  it("keeps service pages", () => {
    expect(
      isOverviewUtilityPage({
        url: "https://example.com/motorized-blinds/",
        slug: "motorized-blinds",
        title: "Motorized Blinds",
      }),
    ).toBe(false);
  });

  it("filters utility rows from pages inventory", () => {
    const rows = filterOverviewUtilityInventoryRows([
      {
        url: "https://example.com/privacy-policy/",
        slug: "privacy-policy",
        collection: "pages",
        fields: { title: "Privacy Policy" },
      },
      {
        url: "https://example.com/services/",
        slug: "services",
        collection: "pages",
        fields: { title: "Services" },
      },
      {
        url: "https://example.com/blog/post/",
        slug: "post",
        collection: "posts",
        fields: { title: "Blog Post" },
      },
    ]);
    expect(rows.map((r) => r.slug)).toEqual(["services", "post"]);
  });

  it("filters utility URLs from sitemap scrape lists", () => {
    expect(
      filterOverviewUtilityUrls([
        "https://example.com/privacy-policy/",
        "https://example.com/about/",
      ]),
    ).toEqual(["https://example.com/about/"]);
  });
});
