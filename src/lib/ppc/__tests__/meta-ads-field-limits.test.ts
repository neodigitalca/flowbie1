import { describe, expect, it, vi } from "vitest";
import {
  clampMetaAdDescription,
  clampMetaAdHeadline,
  clampMetaAdPrimaryText,
  createDefaultMetaGenerateConfig,
  normalizeMetaAdCta,
  readMetaGenerateConfig,
} from "@/lib/ppc/meta-ads-field-limits";

describe("meta-ads-field-limits", () => {
  it("clamps primary text to 125 characters", () => {
    const long = "a".repeat(200);
    expect(clampMetaAdPrimaryText(long).length).toBe(125);
  });

  it("clamps headline to 40 characters", () => {
    expect(clampMetaAdHeadline("x".repeat(50)).length).toBe(40);
  });

  it("clamps description to 30 characters", () => {
    expect(clampMetaAdDescription("y".repeat(40)).length).toBe(30);
  });

  it("normalizes CTA values", () => {
    expect(normalizeMetaAdCta("learn more")).toBe("Learn More");
    expect(normalizeMetaAdCta("invalid")).toBe("Learn More");
  });

  it("seeds default palettes on create", () => {
    const config = createDefaultMetaGenerateConfig();
    expect(config.defaultColorPalette.background).toBe("#02050a");
    expect(config.defaultVisualToolPalette.typography.degree).toBeGreaterThan(0);
  });

  it("migrates legacy theme ids to default palettes when reading config", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });

    const siteId = "test-meta-config-migrate";
    sessionStorage.setItem(
      `flowbie-ppc-meta-generate-config:${siteId}`,
      JSON.stringify({
        adCount: 3,
        placement: "feed_1x1",
        includeImage: true,
        colorThemeId: "flowbie-light",
        visualToolThemeId: "device-vignette",
      }),
    );

    const config = readMetaGenerateConfig(siteId);
    expect(config.defaultColorPalette.background).toBe("#f8f8f8");
    expect(config.defaultVisualToolPalette.device_screen.degree).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});
