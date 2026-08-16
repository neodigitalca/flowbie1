import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cityRegionFromMasterInstructions,
  clearMasterInstructionsTestCache,
  gbpCoordsFromMasterInstructions,
  gbpGroundingFromMasterInstructions,
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
});
