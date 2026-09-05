import { describe, expect, it } from "vitest";
import {
  assertConfiguredEntityRowCount,
  configuredEntityPageTotal,
  entityAdGroupCountFromInput,
  entityAdsPerGroupFromInput,
  entitySapTotalFromParts,
  expandEntityLabelsForLayout,
} from "@/lib/local-analysis/entity-ad-group-budget";

describe("entity-ad-group-budget", () => {
  it("computes product with min 1 each", () => {
    expect(entitySapTotalFromParts(2, 3)).toBe(6);
    expect(entitySapTotalFromParts(0, 5)).toBe(5);
    expect(entitySapTotalFromParts(5, 0)).toBe(5);
  });

  it("parses inputs with floor 1", () => {
    expect(entityAdGroupCountFromInput("")).toBe(1);
    expect(entityAdGroupCountFromInput("4")).toBe(4);
    expect(entityAdsPerGroupFromInput("0")).toBe(1);
  });

  it("expands entities per ad group layout", () => {
    const expanded = expandEntityLabelsForLayout(
      ["North Edmonton, AB", "South Edmonton, AB"],
      2,
      3,
    );
    expect(expanded).toEqual([
      "North Edmonton, AB",
      "North Edmonton, AB",
      "North Edmonton, AB",
      "South Edmonton, AB",
      "South Edmonton, AB",
      "South Edmonton, AB",
    ]);
  });

  it("cycles entity picks when fewer than ad group count", () => {
    const expanded = expandEntityLabelsForLayout(["A", "B"], 3, 2);
    expect(expanded).toEqual(["A", "A", "B", "B", "A", "A"]);
  });

  it("configuredEntityPageTotal follows pipeline ad group layout", () => {
    expect(configuredEntityPageTotal(3, 5)).toBe(15);
    expect(configuredEntityPageTotal(4, 6)).toBe(24);
    expect(configuredEntityPageTotal(1, 1)).toBe(1);
  });

  it("assertConfiguredEntityRowCount throws when count mismatches pipeline", () => {
    expect(() => assertConfiguredEntityRowCount(5, 15, "Grid clustering")).toThrow(
      "Grid clustering produced 5 of 15 configured entity rows.",
    );
  });
});
