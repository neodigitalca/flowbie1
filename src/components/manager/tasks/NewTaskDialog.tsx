import React, { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DASHBOARD_SETTINGS_FIELD_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";
import type { TaskProject, TeamTask } from "@/lib/tasks-types";

const INPUT_CLASS = `${DASHBOARD_SETTINGS_FIELD_CLASS} min-w-0 w-full h-12`;

export type NewTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: TaskProject[];
  defaultProjectId: number | null;
  editTask?: TeamTask | null;
  onCreate: (payload: { keyword: string; title: string; projectId: number }) => Promise<boolean>;
  onUpdate?: (taskId: number, payload: { keyword: string; title: string }) => Promise<boolean>;
};

export function NewTaskDialog({
  open,
  onOpenChange,
  projects,
  defaultProjectId,
  editTask = null,
  onCreate,
  onUpdate,
}: NewTaskDialogProps): React.ReactElement {
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = editTask != null;

  const reset = useCallback(() => {
    setKeyword("");
    setTitle("");
    setProjectId(defaultProjectId ?? projects[0]?.id ?? null);
    setError(null);
  }, [defaultProjectId, projects]);

  useEffect(() => {
    if (!open) return;
    if (editTask) {
      setKeyword(editTask.keyword);
      setTitle(editTask.title);
      setProjectId(editTask.projectId);
      setError(null);
    } else {
      reset();
    }
  }, [editTask, open, reset]);

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (!isEdit && (projectId == null || projectId <= 0)) {
      setError("Select a project.");
      return;
    }
    if (!isEdit && projects.length === 0) {
      setError("Create a project first.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      keyword: keyword.trim() || trimmedTitle.toLowerCase().replace(/\s+/g, "-"),
      title: trimmedTitle,
    };
    let ok = false;
    if (isEdit && editTask && onUpdate) {
      ok = await onUpdate(editTask.id, payload);
      if (!ok) setError("Could not update task.");
    } else if (projectId != null) {
      ok = await onCreate({ ...payload, projectId });
      if (!ok) setError("Could not create task.");
    }
    setSaving(false);
    if (!ok) return;
    reset();
    onOpenChange(false);
  }, [editTask, isEdit, keyword, onCreate, onOpenChange, onUpdate, projectId, projects.length, reset, title]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md rounded-none border-0 bg-zinc-950 p-6 text-white">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white">
            {isEdit ? "Edit task" : "New task"}
          </DialogTitle>
        </DialogHeader>
        {!isEdit && projects.length > 0 ? (
          <div className="flex flex-col gap-2">
            <label className="text-base text-muted-foreground">Project</label>
            <select
              value={projectId ?? ""}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className={`${INPUT_CLASS} px-3`}
              disabled={saving}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Keyword"
          aria-label="Task keyword"
          className={INPUT_CLASS}
          disabled={saving}
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          aria-label="Task title"
          className={INPUT_CLASS}
          disabled={saving}
        />
        {error ? <p className="text-base text-red-400">{error}</p> : null}
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" className="h-12 text-base" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
