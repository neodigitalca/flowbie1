import { describe, expect, it } from "vitest";
import { resolveAdsReportingRunConfig } from "@/lib/ads-reporting/resolve-ads-reporting-run-config";

describe("resolveAdsReportingRunConfig", () => {
  it("defaults to mom", () => {
    const config = resolveAdsReportingRunConfig({});
    expect(config.comparePreset).toBe("mom");
    expect(config.presetId).toBe("mom");
  });

  it("reads yoy from comparePreset", () => {
    const config = resolveAdsReportingRunConfig({ comparePreset: "yoy" });
    expect(config.comparePreset).toBe("yoy");
    expect(config.presetId).toBe("yoy");
  });
});
