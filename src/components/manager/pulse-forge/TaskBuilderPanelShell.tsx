import React from "react";
import { cn } from "@/lib/utils";
import {
  FORGE_DASHBOARD_SECTION_LABEL_CLASS,
  FORGE_TASK_BUILDER_PANEL_SHELL_CLASS,
} from "@/components/manager/pulse-forge/forge-dashboard-styles";

export type TaskBuilderPanelShellProps = {
  label?: string;
  children: React.ReactNode;
  className?: string;
};

export function TaskBuilderPanelShell({
  label,
  children,
  className,
}: TaskBuilderPanelShellProps): React.ReactElement {
  return (
    <div className={cn(FORGE_TASK_BUILDER_PANEL_SHELL_CLASS, className)}>
      {label ? (
        <div className="shrink-0 border-b border-white/10 px-4 py-3">
          <span className={FORGE_DASHBOARD_SECTION_LABEL_CLASS}>{label}</span>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">{children}</div>
    </div>
  );
}
