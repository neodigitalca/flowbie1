import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import {
  buildBenchmarkInventorySiteQueue,
  resolveBenchmarkCurateSites,
} from "./vertical-benchmark-roster-order";

function site(id: string, name: string): WordPressSite {
  return {
    id,
    name,
    siteUrl: `https://${id}.example`,
    username: "u",
    appPassword: "p",
    enabled: true,
  } as WordPressSite;
}

describe("vertical-benchmark-roster-order", () => {
  it("prepends connected site to inventory queue when it is outside the roster", () => {
    const connected = site("shutter", "Shutter Spot");
    const advance = site("advance", "Advance Blinds");
    const queue = buildBenchmarkInventorySiteQueue([advance], connected);
    expect(queue.map((s) => s.id)).toEqual(["shutter", "advance"]);
  });

  it("resolves curate target from connected site when only connected is selected", () => {
    const connected = site("shutter", "Shutter Spot");
    const advance = site("advance", "Advance Blinds");
    const out = resolveBenchmarkCurateSites({
      allSites: [connected, advance],
      rosterSites: [advance],
      selectedSiteIds: new Set(["shutter"]),
      connectedSiteId: "shutter",
    });
    expect(out.curateSites.map((s) => s.id)).toEqual(["shutter"]);
    expect(out.connectedSite?.id).toBe("shutter");
  });
});
