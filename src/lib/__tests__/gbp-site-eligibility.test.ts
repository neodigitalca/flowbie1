import { describe, it, expect } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import {
  filterSitesWithGbpLocation,
  hasGbpLocationLink,
  isGbpPostSiteEligible,
  sortGbpPostSitesByName,
} from "@/lib/gbp-post/gbp-site-eligibility";

function baseSite(overrides: Partial<WordPressSite> = {}): WordPressSite {
  return {
    id: "1",
    name: "Zebra",
    siteUrl: "https://zebra.example",
    username: "u",
    appPassword: "p",
    connectedAt: 0,
    gbpLocationId: "123",
    ...overrides,
  };
}

describe("gbp-site-eligibility", () => {
  it("hasGbpLocationLink only checks GBP Location ID", () => {
    expect(hasGbpLocationLink(baseSite())).toBe(true);
    expect(hasGbpLocationLink(baseSite({ gbpLocationId: "" }))).toBe(false);
    expect(hasGbpLocationLink(baseSite({ username: "", enabled: false }))).toBe(true);
  });

  it("isGbpPostSiteEligible requires wp creds for single-property post", () => {
    expect(isGbpPostSiteEligible(baseSite())).toBe(true);
    expect(isGbpPostSiteEligible(baseSite({ username: "" }))).toBe(false);
    expect(isGbpPostSiteEligible(baseSite({ enabled: false }))).toBe(false);
  });

  it("sortGbpPostSitesByName orders A-Z", () => {
    const sorted = sortGbpPostSitesByName([
      baseSite({ id: "a", name: "Mango" }),
      baseSite({ id: "b", name: "Apple" }),
      baseSite({ id: "c", name: "Banana" }),
    ]);
    expect(sorted.map((s) => s.name)).toEqual(["Apple", "Banana", "Mango"]);
  });

  it("filterSitesWithGbpLocation includes any property with GBP id", () => {
    const out = filterSitesWithGbpLocation([
      baseSite({ id: "a", name: "Zed", gbpLocationId: "" }),
      baseSite({ id: "b", name: "Alpha", username: "" }),
      baseSite({ id: "c", name: "Beta", enabled: false }),
    ]);
    expect(out.map((s) => s.name)).toEqual(["Alpha", "Beta"]);
  });
});
