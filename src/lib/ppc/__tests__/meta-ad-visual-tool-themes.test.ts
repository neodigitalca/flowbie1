import { describe, expect, it, vi } from "vitest";
import {
  getMetaAdVisualToolThemePalette,
  META_AD_VISUAL_TOOL_THEME_DEFAULT_ID,
  resolveMetaAdRowVisualToolPalette,
  resolveMetaAdVisualToolThemeId,
  rowUsesHeaderVisualToolTheme,
} from "@/lib/ppc/meta-ad-visual-tool-themes";
import { emptyVisualToolPalette } from "@/lib/ppc/meta-ad-visual-tool-palette";
import { createDefaultMetaGenerateConfig, readMetaGenerateConfig } from "@/lib/ppc/meta-ads-field-limits";

describe("meta-ad-visual-tool-themes", () => {
  it("defaults to typography-icons palette", () => {
    expect(META_AD_VISUAL_TOOL_THEME_DEFAULT_ID).toBe("typography-icons");
    expect(createDefaultMetaGenerateConfig().defaultVisualToolPalette.typography.degree).toBeGreaterThan(0);
  });

  it("resolves unknown theme ids to default", () => {
    expect(resolveMetaAdVisualToolThemeId("invalid")).toBe("typography-icons");
  });

  it("uses row palette when set, otherwise default palette", () => {
    expect(
      resolveMetaAdRowVisualToolPalette({
        rowPalette: { ...emptyVisualToolPalette(), photo_focal: { chance: 0.95, degree: 0.9 } },
        defaultPalette: getMetaAdVisualToolThemePalette("typography-icons"),
      })?.photo_focal?.degree,
    ).toBe(0.9);
    expect(
      resolveMetaAdRowVisualToolPalette({
        defaultPalette: getMetaAdVisualToolThemePalette("photo-hero"),
      })?.photo_focal?.degree,
    ).toBe(0.8);
    expect(
      resolveMetaAdRowVisualToolPalette({
        defaultPalette: getMetaAdVisualToolThemePalette("skyline-local"),
      })?.city_skyline?.degree,
    ).toBe(0.9);
  });

  it("returns undefined for openrouter auto theme", () => {
    expect(getMetaAdVisualToolThemePalette("openrouter")).toBeUndefined();
    expect(
      resolveMetaAdRowVisualToolPalette({
        rowThemeId: "openrouter",
      }),
    ).toBeUndefined();
  });

  it("treats undefined row theme as header default", () => {
    expect(rowUsesHeaderVisualToolTheme(undefined)).toBe(true);
    expect(rowUsesHeaderVisualToolTheme("icon-graphic")).toBe(false);
  });

  it("migrates legacy visualToolThemeId in generate config storage", () => {
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

    const siteId = "test-site-visual-tools";
    sessionStorage.setItem(
      `neo-pulse-ppc-meta-generate-config:${siteId}`,
      JSON.stringify({
        adCount: 2,
        placement: "feed_4x5",
        includeImage: true,
        colorThemeId: "neo-pulse-dark",
        visualToolThemeId: "map-local",
      }),
    );
    expect(readMetaGenerateConfig(siteId).defaultVisualToolPalette.map_overlay.degree).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});
