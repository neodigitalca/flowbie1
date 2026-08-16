import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SocialCreatorVisualSettingsPanel } from "@/components/social/creator/SocialCreatorVisualSettingsPanel";
import { cloneVisualToolPalette } from "@/lib/ppc/meta-ad-visual-tool-palette";
import { resolveMetaTypographyStyle } from "@/lib/ppc/meta-ad-typography-styles";
import type {
  MetaAdColorPalette,
  MetaAdTypographyStyle,
  MetaAdVisualToolPalette,
  SocialGenerateConfig,
  SocialVisualToolMode,
} from "@/lib/social/social-creator-types";

export type SocialCreatorWorkspaceDefaultsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generateConfig: SocialGenerateConfig;
  disabled?: boolean;
  onSave: (defaults: {
    defaultColorPalette: MetaAdColorPalette;
    defaultVisualToolPalette: MetaAdVisualToolPalette;
    defaultVisualToolMode: SocialVisualToolMode;
    defaultTypographyStyle: MetaAdTypographyStyle;
  }) => void;
};

export function SocialCreatorWorkspaceDefaultsDialog({
  open,
  onOpenChange,
  generateConfig,
  disabled = false,
  onSave,
}: SocialCreatorWorkspaceDefaultsDialogProps) {
  const [draftColors, setDraftColors] = useState<MetaAdColorPalette>(() => ({
    ...generateConfig.defaultColorPalette,
  }));
  const [draftTools, setDraftTools] = useState<MetaAdVisualToolPalette>(() =>
    cloneVisualToolPalette(generateConfig.defaultVisualToolPalette),
  );
  const [draftVisualToolMode, setDraftVisualToolMode] = useState<SocialVisualToolMode>(
    () => generateConfig.defaultVisualToolMode,
  );
  const [draftTypographyStyle, setDraftTypographyStyle] = useState<MetaAdTypographyStyle>(() =>
    resolveMetaTypographyStyle(generateConfig.defaultTypographyStyle),
  );

  useEffect(() => {
    if (!open) return;
    setDraftColors({ ...generateConfig.defaultColorPalette });
    setDraftTools(cloneVisualToolPalette(generateConfig.defaultVisualToolPalette));
    setDraftVisualToolMode(generateConfig.defaultVisualToolMode);
    setDraftTypographyStyle(resolveMetaTypographyStyle(generateConfig.defaultTypographyStyle));
  }, [
    generateConfig.defaultColorPalette,
    generateConfig.defaultVisualToolPalette,
    generateConfig.defaultVisualToolMode,
    generateConfig.defaultTypographyStyle,
    open,
  ]);

  const handleSave = () => {
    onSave({
      defaultColorPalette: { ...draftColors },
      defaultVisualToolPalette: cloneVisualToolPalette(draftTools),
      defaultVisualToolMode: draftVisualToolMode,
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
        <SocialCreatorVisualSettingsPanel
          colorPalette={draftColors}
          visualToolPalette={draftTools}
          visualToolMode={draftVisualToolMode}
          typographyStyle={draftTypographyStyle}
          disabled={disabled}
          onColorPaletteChange={setDraftColors}
          onVisualToolPaletteChange={setDraftTools}
          onVisualToolModeChange={setDraftVisualToolMode}
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
