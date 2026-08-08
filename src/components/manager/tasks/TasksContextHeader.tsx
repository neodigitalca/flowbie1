import React from "react";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { TasksViewMode } from "@/lib/tasks-types";

export type TasksContextHeaderProps = {
  contextTitle: string;
  viewMode: TasksViewMode;
  completedToday: number;
  onViewModeChange: (mode: TasksViewMode) => void;
};

const VIEW_MODES: { id: TasksViewMode; label: string }[] = [
  { id: "list", label: "List" },
  { id: "board", label: "Board" },
  { id: "calendar", label: "Calendar" },
  { id: "files", label: "Files" },
];

export function TasksContextHeader({
  contextTitle,
  viewMode,
  completedToday,
  onViewModeChange,
}: TasksContextHeaderProps): React.ReactElement {
  return (
    <div className="flex shrink-0 flex-col bg-zinc-900/50">
      <div className="flex h-12 items-center gap-3 px-3">
        <h2 className="text-base font-semibold text-white">{contextTitle}</h2>
        <div className="ml-auto flex items-center gap-1.5">
          {VIEW_MODES.map((v) => (
            <WorkspacePill
              key={v.id}
              label={v.label}
              active={viewMode === v.id}
              onClick={() => onViewModeChange(v.id)}
            />
          ))}
        </div>
      </div>
      {completedToday > 0 ? (
        <p className="px-3 pb-2 text-base text-muted-foreground">
          {completedToday === 1 ? "1 task completed today" : `${completedToday} tasks completed today`}
        </p>
      ) : null}
    </div>
  );
}
