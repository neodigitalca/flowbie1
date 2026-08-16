import { describe, expect, it } from "vitest";
import { csvRowToEntitySapOverviewRowDisplay } from "@/components/shared/bulk-details-row-display";

describe("csvRowToEntitySapOverviewRowDisplay", () => {
  it("shows entity in title column when title is empty", () => {
    const row = csvRowToEntitySapOverviewRowDisplay(
      { entity: "South West Altona, MB", keyword: "", title: "", meta: "", slug: "" },
      0,
    );
    expect(row.title).toBe("South West Altona, MB");
    expect(row.focusKeyword).toBe("");
  });

  it("prefers title over entity when both exist", () => {
    const row = csvRowToEntitySapOverviewRowDisplay(
      {
        entity: "South West Altona, MB",
        keyword: "blinds near me",
        title: "Custom Title",
        meta: "",
        slug: "",
      },
      0,
    );
    expect(row.title).toBe("Custom Title");
    expect(row.focusKeyword).toBe("blinds near me");
  });
});
