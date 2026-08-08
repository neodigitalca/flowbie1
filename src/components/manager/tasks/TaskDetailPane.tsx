import React, { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DASHBOARD_SETTINGS_FIELD_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";
import { TaskAssigneePicker } from "@/components/manager/tasks/TaskAssigneePicker";
import { TaskTagPicker } from "@/components/manager/tasks/TaskTagPicker";
import { TaskSubtaskList } from "@/components/manager/tasks/TaskSubtaskList";
import { TaskCommentComposer } from "@/components/manager/tasks/TaskCommentComposer";
import { TaskFileUpload } from "@/components/manager/tasks/TaskFileUpload";
import type { TaskFile, TaskNote, TaskTag, TeamTask, TaskStatus } from "@/lib/tasks-types";
import { TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/tasks-types";
import type { TeamMember } from "@/lib/teams-types";

const FIELD_CLASS = `${DASHBOARD_SETTINGS_FIELD_CLASS} w-full text-base`;

export type TaskDetailPaneProps = {
  task: TeamTask | null;
  notes: TaskNote[];
  files: TaskFile[];
  subtasks: TeamTask[];
  tags: TaskTag[];
  members: TeamMember[];
  memberNames: Map<number, string>;
  teamId: number | null;
  saving: boolean;
  uploading: boolean;
  onClose: () => void;
  onMarkDone: () => void;
  onUpdate: (patch: {
    keyword?: string;
    title?: string;
    description?: string;
    status?: TaskStatus;
    assigneeIds?: number[];
    dueDate?: string;
    tagIds?: string[];
  }) => void;
  onAddNote: (body: string, mentionUserIds: number[]) => void;
  onUploadFile: (file: File) => void;
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (taskId: number, status: TaskStatus) => void;
  onDelete: () => void;
};

function NoteBody({ body }: { body: string }) {
  const parts = body.split(/(@\S+(?:\s+\S+)?)/g);
  return (
    <p className="whitespace-pre-wrap text-base text-muted-foreground">
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="text-primary">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export function TaskDetailPane({
  task,
  notes,
  files,
  subtasks,
  tags,
  members,
  memberNames,
  teamId,
  saving,
  uploading,
  onClose,
  onMarkDone,
  onUpdate,
  onAddNote,
  onUploadFile,
  onAddSubtask,
  onToggleSubtask,
  onDelete,
}: TaskDetailPaneProps): React.ReactElement | null {
  const [localTitle, setLocalTitle] = useState("");
  const [localKeyword, setLocalKeyword] = useState("");
  const [localDescription, setLocalDescription] = useState("");

  useEffect(() => {
    if (!task) return;
    setLocalTitle(task.title);
    setLocalKeyword(task.keyword);
    setLocalDescription(task.description);
  }, [task?.id, task?.title, task?.keyword, task?.description]);

  const flushFields = useCallback(() => {
    if (!task) return;
    onUpdate({
      title: localTitle,
      keyword: localKeyword,
      description: localDescription,
    });
  }, [localDescription, localKeyword, localTitle, onUpdate, task]);

  if (!task) return null;

  return (
    <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col bg-zinc-950">
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <Button
          type="button"
          className="h-10 text-base"
          disabled={saving || task.status === "done"}
          onClick={onMarkDone}
        >
          Mark done
        </Button>
        <Button type="button" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
        {task.projectTitle ? (
          <p className="text-base text-muted-foreground">{task.projectTitle}</p>
        ) : null}
        <Input
          value={localKeyword}
          onChange={(e) => setLocalKeyword(e.target.value)}
          onBlur={flushFields}
          aria-label="Task keyword"
          className={`${FIELD_CLASS} h-12`}
          disabled={saving}
        />
        <Input
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={flushFields}
          aria-label="Task title"
          className={`${FIELD_CLASS} h-12`}
          disabled={saving}
        />
        <Textarea
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onBlur={flushFields}
          aria-label="Task description"
          className={`${FIELD_CLASS} min-h-20`}
          disabled={saving}
        />
        <div className="flex flex-col gap-2">
          <label className="text-base text-muted-foreground">Status</label>
          <select
            value={task.status}
            onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
            className={`${FIELD_CLASS} h-12 px-3`}
            disabled={saving}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-base text-muted-foreground">Due date</label>
          <Input
            type="date"
            value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
            onChange={(e) => onUpdate({ dueDate: e.target.value })}
            className={`${FIELD_CLASS} h-12`}
            disabled={saving}
          />
        </div>
        <TaskAssigneePicker
          members={members}
          assigneeIds={task.assigneeIds}
          onChange={(assigneeIds) => onUpdate({ assigneeIds })}
        />
        <TaskTagPicker tags={tags} selectedTagIds={task.tagIds} onChange={(tagIds) => onUpdate({ tagIds })} />
        <TaskSubtaskList subtasks={subtasks} onToggle={onToggleSubtask} onAdd={onAddSubtask} />
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-white">Comments</p>
          {notes.length === 0 ? (
            <p className="text-base text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {notes.map((note) => (
                <li key={note.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-medium text-white">
                      {memberNames.get(note.authorId) ?? `User ${note.authorId}`}
                    </span>
                    <span className="text-base text-muted-foreground">{note.createdAt.slice(0, 10)}</span>
                  </div>
                  <NoteBody body={note.body} />
                </li>
              ))}
            </ul>
          )}
          <TaskCommentComposer members={members} disabled={saving} onSubmit={onAddNote} />
        </div>
        {teamId ? (
          <TaskFileUpload teamId={teamId} taskId={task.id} files={files} uploading={uploading} onUpload={onUploadFile} />
        ) : null}
        <Button type="button" variant="destructive" className="h-12 text-base" disabled={saving} onClick={onDelete}>
          Delete task
        </Button>
      </div>
    </aside>
  );
}
