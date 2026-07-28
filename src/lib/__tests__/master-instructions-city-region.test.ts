import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cityRegionFromMasterInstructions,
  clearMasterInstructionsTestCache,
  formatGbpMasterRulesAddressForGeocode,
  gbpCoordsFromMasterInstructions,
  gbpGridContextFromMasterInstructions,
  gbpGroundingFromMasterInstructions,
  gbpPlaceHintFromMasterInstructions,
  hasGbpMasterRulesAddressForGeocode,
  seedMasterInstructionsForTests,
} from "../master-instructions-storage";

describe("cityRegionFromMasterInstructions", () => {
  const siteId = "test-site-city-region";
  const lsStore = new Map<string, string>();

  beforeEach(() => {
    lsStore.clear();
    vi.stubGlobal("window", {} as Window);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => lsStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        lsStore.set(key, value);
      },
      removeItem: (key: string) => {
        lsStore.delete(key);
      },
    });
    clearMasterInstructionsTestCache();
  });

  afterEach(() => {
    clearMasterInstructionsTestCache();
    vi.unstubAllGlobals();
  });

  it("reads city and region from semantic triples", () => {
    seedMasterInstructionsForTests(siteId, {
      sources: [
        {
          name: "GBP-business-gbp.txt",
          kind: "semantic-triples",
          uploadedAt: 1,
          content: "[Business]\nname\tAcme SEO\ncity\tEdmonton\nregion\tAlberta",
        },
      ],
    });
    expect(cityRegionFromMasterInstructions(siteId)).toEqual({
      city: "Edmonton",
      region: "Alberta",
    });
  });

  it("reads city and region from gbp-address-json", () => {
    seedMasterInstructionsForTests(siteId, {
      sources: [
        {
          name: "gbp.json",
          kind: "gbp-address-json",
          uploadedAt: 1,
          content: JSON.stringify({ city: "St. Albert", region: "AB" }),
        },
      ],
    });
    expect(cityRegionFromMasterInstructions(siteId)).toEqual({
      city: "St. Albert",
      region: "AB",
    });
  });

  it("reads GBP center from GBP-business-gbp.txt semantic triples", () => {
    seedMasterInstructionsForTests(siteId, {
      sources: [
        {
          name: "GBP-business-gbp.txt",
          kind: "semantic-triples",
          uploadedAt: 1,
          content:
            "[Business]\nname\tTailored Interiors\nlatitude\t49.8951\nlongitude\t-97.1384\nplace_id\tChIJtest",
        },
      ],
    });
    expect(gbpGroundingFromMasterInstructions(siteId)).toEqual({
      businessName: "Tailored Interiors",
      latitude: 49.8951,
      longitude: -97.1384,
      placeId: "ChIJtest",
      cid: null,
    });
  });

  it("reads coords from gps_coordinates pair and colon lines", () => {
    seedMasterInstructionsForTests(siteId, {
      sources: [
        {
          name: "GBP-business-gbp.txt",
          uploadedAt: 1,
          content: "[Location]\ngps_coordinates\t49.8951, -97.1384\nname: Tailored Interiors",
        },
      ],
    });
    expect(gbpGroundingFromMasterInstructions(siteId)?.latitude).toBe(49.8951);
    expect(gbpGroundingFromMasterInstructions(siteId)?.longitude).toBe(-97.1384);
  });

  it("gbpCoordsFromMasterInstructions allows missing name when lat/lng present", () => {
    seedMasterInstructionsForTests(siteId, {
      sources: [
        {
          name: "GBP-business-gbp.txt",
          uploadedAt: 1,
          content: "latitude\t49.8951\nlongitude\t-97.1384",
        },
      ],
    });
    expect(gbpGroundingFromMasterInstructions(siteId)).toBeNull();
    expect(gbpCoordsFromMasterInstructions(siteId)?.latitude).toBe(49.8951);
  });

  it("gbpGridContextFromMasterInstructions reads Advance Blinds GBP format", () => {
    seedMasterInstructionsForTests(siteId, {
      sources: [
        {
          name: "GBP-business-gbp.txt",
          uploadedAt: 1,
          content: `[Advance Blinds: Blinds, Shades & Drapery In Manitoba] - entity/topic
[Advance Blinds & Drapery] - entity/topic
street_address\t303A Main Avenue
city\tPlum Coulee
region\tMB
postal_code\tR0G 1R0
country\tCA`,
        },
      ],
    });
    expect(gbpGridContextFromMasterInstructions(siteId)).toEqual({
      businessName: "Advance Blinds & Drapery",
      city: "Plum Coulee",
      region: "MB",
      postalCode: "R0G 1R0",
      address: "303A Main Avenue",
      country: "CA",
      placeId: null,
      cid: null,
    });
  });

  it("gbpPlaceHintFromMasterInstructions reads city and postal for offline centroid", () => {
    seedMasterInstructionsForTests(siteId, {
      sources: [
        {
          name: "GBP-business-gbp.txt",
          uploadedAt: 1,
          content: "[Business]\nname\tTailored Interiors\ncity\tSherwood Park\nregion\tAlberta\npostal_code\tT8A 4M5",
        },
      ],
    });
    expect(gbpPlaceHintFromMasterInstructions(siteId)).toEqual({
      city: "Sherwood Park",
      region: "Alberta",
      postalCode: "T8A 4M5",
      address: "",
    });
  });

  it("formatGbpMasterRulesAddressForGeocode joins street + city region postal + country", () => {
    expect(
      formatGbpMasterRulesAddressForGeocode({
        address: "10615 170 St NW",
        city: "Edmonton",
        region: "Alberta",
        postalCode: "T5P 4W2",
        country: "CA",
      }),
    ).toBe("10615 170 St NW, Edmonton Alberta T5P 4W2, CA");
  });

  it("formatGbpMasterRulesAddressForGeocode keeps formatted_address when already complete", () => {
    expect(
      formatGbpMasterRulesAddressForGeocode({
        address: "303A Main Avenue, Plum Coulee MB R0G 1R0",
        city: "Plum Coulee",
        region: "MB",
        postalCode: "R0G 1R0",
        country: "CA",
      }),
    ).toBe("303A Main Avenue, Plum Coulee MB R0G 1R0, CA");
  });

  it("hasGbpMasterRulesAddressForGeocode requires street plus locality", () => {
    expect(
      hasGbpMasterRulesAddressForGeocode({
        address: "10615 170 St NW",
        city: "Edmonton",
        region: "",
        postalCode: "",
        country: "CA",
      }),
    ).toBe(true);
    expect(
      hasGbpMasterRulesAddressForGeocode({
        address: "",
        city: "Edmonton",
        region: "Alberta",
        postalCode: "T5P 4W2",
        country: "CA",
      }),
    ).toBe(false);
  });
});
