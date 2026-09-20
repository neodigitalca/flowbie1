import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import {
  getPrimaryCityStateLabel,
  resolveEntityClusterLocationLabel,
} from "@/lib/primary-location-from-site";

function siteWithCity(city: string, state: string): WordPressSite {
  return {
    id: "lindsey",
    name: "Lindsey Blinds",
    siteUrl: "https://example.com",
    username: "",
    appPassword: "",
    connectedAt: Date.now(),
    locations: [
      {
        id: "loc-1",
        name: "Main",
        address: "100 8 Ave SW",
        city,
        state,
        zip: "T2P 1B2",
        phone: "",
        isDefault: true,
      },
    ],
  } as WordPressSite;
}

describe("resolveEntityClusterLocationLabel", () => {
  it("uses the Location field when it is filled", () => {
    const site = siteWithCity("Calgary", "AB");
    expect(resolveEntityClusterLocationLabel(site, "Airdrie, AB")).toBe("Airdrie, AB");
  });

  it("uses the profile city when the Location field is empty", () => {
    const site = siteWithCity("Calgary", "AB");
    expect(getPrimaryCityStateLabel(site)).toBe("Calgary, AB");
    expect(resolveEntityClusterLocationLabel(site, "")).toBe("Calgary, AB");
    expect(resolveEntityClusterLocationLabel(site, "   ")).toBe("Calgary, AB");
  });
});
