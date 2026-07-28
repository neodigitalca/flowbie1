import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { ResearchSectionId } from "@/components/research/research-workspace-sections";

const SECTIONS: { id: ResearchSectionId; label: string }[] = [
  { id: "research-proposal", label: "Proposal" },
  { id: "research-citation", label: "Citation" },
  { id: "research-backlinking", label: "Backlinking" },
];

export type ResearchSectionPillsProps = {
  activeSection: ResearchSectionId;
  onSectionChange: (id: ResearchSectionId) => void;
  disabled?: boolean;
};

export function ResearchSectionPills({
  activeSection,
  onSectionChange,
  disabled = false,
}: ResearchSectionPillsProps) {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1" aria-label="Research section">
      {SECTIONS.map(({ id, label }) => (
        <WorkspacePill
          key={id}
          label={label}
          active={activeSection === id}
          disabled={disabled}
          onClick={() => onSectionChange(id)}
        />
      ))}
    </div>
  );
}
