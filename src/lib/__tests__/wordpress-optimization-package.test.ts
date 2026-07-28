import { describe, expect, it } from "vitest";
import {
  normalizeWpIsoToSecond,
  optimizationPeriodCapForPackage,
  siteHasOptimizationPeriodCap,
  OPTIMIZATION_PACKAGE_CAPS,
  takeRandomSample,
  wpModifiedIndicatesOptimization,
} from "@/lib/wordpress-optimization-package";

describe("wordpress-optimization-package", () => {
  it("optimizationPeriodCapForPackage maps tiers", () => {
    expect(optimizationPeriodCapForPackage("basic")).toBe(OPTIMIZATION_PACKAGE_CAPS.basic);
    expect(optimizationPeriodCapForPackage("pro")).toBe(OPTIMIZATION_PACKAGE_CAPS.pro);
    expect(optimizationPeriodCapForPackage("plus")).toBe(OPTIMIZATION_PACKAGE_CAPS.plus);
    expect(optimizationPeriodCapForPackage(undefined)).toBeNull();
    expect(optimizationPeriodCapForPackage(null)).toBeNull();
  });

  it("siteHasOptimizationPeriodCap mirrors cap presence", () => {
    expect(siteHasOptimizationPeriodCap("basic")).toBe(true);
    expect(siteHasOptimizationPeriodCap(undefined)).toBe(false);
  });

  it("normalizeWpIsoToSecond floors to whole seconds", () => {
    expect(normalizeWpIsoToSecond("2024-06-01T12:34:56.789Z")).toBe("2024-06-01T12:34:56.000Z");
    expect(normalizeWpIsoToSecond("2024-06-01T12:34:56Z")).toBe("2024-06-01T12:34:56.000Z");
  });

  it("wpModifiedIndicatesOptimization compares at second precision", () => {
    expect(
      wpModifiedIndicatesOptimization("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z"),
    ).toBe(true);
    expect(
      wpModifiedIndicatesOptimization("2024-01-01T00:00:00.100Z", "2024-01-01T00:00:00.900Z"),
    ).toBe(false);
  });

  it("takeRandomSample respects count and only returns items from the source list", () => {
    const items = [1, 2, 3, 4, 5];
    const s = takeRandomSample(items, 3);
    expect(s.length).toBe(3);
    expect(new Set(s).size).toBe(3);
    expect(s.every((x) => items.includes(x))).toBe(true);
    expect(takeRandomSample(items, 99).length).toBe(5);
    expect(takeRandomSample(items, 0).length).toBe(0);
  });
});
