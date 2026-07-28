import type { ManagerSettingsClusterId } from "@/components/manager/manager-settings-cluster";
import { PropertiesWorkspaceToolbar } from "@/components/manager/dashboard/PropertiesWorkspaceToolbar";
import { usePropertiesDashboardToolbarState } from "@/components/manager/dashboard/PropertiesDashboardChromeContext";

export type DashboardToolbarProps = {
  activeSection: ManagerSettingsClusterId;
};

export function DashboardToolbar({ activeSection }: DashboardToolbarProps) {
  const propertiesToolbar = usePropertiesDashboardToolbarState();

  if (activeSection !== "properties" || !propertiesToolbar) {
    return null;
  }

  return <PropertiesWorkspaceToolbar {...propertiesToolbar} />;
}
