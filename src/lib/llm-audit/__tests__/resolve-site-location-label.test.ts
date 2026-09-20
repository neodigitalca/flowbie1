import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { resolveFanoutLocationForResearch } from "@/lib/llm-audit/resolve-site-location-label";

function siteWithCity(city: string, state: string): WordPressSite {
  return {
    id: "site-1",
    name: "Test",
    siteUrl: "https://example.com",
    username: "u",
    appPassword: "p",
    connectedAt: 0,
    locations: [
      {
        id: "loc-1",
        name: city,
        address: "",
        city,
        state,
        zip: "",
        phone: "",
        isDefault: true,
      },
    ],
  };
}

describe("resolveFanoutLocationForResearch", () => {
  it("does not treat a topic keyword as a city", () => {
    expect(resolveFanoutLocationForResearch(undefined, "RRSP TFSA 2026")).toBe("");
    expect(resolveFanoutLocationForResearch(siteWithCity("Edmonton", "AB"), "RRSP TFSA 2026")).toBe(
      "Edmonton, AB",
    );
  });

  it("uses the keyword city when a service token splits the phrase", () => {
    expect(resolveFanoutLocationForResearch(undefined, "Westlock solar panels")).toBe("Westlock");
    expect(resolveFanoutLocationForResearch(siteWithCity("Edmonton", "AB"), "Westlock solar panels")).toBe(
      "Westlock, AB",
    );
  });
});
