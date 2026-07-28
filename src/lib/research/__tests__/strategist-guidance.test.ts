import { describe, expect, it } from "vitest";
import { formatStrategistGuidancePrefix } from "@/lib/research/strategist-guidance";

describe("formatStrategistGuidancePrefix", () => {
  it("returns empty for blank guidance", () => {
    expect(formatStrategistGuidancePrefix("")).toBe("");
    expect(formatStrategistGuidancePrefix("   ")).toBe("");
  });

  it("prefixes collapsed guidance", () => {
    const out = formatStrategistGuidancePrefix("Focus on  speed\nand FAQ");
    expect(out).toMatch(/^USER_STRATEGIST_GUIDANCE: Focus on speed and FAQ/);
    expect(out.endsWith("\n\n")).toBe(true);
  });
});
