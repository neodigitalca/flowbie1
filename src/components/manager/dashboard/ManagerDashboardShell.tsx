import type { ReactNode } from "react";
import { DashboardWorkspaceHeader } from "@/components/manager/dashboard/DashboardWorkspaceHeader";
import { CONTENT_OPTIMIZER_BODY_INSET_CLASS } from "@/components/overview/overview-tab/overview-tab-content-constants";
import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
  SEO_WORKSPACE_SHELL_CLASS,
} from "@/components/seo/seo-workspace-layout";
import type { ManagerSettingsClusterId } from "@/components/manager/manager-settings-cluster";
import { cn } from "@/lib/utils";

export type ManagerDashboardSection = {
  id: ManagerSettingsClusterId;
  content: ReactNode;
};

export type ManagerDashboardShellProps = {
  activeSection: ManagerSettingsClusterId;
  onSectionChange: (id: ManagerSettingsClusterId) => void;
  sections: ManagerDashboardSection[];
  visibleSectionIds?: readonly ManagerSettingsClusterId[];
};

export function ManagerDashboardShell({
  activeSection,
  onSectionChange,
  sections,
  visibleSectionIds,
}: ManagerDashboardShellProps) {
  const activeContent = sections.find((section) => section.id === activeSection)?.content;

  return (
    <div className={cn(SEO_WORKSPACE_SHELL_CLASS, "font-sans text-base")}>
      <div className={SEO_WORKSPACE_HEADER_CLASS}>
        <DashboardWorkspaceHeader
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          visibleSectionIds={visibleSectionIds}
        />
      </div>
      <div className={cn(SEO_WORKSPACE_BODY_SCROLL_CLASS, CONTENT_OPTIMIZER_BODY_INSET_CLASS)}>
        {activeContent}
      </div>
    </div>
  );
}
