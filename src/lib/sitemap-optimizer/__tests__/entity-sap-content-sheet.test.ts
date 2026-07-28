import { describe, expect, it } from "vitest";
import { buildContentSheetRows } from "@/lib/sitemap-optimizer/build-content-sheet-rows";
import type { SitemapOptimizerRunResult } from "@/lib/sitemap-optimizer/types";
import {
  buildContentSheetBulkTemplateCsv,
  contentSheetToBulkTemplateObjects,
} from "@/lib/sitemap-optimizer/content-sheet-bulk-export";

describe("entity SAP content sheet", () => {
  it("uses AI sapModifier and bulkEntityLabel instead of template merge brief", () => {
    const rows = [
      {
        postId: "wp:1",
        url: "https://example.com/service-area/camrose-blinds/",
        collection: "service-area",
        title: "Camrose Blinds",
        keyword: "",
        meta: "",
        contentSnippet: "",
        gscQueries: [],
        gscFetched: true,
      },
    ];
    const clusters = {
      clusters: [
        {
          clusterId: "entity-singleton-wp:1",
          label: "Camrose",
          intent: "local",
          memberPostIds: ["wp:1"],
          confidence: "high" as const,
          rationale: "",
        },
      ],
      singletons: [] as string[],
    };
    const merges = [
      {
        clusterId: "entity-singleton-wp:1",
        recommendedTitle: "Hunter Douglas Blinds Near Camrose, AB",
        recommendedPrimaryKeyword: "hunter douglas blinds",
        recommendedMeta: "Custom Hunter Douglas blinds and shades with in-home consultation in Camrose.",
        sapEntity: "Downtown Camrose, Camrose, AB",
        sapModifier: "Emphasize in-home measuring and motorized shade options.",
        combinedOutline: ["Local overview", "Products", "Service area"],
        whatToKeepFromEach: [
          { url: "https://example.com/service-area/camrose-blinds/", title: "Camrose Blinds", bullets: ["Local blinds"] },
        ],
        redirectOrCanonicalNote: "",
        priority: "high" as const,
        confidence: "high" as const,
        rationale: "Consolidate thin local page.",
        lockedDestinationUrl: "https://example.com/service-area/hunter-douglas-blinds-near-camrose/",
      },
    ];

    const sheet = buildContentSheetRows({
      rows,
      clusters,
      merges,
      minClusterMembers: 1,
      entityMode: true,
    });

    expect(sheet[0]?.modifier).toBe("Emphasize in-home measuring and motorized shade options.");
    expect(sheet[0]?.modifier).not.toContain("Search intent");
    expect(sheet[0]?.bulkEntityLabel).toBe("Downtown Camrose, Camrose, AB");

    const result = {
      runMode: "wordpress" as const,
      entityPrimary: true,
      rows,
      clusters,
      merges,
      contentSheet: sheet,
      gscMissCount: 0,
      dateRange: { startDate: "2026-01-01", endDate: "2026-01-31" },
      analyzedAt: "2026-01-31T00:00:00.000Z",
    } satisfies SitemapOptimizerRunResult;

    const objects = contentSheetToBulkTemplateObjects(result);
    expect(objects[0]?.entity).toBe("Downtown Camrose, Camrose, AB");
    expect(objects[0]?.featuredImage).toBe("google-maps");

    const csv = buildContentSheetBulkTemplateCsv(result);
    expect(csv).toContain("google-maps");
    expect(csv).not.toContain("Search intent");
  });
});
