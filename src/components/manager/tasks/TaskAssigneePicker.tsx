import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { isNeoPulseBotMember, sortMembersWithNeoPulseBotFirst } from "@/lib/chat-neo-pulse";
import type { TeamMember } from "@/lib/teams-types";

export type TaskAssigneePickerProps = {
  members: TeamMember[];
  assigneeIds: number[];
  onChange: (assigneeIds: number[]) => void;
  variant?: "list" | "inline";
  humansOnly?: boolean;
};

export function TaskAssigneePicker({
  members,
  assigneeIds,
  onChange,
  variant = "list",
  humansOnly = false,
}: TaskAssigneePickerProps): React.ReactElement {
  const sortedMembers = useMemo(() => {
    const filtered = humansOnly ? members.filter((m) => !isNeoPulseBotMember(m)) : members;
    return humansOnly ? filtered : sortMembersWithNeoPulseBotFirst(filtered);
  }, [humansOnly, members]);

  const toggle = (userId: number) => {
    if (assigneeIds.includes(userId)) {
      onChange(assigneeIds.filter((id) => id !== userId));
    } else {
      onChange([...assigneeIds, userId]);
    }
  };

  if (variant === "inline") {
    return (
      <div className="flex min-w-0 flex-wrap gap-1">
        {sortedMembers.map((member) => {
          const active = assigneeIds.includes(member.userId);
          const isBot = isNeoPulseBotMember(member);
          const label = isBot ? "NEO Pulse" : member.displayName || member.email;
          return (
            <button
              key={member.userId}
              type="button"
              onClick={() => toggle(member.userId)}
              className={cn(
                "rounded-none px-2 py-1 text-base",
                active
                  ? isBot
                    ? "bg-primary/20 text-primary"
                    : "bg-zinc-800 text-white"
                  : "text-muted-foreground hover:bg-zinc-900 hover:text-white",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-white">Assignees</p>
      <ul className="flex flex-col gap-1">
        {sortedMembers.map((member) => {
          const active = assigneeIds.includes(member.userId);
          const isBot = isNeoPulseBotMember(member);
          const label = isBot ? "NEO Pulse" : member.displayName || member.email;
          return (
            <li key={member.userId}>
              <button
                type="button"
                onClick={() => toggle(member.userId)}
                className={cn(
                  "w-full px-2 py-2 text-left text-base",
                  active
                    ? isBot
                      ? "bg-primary/20 text-primary"
                      : "bg-zinc-800 text-white"
                    : "text-muted-foreground hover:bg-zinc-900 hover:text-white",
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
