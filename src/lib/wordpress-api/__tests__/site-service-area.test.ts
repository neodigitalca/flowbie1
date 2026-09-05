import { describe, expect, it } from "vitest";
import {
  buildSiteLocationsPatch,
  readSiteServiceCity,
  readSiteServiceCountry,
  readSiteServiceState,
} from "@/lib/wordpress-api/site-service-area";
import type { WordPressSite } from "@/components/integrations/types";

function ridgelineSite(overrides: Partial<WordPressSite> = {}): WordPressSite {
  return {
    id: "wp-ridgeline",
    name: "Ridgeline Solar",
    siteUrl: "https://ridgelinesolar.ca/",
    username: "u",
    appPassword: "p",
    connectedAt: 0,
    ...overrides,
  };
}

describe("site-service-area", () => {
  it("reads city and province from default location", () => {
    const site = ridgelineSite({
      locations: [
        {
          id: "l1",
          name: "HQ",
          address: "",
          city: "Edmonton",
          state: "AB",
          zip: "",
          phone: "",
          isDefault: true,
        },
      ],
    });
    expect(readSiteServiceCity(site)).toBe("Edmonton");
    expect(readSiteServiceState(site)).toBe("Alberta");
    expect(readSiteServiceCountry(site)).toBe("Canada");
  });

  it("builds a default location patch for QFO", () => {
    const site = ridgelineSite();
    const patch = buildSiteLocationsPatch(site, "Edmonton", "AB", "Canada");
    expect(patch.locations?.[0]?.city).toBe("Edmonton");
    expect(patch.locations?.[0]?.state).toBe("Alberta");
    expect(patch.locations?.[0]?.country).toBe("Canada");
    expect(patch.locations?.[0]?.isDefault).toBe(true);
    expect(patch.napInfo?.locations?.[0]?.city).toBe("Edmonton");
  });
});
