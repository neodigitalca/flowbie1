import { createContext, useContext, type ReactNode } from "react";
import type { ResearchSectionId } from "@/components/research/research-workspace-sections";

export type ResearchWorkspaceNavContextValue = {
  activeSection: ResearchSectionId;
  onSectionChange: (id: ResearchSectionId) => void;
  sectionSwitchDisabled?: boolean;
};

const ResearchWorkspaceNavContext = createContext<ResearchWorkspaceNavContextValue | null>(null);

export function ResearchWorkspaceNavProvider({
  value,
  children,
}: {
  value: ResearchWorkspaceNavContextValue;
  children: ReactNode;
}) {
  return <ResearchWorkspaceNavContext.Provider value={value}>{children}</ResearchWorkspaceNavContext.Provider>;
}

export function useResearchWorkspaceNav(): ResearchWorkspaceNavContextValue | null {
  return useContext(ResearchWorkspaceNavContext);
}
