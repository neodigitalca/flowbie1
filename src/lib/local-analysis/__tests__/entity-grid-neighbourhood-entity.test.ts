import { describe, expect, it } from "vitest";
import { isCityLevelOnlyEntity } from "@/lib/local-analysis/entity-grid-location-wiki-agent";

describe("isCityLevelOnlyEntity", () => {
  it("flags metro-only Edmonton labels", () => {
    expect(isCityLevelOnlyEntity("Edmonton, AB", "Edmonton, AB")).toBe(true);
    expect(isCityLevelOnlyEntity("Edmonton", "Edmonton, AB")).toBe(true);
  });

  it("allows neighbourhood-first labels", () => {
    expect(isCityLevelOnlyEntity("Mill Woods, Edmonton, AB", "Edmonton, AB")).toBe(false);
    expect(isCityLevelOnlyEntity("Oliver, Edmonton, AB", "Edmonton, AB")).toBe(false);
    expect(isCityLevelOnlyEntity("West Jasper Place, Edmonton, AB", "Edmonton, AB")).toBe(false);
  });
});
