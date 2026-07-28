import { WorkspacePill } from "@/components/shared/WorkspacePill";
import {
  KNOWLEDGE_BASE_SECTION_LABELS,
  type KnowledgeBaseSectionId,
} from "@/lib/knowledge-base/types";
import { cn } from "@/lib/utils";

export type KnowledgeBaseSectionPillsProps = {
  activeSection: KnowledgeBaseSectionId;
  onSectionChange: (id: KnowledgeBaseSectionId) => void;
  disabled?: boolean;
  className?: string;
};

const SECTION_ORDER: KnowledgeBaseSectionId[] = ["text", "upload", "manager", "scraper"];

export function KnowledgeBaseSectionPills({
  activeSection,
  onSectionChange,
  disabled = false,
  className,
}: KnowledgeBaseSectionPillsProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-nowrap items-center gap-1", className)}
      role="group"
      aria-label="Knowledge base section"
    >
      {SECTION_ORDER.map((section) => (
        <WorkspacePill
          key={section}
          label={KNOWLEDGE_BASE_SECTION_LABELS[section]}
          active={activeSection === section}
          disabled={disabled}
          onClick={() => {
            if (activeSection !== section) onSectionChange(section);
          }}
        />
      ))}
    </div>
  );
}
