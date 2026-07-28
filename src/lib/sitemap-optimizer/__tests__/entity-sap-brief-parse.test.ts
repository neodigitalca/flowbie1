import { describe, expect, it } from "vitest";
import {
  entitySapBriefHasRequiredFields,
  parseEntitySapBriefJson,
} from "@/lib/sitemap-optimizer/entity-sap-brief-parse";

describe("entity-sap-brief-parse", () => {
  it("accepts SAP bulk CSV alias keys keyword, entity, title, modifier", () => {
    const parsed = parseEntitySapBriefJson(
      JSON.stringify({
        keyword: "hunter douglas blinds",
        entity: "Ice on Whyte, Edmonton, AB",
        title: "Hunter Douglas Blinds Near Ice on Whyte, Edmonton",
        modifier: "Highlight motorized options.",
        meta: "Custom Hunter Douglas blinds and shades with in-home consultation in Edmonton.",
      }),
      "entity-compress-0-4",
    );
    expect(parsed).not.toBeNull();
    expect(entitySapBriefHasRequiredFields(parsed!)).toBe(true);
    expect(parsed!.recommendedPrimaryKeyword).toBe("hunter douglas blinds");
    expect(parsed!.sapEntity).toBe("Ice on Whyte, Edmonton, AB");
    expect(parsed!.recommendedTitle).toContain("Hunter Douglas");
    expect(parsed!.sapModifier).toBe("Highlight motorized options.");
  });

  it("unwraps nested sapRow objects", () => {
    const parsed = parseEntitySapBriefJson(
      JSON.stringify({
        sapRow: {
          recommendedPrimaryKeyword: "custom blinds",
          sapEntity: "Camrose, AB",
          recommendedTitle: "Custom Blinds Near Camrose, AB",
        },
      }),
      "c1",
    );
    expect(parsed?.recommendedPrimaryKeyword).toBe("custom blinds");
    expect(parsed?.sapEntity).toBe("Camrose, AB");
  });
});
