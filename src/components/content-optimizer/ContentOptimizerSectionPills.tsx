import {
  WORKSPACE_PILL_ACTIVE,
  WORKSPACE_PILL_INACTIVE,
  WORKSPACE_PILL_SQUARE_BASE,
} from "@/components/shared/workspace-pill-styles";
import type { ContentOptimizerSectionId } from "@/components/content-optimizer/content-optimizer-sections";
import { cn } from "@/lib/utils";

export type ContentOptimizerSectionPillsProps = {
  activeSection: ContentOptimizerSectionId;
  onSectionChange: (id: ContentOptimizerSectionId) => void;
  disabled?: boolean;
};

/** Single two-state control: off = normal content, on = multi-site (green). */
export function ContentOptimizerSectionPills({
  activeSection,
  onSectionChange,
  disabled = false,
}: ContentOptimizerSectionPillsProps) {
  const multiSiteActive = activeSection === "multi-site";

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={multiSiteActive}
      aria-label={multiSiteActive ? "Multi-site mode on" : "Multi-site mode off"}
      onClick={() => onSectionChange(multiSiteActive ? "content" : "multi-site")}
      className={cn(
        WORKSPACE_PILL_SQUARE_BASE,
        "h-8 min-w-[5.5rem] shrink-0",
        multiSiteActive ? WORKSPACE_PILL_ACTIVE : WORKSPACE_PILL_INACTIVE,
        disabled && "pointer-events-none opacity-50",
      )}
    >
      Multi-site
    </button>
  );
}
