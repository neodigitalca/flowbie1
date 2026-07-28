import { describe, expect, it } from "vitest";
import {
  parseEntityRedirectPlanJson,
  pickRedirectPillarPostId,
  validateEntityRedirectPlanStrategy,
} from "@/lib/sitemap-optimizer/entity-redirect-plan-parse";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

describe("entity redirect plan parse", () => {
  it("keeps family when destinationPostId is wrong but sourcePostIds are valid", () => {
    const rows: SitemapOptimizerPostRow[] = [
      {
        postId: "wp:7717",
        url: "https://example.com/a/",
        collection: "entity",
        title: "a",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscPageClicks: 1,
        gscPageImpressions: 10,
        gscQueries: [],
        gscFetched: true,
      },
      {
        postId: "wp:7897",
        url: "https://example.com/service-area/edmonton-seo-beaumaris/",
        collection: "entity",
        title: "b",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscPageClicks: 5,
        gscPageImpressions: 50,
        gscQueries: [],
        gscFetched: true,
      },
    ];
    const rowById = new Map(rows.map((r) => [r.postId, r]));
    const json = JSON.stringify({
      families: [
        {
          destinationPostId: "wp:7822",
          sourcePostIds: ["wp:7717", "wp:7897"],
          recommendedPrimaryKeyword: "local seo services",
          recommendedTitle: "Title",
          recommendedMeta: "Meta description for the consolidated page.",
          sapEntity: "Beaumaris, Edmonton",
          sapModifier: "Brief",
          combinedOutline: ["H2 one", "H2 two"],
          whatToKeepFromEach: [
            { url: "https://example.com/a/", title: "a", bullets: ["x"] },
            { url: "https://example.com/b/", title: "b", bullets: ["y"] },
          ],
          rationale: "Grouped",
        },
      ],
    });
    const plan = parseEntityRedirectPlanJson(json, ["wp:7717", "wp:7897"], rowById);
    expect(plan?.families).toHaveLength(1);
    expect(plan?.families[0]?.destinationPostId).toBe(
      pickRedirectPillarPostId(["wp:7717", "wp:7897"], rowById),
    );
    expect(plan?.families[0]?.destinationPostId).toBe("wp:7897");
    expect(plan?.families[0]?.sapEntity).toBe("Beaumaris, Edmonton");
    expect(validateEntityRedirectPlanStrategy(plan!)).toBe(true);
  });

  it("never picks a numbered-slug duplicate as pillar when a non-duplicate exists", () => {
    const rows: SitemapOptimizerPostRow[] = [
      {
        postId: "wp:1",
        url: "https://example.com/service-area/window-shades-altamonte-springs-2/",
        collection: "entity",
        title: "clone",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscPageClicks: 50,
        gscPageImpressions: 500,
        gscQueries: [],
        gscFetched: true,
      },
      {
        postId: "wp:2",
        url: "https://example.com/service-area/window-shades-altamonte-springs/",
        collection: "entity",
        title: "canonical",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscPageClicks: 1,
        gscPageImpressions: 10,
        gscQueries: [],
        gscFetched: true,
      },
    ];
    const rowById = new Map(rows.map((r) => [r.postId, r]));
    expect(pickRedirectPillarPostId(["wp:1", "wp:2"], rowById)).toBe("wp:2");

    const json = JSON.stringify({
      families: [
        {
          destinationPostId: "wp:1",
          sourcePostIds: ["wp:1", "wp:2"],
          rationale: "Grouped",
        },
      ],
    });
    const plan = parseEntityRedirectPlanJson(json, ["wp:1", "wp:2"], rowById);
    expect(plan?.families[0]?.destinationPostId).toBe("wp:2");
  });

  it("resolves bare numeric postIds and splits oversized families", () => {
    const rows: SitemapOptimizerPostRow[] = Array.from({ length: 6 }, (_, i) => ({
      postId: `wp:${100 + i}`,
      url: `https://example.com/service-area/edmonton-seo-place-${i}/`,
      collection: "entity" as const,
      title: `Place ${i}`,
      keyword: "",
      meta: "",
      contentSnippet: "",
      gscPageClicks: i,
      gscPageImpressions: i * 10,
      gscQueries: [],
      gscFetched: true,
    }));
    const allowed = rows.map((r) => r.postId);
    const rowById = new Map(rows.map((r) => [r.postId, r]));
    const json = JSON.stringify({
      families: [
        {
          destinationPostId: "105",
          sourcePostIds: ["100", "101", "102", "103", "104", "105"],
          recommendedPrimaryKeyword: "local seo",
          recommendedTitle: "Title",
          recommendedMeta: "Meta description for the consolidated page.",
          sapEntity: "Griesbach, Edmonton",
          sapModifier: "Brief",
          combinedOutline: ["H2 one", "H2 two"],
          whatToKeepFromEach: rows.map((r) => ({
            url: r.url,
            title: r.title,
            bullets: ["x"],
          })),
          rationale: "Grouped",
        },
      ],
    });
    const plan = parseEntityRedirectPlanJson(json, allowed, rowById);
    expect(plan?.families).toHaveLength(2);
    expect(plan?.families.flatMap((f) => f.sourcePostIds).sort()).toEqual(allowed.sort());
  });

  it("keeps unassigned ids when families overlap", () => {
    const rows: SitemapOptimizerPostRow[] = [
      {
        postId: "wp:1",
        url: "https://example.com/a/",
        collection: "entity",
        title: "a",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscPageClicks: 1,
        gscPageImpressions: 10,
        gscQueries: [],
        gscFetched: true,
      },
      {
        postId: "wp:2",
        url: "https://example.com/b/",
        collection: "entity",
        title: "b",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscPageClicks: 0,
        gscPageImpressions: 0,
        gscQueries: [],
        gscFetched: true,
      },
      {
        postId: "wp:3",
        url: "https://example.com/c/",
        collection: "entity",
        title: "c",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscPageClicks: 0,
        gscPageImpressions: 0,
        gscQueries: [],
        gscFetched: true,
      },
    ];
    const allowed = rows.map((r) => r.postId);
    const rowById = new Map(rows.map((r) => [r.postId, r]));
    const json = JSON.stringify({
      families: [
        {
          destinationPostId: "wp:1",
          sourcePostIds: ["wp:1", "wp:2"],
          recommendedPrimaryKeyword: "local seo",
          recommendedTitle: "Title one",
          recommendedMeta: "Meta one",
          sapEntity: "Alpha, Edmonton",
          sapModifier: "Brief one",
          combinedOutline: ["H2"],
          whatToKeepFromEach: [
            { url: "https://example.com/a/", title: "a", bullets: ["x"] },
            { url: "https://example.com/b/", title: "b", bullets: ["y"] },
          ],
          rationale: "First",
        },
        {
          destinationPostId: "wp:2",
          sourcePostIds: ["wp:2", "wp:3"],
          recommendedPrimaryKeyword: "seo services",
          recommendedTitle: "Title two",
          recommendedMeta: "Meta two",
          sapEntity: "Beta, Edmonton",
          sapModifier: "Brief two",
          combinedOutline: ["H2"],
          whatToKeepFromEach: [
            { url: "https://example.com/b/", title: "b", bullets: ["y"] },
            { url: "https://example.com/c/", title: "c", bullets: ["z"] },
          ],
          rationale: "Second",
        },
      ],
    });
    const plan = parseEntityRedirectPlanJson(json, allowed, rowById);
    expect(plan?.families.flatMap((f) => f.sourcePostIds).sort()).toEqual(allowed.sort());
  });
});
