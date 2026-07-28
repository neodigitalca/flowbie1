import { describe, expect, it } from "vitest";
import {
  buildClusterWikiCandidateTiers,
  extractClusterWikiGeo,
  isCityLevelWikiTitle,
  isRejectedClusterWikiTitle,
  isRejectedNeighbourhoodWikiTitle,
} from "@/lib/local-analysis/cluster-wiki-candidates";
import type { GridLocationBucket } from "@/lib/local-analysis/grid-location-buckets";

const bucket: GridLocationBucket = {
  bucketId: "b1",
  placeLabel: "Altona cluster",
  weight: 10,
  sampleAddresses: ["100 Main St, Altona, MB R0G 0A0"],
};

describe("extractClusterWikiGeo", () => {
  it("parses city and Manitoba from entity label", () => {
    expect(extractClusterWikiGeo("2 St NE, Altona, MB")).toEqual({
      city: "Altona",
      regionCode: "MB",
      regionName: "Manitoba",
    });
  });
});

describe("buildClusterWikiCandidateTiers", () => {
  it("orders neighbourhood before city before province", () => {
    const tiers = buildClusterWikiCandidateTiers("Fort Garry, Winnipeg, MB", {
      ...bucket,
      sampleAddresses: ["1 Main St, Winnipeg, MB"],
    });
    expect(tiers.neighbourhood[0]).toBe("Fort Garry, Winnipeg, MB");
    expect(tiers.neighbourhood).toContain("Fort Garry, Winnipeg, Manitoba");
    expect(tiers.city).toContain("Winnipeg, Manitoba");
    expect(tiers.city).not.toContain("Altona");
  });

  it("city tier uses Altona, Manitoba not bare Altona", () => {
    const tiers = buildClusterWikiCandidateTiers("2 St NE, Altona, MB", bucket);
    expect(tiers.city).toContain("Altona, Manitoba");
    expect(tiers.city).not.toContain("Altona");
  });

  it("prefers city-qualified neighbourhood titles before bare placeHead", () => {
    const tiers = buildClusterWikiCandidateTiers("Mill Woods, Edmonton, AB", {
      ...bucket,
      sampleAddresses: ["1 Main St, Edmonton, AB"],
    });
    expect(tiers.neighbourhood[0]).toBe("Mill Woods, Edmonton, AB");
    expect(tiers.neighbourhood).toContain("Mill Woods, Edmonton");
    expect(tiers.neighbourhood).toContain("Mill Woods");
    expect(tiers.neighbourhood.indexOf("Mill Woods, Edmonton")).toBeLessThan(
      tiers.neighbourhood.indexOf("Mill Woods"),
    );
  });

  it("includes Ritchie, Edmonton before bare Ritchie", () => {
    const tiers = buildClusterWikiCandidateTiers("Ritchie, Edmonton, AB", {
      ...bucket,
      sampleAddresses: ["1 Main St, Edmonton, AB"],
    });
    expect(tiers.neighbourhood).toContain("Ritchie, Edmonton");
    expect(tiers.neighbourhood.indexOf("Ritchie, Edmonton")).toBeLessThan(
      tiers.neighbourhood.indexOf("Ritchie"),
    );
  });
});

describe("isRejectedClusterWikiTitle", () => {
  it("rejects bare city and disambiguation when region is known", () => {
    const geo = { city: "Altona", regionCode: "MB", regionName: "Manitoba" };
    expect(isRejectedClusterWikiTitle("Altona", geo)).toBe(true);
    expect(isRejectedClusterWikiTitle("Altona (disambiguation)", geo)).toBe(true);
    expect(isRejectedClusterWikiTitle("Altona, Manitoba", geo)).toBe(false);
  });
});

describe("isRejectedNeighbourhoodWikiTitle", () => {
  it("rejects city-level pages during neighbourhood lookup", () => {
    const geo = { city: "Winnipeg", regionCode: "MB", regionName: "Manitoba" };
    expect(isRejectedNeighbourhoodWikiTitle("Winnipeg, Manitoba", geo)).toBe(true);
    expect(isRejectedNeighbourhoodWikiTitle("Fort Garry, Winnipeg", geo)).toBe(false);
  });

  it("identifies city-level titles", () => {
    const geo = { city: "Altona", regionCode: "MB", regionName: "Manitoba" };
    expect(isCityLevelWikiTitle("Altona, Manitoba", geo)).toBe(true);
    expect(isCityLevelWikiTitle("Manitoba", geo)).toBe(false);
  });
});
