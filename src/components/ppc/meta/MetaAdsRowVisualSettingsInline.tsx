import { MetaAdsVisualSettingsPanel } from "@/components/ppc/meta/MetaAdsVisualSettingsPanel";
import {
  cloneVisualToolPalette,
  hasActiveVisualToolPalette,
  migrateLegacyPeopleToolPalette,
} from "@/lib/ppc/meta-ad-visual-tool-palette";
import { hasMetaColorPalette } from "@/lib/ppc/meta-ad-color-palette";
import { resolveMetaTypographyStyle } from "@/lib/ppc/meta-ad-typography-styles";
import type {
  MetaAdColorPalette,
  MetaAdRow,
  MetaAdTypographyStyle,
  MetaAdVisualToolPalette,
  MetaGenerateConfig,
} from "@/lib/ppc/meta-ads-types";

export type MetaAdsRowVisualSettingsInlineProps = {
  row: MetaAdRow;
  generateConfig: MetaGenerateConfig;
  stripeRowOffset?: number;
  disabled?: boolean;
  onUpdateAd: (patch: Partial<MetaAdRow>) => void;
};

function effectiveRowColorPalette(row: MetaAdRow, generateConfig: MetaGenerateConfig): MetaAdColorPalette {
  if (hasMetaColorPalette(row.colorPalette)) {
    return { ...row.colorPalette! };
  }
  return { ...generateConfig.defaultColorPalette };
}

function effectiveRowVisualToolPalette(
  row: MetaAdRow,
  generateConfig: MetaGenerateConfig,
): MetaAdVisualToolPalette {
  const base =
    row.visualToolPalette && hasActiveVisualToolPalette(row.visualToolPalette)
      ? cloneVisualToolPalette(row.visualToolPalette)
      : cloneVisualToolPalette(generateConfig.defaultVisualToolPalette);
  return migrateLegacyPeopleToolPalette(base, row.allowPeopleInImage);
}

function effectiveRowTypographyStyle(row: MetaAdRow, generateConfig: MetaGenerateConfig): MetaAdTypographyStyle {
  return resolveMetaTypographyStyle(row.typographyStyle ?? generateConfig.defaultTypographyStyle);
}

export function MetaAdsRowVisualSettingsInline({
  row,
  generateConfig,
  stripeRowOffset = 0,
  disabled = false,
  onUpdateAd,
}: MetaAdsRowVisualSettingsInlineProps) {
  return (
    <MetaAdsVisualSettingsPanel
      colorPalette={effectiveRowColorPalette(row, generateConfig)}
      visualToolPalette={effectiveRowVisualToolPalette(row, generateConfig)}
      typographyStyle={effectiveRowTypographyStyle(row, generateConfig)}
      visualNote={row.imagePromptModifier ?? ""}
      stripeRowOffset={stripeRowOffset}
      disabled={disabled}
      onColorPaletteChange={(colorPalette) => onUpdateAd({ colorPalette })}
      onVisualToolPaletteChange={(visualToolPalette) =>
        onUpdateAd({
          visualToolPalette: cloneVisualToolPalette(visualToolPalette),
          allowPeopleInImage: undefined,
        })
      }
      onTypographyStyleChange={(typographyStyle) => onUpdateAd({ typographyStyle })}
      onVisualNoteChange={(imagePromptModifier) => onUpdateAd({ imagePromptModifier })}
      onResetToWorkspace={() =>
        onUpdateAd({
          colorPalette: undefined,
          visualToolPalette: undefined,
          typographyStyle: undefined,
          allowPeopleInImage: undefined,
        })
      }
    />
  );
}
