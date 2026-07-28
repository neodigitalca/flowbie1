import { TrendingUp } from "lucide-react";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import {
  GENERATOR_WORKSPACE_TITLE,
  type BlogGeneratorSectionId,
} from "@/components/blog-generator/blog-generator-sections";
import { ImageGeneratorDetailsPanel } from "@/components/generator/image/ImageGeneratorDetailsPanel";
import { ImageGeneratorToolbar } from "@/components/generator/image/ImageGeneratorToolbar";
import type { UseImageGeneratorResult } from "@/components/generator/image/image-generator-types";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";

export type ImageGeneratorWorkspaceHeaderProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  workspaceBusy: boolean;
  generator: UseImageGeneratorResult;
};

export function ImageGeneratorWorkspaceHeader({
  activeSection,
  onSectionChange,
  workspaceBusy,
  generator,
}: ImageGeneratorWorkspaceHeaderProps) {
  const imageBusy = generator.isGenerating || generator.isGeneratingChecklist;
  const hasRefs = Boolean(generator.referenceResearch);
  const canOpenDetails = true;

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
      icon={TrendingUp}
      title={GENERATOR_WORKSPACE_TITLE}
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
      detailsPanel={
        <ImageGeneratorDetailsPanel
          isGenerating={generator.isGenerating}
          isGeneratingChecklist={generator.isGeneratingChecklist}
          error={generator.error}
          imageSourceMode={generator.imageSourceMode}
          referenceResearch={generator.referenceResearch}
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
