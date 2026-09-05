import { describe, expect, it } from "vitest";
import {
  buildLinkTargetQueries,
  buildLinkTargetsPlanFromMatches,
  linkRowsToCatalogItems,
} from "@/lib/overview/overview-content-link-targets-harness-run";

describe("overview-content-link-targets-harness-run", () => {
  const catalog = linkRowsToCatalogItems([
    {
      id: 1,
      slug: "powerview",
      title: "PowerView Automation",
      excerpt: "",
      link: "https://example.com/operating-systems/powerview-automation/",
      date_gmt: "",
      postType: "page",
    },
    {
      id: 2,
      slug: "motorized",
      title: "Motorized Blinds Vs Manual",
      excerpt: "",
      link: "https://example.com/blog/motorized-blinds-vs-manual/",
      date_gmt: "",
      postType: "post",
    },
  ]);

  it("builds page, blog, and related queries per section plus one global page query", () => {
    const queries = buildLinkTargetQueries({
      primaryKeyword: "Smart Blinds",
      bodySectionTitles: ["Upgrade Your Home", "Compare Features"],
    });
    expect(queries.filter((q) => q.id.startsWith("section-0-")).length).toBe(3);
    expect(queries.some((q) => q.id === "section-0-page")).toBe(true);
    expect(queries.some((q) => q.id === "section-0-blog")).toBe(true);
    expect(queries.some((q) => q.id === "section-0-related")).toBe(true);
    expect(queries.some((q) => q.id === "global-page")).toBe(true);
    expect(queries.length).toBe(7);
  });

  it("builds plan from intent match URLs by bucket", () => {
    const queries = buildLinkTargetQueries({
      primaryKeyword: "Smart Blinds",
      bodySectionTitles: ["Upgrade Your Home"],
    });
    const urlByQueryId = new Map<string, string>([
      ["section-0-page", "https://example.com/operating-systems/powerview-automation/"],
      ["section-0-blog", "https://example.com/blog/motorized-blinds-vs-manual/"],
    ]);
    const plan = buildLinkTargetsPlanFromMatches({ catalog, queries, urlByQueryId });
    expect(plan.pageTargets.length).toBe(1);
    expect(plan.blogTargets.length).toBe(1);
    expect(plan.pageTargets[0]?.suggestedAnchor).toBe("PowerView Automation");
  });

  it("throws when pages exist but no page targets matched", () => {
    const queries = buildLinkTargetQueries({
      primaryKeyword: "Smart Blinds",
      bodySectionTitles: ["Compare Features"],
    });
    const urlByQueryId = new Map<string, string>([
      ["section-0-blog", "https://example.com/blog/motorized-blinds-vs-manual/"],
    ]);
    expect(() => buildLinkTargetsPlanFromMatches({ catalog, queries, urlByQueryId })).toThrow(
      /no page targets/i,
    );
  });
});
