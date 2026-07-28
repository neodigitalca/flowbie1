import { describe, expect, it } from "vitest";
import { sanitizeSapEntityForExport } from "@/lib/local-seo-strategy-from-grid";

describe("sanitizeSapEntityForExport", () => {
  it("replaces street-like middle segment with city from market hint", () => {
    const out = sanitizeSapEntityForExport(
      "Central Corridor, 16329 130 Ave NW Unit 3, AB T5V 1K5",
      "Edmonton, Alberta, Canada",
    );
    expect(out).toBe("Central Corridor, Edmonton, AB");
  });

  it("strips postal codes without changing structure when middle is already city", () => {
    const out = sanitizeSapEntityForExport("Metro Core, Edmonton, AB T5V 1K5", "Edmonton, AB");
    expect(out).toBe("Metro Core, Edmonton, AB");
  });

  it("replaces a mistaken US third segment when the market hint is Canada", () => {
    const out = sanitizeSapEntityForExport("Metro Core, Edmonton, US", "Edmonton, AB");
    expect(out).toBe("Metro Core, Edmonton, AB");
  });

  it("dedupes repeated city segments from model output (e.g. Stuart, Stuart, FL)", () => {
    const out = sanitizeSapEntityForExport("Stuart, Stuart, FL", "Stuart, FL");
    expect(out).toBe("Stuart, FL");
  });

  it("abbreviates full US state name to two-letter code", () => {
    const out = sanitizeSapEntityForExport("Folsom Lake, Folsom, California", "Folsom, CA");
    expect(out).toBe("Folsom Lake, Folsom, CA");
  });

  it("dedupes Edmonton, Edmonton, AB to Edmonton, AB", () => {
    const out = sanitizeSapEntityForExport("Edmonton, Edmonton, AB", "Edmonton, AB");
    expect(out).toBe("Edmonton, AB");
  });
});
