import { ResearchSectionPills } from "@/components/research/ResearchSectionPills";
import { useResearchWorkspaceNav } from "@/components/research/ResearchWorkspaceNavContext";

export function ResearchSectionPillsFromContext() {
  const nav = useResearchWorkspaceNav();
  if (!nav) return null;

  return (
    <ResearchSectionPills
      activeSection={nav.activeSection}
      onSectionChange={nav.onSectionChange}
      disabled={nav.sectionSwitchDisabled}
    />
  );
}
