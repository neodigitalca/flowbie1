import type { LucideIcon } from "lucide-react";
import {
  ArrowUpToLine,
  Crosshair,
  FileSpreadsheet,
  Image,
  MapPin,
  MessageSquare,
  Newspaper,
  Swords,
  Workflow,
} from "lucide-react";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";

const SECTIONS: { id: BlogGeneratorSectionId; label: string; icon: LucideIcon }[] = [
  { id: "opt", label: "Opt", icon: Crosshair },
  { id: "bulk-csv", label: "CSV", icon: FileSpreadsheet },
  { id: "bulk-prompt", label: "Prompt", icon: MessageSquare },
  { id: "bulk-blog-import", label: "Import", icon: ArrowUpToLine },
  { id: "bulk-press-release", label: "PR", icon: Newspaper },
  { id: "entity", label: "Entity", icon: MapPin },
  { id: "competitor", label: "Competitor", icon: Swords },
  { id: "flow", label: "Flow", icon: Workflow },
  { id: "image", label: "Image", icon: Image },
];

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
  const visibleSections = showOpt ? SECTIONS : SECTIONS.filter((s) => s.id !== "opt");

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
          onClick={() => onSectionChange(id)}
        />
      ))}
    </div>
  );
}
