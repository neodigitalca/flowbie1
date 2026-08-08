import React, { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamTask, TaskStatus } from "@/lib/tasks-types";

export type TaskSubtaskListProps = {
  subtasks: TeamTask[];
  onToggle: (taskId: number, status: TaskStatus) => void;
  onAdd: (title: string) => void;
};

export function TaskSubtaskList({ subtasks, onToggle, onAdd }: TaskSubtaskListProps): React.ReactElement {
  const [draft, setDraft] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-white">Subtasks</p>
      <ul className="flex flex-col gap-1">
        {subtasks.map((sub) => {
          const done = sub.status === "done";
          return (
            <li key={sub.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggle(sub.id, done ? "todo" : "done")}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center",
                  done ? "bg-primary text-black" : "bg-zinc-800 text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : null}
              </button>
              <span className={cn("text-base", done ? "text-muted-foreground line-through" : "text-white")}>
                {sub.title}
              </span>
            </li>
          );
        })}
      </ul>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            onAdd(draft.trim());
            setDraft("");
          }
        }}
        placeholder="Add subtask"
        className="h-10 bg-zinc-900 px-2 text-base text-white placeholder:text-muted-foreground"
      />
    </div>
  );
}
