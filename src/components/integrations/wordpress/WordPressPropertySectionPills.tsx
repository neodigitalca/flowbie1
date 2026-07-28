import { WorkspacePill } from "@/components/shared/WorkspacePill";
import { cn } from "@/lib/utils";

export type WordPressPropertySectionPillItem = {
  id: string;
  label: string;
};

export type WordPressPropertySectionPillsProps = {
  sections: WordPressPropertySectionPillItem[];
  activeSectionId: string;
  onSectionChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
};

export function WordPressPropertySectionPills({
  sections,
  activeSectionId,
  onSectionChange,
  disabled = false,
  className,
}: WordPressPropertySectionPillsProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto", className)}
      role="group"
      aria-label="Property section"
    >
      {sections.map((section) => (
        <WorkspacePill
          key={section.id}
          label={section.label}
          active={activeSectionId === section.id}
          disabled={disabled}
          onClick={() => {
            if (activeSectionId !== section.id) onSectionChange(section.id);
          }}
        />
      ))}
    </div>
  );
}
