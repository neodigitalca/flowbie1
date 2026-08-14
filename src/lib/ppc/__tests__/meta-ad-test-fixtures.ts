import type { MetaAdCreativeBrief, MetaAdVisualToolPalette } from "@/lib/ppc/meta-ads-types";
import { emptyVisualToolPalette } from "@/lib/ppc/meta-ad-visual-tool-palette";

export const TYPOGRAPHY_PALETTE: MetaAdVisualToolPalette = {
  ...emptyVisualToolPalette(),
  typography: { chance: 0.9, degree: 0.8 },
  icon_cluster: { chance: 0.6, degree: 0.5 },
  accent_shapes: { chance: 0.5, degree: 0.4 },
  gradient_panel: { chance: 0.3, degree: 0.2 },
};

export const SKYLINE_PALETTE: MetaAdVisualToolPalette = {
  ...emptyVisualToolPalette(),
  typography: { chance: 0.6, degree: 0.4 },
  city_skyline: { chance: 0.8, degree: 0.9 },
  gradient_panel: { chance: 0.5, degree: 0.4 },
};

export const DEVICE_PALETTE: MetaAdVisualToolPalette = {
  ...emptyVisualToolPalette(),
  typography: { chance: 0.5, degree: 0.4 },
  device_screen: { chance: 0.8, degree: 0.7 },
};

export const MAP_PALETTE: MetaAdVisualToolPalette = {
  ...emptyVisualToolPalette(),
  typography: { chance: 0.7, degree: 0.6 },
  icon_cluster: { chance: 0.5, degree: 0.5 },
  map_overlay: { chance: 0.7, degree: 0.6 },
};

export const PHOTO_FOCAL_PALETTE: MetaAdVisualToolPalette = {
  ...emptyVisualToolPalette(),
  typography: { chance: 0.4, degree: 0.3 },
  photo_focal: { chance: 0.9, degree: 0.8 },
};

export const PHOTO_SKYLINE_DEVICE_PALETTE: MetaAdVisualToolPalette = {
  ...emptyVisualToolPalette(),
  typography: { chance: 0.4, degree: 0.3 },
  city_skyline: { chance: 0.6, degree: 0.7 },
  device_screen: { chance: 0.7, degree: 0.8 },
  photo_focal: { chance: 0.3, degree: 0.4 },
};

export function withToolPalette(
  brief: Omit<MetaAdCreativeBrief, "visualToolPalette">,
  palette: MetaAdVisualToolPalette,
): MetaAdCreativeBrief {
  return {
    ...brief,
    visualToolPalette: palette,
  };
}
