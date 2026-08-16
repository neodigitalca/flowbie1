import { SocialCreatorVisualSettingsPanel } from "@/components/social/creator/SocialCreatorVisualSettingsPanel";
import {
  cloneVisualToolPalette,
  hasActiveVisualToolPalette,
  migrateLegacyPeopleToolPalette,
} from "@/lib/ppc/meta-ad-visual-tool-palette";
import { hasMetaColorPalette } from "@/lib/ppc/meta-ad-color-palette";
import { resolveMetaTypographyStyle } from "@/lib/ppc/meta-ad-typography-styles";
import type {
  MetaAdColorPalette,
  SocialCreatorRow,
  MetaAdTypographyStyle,
  MetaAdVisualToolPalette,
  SocialGenerateConfig,
} from "@/lib/social/social-creator-types";

export type SocialCreatorRowVisualSettingsInlineProps = {
  row: SocialCreatorRow;
  generateConfig: SocialGenerateConfig;
  stripeRowOffset?: number;
  disabled?: boolean;
  onUpdateAd: (patch: Partial<SocialCreatorRow>) => void;
};

function effectiveRowColorPalette(row: SocialCreatorRow, generateConfig: SocialGenerateConfig): MetaAdColorPalette {
  if (hasMetaColorPalette(row.colorPalette)) {
    return { ...row.colorPalette! };
  }
  return { ...generateConfig.defaultColorPalette };
}

function effectiveRowVisualToolPalette(
  row: SocialCreatorRow,
  generateConfig: SocialGenerateConfig,
): MetaAdVisualToolPalette {
  const base =
    row.visualToolPalette && hasActiveVisualToolPalette(row.visualToolPalette)
      ? cloneVisualToolPalette(row.visualToolPalette)
      : cloneVisualToolPalette(generateConfig.defaultVisualToolPalette);
  return migrateLegacyPeopleToolPalette(base, row.allowPeopleInImage);
}

function effectiveRowTypographyStyle(row: SocialCreatorRow, generateConfig: SocialGenerateConfig): MetaAdTypographyStyle {
  return resolveMetaTypographyStyle(row.typographyStyle ?? generateConfig.defaultTypographyStyle);
}

export function SocialCreatorRowVisualSettingsInline({
  row,
  generateConfig,
  stripeRowOffset = 0,
  disabled = false,
  onUpdateAd,
}: SocialCreatorRowVisualSettingsInlineProps) {
  return (
    <SocialCreatorVisualSettingsPanel
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
