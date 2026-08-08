import React, { useCallback, useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDueDateShort, memberInitials } from "@/lib/tasks-filter";
import type { TaskSection, TaskTag, TeamTask, TaskStatus } from "@/lib/tasks-types";
import { TASK_STATUSES } from "@/lib/tasks-types";
import { TaskSectionHeader } from "@/components/manager/tasks/TaskSectionHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type TasksListViewProps = {
  sections: TaskSection[];
  tasks: TeamTask[];
  tags: TaskTag[];
  selectedTaskId: number | null;
  memberNames: Map<number, string>;
  myTasksMode: boolean;
  onSelectTask: (taskId: number) => void;
  onStatusChange: (taskId: number, status: TaskStatus) => void;
  onAddTask: (sectionId: number, title: string) => void;
  onMoveTask: (taskId: number, sectionId: number) => void;
  onEditSection?: (sectionId: number) => void;
  onDeleteSection?: (sectionId: number) => void;
  onEditTask: (taskId: number) => void;
  onDeleteTask: (taskId: number) => void;
};

function nextStatus(current: TaskStatus): TaskStatus {
  const idx = TASK_STATUSES.indexOf(current);
  return TASK_STATUSES[(idx + 1) % TASK_STATUSES.length]!;
}

function tagLabel(tags: TaskTag[], keyword: string): string {
  return tags.find((t) => t.keyword === keyword)?.name ?? keyword;
}

function tagColor(tags: TaskTag[], keyword: string): string {
  return tags.find((t) => t.keyword === keyword)?.color ?? "#52525b";
}

