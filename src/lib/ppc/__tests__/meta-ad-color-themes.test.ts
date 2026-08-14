import { describe, expect, it, vi } from "vitest";
import {
  getMetaAdColorThemePalette,
  META_AD_COLOR_THEME_DEFAULT_ID,
  resolveMetaAdColorThemeId,
  resolveMetaAdRowColorPalette,
} from "@/lib/ppc/meta-ad-color-themes";
import { createDefaultMetaGenerateConfig, readMetaGenerateConfig } from "@/lib/ppc/meta-ads-field-limits";

describe("meta-ad-color-themes", () => {
  it("defaults to flowbie dark palette", () => {
    expect(META_AD_COLOR_THEME_DEFAULT_ID).toBe("flowbie-dark");
    expect(createDefaultMetaGenerateConfig().defaultColorPalette.background).toBe("#02050a");
  });

  it("resolves unknown theme ids to default", () => {
    expect(resolveMetaAdColorThemeId("invalid")).toBe("flowbie-dark");
  });

  it("uses row palette when set, otherwise default palette", () => {
    expect(
      resolveMetaAdRowColorPalette({
        rowPalette: { accent: "#ff0000" },
        defaultPalette: { background: "#02050a", accent: "#84bc00", primary: "#ffffff" },
      })?.accent,
    ).toBe("#ff0000");
    expect(
      resolveMetaAdRowColorPalette({
        defaultPalette: { background: "#f8f8f8", accent: "#84bc00", primary: "#1a1a1a" },
      })?.background,
    ).toBe("#f8f8f8");
  });

  it("migrates legacy colorThemeId in generate config storage", () => {
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

    const siteId = "test-site-theme";
    sessionStorage.setItem(
      `flowbie-ppc-meta-generate-config:${siteId}`,
      JSON.stringify({ adCount: 2, placement: "feed_4x5", includeImage: true, colorThemeId: "neon-contrast" }),
    );
    expect(readMetaGenerateConfig(siteId).defaultColorPalette.background).toBe("#000000");
    vi.unstubAllGlobals();
  });

  it("returns flowbie dark palette hex values", () => {
    const palette = getMetaAdColorThemePalette("flowbie-dark");
    expect(palette.background).toBe("#02050a");
    expect(palette.accent).toBe("#84bc00");
    expect(palette.primary).toBe("#ffffff");
  });
});
