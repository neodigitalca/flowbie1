import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { memberInitials } from "@/lib/tasks-filter";
import type { TeamTask, TaskStatus } from "@/lib/tasks-types";
import { TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/tasks-types";

export type TasksBoardViewProps = {
  tasks: TeamTask[];
  selectedTaskId: number | null;
  memberNames: Map<number, string>;
  onSelectTask: (taskId: number) => void;
  onStatusChange: (taskId: number, status: TaskStatus) => void;
};

export function TasksBoardView({
  tasks,
  selectedTaskId,
  memberNames,
  onSelectTask,
  onStatusChange,
}: TasksBoardViewProps): React.ReactElement {
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);

  const handleDrop = useCallback(
    (status: TaskStatus) => {
      if (dragTaskId == null) return;
      onStatusChange(dragTaskId, status);
      setDragTaskId(null);
    },
    [dragTaskId, onStatusChange],
  );

  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-3 gap-2 overflow-hidden bg-black p-3">
      {TASK_STATUSES.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            className="flex min-h-0 flex-col bg-zinc-950"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(status)}
          >
            <div className="shrink-0 px-3 py-2">
              <h3 className="text-base font-semibold text-white">{TASK_STATUS_LABELS[status]}</h3>
              <p className="text-base text-muted-foreground">{columnTasks.length}</p>
            </div>
            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
              {columnTasks.map((task) => (
                <li key={task.id}>
                  <div
                    draggable
                    onDragStart={() => setDragTaskId(task.id)}
                    onDragEnd={() => setDragTaskId(null)}
                    className={cn(
                      "cursor-grab px-2 py-2 active:cursor-grabbing",
                      task.id === selectedTaskId ? "bg-zinc-800" : "bg-zinc-900 hover:bg-zinc-800",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTask(task.id)}
                      className="flex w-full flex-col items-start gap-1 text-left"
                    >
                      <span className="text-base font-medium text-white">{task.title}</span>
                      {task.projectTitle ? (
                        <span className="text-base text-muted-foreground">{task.projectTitle}</span>
                      ) : null}
                      {task.assigneeIds.length > 0 ? (
                        <div className="flex gap-1">
                          {task.assigneeIds.map((uid) => (
                            <span
                              key={uid}
                              className="flex h-8 w-8 items-center justify-center bg-zinc-950 text-base text-white"
                            >
                              {memberInitials(memberNames.get(uid) ?? "?")}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
