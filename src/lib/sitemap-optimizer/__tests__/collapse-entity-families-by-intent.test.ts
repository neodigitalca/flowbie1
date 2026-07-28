import { describe, expect, it } from "vitest";
import {
  collapseEntityFamiliesByIntent,
  entityContentIntentKey,
} from "@/lib/sitemap-optimizer/collapse-entity-families-by-intent";
import { dedupeContentSheetRowsByIntent } from "@/lib/sitemap-optimizer/dedupe-content-sheet-by-destination";
import type { EntityRedirectPlan } from "@/lib/sitemap-optimizer/entity-redirect-plan-parse";
import type { SitemapOptimizerContentSheetRow } from "@/lib/sitemap-optimizer/types";

describe("entityContentIntentKey", () => {
  it("normalizes whitespace and case", () => {
    expect(entityContentIntentKey("Window Treatments  Edmonton", "Edmonton,  Alberta")).toBe(
      "window treatments edmonton||edmonton, alberta",
    );
  });

  it("returns empty when keyword or entity missing", () => {
    expect(entityContentIntentKey("", "Edmonton")).toBe("");
    expect(entityContentIntentKey("blinds", "")).toBe("");
  });
});

describe("collapseEntityFamiliesByIntent", () => {
  it("merges families that share keyword + entity into one destination", () => {
    const plan: EntityRedirectPlan = {
      families: [
        {
          familyId: "f1",
          destinationPostId: "wp:1",
          sourcePostIds: ["wp:1", "wp:10"],
          rationale: "street a",
          recommendedPrimaryKeyword: "window treatments Edmonton",
          recommendedTitle: "Window Treatments in Edmonton, Alberta",
          recommendedMeta: "Meta one.",
          sapEntity: "Edmonton, Alberta",
          sapModifier: "Also covers: 34 Avenue.",
          whatToKeepFromEach: [
            { url: "https://example.com/a/", title: "A", bullets: ["34 Ave"] },
          ],
        },
        {
          familyId: "f2",
          destinationPostId: "wp:2",
          sourcePostIds: ["wp:2", "wp:20", "wp:21"],
          rationale: "street b",
          recommendedPrimaryKeyword: "Window Treatments Edmonton",
          recommendedTitle: "Window Treatments in Edmonton, Alberta",
          recommendedMeta: "Meta two.",
          sapEntity: "edmonton, alberta",
          sapModifier: "Also covers: 66 Street.",
          whatToKeepFromEach: [
            { url: "https://example.com/b/", title: "B", bullets: ["66 St"] },
          ],
        },
        {
          familyId: "f3",
          destinationPostId: "wp:3",
          sourcePostIds: ["wp:3"],
          rationale: "other city",
          recommendedPrimaryKeyword: "window treatments Calgary",
          recommendedTitle: "Window Treatments in Calgary",
          recommendedMeta: "Meta three.",
          sapEntity: "Calgary, Alberta",
          sapModifier: "Also covers: Calgary.",
        },
      ],
    };

    const out = collapseEntityFamiliesByIntent(plan);
    expect(out.families).toHaveLength(2);

    const edmonton = out.families.find((f) =>
      f.recommendedPrimaryKeyword?.toLowerCase().includes("edmonton"),
    );
    expect(edmonton).toBeTruthy();
    expect(edmonton!.destinationPostId).toBe("wp:2");
    expect(edmonton!.sourcePostIds.sort()).toEqual(["wp:1", "wp:10", "wp:2", "wp:20", "wp:21"]);
    expect(edmonton!.whatToKeepFromEach).toHaveLength(2);

    const calgary = out.families.find((f) =>
      f.recommendedPrimaryKeyword?.toLowerCase().includes("calgary"),
    );
    expect(calgary?.familyId).toBe("f3");
  });
});

describe("dedupeContentSheetRowsByIntent", () => {
  it("collapses merge rows with the same keyword and entity", () => {
    const sheet: SitemapOptimizerContentSheetRow[] = [
      {
        postId: "wp:1",
        sourceUrl: "https://example.com/a/",
        proposedDestinationUrl: "https://example.com/a/",
        sourceTitle: "",
        action: "merge",
        priority: "high",
        proposedTitle: "Window Treatments in Edmonton, Alberta",
        proposedPrimaryKeyword: "window treatments Edmonton",
        proposedMeta: "Meta",
        bulkEntityLabel: "Edmonton, Alberta",
        mergeSourceCount: 2,
        mergeClusterId: "f1",
      },
      {
        postId: "wp:2",
        sourceUrl: "https://example.com/b/",
        proposedDestinationUrl: "https://example.com/b/",
        sourceTitle: "",
        action: "merge",
        priority: "high",
        proposedTitle: "Window Treatments in Edmonton, Alberta",
        proposedPrimaryKeyword: "window treatments Edmonton",
        proposedMeta: "Meta",
        bulkEntityLabel: "Edmonton, Alberta",
        mergeSourceCount: 3,
        mergeClusterId: "f2",
      },
    ];

    const out = dedupeContentSheetRowsByIntent(sheet);
    expect(out).toHaveLength(1);
    expect(out[0]?.mergeSourceCount).toBe(5);
  });
});
