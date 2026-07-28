import type { ComponentProps } from "react";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BULK_HEADER_SELECT_TRIGGER,
  BULK_HEADER_TOOL_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { IMAGE_MODEL_PRESETS } from "@/lib/image-model-defaults";
import { ImageGeneratorRunButton } from "@/components/generator/image/ImageGeneratorRunButton";
import type { UseImageGeneratorResult } from "@/components/generator/image/image-generator-types";
import { cn } from "@/lib/utils";

type ImageGeneratorToolbarProps = Pick<
  UseImageGeneratorResult,
  | "imageSourceMode"
  | "setImageSourceMode"
  | "selectedSection"
  | "setSelectedSection"
  | "availableSections"
  | "imageModel"
  | "setImageModel"
  | "isCustomModel"
  | "setIsCustomModel"
  | "hasApiKey"
  | "hasGeneratedChecklist"
  | "isGeneratingChecklist"
  | "isGenerating"
  | "imageDisplayUrl"
  | "handleGenerateChecklist"
  | "handleGenerateImage"
  | "handleDownload"
  | "handleCopy"
> & {
  workspaceBusy?: boolean;
};

function ToolbarSelect({
  className,
  children,
  ...props
}: ComponentProps<typeof Select> & { className?: string }) {
  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <Select {...props}>{children}</Select>
    </div>
  );
}

export function ImageGeneratorToolbar({
  imageSourceMode,
  setImageSourceMode,
  selectedSection,
  setSelectedSection,
  availableSections,
  imageModel,
  setImageModel,
  isCustomModel,
  setIsCustomModel,
  hasApiKey,
  hasGeneratedChecklist,
  isGeneratingChecklist,
  isGenerating,
  imageDisplayUrl,
  handleGenerateChecklist,
  handleGenerateImage,
  handleDownload,
  handleCopy,
  workspaceBusy = false,
}: ImageGeneratorToolbarProps) {
  const controlsDisabled = workspaceBusy || isGenerating || isGeneratingChecklist;
  const actionBtnClass = cn(BULK_HEADER_TOOL_BTN, "min-w-0 flex-1 justify-center");
  const isSolo = imageSourceMode === "solo";

  return (
    <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5" role="group" aria-label="Image options">
        <ToolbarSelect
          value={imageSourceMode}
          onValueChange={(v) => setImageSourceMode(v as UseImageGeneratorResult["imageSourceMode"])}
          disabled={controlsDisabled}
        >
          <SelectTrigger className={cn(BULK_HEADER_SELECT_TRIGGER, "w-full")} aria-label="Image source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem className="text-base" value="featured">
              Featured
            </SelectItem>
            <SelectItem className="text-base" value="section">
              Section
            </SelectItem>
            <SelectItem className="text-base" value="solo">
              Solo
            </SelectItem>
          </SelectContent>
        </ToolbarSelect>

        {imageSourceMode === "section" ? (
          <ToolbarSelect
            value={selectedSection ?? ""}
            onValueChange={(v) => setSelectedSection(v || null)}
            disabled={controlsDisabled || availableSections.length === 0}
          >
            <SelectTrigger className={cn(BULK_HEADER_SELECT_TRIGGER, "w-full")} aria-label="Section">
              <SelectValue placeholder={availableSections.length === 0 ? "No sections" : "Choose section"} />
            </SelectTrigger>
            <SelectContent position="popper">
              {availableSections.map((section, index) => (
                <SelectItem key={index} className="text-base" value={section.header}>
                  {section.header}
                </SelectItem>
              ))}
            </SelectContent>
          </ToolbarSelect>
        ) : null}

        <ToolbarSelect
          value={isCustomModel ? "custom" : imageModel}
          onValueChange={(value) => {
            if (value === "custom") {
              setIsCustomModel(true);
            } else {
              setIsCustomModel(false);
              setImageModel(value);
            }
          }}
          disabled={controlsDisabled}
        >
          <SelectTrigger className={cn(BULK_HEADER_SELECT_TRIGGER, "w-full")} aria-label="Image model">
            <SelectValue placeholder="Image model" />
          </SelectTrigger>
          <SelectContent position="popper">
            {IMAGE_MODEL_PRESETS.map((preset) => (
              <SelectItem key={preset.value} className="text-base" value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem className="text-base" value="custom">
              Custom model
            </SelectItem>
          </SelectContent>
        </ToolbarSelect>
      </div>

      <div className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />

      <div className="flex min-w-0 flex-1 items-center gap-1.5" role="group" aria-label="Generate image">
        {imageDisplayUrl ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={actionBtnClass}
              disabled={workspaceBusy || isGenerating}
              aria-label="Download image"
              title="Download image"
              onClick={() => void handleDownload()}
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Download
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={actionBtnClass}
              disabled={workspaceBusy || isGenerating}
              aria-label="Copy image"
              title="Copy image"
              onClick={() => void handleCopy()}
            >
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
              Copy
            </Button>
          </>
        ) : null}
        <ImageGeneratorRunButton
          hasApiKey={hasApiKey}
          hasGeneratedChecklist={hasGeneratedChecklist}
          isGeneratingChecklist={isGeneratingChecklist}
          isGenerating={isGenerating}
          workspaceBusy={workspaceBusy}
          skipChecklist={isSolo}
          onGenerateChecklist={() => void handleGenerateChecklist()}
          onGenerateImage={() => void handleGenerateImage()}
        />
      </div>
    </div>
  );
}
