import React, { useCallback, useState } from "react";
import { ProposalResearchTab } from "@/components/research/proposal/ProposalResearchTab";
import { CitationResearchTab } from "@/components/research/citation/CitationResearchTab";
import { BacklinkingResearchTab } from "@/components/research/backlinking/BacklinkingResearchTab";
import { ResearchWorkspaceNavProvider } from "@/components/research/ResearchWorkspaceNavContext";
import {
  type ResearchSectionId,
  readStoredResearchSection,
  writeStoredResearchSection,
} from "@/components/research/research-workspace-sections";

export const ResearchWorkspaceShell: React.FC = () => {
  const [section, setSectionState] = useState<ResearchSectionId>(() => readStoredResearchSection());

  const setSection = useCallback((id: ResearchSectionId) => {
    setSectionState(id);
    writeStoredResearchSection(id);
  }, []);

  return (
    <ResearchWorkspaceNavProvider
      value={{
        activeSection: section,
        onSectionChange: setSection,
      }}
    >
      {section === "research-citation" ? (
        <CitationResearchTab />
      ) : section === "research-backlinking" ? (
        <BacklinkingResearchTab />
      ) : (
        <ProposalResearchTab />
      )}
    </ResearchWorkspaceNavProvider>
  );
};
