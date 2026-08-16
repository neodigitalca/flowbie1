import React from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_SELECT,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { TasksFilterMode, TasksSortMode } from "@/lib/tasks-types";

export type TasksFilterToolbarProps = {
  searchQuery: string;
  filterMode: TasksFilterMode;
  sortMode: TasksSortMode;
  addTaskDisabled: boolean;
  onSearchChange: (q: string) => void;
  onFilterChange: (mode: TasksFilterMode) => void;
  onSortChange: (mode: TasksSortMode) => void;
  onAddTask: () => void;
  onAddSection?: () => void;
  showAddSection: boolean;
};

export function TasksFilterToolbar({
  searchQuery,
  filterMode,
  sortMode,
  addTaskDisabled,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onAddTask,
  onAddSection,
  showAddSection,
}: TasksFilterToolbarProps): React.ReactElement {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 bg-black px-3">
      <Input
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search tasks"
        className={`${BULK_HEADER_FIELD} h-8 min-w-40 flex-1 text-base`}
      />
      <select
        value={filterMode}
        onChange={(e) => onFilterChange(e.target.value as TasksFilterMode)}
        className={`${BULK_HEADER_SELECT} h-8 text-base [color-scheme:dark]`}
      >
        <option value="incomplete">Incomplete tasks</option>
        <option value="all">All tasks</option>
        <option value="completed">Completed</option>
      </select>
      <select
        value={sortMode}
        onChange={(e) => onSortChange(e.target.value as TasksSortMode)}
        className={`${BULK_HEADER_SELECT} h-8 text-base [color-scheme:dark]`}
      >
        <option value="dueDate">Sort: Due date</option>
        <option value="created">Sort: Created</option>
        <option value="title">Sort: Title</option>
      </select>
      {showAddSection && onAddSection ? (
        <>
          <span className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
          <Button type="button" className={BULK_HEADER_RUN_BTN} onClick={onAddSection}>
            Add section
          </Button>
        </>
      ) : null}
      <span className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
      <Button type="button" className={BULK_HEADER_RUN_BTN} disabled={addTaskDisabled} onClick={onAddTask}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add task
      </Button>
    </div>
  );
}
