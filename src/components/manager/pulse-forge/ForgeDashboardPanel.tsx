import React from "react";
import { ChevronRight } from "lucide-react";
import { FORGE_DASHBOARD_PANEL_SHELL_CLASS } from "@/components/manager/pulse-forge/forge-dashboard-styles";

export type ForgeDashboardPanelProps = {
  title: string;
  children: React.ReactNode;
};

export function ForgeDashboardPanel({
  title,
  children,
}: ForgeDashboardPanelProps): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-base font-semibold text-white">{title}</p>
        <span className="inline-flex items-center gap-0.5 text-base text-muted-foreground">
          Explore
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </span>
      </div>
      <div className={FORGE_DASHBOARD_PANEL_SHELL_CLASS}>
        <div className="flex flex-col gap-0">{children}</div>
      </div>
    </div>
  );
}
