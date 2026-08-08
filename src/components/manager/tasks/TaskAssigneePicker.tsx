import React from "react";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/teams-types";

export type TaskAssigneePickerProps = {
  members: TeamMember[];
  assigneeIds: number[];
  onChange: (assigneeIds: number[]) => void;
};

export function TaskAssigneePicker({
  members,
  assigneeIds,
  onChange,
}: TaskAssigneePickerProps): React.ReactElement {
  const toggle = (userId: number) => {
    if (assigneeIds.includes(userId)) {
      onChange(assigneeIds.filter((id) => id !== userId));
    } else {
      onChange([...assigneeIds, userId]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-white">Assignees</p>
      <ul className="flex flex-col gap-1">
        {members.map((member) => {
          const active = assigneeIds.includes(member.userId);
          const label = member.displayName || member.email;
          return (
            <li key={member.userId}>
              <button
                type="button"
                onClick={() => toggle(member.userId)}
                className={cn(
                  "w-full px-2 py-2 text-left text-base",
                  active ? "bg-zinc-800 text-white" : "text-muted-foreground hover:bg-zinc-900 hover:text-white",
                )}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
