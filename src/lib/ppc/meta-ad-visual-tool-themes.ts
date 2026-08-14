import type { MetaAdVisualToolPalette, MetaAdVisualToolThemeId } from "@/lib/ppc/meta-ads-types";
import {
  cloneVisualToolPalette,
  emptyVisualToolPalette,
  formatVisualToolPaletteLine,
  hasActiveVisualToolPalette,
} from "@/lib/ppc/meta-ad-visual-tool-palette";

export type MetaAdVisualToolTheme = {
  id: MetaAdVisualToolThemeId;
  label: string;
  palette?: MetaAdVisualToolPalette;
};

export const META_AD_VISUAL_TOOL_THEME_DEFAULT_ID: MetaAdVisualToolThemeId = "typography-icons";

export const META_AD_VISUAL_TOOL_THEMES: MetaAdVisualToolTheme[] = [
  {
    id: "openrouter",
    label: "OpenRouter auto",
  },
  {
    id: "typography-icons",
    label: "Typography + icons",
    palette: {
      ...emptyVisualToolPalette(),
      typography: { chance: 0.9, degree: 0.8 },
      icon_cluster: { chance: 0.7, degree: 0.6 },
      accent_shapes: { chance: 0.5, degree: 0.5 },
      gradient_panel: { chance: 0.3, degree: 0.2 },
    },
  },
  {
    id: "skyline-local",
    label: "Skyline local",
    palette: {
      ...emptyVisualToolPalette(),
      typography: { chance: 0.6, degree: 0.4 },
      city_skyline: { chance: 0.8, degree: 0.9 },
      gradient_panel: { chance: 0.5, degree: 0.4 },
    },
  },
  {
    id: "device-vignette",
    label: "Device vignette",
    palette: {
      ...emptyVisualToolPalette(),
      typography: { chance: 0.5, degree: 0.4 },
      device_screen: { chance: 0.8, degree: 0.7 },
    },
  },
  {
    id: "icon-graphic",
    label: "Icon graphic",
    palette: {
      ...emptyVisualToolPalette(),
      icon_cluster: { chance: 1, degree: 1 },
      accent_shapes: { chance: 0.8, degree: 0.7 },
      gradient_panel: { chance: 0.2, degree: 0.2 },
    },
  },
  {
    id: "photo-hero",
    label: "Photo hero",
    palette: {
      ...emptyVisualToolPalette(),
      typography: { chance: 0.4, degree: 0.3 },
      photo_focal: { chance: 0.9, degree: 0.8 },
    },
  },
  {
    id: "map-local",
    label: "Map local",
    palette: {
      ...emptyVisualToolPalette(),
      typography: { chance: 0.7, degree: 0.6 },
      icon_cluster: { chance: 0.5, degree: 0.5 },
      map_overlay: { chance: 0.7, degree: 0.6 },
    },
  },
];

const THEME_BY_ID = new Map(META_AD_VISUAL_TOOL_THEMES.map((theme) => [theme.id, theme]));

export function isMetaAdVisualToolThemeId(value: unknown): value is MetaAdVisualToolThemeId {
  return typeof value === "string" && THEME_BY_ID.has(value as MetaAdVisualToolThemeId);
}

export function resolveMetaAdVisualToolThemeId(value: unknown): MetaAdVisualToolThemeId {
  return isMetaAdVisualToolThemeId(value) ? value : META_AD_VISUAL_TOOL_THEME_DEFAULT_ID;
}

export function getMetaAdVisualToolTheme(id: MetaAdVisualToolThemeId): MetaAdVisualToolTheme {
  return THEME_BY_ID.get(id) ?? THEME_BY_ID.get(META_AD_VISUAL_TOOL_THEME_DEFAULT_ID)!;
}

export function getMetaAdVisualToolThemePalette(id: MetaAdVisualToolThemeId): MetaAdVisualToolPalette | undefined {
  const theme = getMetaAdVisualToolTheme(id);
  if (!theme.palette) return undefined;
  return cloneVisualToolPalette(theme.palette);
}

export function resolveMetaAdRowVisualToolPalette(options: {
  rowPalette?: MetaAdVisualToolPalette;
  defaultPalette?: MetaAdVisualToolPalette;
  rowThemeId?: MetaAdVisualToolThemeId;
  headerThemeId?: MetaAdVisualToolThemeId;
}): MetaAdVisualToolPalette | undefined {
  if (options.rowPalette && hasActiveVisualToolPalette(options.rowPalette)) {
    return cloneVisualToolPalette(options.rowPalette);
  }
  if (options.defaultPalette && hasActiveVisualToolPalette(options.defaultPalette)) {
    return cloneVisualToolPalette(options.defaultPalette);
  }
  const themeId = options.rowThemeId ?? resolveMetaAdVisualToolThemeId(options.headerThemeId);
  return getMetaAdVisualToolThemePalette(themeId);
}

export function rowHasManualVisualToolPalette(rowPalette?: MetaAdVisualToolPalette): boolean {
  return Boolean(rowPalette && hasActiveVisualToolPalette(rowPalette));
}

export function rowUsesHeaderVisualToolTheme(rowThemeId: MetaAdVisualToolThemeId | undefined): boolean {
  return rowThemeId === undefined;
}

export function formatMetaVisualToolPaletteBriefConstraint(
  palette: MetaAdVisualToolPalette | undefined,
): string | null {
  if (!palette || !hasActiveVisualToolPalette(palette)) return null;
  return `User visual tool palette (use these exact degree values): ${formatVisualToolPaletteLine(palette)}. visualConcept must describe only tools with degree above zero.`;
}
