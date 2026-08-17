import React from "react";
import { Settings, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskProject, TeamTask } from "@/lib/tasks-types";
import { AutomationTaskExecuteButton } from "@/components/manager/tasks/AutomationTaskExecuteButton";
import { forgeTableRowStripeClass } from "@/components/manager/pulse-forge/forge-dashboard-styles";
import { FORGE_AUTOMATION_TD_CLASS } from "@/lib/pulse-forge/forge-automation-row-meta";
import {
  getPropertyListRowBlackIconButtonClass,
  getPropertyListRowIconButtonHoverGlowClass,
} from "@/components/integrations/wordpress/cyberpunk-theme";

export type ForgeAutomationListRowProps = {
  rank: number;
  stripeIndex: number;
  title: string;
  siteName: string;
  scheduleLabel?: string;
  compareLabel?: string;
  executionTimeLabel?: string;
  tdeLabel?: string;
  statusLabel: string;
  runCount?: string;
  active: boolean;
  demoMode?: boolean;
  project?: TaskProject;
  teamId?: number | null;
  task?: TeamTask | null;
  showExecute?: boolean;
  visibilityLabel?: string;
  onOpenSettings?: () => void;
  onDelete?: () => void;
  onExecuted?: () => void;
};

export function ForgeAutomationListRow({
  rank,
  stripeIndex,
  title,
  siteName,
  scheduleLabel,
  compareLabel,
  executionTimeLabel,
  tdeLabel,
  statusLabel,
  runCount,
  active,
  demoMode = false,
  visibilityLabel,
  project,
  teamId = null,
  task = null,
  showExecute = false,
  onOpenSettings,
  onDelete,
  onExecuted,
}: ForgeAutomationListRowProps): React.ReactElement {
  const interactive = !demoMode && Boolean(onOpenSettings);

  return (
    <>
      <tr
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? onOpenSettings : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenSettings?.();
                }
              }
            : undefined
        }
        className={cn(
          forgeTableRowStripeClass(stripeIndex, { active }),
          interactive && "cursor-pointer",
          demoMode && "opacity-95",
        )}
      >
        <td className={cn(FORGE_AUTOMATION_TD_CLASS, "w-10 tabular-nums text-muted-foreground")}>
          {rank}
        </td>
        <td className={cn(FORGE_AUTOMATION_TD_CLASS, "w-6")}>
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              active ? "bg-primary" : "bg-zinc-700",
            )}
            aria-hidden
          />
        </td>
        <td className={cn(FORGE_AUTOMATION_TD_CLASS, "min-w-[14rem] max-w-[20rem] font-medium text-white")}>
          <span className="block truncate">{title}</span>
          {visibilityLabel ? (
            <span className="block truncate text-base text-muted-foreground">{visibilityLabel}</span>
          ) : null}
        </td>
        <td className={cn(FORGE_AUTOMATION_TD_CLASS, "min-w-[9rem] max-w-[12rem] text-muted-foreground")}>
          <span className="block truncate">{siteName}</span>
        </td>
        <td className={cn(FORGE_AUTOMATION_TD_CLASS, "min-w-[6.5rem] text-muted-foreground")}>
          {scheduleLabel ?? "—"}
        </td>
        <td className={cn(FORGE_AUTOMATION_TD_CLASS, "min-w-[5rem] text-muted-foreground")}>
          {compareLabel ?? "—"}
        </td>
        <td className={cn(FORGE_AUTOMATION_TD_CLASS, "min-w-[6.5rem] tabular-nums text-muted-foreground")}>
          {executionTimeLabel ?? "—"}
        </td>
        <td
          className={cn(FORGE_AUTOMATION_TD_CLASS, "min-w-[5.5rem] tabular-nums text-muted-foreground")}
          title="Time (Edmonton)"
        >
          {tdeLabel ?? "—"}
        </td>
        <td className={cn(FORGE_AUTOMATION_TD_CLASS, "min-w-[5rem]", active ? "text-primary" : "text-muted-foreground")}>
          {statusLabel}
        </td>
        <td className={cn(FORGE_AUTOMATION_TD_CLASS, "min-w-[5rem] tabular-nums text-white")}>
          {runCount ?? "—"}
        </td>
        <td className={cn(FORGE_AUTOMATION_TD_CLASS, "w-[7.5rem]")}>
          <div className="flex items-center gap-0.5">
            {showExecute && task ? (
              <AutomationTaskExecuteButton
                teamId={teamId}
                taskId={task.id}
                task={task}
                project={project ?? null}
                variant="icon"
                className={cn(
                  getPropertyListRowBlackIconButtonClass(true),
                  getPropertyListRowIconButtonHoverGlowClass("powerOn"),
                )}
                onExecuted={onExecuted}
              />
            ) : null}
            <button
              type="button"
              aria-label={`Settings for ${title}`}
              disabled={demoMode}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings?.();
              }}
              className={cn(
                getPropertyListRowBlackIconButtonClass(true),
                getPropertyListRowIconButtonHoverGlowClass("powerOn"),
              )}
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Delete ${title}`}
              disabled={demoMode}
              onClick={(e) => {
                e.stopPropagation();
                if (demoMode || !onDelete) return;
                onDelete();
              }}
              className={cn(
                getPropertyListRowBlackIconButtonClass(true),
                getPropertyListRowIconButtonHoverGlowClass("destructive"),
              )}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    </>
  );
}
