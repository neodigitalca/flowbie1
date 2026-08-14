import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MetaAdsVisualSettingsPanel } from "@/components/ppc/meta/MetaAdsVisualSettingsPanel";
import { cloneVisualToolPalette } from "@/lib/ppc/meta-ad-visual-tool-palette";
import { resolveMetaTypographyStyle } from "@/lib/ppc/meta-ad-typography-styles";
import type {
  MetaAdColorPalette,
  MetaAdTypographyStyle,
  MetaAdVisualToolPalette,
  MetaGenerateConfig,
} from "@/lib/ppc/meta-ads-types";

export type MetaAdsWorkspaceDefaultsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generateConfig: MetaGenerateConfig;
  disabled?: boolean;
  onSave: (defaults: {
    defaultColorPalette: MetaAdColorPalette;
    defaultVisualToolPalette: MetaAdVisualToolPalette;
    defaultTypographyStyle: MetaAdTypographyStyle;
  }) => void;
};

export function MetaAdsWorkspaceDefaultsDialog({
  open,
  onOpenChange,
  generateConfig,
  disabled = false,
  onSave,
}: MetaAdsWorkspaceDefaultsDialogProps) {
  const [draftColors, setDraftColors] = useState<MetaAdColorPalette>(() => ({
    ...generateConfig.defaultColorPalette,
  }));
  const [draftTools, setDraftTools] = useState<MetaAdVisualToolPalette>(() =>
    cloneVisualToolPalette(generateConfig.defaultVisualToolPalette),
  );
  const [draftTypographyStyle, setDraftTypographyStyle] = useState<MetaAdTypographyStyle>(() =>
    resolveMetaTypographyStyle(generateConfig.defaultTypographyStyle),
  );

  useEffect(() => {
    if (!open) return;
    setDraftColors({ ...generateConfig.defaultColorPalette });
    setDraftTools(cloneVisualToolPalette(generateConfig.defaultVisualToolPalette));
    setDraftTypographyStyle(resolveMetaTypographyStyle(generateConfig.defaultTypographyStyle));
  }, [
    generateConfig.defaultColorPalette,
    generateConfig.defaultVisualToolPalette,
    generateConfig.defaultTypographyStyle,
    open,
  ]);

  const handleSave = () => {
    onSave({
      defaultColorPalette: { ...draftColors },
      defaultVisualToolPalette: cloneVisualToolPalette(draftTools),
      defaultTypographyStyle: draftTypographyStyle,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-none border-0 bg-zinc-950 p-6 text-white">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white">Workspace defaults</DialogTitle>
        </DialogHeader>
        <MetaAdsVisualSettingsPanel
          colorPalette={draftColors}
          visualToolPalette={draftTools}
          typographyStyle={draftTypographyStyle}
          disabled={disabled}
          onColorPaletteChange={setDraftColors}
          onVisualToolPaletteChange={setDraftTools}
          onTypographyStyleChange={setDraftTypographyStyle}
        />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-base text-muted-foreground hover:text-foreground"
            disabled={disabled}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" className="text-base" disabled={disabled} onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
