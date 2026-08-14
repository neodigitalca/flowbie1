import type { MetaAdColorPalette, MetaAdColorThemeId } from "@/lib/ppc/meta-ads-types";
import { hasMetaColorPalette, normalizeMetaColorPalette } from "@/lib/ppc/meta-ad-color-palette";

export type MetaAdColorTheme = {
  id: MetaAdColorThemeId;
  label: string;
  palette: MetaAdColorPalette;
};

export const META_AD_COLOR_THEME_DEFAULT_ID: MetaAdColorThemeId = "flowbie-dark";

export const META_AD_COLOR_THEMES: MetaAdColorTheme[] = [
  {
    id: "flowbie-dark",
    label: "Flowbie dark",
    palette: {
      background: "#02050a",
      accent: "#84bc00",
      primary: "#ffffff",
    },
  },
  {
    id: "flowbie-light",
    label: "Flowbie light",
    palette: {
      background: "#f8f8f8",
      accent: "#84bc00",
      primary: "#1a1a1a",
    },
  },
  {
    id: "neon-contrast",
    label: "Neon contrast",
    palette: {
      background: "#000000",
      accent: "#84bc00",
      primary: "#ffffff",
    },
  },
];

const THEME_BY_ID = new Map(META_AD_COLOR_THEMES.map((theme) => [theme.id, theme]));

export function isMetaAdColorThemeId(value: unknown): value is MetaAdColorThemeId {
  return typeof value === "string" && THEME_BY_ID.has(value as MetaAdColorThemeId);
}

export function resolveMetaAdColorThemeId(value: unknown): MetaAdColorThemeId {
  return isMetaAdColorThemeId(value) ? value : META_AD_COLOR_THEME_DEFAULT_ID;
}

export function getMetaAdColorTheme(id: MetaAdColorThemeId): MetaAdColorTheme {
  return THEME_BY_ID.get(id) ?? THEME_BY_ID.get(META_AD_COLOR_THEME_DEFAULT_ID)!;
}

export function getMetaAdColorThemePalette(id: MetaAdColorThemeId): MetaAdColorPalette {
  return { ...getMetaAdColorTheme(id).palette };
}

export function resolveMetaAdRowColorPalette(options: {
  rowPalette?: MetaAdColorPalette;
  defaultPalette?: MetaAdColorPalette;
  themeId?: MetaAdColorThemeId;
}): MetaAdColorPalette | undefined {
  const row = normalizeMetaColorPalette(options.rowPalette);
  if (row) return row;
  if (options.defaultPalette) {
    return normalizeMetaColorPalette(options.defaultPalette) ?? options.defaultPalette;
  }
  const themeId = resolveMetaAdColorThemeId(options.themeId);
  return getMetaAdColorThemePalette(themeId);
}

export function rowUsesHeaderColorTheme(rowPalette: MetaAdColorPalette | undefined): boolean {
  return !hasMetaColorPalette(rowPalette);
}
