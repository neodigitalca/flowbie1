import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GeneratorToolbarFrame } from "@/components/blog-generator/GeneratorToolbarFrame";
import { GENERATOR_SELECT, GENERATOR_TOOLBAR_SLOT_RESERVE } from "@/components/blog-generator/generator-toolbar-theme";
import { BULK_HEADER_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
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
  const isSolo = imageSourceMode === "solo";
  const showSectionSelect = imageSourceMode === "section";

  return (
    <GeneratorToolbarFrame
      primary={
        <>
          <Select
            value={imageSourceMode}
            onValueChange={(v) => setImageSourceMode(v as UseImageGeneratorResult["imageSourceMode"])}
            disabled={controlsDisabled}
          >
            <SelectTrigger className={GENERATOR_SELECT} aria-label="Image source">
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
          </Select>

          <div className={cn(!showSectionSelect && GENERATOR_TOOLBAR_SLOT_RESERVE, GENERATOR_SELECT)}>
            {showSectionSelect ? (
              <Select
                value={selectedSection ?? ""}
                onValueChange={(v) => setSelectedSection(v || null)}
                disabled={controlsDisabled || availableSections.length === 0}
              >
                <SelectTrigger className={GENERATOR_SELECT} aria-label="Section">
                  <SelectValue placeholder={availableSections.length === 0 ? "No sections" : "Choose section"} />
                </SelectTrigger>
                <SelectContent position="popper">
                  {availableSections.map((section, index) => (
                    <SelectItem key={index} className="text-base" value={section.header}>
                      {section.header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select disabled>
                <SelectTrigger className={cn(GENERATOR_SELECT, "invisible pointer-events-none")} aria-hidden tabIndex={-1}>
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
              </Select>
            )}
          </div>

          <Select
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
            <SelectTrigger className={GENERATOR_SELECT} aria-label="Image model">
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
          </Select>
        </>
      }
      actions={
        <>
          {imageDisplayUrl ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={BULK_HEADER_TOOL_BTN}
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
                className={BULK_HEADER_TOOL_BTN}
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
        </>
      }
    />
  );
}
