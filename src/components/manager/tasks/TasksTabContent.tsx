import React from "react";
import { TasksShell } from "@/components/manager/tasks/TasksShell";

export type TasksTabContentProps = {
  onOpenPulseForge?: () => void;
};

export function TasksTabContent({ onOpenPulseForge }: TasksTabContentProps): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <TasksShell onOpenPulseForge={onOpenPulseForge} />
    </div>
  );
}
