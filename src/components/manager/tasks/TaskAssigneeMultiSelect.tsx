import React, { useMemo } from "react";
import { TaskFormMultiSelect } from "@/components/manager/tasks/TaskFormLayout";
import { isNeoPulseBotMember, sortMembersWithNeoPulseBotFirst } from "@/lib/chat-neo-pulse";
import type { TeamMember } from "@/lib/teams-types";

export type TaskAssigneeMultiSelectProps = {
  members: TeamMember[];
  assigneeIds: number[];
  onChange: (assigneeIds: number[]) => void;
  disabled?: boolean;
  humansOnly?: boolean;
  placeholder?: string;
  className?: string;
};

export function TaskAssigneeMultiSelect({
  members,
  assigneeIds,
  onChange,
  disabled = false,
  humansOnly = false,
  placeholder = "Assignees",
  className,
}: TaskAssigneeMultiSelectProps): React.ReactElement {
  const sortedMembers = useMemo(() => {
    const filtered = humansOnly ? members.filter((m) => !isNeoPulseBotMember(m)) : members;
    return humansOnly ? filtered : sortMembersWithNeoPulseBotFirst(filtered);
  }, [humansOnly, members]);

  const options = useMemo(
    () =>
      sortedMembers.map((member) => ({
        value: String(member.userId),
        label: isNeoPulseBotMember(member) ? "NEO Pulse" : member.displayName || member.email,
      })),
    [sortedMembers],
  );

  const selectedValues = useMemo(
    () => assigneeIds.map((id) => String(id)),
    [assigneeIds],
  );

  return (
    <TaskFormMultiSelect
      placeholder={placeholder}
      options={options}
      selectedValues={selectedValues}
      onChange={(values) => onChange(values.map((v) => Number(v)))}
      disabled={disabled}
      className={className}
    />
  );
}
