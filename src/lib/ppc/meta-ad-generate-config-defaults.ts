import { getMetaAdColorThemePalette, META_AD_COLOR_THEME_DEFAULT_ID, resolveMetaAdColorThemeId } from "@/lib/ppc/meta-ad-color-themes";
import { normalizeMetaColorPalette } from "@/lib/ppc/meta-ad-color-palette";
import {
  cloneVisualToolPalette,
  emptyVisualToolPalette,
  hasActiveVisualToolPalette,
  parseVisualToolPalette,
} from "@/lib/ppc/meta-ad-visual-tool-palette";
import {
  getMetaAdVisualToolThemePalette,
  META_AD_VISUAL_TOOL_THEME_DEFAULT_ID,
  resolveMetaAdVisualToolThemeId,
} from "@/lib/ppc/meta-ad-visual-tool-themes";
import type {
  MetaAdColorPalette,
  MetaAdVisualToolPalette,
  MetaGenerateConfig,
} from "@/lib/ppc/meta-ads-types";

export function createDefaultMetaColorPalette(): MetaAdColorPalette {
  return getMetaAdColorThemePalette(META_AD_COLOR_THEME_DEFAULT_ID);
}

export function createDefaultMetaVisualToolPalette(): MetaAdVisualToolPalette {
  return (
    getMetaAdVisualToolThemePalette(META_AD_VISUAL_TOOL_THEME_DEFAULT_ID) ??
    emptyVisualToolPalette()
  );
}

type LegacyMetaGenerateConfig = Partial<MetaGenerateConfig> & {
  colorThemeId?: unknown;
  visualToolThemeId?: unknown;
};

export function normalizeMetaGenerateColorPalette(
  raw: unknown,
  legacyThemeId?: unknown,
): MetaAdColorPalette {
  const fromRaw = normalizeMetaColorPalette(raw as MetaAdColorPalette | undefined);
  if (fromRaw) return fromRaw;
  return getMetaAdColorThemePalette(resolveMetaAdColorThemeId(legacyThemeId));
}

export function normalizeMetaGenerateVisualToolPalette(
  raw: unknown,
  legacyThemeId?: unknown,
): MetaAdVisualToolPalette {
  const parsed = parseVisualToolPalette(raw);
  if (hasActiveVisualToolPalette(parsed)) return cloneVisualToolPalette(parsed);
  const themeId = resolveMetaAdVisualToolThemeId(legacyThemeId);
  return (
    getMetaAdVisualToolThemePalette(themeId) ?? createDefaultMetaVisualToolPalette()
  );
}

export function resolveMetaGenerateVisualToolPaletteForGenerate(
  palette: MetaAdVisualToolPalette,
): MetaAdVisualToolPalette | undefined {
  return hasActiveVisualToolPalette(palette)
    ? cloneVisualToolPalette(palette)
    : undefined;
}

export function mergeLegacyMetaGenerateConfig(parsed: LegacyMetaGenerateConfig): Pick<
  MetaGenerateConfig,
  "defaultColorPalette" | "defaultVisualToolPalette"
> {
  return {
    defaultColorPalette: normalizeMetaGenerateColorPalette(
      parsed.defaultColorPalette,
      parsed.colorThemeId,
    ),
    defaultVisualToolPalette: normalizeMetaGenerateVisualToolPalette(
      parsed.defaultVisualToolPalette,
      parsed.visualToolThemeId,
    ),
  };
}
