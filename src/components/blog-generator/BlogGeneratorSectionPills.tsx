import { WorkspacePill } from "@/components/shared/WorkspacePill";
import {
  BLOG_GENERATOR_SECTION_DEFS,
  type BlogGeneratorSectionId,
} from "@/components/blog-generator/blog-generator-sections";

export type BlogGeneratorSectionPillsProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  disabled?: boolean;
  /** Hide Opt when team lacks content-optimizer permission. */
  showOpt?: boolean;
};

export function BlogGeneratorSectionPills({
  activeSection,
  onSectionChange,
  disabled = false,
  showOpt = true,
}: BlogGeneratorSectionPillsProps) {
  const visibleSections = showOpt
    ? BLOG_GENERATOR_SECTION_DEFS
    : BLOG_GENERATOR_SECTION_DEFS.filter((s) => s.id !== "opt");

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1" aria-label="Generator mode">
      {visibleSections.map(({ id, label, icon }) => (
        <WorkspacePill
          key={id}
          label={label}
          icon={icon}
          iconOnly
          active={activeSection === id}
          disabled={disabled}
          onClick={() => {
            if (activeSection !== id) onSectionChange(id);
          }}
        />
      ))}
    </div>
  );
}
