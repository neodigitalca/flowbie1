import { describe, expect, it } from "vitest";
import {
  compareDefaultImageModelCost,
  DEFAULT_IMAGE_MODEL,
  estimateImageOutputCostUsd,
  LEGACY_PRO_IMAGE_MODEL,
} from "@/lib/image-model-defaults";

describe("image-model-defaults", () => {
  it("uses gemini 3.1 flash image as default", () => {
    expect(DEFAULT_IMAGE_MODEL).toBe("google/gemini-3.1-flash-image");
  });

  it("estimates lower cost than legacy pro for featured 16:9", () => {
    const cmp = compareDefaultImageModelCost("16:9");
    expect(cmp.legacyModel).toBe(LEGACY_PRO_IMAGE_MODEL);
    expect(cmp.currentModel).toBe(DEFAULT_IMAGE_MODEL);
    expect(cmp.legacyUsd).toBe(0.134);
    expect(cmp.currentUsd).toBe(0.101);
    expect(cmp.savingsUsd).toBeCloseTo(0.033, 3);
    expect(cmp.savingsPercent).toBe(25);
  });

  it("estimates 50% savings for square 1:1", () => {
    const cmp = compareDefaultImageModelCost("1:1");
    expect(cmp.legacyUsd).toBe(0.134);
    expect(cmp.currentUsd).toBe(0.067);
    expect(cmp.savingsPercent).toBe(50);
  });

  it("estimates per-image cost by model", () => {
    expect(estimateImageOutputCostUsd(LEGACY_PRO_IMAGE_MODEL, "1:1")).toBe(0.134);
    expect(estimateImageOutputCostUsd(DEFAULT_IMAGE_MODEL, "1:1")).toBe(0.067);
  });
});
