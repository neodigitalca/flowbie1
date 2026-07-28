import { LayoutDashboard } from "lucide-react";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { DashboardSectionPills } from "@/components/manager/dashboard/DashboardSectionPills";
import { DashboardToolbar } from "@/components/manager/dashboard/DashboardToolbar";
import type { ManagerSettingsClusterId } from "@/components/manager/manager-settings-cluster";

export type DashboardWorkspaceHeaderProps = {
  activeSection: ManagerSettingsClusterId;
  onSectionChange: (id: ManagerSettingsClusterId) => void;
};

export function DashboardWorkspaceHeader({
  activeSection,
  onSectionChange,
}: DashboardWorkspaceHeaderProps) {
  return (
    <UnifiedWorkspaceChrome
      icon={LayoutDashboard}
      title="Dashboard"
      titleRowEnd={
        <DashboardSectionPills activeSection={activeSection} onSectionChange={onSectionChange} />
      }
      toolbar={<DashboardToolbar activeSection={activeSection} />}
      workspaceBusy={false}
      progressBand="empty"
    />
  );
}
