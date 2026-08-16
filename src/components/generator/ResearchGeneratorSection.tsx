import { useCallback, useState } from "react";
import { ProposalResearchTab } from "@/components/research/proposal/ProposalResearchTab";
import { CitationResearchTab } from "@/components/research/citation/CitationResearchTab";
import { BacklinkingResearchTab } from "@/components/research/backlinking/BacklinkingResearchTab";
import { ResearchWorkspaceNavProvider } from "@/components/research/ResearchWorkspaceNavContext";
import type { GeneratorWorkspaceChromeBindings } from "@/components/blog-generator/generator-workspace-chrome-bindings";
import {
  type ResearchSectionId,
  readStoredResearchSection,
  writeStoredResearchSection,
} from "@/components/research/research-workspace-sections";

export type ResearchGeneratorSectionProps = GeneratorWorkspaceChromeBindings;

export function ResearchGeneratorSection({
  activeSection,
  onSectionChange,
}: ResearchGeneratorSectionProps) {
  const [researchSection, setResearchSectionState] = useState<ResearchSectionId>(() =>
    readStoredResearchSection(),
  );

  const setResearchSection = useCallback((id: ResearchSectionId) => {
    setResearchSectionState(id);
    writeStoredResearchSection(id);
  }, []);

  const generatorChrome = { activeSection, onSectionChange };

  return (
    <ResearchWorkspaceNavProvider
      value={{
        activeSection: researchSection,
        onSectionChange: setResearchSection,
      }}
    >
      {researchSection === "research-citation" ? (
        <CitationResearchTab generatorChrome={generatorChrome} />
      ) : researchSection === "research-backlinking" ? (
        <BacklinkingResearchTab generatorChrome={generatorChrome} />
      ) : (
        <ProposalResearchTab generatorChrome={generatorChrome} />
      )}
    </ResearchWorkspaceNavProvider>
  );
}
