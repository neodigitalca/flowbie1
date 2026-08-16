import type { TeamTask, TasksFilterMode, TasksSortMode } from "@/lib/tasks-types";
import { isNeoPulseBotMember } from "@/lib/chat-neo-pulse";
import type { TeamMember } from "@/lib/teams-types";

export function filterTasks(tasks: TeamTask[], mode: TasksFilterMode): TeamTask[] {
  if (mode === "all") return tasks;
  if (mode === "completed") return tasks.filter((t) => t.status === "done");
  return tasks.filter((t) => t.status !== "done");
}

export function sortTasks(tasks: TeamTask[], mode: TasksSortMode): TeamTask[] {
  const copy = [...tasks];
  if (mode === "title") {
    copy.sort((a, b) => a.title.localeCompare(b.title));
    return copy;
  }
  if (mode === "created") {
    copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return copy;
  }
  copy.sort((a, b) => {
    const ad = a.dueDate || "9999-12-31";
    const bd = b.dueDate || "9999-12-31";
    return ad.localeCompare(bd);
  });
  return copy;
}

export function filterTasksByQuery(tasks: TeamTask[], query: string): TeamTask[] {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.keyword.toLowerCase().includes(q) ||
      t.projectTitle.toLowerCase().includes(q) ||
      t.tagIds.some((tag) => tag.toLowerCase().includes(q)),
  );
}

export function formatDueDateShort(iso: string): string {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  const date = new Date(`${d}T12:00:00`);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export { formatDueDateTimeShort } from "@/lib/edmonton-time";

export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function taskHasPulseAssignee(
  task: { assigneeIds?: number[] },
  members: TeamMember[],
): boolean {
  return (task.assigneeIds ?? []).some((userId) => {
    const member = members.find((m) => m.userId === userId);
    return member != null && isNeoPulseBotMember(member);
  });
}

export function assigneeBadgeLabel(userId: number, members: TeamMember[]): string | null {
  const member = members.find((m) => m.userId === userId);
  if (!member) return null;
  if (isNeoPulseBotMember(member)) return "PULSE";
  const name = member.displayName || member.email || "";
  if (!name.trim()) return null;
  return memberInitials(name);
}

export function assigneeBadgeIsPulse(userId: number, members: TeamMember[]): boolean {
  const member = members.find((m) => m.userId === userId);
  return member != null && isNeoPulseBotMember(member);
}
