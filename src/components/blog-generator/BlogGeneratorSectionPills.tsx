import type { LucideIcon } from "lucide-react";
import { FileUp, Image, MapPin, MessageSquare, Newspaper, Upload, Workflow } from "lucide-react";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";

const SECTIONS: { id: BlogGeneratorSectionId; label: string; icon: LucideIcon }[] = [
  { id: "bulk-csv", label: "CSV", icon: Upload },
  { id: "bulk-prompt", label: "Prompt", icon: MessageSquare },
  { id: "bulk-blog-import", label: "Blog Import", icon: FileUp },
  { id: "bulk-press-release", label: "PR", icon: Newspaper },
  { id: "entity", label: "Entity", icon: MapPin },
  { id: "flow", label: "Flow", icon: Workflow },
  { id: "image", label: "Image", icon: Image },
];

export type BlogGeneratorSectionPillsProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  disabled?: boolean;
};

export function BlogGeneratorSectionPills({
  activeSection,
  onSectionChange,
  disabled = false,
}: BlogGeneratorSectionPillsProps) {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1" aria-label="Generator mode">
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
