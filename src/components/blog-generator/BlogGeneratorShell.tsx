import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BulkBlogGenerationTab } from "@/components/keyword-research/BulkBlogGenerationTab";
import { FlowGeneratorSection } from "@/components/generator/FlowGeneratorSection";
import { ResearchGeneratorSection } from "@/components/generator/ResearchGeneratorSection";
import { ReportingTab } from "@/components/research/reporting/ReportingTab";
import { ImageGeneratorSection } from "@/components/generator/ImageGeneratorSection";
import type { GeneratorFreeFlowBindings } from "@/components/generator/generator-free-flow-bindings";
import { CompetitorGeneratorShell } from "@/components/competitor-generator/CompetitorGeneratorShell";
import { SapGeneratorShell } from "@/components/sap-generator/SapGeneratorShell";
import { ContentOptimizerTabContent } from "@/components/content-optimizer/ContentOptimizerTabContent";
import {
  type BlogGeneratorSectionId,
  readStoredBlogGeneratorSection,
  registerBlogGeneratorSectionListener,
  unregisterBlogGeneratorSectionListener,
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

  useEffect(() => {
    const onExternalSection = (id: BlogGeneratorSectionId) => {
      setSectionState(id);
    };
    registerBlogGeneratorSectionListener(onExternalSection);
    return () => unregisterBlogGeneratorSectionListener(onExternalSection);
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

  if (section === "opt") {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <ContentOptimizerTabContent
          apiKey={openRouterApiKey}
          selectedModel={selectedModel ?? ""}
          temperature={temperature ?? 0.7}
          maxTokens={maxTokens ?? 4096}
          topP={topP ?? 1}
          generatorChrome={{ activeSection: section, onSectionChange: setSection }}
        />
      </div>
    );
  }

  if (section === "research") {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <ResearchGeneratorSection activeSection={section} onSectionChange={setSection} />
      </div>
    );
  }

  if (section === "report") {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <ReportingTab activeSection={section} onSectionChange={setSection} />
      </div>
    );
  }

  if (section === "flow") {
    if (!freeFlowBindings) return null;
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

  if (section === "image") {
    if (!freeFlowBindings) return null;
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

  if (section === "competitor") {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <CompetitorGeneratorShell
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
