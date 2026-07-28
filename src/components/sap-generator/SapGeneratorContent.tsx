import React from "react";
import type { WordPressSite } from "@/components/integrations/types";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import {
  LocalAnalysisPanel,
  type LocalAnalysisWorkspaceControls,
} from "@/components/sap-generator/LocalAnalysisPanel";
import { SEO_WORKSPACE_SHELL_CLASS } from "@/components/seo/seo-workspace-layout";
import { cn } from "@/lib/utils";

export interface SapGeneratorContentProps {
  localAnalysisSite: WordPressSite;
  localAnalysisWorkspaceKey: string;
  localAnalysisWorkspace: LocalAnalysisWorkspaceControls;
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  apiKey: string;
  dataForSEOApiKey: string;
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  flowPurpose?: string;
}

export const SapGeneratorContent: React.FC<SapGeneratorContentProps> = ({
  localAnalysisSite,
  localAnalysisWorkspaceKey,
  localAnalysisWorkspace,
  activeSection,
  onSectionChange,
  apiKey,
  dataForSEOApiKey,
  selectedModel,
  temperature,
  maxTokens,
  topP,
  flowPurpose,
}) => (
  <div className={cn(SEO_WORKSPACE_SHELL_CLASS, "min-h-0 gap-0")}>
    <LocalAnalysisPanel
      key={localAnalysisWorkspaceKey}
      site={localAnalysisSite}
      workspace={localAnalysisWorkspace}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      apiKey={apiKey}
      dataForSEOApiKey={dataForSEOApiKey}
      selectedModel={selectedModel}
      temperature={temperature}
      maxTokens={maxTokens}
      topP={topP}
      flowPurpose={flowPurpose}
    />
  </div>
);
