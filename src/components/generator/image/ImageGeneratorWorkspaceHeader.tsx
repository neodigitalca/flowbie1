import { useMemo } from "react";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import { ImageGeneratorToolbar } from "@/components/generator/image/ImageGeneratorToolbar";
import type { UseImageGeneratorResult } from "@/components/generator/image/image-generator-types";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import { buildImageBulkGeneratorDetailsProps } from "@/lib/generator/image/image-bulk-details-bindings";

export type ImageGeneratorWorkspaceHeaderProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  workspaceBusy: boolean;
  generator: UseImageGeneratorResult;
  onDetailsOpenChange?: (open: boolean) => void;
};

export function ImageGeneratorWorkspaceHeader({
  activeSection,
  onSectionChange,
  workspaceBusy,
  generator,
  onDetailsOpenChange,
}: ImageGeneratorWorkspaceHeaderProps) {
  const imageBusy = generator.isGenerating || generator.isGeneratingChecklist;
  const hasRefs = Boolean(generator.referenceResearch);
  const canOpenDetails = true;

  const detailsPanelProps = useMemo(
    () =>
      buildImageBulkGeneratorDetailsProps({
        workspaceBusy,
        isGenerating: generator.isGenerating,
        isGeneratingChecklist: generator.isGeneratingChecklist,
        hasGeneratedChecklist: generator.hasGeneratedChecklist,
        referenceResearch: generator.referenceResearch,
        imageDisplayUrl: generator.imageDisplayUrl,
        userPrompt: generator.userPrompt,
        imageSourceMode: generator.imageSourceMode,
        error: generator.error,
      }),
    [
      workspaceBusy,
      generator.isGenerating,
      generator.isGeneratingChecklist,
      generator.hasGeneratedChecklist,
      generator.referenceResearch,
      generator.imageDisplayUrl,
      generator.userPrompt,
      generator.imageSourceMode,
      generator.error,
    ],
  );

  let progressSnapshot: MetaBulkMicroSnapshot = {
    label: "Image",
    completed: 0,
    total: 1,
    statusMessage: "Ready",
  };
  if (generator.isGeneratingChecklist) {
    progressSnapshot = {
      label: "Checklist",
      completed: 0,
      total: 1,
      statusMessage: "Building checklist…",
    };
  } else if (generator.isGenerating) {
    progressSnapshot = {
      label: "Image",
      completed: 0,
      total: 1,
      statusMessage: "Gathering references and generating…",
    };
  } else if (generator.imageDisplayUrl) {
    progressSnapshot = {
      label: "Image",
      completed: 1,
      total: 1,
      statusMessage: hasRefs
        ? `References: ${generator.referenceResearch?.references.length ?? 0}`
        : "Generated",
    };
  }

  return (
    <BlogGeneratorWorkspaceChrome
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionSwitchDisabled={workspaceBusy || imageBusy}
      workspaceBusy={workspaceBusy || imageBusy}
      progressBand="full"
      progressSnapshot={progressSnapshot}
      hideIdleProgressTrack
      canOpenDetails={canOpenDetails}
      isProcessing={imageBusy}
      detailsPanelId="image-generator-details-panel"
      onDetailsOpenChange={onDetailsOpenChange}
      detailsPanel={
        <BulkGeneratorDetailsDrawer
          variant="csv"
          postDestination="local"
          wpConfig={null}
          {...detailsPanelProps}
        />
      }
      toolbar={
        <ImageGeneratorToolbar
          workspaceBusy={workspaceBusy}
          imageSourceMode={generator.imageSourceMode}
          setImageSourceMode={generator.setImageSourceMode}
          selectedSection={generator.selectedSection}
          setSelectedSection={generator.setSelectedSection}
          availableSections={generator.availableSections}
          imageModel={generator.imageModel}
          setImageModel={generator.setImageModel}
          isCustomModel={generator.isCustomModel}
          setIsCustomModel={generator.setIsCustomModel}
          hasApiKey={generator.hasApiKey}
          hasGeneratedChecklist={generator.hasGeneratedChecklist}
          isGeneratingChecklist={generator.isGeneratingChecklist}
          isGenerating={generator.isGenerating}
          imageDisplayUrl={generator.imageDisplayUrl}
          handleGenerateChecklist={generator.handleGenerateChecklist}
          handleGenerateImage={generator.handleGenerateImage}
          handleDownload={generator.handleDownload}
          handleCopy={generator.handleCopy}
        />
      }
    />
  );
}