function TaskRow({
  task,
  tags,
  selected,
  memberNames,
  myTasksMode,
  onSelect,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  task: TeamTask;
  tags: TaskTag[];
  selected: boolean;
  memberNames: Map<number, string>;
  myTasksMode: boolean;
  onSelect: () => void;
  onStatusChange: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const done = task.status === "done";

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-2 py-2",
        selected ? "bg-zinc-900" : "hover:bg-zinc-950",
      )}
    >
      <button
        type="button"
        aria-label={`Toggle ${task.title}`}
        onClick={onStatusChange}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center",
          done ? "bg-primary text-black" : "bg-zinc-800 text-muted-foreground hover:text-white",
        )}
      >
        {done ? <Check className="h-4 w-4" /> : null}
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={cn("min-w-0 flex-1 text-base", done ? "text-muted-foreground line-through" : "text-white")}>
          {task.title}
        </span>
        {myTasksMode && task.projectTitle ? (
          <span className="shrink-0 text-base text-muted-foreground">{task.projectTitle}</span>
        ) : null}
        <div className="flex shrink-0 flex-wrap gap-1">
          {task.tagIds.map((tagId) => (
            <span
              key={tagId}
              className="px-2 py-0.5 text-base text-white"
              style={{ backgroundColor: tagColor(tags, tagId) }}
            >
              {tagLabel(tags, tagId)}
            </span>
          ))}
        </div>
        {task.dueDate ? (
          <span className="shrink-0 text-base text-muted-foreground">{formatDueDateShort(task.dueDate)}</span>
        ) : null}
        <div className="flex shrink-0 gap-1">
          {task.assigneeIds.slice(0, 3).map((uid) => (
            <span key={uid} className="flex h-8 w-8 items-center justify-center bg-zinc-800 text-base text-white">
              {memberInitials(memberNames.get(uid) ?? "?")}
            </span>
          ))}
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          aria-label={`Edit ${task.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-zinc-900 hover:text-white"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`Delete ${task.title}`}
          onClick={(e) => {
            e.stopPropagation();
            setDeleteOpen(true);
          }}
          className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-zinc-900 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-none border-0 bg-zinc-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete task</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">
              Delete &quot;{task.title}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 text-base">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-10 bg-red-600 text-base hover:bg-red-700"
              onClick={() => onDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TasksListView({
  sections,
  tasks,
  tags,
  selectedTaskId,
  memberNames,
  myTasksMode,
  onSelectTask,
  onStatusChange,
  onAddTask,
  onMoveTask,
  onEditSection,
  onDeleteSection,
  onEditTask,
  onDeleteTask,
}: TasksListViewProps): React.ReactElement {
  const [draftBySection, setDraftBySection] = useState<Record<number, string>>({});
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);

  const handleDrop = useCallback(
    (sectionId: number) => {
      if (dragTaskId == null) return;
      onMoveTask(dragTaskId, sectionId);
      setDragTaskId(null);
    },
    [dragTaskId, onMoveTask],
  );

  if (myTasksMode) {
    const buckets: { title: string; tasks: TeamTask[] }[] = [
      { title: "Due today", tasks: [] },
      { title: "Upcoming", tasks: [] },
      { title: "No due date", tasks: [] },
      { title: "Completed", tasks: [] },
    ];
    const today = new Date().toISOString().slice(0, 10);
    for (const task of tasks) {
      if (task.status === "done") {
        buckets[3]!.tasks.push(task);
      } else if (!task.dueDate) {
        buckets[2]!.tasks.push(task);
      } else if (task.dueDate.slice(0, 10) === today) {
        buckets[0]!.tasks.push(task);
      } else {
        buckets[1]!.tasks.push(task);
      }
    }
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black px-3 py-3">
        {tasks.length === 0 ? (
          <p className="text-base text-muted-foreground">No tasks assigned to you.</p>
        ) : (
          buckets.map(
            (bucket) =>
              bucket.tasks.length > 0 && (
                <section key={bucket.title} className="mb-6">
                  <h3 className="mb-2 text-base font-semibold text-white">{bucket.title}</h3>
                  <ul>
                    {bucket.tasks.map((task) => (
                      <li key={task.id}>
                        <TaskRow
                          task={task}
                          tags={tags}
                          selected={task.id === selectedTaskId}
                          memberNames={memberNames}
                          myTasksMode
                          onSelect={() => onSelectTask(task.id)}
                          onStatusChange={() => onStatusChange(task.id, nextStatus(task.status))}
                          onEdit={() => onEditTask(task.id)}
                          onDelete={() => onDeleteTask(task.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ),
          )
        )}
      </div>
    );
  }

  const sectionList =
    sections.length > 0
      ? sections
      : [{ id: 0, teamId: 0, projectId: 0, sortOrder: 0, createdAt: "", payload: {}, keyword: "default", title: "Tasks" }];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black px-3 py-3">
      {sectionList.map((section) => {
        const sectionTasks = tasks.filter((t) => (section.id === 0 ? true : t.sectionId === section.id));
        const draft = draftBySection[section.id] ?? "";
        return (
          <section
            key={section.id}
            className="group mb-6"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => section.id > 0 && handleDrop(section.id)}
          >
            {section.id > 0 && onEditSection && onDeleteSection ? (
              <TaskSectionHeader
                sectionId={section.id}
                title={section.title}
                taskCount={sectionTasks.length}
                onEdit={onEditSection}
                onDelete={onDeleteSection}
              />
            ) : (
              <h3 className="mb-2 text-base font-semibold text-white">{section.title}</h3>
            )}
            <ul>
              {sectionTasks.map((task) => (
                <li
                  key={task.id}
                  draggable
                  onDragStart={() => setDragTaskId(task.id)}
                  onDragEnd={() => setDragTaskId(null)}
                >
                  <TaskRow
                    task={task}
                    tags={tags}
                    selected={task.id === selectedTaskId}
                    memberNames={memberNames}
                    myTasksMode={false}
                    onSelect={() => onSelectTask(task.id)}
                    onStatusChange={() => onStatusChange(task.id, nextStatus(task.status))}
                    onEdit={() => onEditTask(task.id)}
                    onDelete={() => onDeleteTask(task.id)}
                  />
                </li>
              ))}
            </ul>
            {section.id > 0 ? (
              <div className="mt-1 flex gap-2 px-2">
                <input
                  value={draft}
                  onChange={(e) => setDraftBySection((prev) => ({ ...prev, [section.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) {
                      onAddTask(section.id, draft.trim());
                      setDraftBySection((prev) => ({ ...prev, [section.id]: "" }));
                    }
                  }}
                  placeholder="Add task"
                  className="h-10 flex-1 bg-zinc-900 px-2 text-base text-white placeholder:text-muted-foreground"
                />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
