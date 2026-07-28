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
};

export function DashboardSectionPills({
  activeSection,
  onSectionChange,
  disabled = false,
  className,
}: DashboardSectionPillsProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto", className)}
      role="group"
      aria-label="Dashboard section"
    >
      {DASHBOARD_SECTION_ORDER.map((section) => (
        <WorkspacePill
          key={section}
          label={DASHBOARD_SECTION_LABELS[section]}
          active={activeSection === section}
          disabled={disabled}
          square
          onClick={() => {
            if (activeSection !== section) onSectionChange(section);
          }}
        />
      ))}
    </div>
  );
}
