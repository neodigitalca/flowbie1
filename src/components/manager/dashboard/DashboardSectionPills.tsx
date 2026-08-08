import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { ManagerSettingsClusterId } from "@/components/manager/manager-settings-cluster";
import {
  DASHBOARD_SECTION_LABELS,
  DASHBOARD_SECTION_ORDER,
} from "@/components/manager/dashboard/dashboard-section-labels";
import { cn } from "@/lib/utils";

export type DashboardSectionPillsProps = {
  activeSection: ManagerSettingsClusterId;
  onSectionChange: (id: ManagerSettingsClusterId) => void;
  disabled?: boolean;
  className?: string;
  sectionOrder?: readonly ManagerSettingsClusterId[];
};

export function DashboardSectionPills({
  activeSection,
  onSectionChange,
  disabled = false,
  className,
  sectionOrder = DASHBOARD_SECTION_ORDER,
}: DashboardSectionPillsProps) {
  return (
    <div
      className={cn("flex min-w-0 w-full max-w-full items-stretch gap-1", className)}
      role="group"
      aria-label="Dashboard section"
    >
      {sectionOrder.map((section) => (
        <WorkspacePill
          key={section}
          label={DASHBOARD_SECTION_LABELS[section]}
          active={activeSection === section}
          disabled={disabled}
          square
          className="min-w-0 flex-1 basis-0 px-2"
          onClick={() => {
            if (activeSection !== section) onSectionChange(section);
          }}
        />
      ))}
    </div>
  );
}
