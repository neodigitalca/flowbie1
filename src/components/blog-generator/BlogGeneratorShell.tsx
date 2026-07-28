import React, { useCallback, useMemo, useState } from "react";
import { BulkBlogGenerationTab } from "@/components/keyword-research/BulkBlogGenerationTab";
import { FlowGeneratorSection } from "@/components/generator/FlowGeneratorSection";
import { ImageGeneratorSection } from "@/components/generator/ImageGeneratorSection";
import type { GeneratorFreeFlowBindings } from "@/components/generator/generator-free-flow-bindings";
import { SapGeneratorShell } from "@/components/sap-generator/SapGeneratorShell";
import {
  type BlogGeneratorSectionId,
  readStoredBlogGeneratorSection,
  writeStoredBlogGeneratorSection,
} from "./blog-generator-sections";

export interface BlogGeneratorShellProps {
  flowPurpose?: string;
  /** Bulk generator tabs (CSV, Prompt, Blog import) and Press release. */
  dataForSEOApiKey?: string;
  openRouterApiKey: string;
  selectedModel?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  freeFlowBindings?: GeneratorFreeFlowBindings;
  onResetBlueprint?: () => void;
}

export const BlogGeneratorShell: React.FC<BlogGeneratorShellProps> = ({
  flowPurpose,
  dataForSEOApiKey,
  openRouterApiKey,
  selectedModel,
  temperature,
  maxTokens,
  topP,
  freeFlowBindings,
  onResetBlueprint,
}) => {
  const [section, setSectionState] = useState<BlogGeneratorSectionId>(() =>
    readStoredBlogGeneratorSection(),
  );

  const setSection = useCallback((id: BlogGeneratorSectionId) => {
    setSectionState(id);
    writeStoredBlogGeneratorSection(id);
  }, []);

  const sharedTabProps = useMemo(
    () => ({
      openRouterApiKey,
      dataForSEOApiKey,
      pressReleaseDataForSeoApiKey: dataForSEOApiKey,
      selectedModel,
      temperature,
      maxTokens,
      topP,
      flowPurpose,
      activeSection: section,
      onSectionChange: setSection,
    }),
    [dataForSEOApiKey, openRouterApiKey, selectedModel, temperature, maxTokens, topP, flowPurpose, section, setSection],
  );

  if (section === "flow" && freeFlowBindings) {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <FlowGeneratorSection
          activeSection={section}
          onSectionChange={setSection}
          bindings={freeFlowBindings}
          onResetBlueprint={onResetBlueprint}
        />
      </div>
    );
  }

  if (section === "image" && freeFlowBindings) {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <ImageGeneratorSection
          activeSection={section}
          onSectionChange={setSection}
          bindings={freeFlowBindings}
        />
      </div>
    );
  }

  if (section === "entity") {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <SapGeneratorShell
          apiKey={openRouterApiKey}
          dataForSEOApiKey={dataForSEOApiKey ?? ""}
          selectedModel={selectedModel ?? ""}
          temperature={temperature ?? 0.7}
          maxTokens={maxTokens ?? 4096}
          topP={topP ?? 1}
          flowPurpose={flowPurpose}
          activeSection={section}
          onSectionChange={setSection}
        />
      </div>
    );
  }

  const variant =
    section === "bulk-press-release"
      ? "press-release"
      : section === "bulk-blog-import"
        ? "blog-import"
        : section === "bulk-prompt"
          ? "prompt"
          : "csv";

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <BulkBlogGenerationTab variant={variant} {...sharedTabProps} />
    </div>
  );
};
