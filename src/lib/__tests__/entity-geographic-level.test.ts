import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENTITY_GEOGRAPHIC_LEVEL,
  ENTITY_TYPE_TAXONOMY,
  ENTITY_TYPE_TAXONOMY_UI_SHORT,
  entityLevelShortLabel,
  entityTypeShortLabel,
  entityTypesForLevel,
  widestEntityTypeShortLabel,
  resolveEntityGeographicLevel,
} from "@/lib/entity-geographic-level";
describe("entity-geographic-level taxonomy", () => {
  it("has stable keys and non-empty lists per level", () => {
    expect(Object.keys(ENTITY_TYPE_TAXONOMY).sort()).toEqual(["city", "national", "provincial"]);
    for (const level of ["national", "provincial", "city"] as const) {
      const list = ENTITY_TYPE_TAXONOMY[level];
      expect(list.length).toBeGreaterThan(0);
      for (const line of list) {
        expect(typeof line).toBe("string");
        expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("entityTypesForLevel returns the same arrays as ENTITY_TYPE_TAXONOMY", () => {
    expect(entityTypesForLevel("national")).toBe(ENTITY_TYPE_TAXONOMY.national);
    expect(entityTypesForLevel("provincial")).toBe(ENTITY_TYPE_TAXONOMY.provincial);
    expect(entityTypesForLevel("city")).toBe(ENTITY_TYPE_TAXONOMY.city);
  });

  it("UI short labels align 1:1 with full taxonomy per level", () => {
    for (const level of ["national", "provincial", "city"] as const) {
      expect(ENTITY_TYPE_TAXONOMY_UI_SHORT[level].length).toBe(ENTITY_TYPE_TAXONOMY[level].length);
      ENTITY_TYPE_TAXONOMY[level].forEach((full, i) => {
        expect(entityTypeShortLabel(level, full)).toBe(ENTITY_TYPE_TAXONOMY_UI_SHORT[level][i]);
      });
    }
  });

  it("widestEntityTypeShortLabel returns the longest option including None", () => {
    for (const level of ["national", "provincial", "city"] as const) {
      const labels = ["None", ...ENTITY_TYPE_TAXONOMY_UI_SHORT[level]];
      const expected = labels.reduce((max, label) => (label.length > max.length ? label : max), "None");
      expect(widestEntityTypeShortLabel(level)).toBe(expected);
    }
    expect(widestEntityTypeShortLabel("city")).toBe("Neighbourhoods");
  });

  it("resolveEntityGeographicLevel defaults unknown values to city", () => {
    expect(resolveEntityGeographicLevel(undefined)).toBe(DEFAULT_ENTITY_GEOGRAPHIC_LEVEL);
    expect(resolveEntityGeographicLevel(null)).toBe(DEFAULT_ENTITY_GEOGRAPHIC_LEVEL);
    expect(resolveEntityGeographicLevel("city")).toBe("city");
    expect(resolveEntityGeographicLevel("national")).toBe("national");
    expect(resolveEntityGeographicLevel("provincial")).toBe("provincial");
  });

  it("city scope short label describes neighbourhood granularity", () => {
    expect(entityLevelShortLabel("city")).toBe("City");
    expect(entityLevelShortLabel("national")).toBe("National");
  });
});
