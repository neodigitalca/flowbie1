import { useState } from "react";
import { ImageGeneratorBody } from "@/components/generator/image/ImageGeneratorBody";
import { ImageGeneratorWorkspaceHeader } from "@/components/generator/image/ImageGeneratorWorkspaceHeader";
import { useImageGenerator } from "@/components/generator/image/useImageGenerator";
import type { GeneratorFreeFlowBindings } from "@/components/generator/generator-free-flow-bindings";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import { WORKSPACE_DETAILS_DIM_OVERLAY_CLASS } from "@/components/overview/overview-tab/overview-tab-content-constants";
import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
  SEO_WORKSPACE_SHELL_CLASS,
} from "@/components/seo/seo-workspace-layout";
import { cn } from "@/lib/utils";

export type ImageGeneratorSectionProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  bindings: GeneratorFreeFlowBindings;
};

export function ImageGeneratorSection({
  activeSection,
  onSectionChange,
  bindings,
}: ImageGeneratorSectionProps) {
  const pipelineBusy = bindings.isGenerating;
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const generator = useImageGenerator({
    apiKey: bindings.apiKey,
    flowTitle: bindings.flowTitle,
    flowPurpose: "",
    agents: bindings.agents,
    finalOutput: bindings.generationResult.final,
    selectedModel: bindings.selectedModel,
    temperature: bindings.temperature,
    maxTokens: bindings.maxTokens,
    topP: bindings.topP,
  });

  return (
    <div className={SEO_WORKSPACE_SHELL_CLASS}>
      <div className={SEO_WORKSPACE_HEADER_CLASS}>
        <ImageGeneratorWorkspaceHeader
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          workspaceBusy={pipelineBusy}
          generator={generator}
          onDetailsOpenChange={setDetailsDrawerOpen}
        />
      </div>
      <div className={cn(SEO_WORKSPACE_BODY_SCROLL_CLASS, "relative")}>
        {detailsDrawerOpen ? (
          <div className={WORKSPACE_DETAILS_DIM_OVERLAY_CLASS} aria-hidden />
        ) : null}
        <ImageGeneratorBody generator={generator} hideHeader />
      </div>
    </div>
  );
}
