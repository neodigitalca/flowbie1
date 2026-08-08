import { describe, expect, it } from "vitest";
import {
  buildCompetitorBulkRows,
  competitorRowsToCsvContent,
} from "@/components/competitor-generation/csv/competitor-rows";

describe("competitor-rows", () => {
  it("builds bulk rows with competitor name as entity", () => {
    const rows = buildCompetitorBulkRows(
      [
        {
          keyword: "blinds near me",
          entity: "Ambiance Shades & Blinds",
          title: "Ambiance Shades & Blinds and blinds near me: what to compare",
          modifier: '{"serviceComparison":[]}',
          featuredImage: "google-maps",
        },
      ],
      { titleFormat: "{entity} and {keyword}", keyword: "blinds near me", siteName: "Our Site" },
    );
    expect(rows[0]?.entity).toBe("Ambiance Shades & Blinds");
    expect(rows[0]?.featuredImage).toBe("google-maps");
  });

  it("defaults featuredImage to n when unset", () => {
    const rows = buildCompetitorBulkRows(
      [
        {
          keyword: "blinds near me",
          entity: "Linh's Window Fashions",
          title: "Compare Linh's",
          modifier: "brief",
        },
      ],
      { titleFormat: "{entity} and {keyword}", keyword: "blinds near me" },
    );
    expect(rows[0]?.featuredImage).toBe("n");
  });

  it("exports standard bulk CSV columns", () => {
    const csv = competitorRowsToCsvContent([
      {
        keyword: "blinds near me",
        entity: "Test Co",
        title: "Compare Test Co",
        modifier: "brief",
        featuredImage: "google-maps",
      },
    ]);
    expect(csv.split("\n")[0]).toBe("keyword,entity,title,modifier,featuredImage");
    expect(csv).toContain('"Test Co"');
  });
});
