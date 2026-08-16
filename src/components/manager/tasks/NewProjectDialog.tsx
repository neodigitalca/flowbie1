import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  TASK_PROJECT_DIALOG_CLASS,
  TASK_FORM_DIALOG_BUTTON_CLASS,
  TASK_FORM_FLAT_CONTROL_CLASS,
  TaskFormFlatGrid,
  TaskFormFlatSelectPlaceholder,
  TaskFormDatePicker,
  TaskFormTimePicker,
  TaskFormPlaceholderCell,
  TaskFormSideSection,
} from "@/components/manager/tasks/TaskFormLayout";
import { TaskAssigneeMultiSelect } from "@/components/manager/tasks/TaskAssigneeMultiSelect";
import { TaskTagMultiSelect } from "@/components/manager/tasks/TaskTagMultiSelect";
import { saveTemplateFromProject } from "@/lib/tasks-api";
import type {
  DefaultTaskCreatePayload,
  TaskProject,
  TaskRecurrenceRule,
  TaskTag,
  TaskTemplate,
  TaskStatus,
  TeamTask,
} from "@/lib/tasks-types";
import {
  TASK_RECURRENCE_LABELS,
  TASK_RECURRENCE_RULES,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
} from "@/lib/tasks-types";
import { filterRegularProjectTemplates } from "@/lib/task-automation-templates";
import type { TeamMember } from "@/lib/teams-types";

export type WordPressSiteOption = { id: string; name: string };

type ProjectTaskDraft = {
  title: string;
  status: TaskStatus;
  dueDate: string;
  dueTime: string;
  recurrenceRule: TaskRecurrenceRule;
  assigneeIds: number[];
  tagIds: string[];
};

function emptyProjectTaskDraft(): ProjectTaskDraft {
  return {
    title: "",
    status: "todo",
    dueDate: "",
    dueTime: "",
    recurrenceRule: "none",
    assigneeIds: [],
    tagIds: [],
  };
}

function draftToPayload(draft: ProjectTaskDraft, index: number): DefaultTaskCreatePayload {
  const trimmedTitle = draft.title.trim();
  return {
    keyword: trimmedTitle.toLowerCase().replace(/\s+/g, "-") || `task-${index + 1}`,
    title: trimmedTitle,
    status: draft.status,
    dueDate: draft.dueDate.trim(),
    dueTime: draft.dueTime.trim().includes(":")
      ? draft.dueTime.trim().slice(0, 5)
      : draft.dueTime.trim(),
    scheduleMode: "calendar",
    recurrenceRule: draft.recurrenceRule,
    assigneeIds: draft.assigneeIds.length > 0 ? draft.assigneeIds : undefined,
    tagIds: draft.tagIds.length > 0 ? draft.tagIds : undefined,
  };
}

type ProjectTaskFlatRowProps = {
  index: number;
  draft: ProjectTaskDraft;
  members: TeamMember[];
  tags: TaskTag[];
  saving: boolean;
  isLast: boolean;
  onChange: (patch: Partial<ProjectTaskDraft>) => void;
  onRemove: () => void;
};

function ProjectTaskFlatRow({
  index,
  draft,
  members,
  tags,
  saving,
  isLast,
  onChange,
  onRemove,
}: ProjectTaskFlatRowProps): React.ReactElement {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-0.5 pr-8",
        !isLast && "border-b border-zinc-800",
      )}
    >
      <button
        type="button"
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-none text-muted-foreground hover:bg-zinc-800 hover:text-white"
        aria-label={`Remove task ${index + 1}`}
        disabled={saving}
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </button>

      <TaskFormFlatGrid>
        <TaskFormPlaceholderCell className="col-span-2 md:col-span-2 xl:col-span-2">
          <Input
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Task title"
            aria-label={`Task ${index + 1} title`}
            disabled={saving}
            className={TASK_FORM_FLAT_CONTROL_CLASS}
          />
        </TaskFormPlaceholderCell>
        <TaskFormFlatSelectPlaceholder
          placeholder="Status"
          value={draft.status}
          onChange={(v) => onChange({ status: v as TaskStatus })}
          disabled={saving}
          options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
        />
        <TaskFormFlatSelectPlaceholder
          placeholder="Frequency"
          value={draft.recurrenceRule === "none" ? "" : draft.recurrenceRule}
          onChange={(v) => onChange({ recurrenceRule: (v || "none") as TaskRecurrenceRule })}
          disabled={saving}
          options={TASK_RECURRENCE_RULES.map((rule) => ({
            value: rule,
            label: rule === "none" ? "Does not repeat" : TASK_RECURRENCE_LABELS[rule],
          }))}
        />
        <TaskFormDatePicker
          placeholder="Due date"
          value={draft.dueDate}
          onChange={(dueDate) => onChange({ dueDate })}
          disabled={saving}
        />
        <TaskFormTimePicker
          placeholder="Due time"
          value={draft.dueTime}
          onChange={(dueTime) => onChange({ dueTime })}
          disabled={saving}
        />
      </TaskFormFlatGrid>

      <TaskFormFlatGrid className="md:grid-cols-2 xl:grid-cols-2">
        <TaskAssigneeMultiSelect
          members={members}
          assigneeIds={draft.assigneeIds}
          onChange={(assigneeIds) => onChange({ assigneeIds })}
          disabled={saving}
          humansOnly
        />
        {tags.length > 0 ? (
          <TaskTagMultiSelect
            tags={tags}
            selectedTagIds={draft.tagIds}
            onChange={(tagIds) => onChange({ tagIds })}
            disabled={saving}
          />
        ) : null}
      </TaskFormFlatGrid>
    </div>
  );
}

export type NewProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: number | null;
  templates: TaskTemplate[];
  sites: WordPressSiteOption[];
  members: TeamMember[];
  tags?: TaskTag[];
  defaultSiteId?: string | null;
  editProject?: TaskProject | null;
  editProjectTasks?: TeamTask[];
  onTemplatesChange?: (templates: TaskTemplate[]) => void;
  onCreate: (payload: {
    keyword: string;
    title: string;
    description?: string;
    wordpressSiteId?: string | null;
    wordpressSites?: WordPressSiteOption[];
    defaultTasks?: DefaultTaskCreatePayload[];
  }) => Promise<boolean>;
  onUpdate?: (
    projectId: number,
    payload: { keyword: string; title: string; description?: string; wordpressSiteId?: string | null },
  ) => Promise<boolean>;
};

export function NewProjectDialog({
  open,
  onOpenChange,
  teamId,
  templates,
  sites,
  members,
  tags = [],
  defaultSiteId = null,
  editProject = null,
  editProjectTasks = [],
  onTemplatesChange,
  onCreate,
  onUpdate,
}: NewProjectDialogProps): React.ReactElement {
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [templateKeyword, setTemplateKeyword] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectTasks, setProjectTasks] = useState<ProjectTaskDraft[]>([]);
  const [saveFromName, setSaveFromName] = useState("");
  const [saveFromKeyword, setSaveFromKeyword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = editProject != null;
  const projectTemplates = useMemo(() => filterRegularProjectTemplates(templates), [templates]);

  const reset = useCallback(() => {
    setKeyword("");
    setTitle("");
    setDescription("");
    setTemplateKeyword("");
    setClientId(defaultSiteId ?? "");
    setProjectTasks([]);
    setSaveFromName("");
    setSaveFromKeyword("");
    setError(null);
  }, [defaultSiteId]);

  useEffect(() => {
    if (!open) return;
    if (editProject) {
      setKeyword(editProject.keyword);
      setTitle(editProject.title);
      setDescription(editProject.description ?? "");
      setTemplateKeyword("");
      setClientId(editProject.wordpressSiteId ?? "");
      setSaveFromName(editProject.title);
      setSaveFromKeyword("");
      setError(null);
    } else {
      reset();
    }
  }, [defaultSiteId, editProject, open, reset]);

  const updateTaskDraft = useCallback((index: number, patch: Partial<ProjectTaskDraft>) => {
    setProjectTasks((prev) => prev.map((task, i) => (i === index ? { ...task, ...patch } : task)));
  }, []);

  const handleTemplatePick = useCallback(
    (kw: string) => {
      setTemplateKeyword(kw);
      const tpl = templates.find((t) => t.keyword === kw);
      if (!tpl) {
        setProjectTasks([]);
        return;
      }
      setKeyword(tpl.keyword);
      setTitle(tpl.name);
      setProjectTasks(
        tpl.defaultTasks.map((t) => ({
          ...emptyProjectTaskDraft(),
          title: t.title,
          status: t.status ?? "todo",
          dueDate: t.dueDate ?? "",
          dueTime: t.dueTime ?? "",
          recurrenceRule: t.recurrenceRule ?? "none",
          assigneeIds: t.assigneeIds ?? [],
          tagIds: t.tagIds ?? [],
        })),
      );
    },
    [templates],
  );

  const handleSaveFromProject = useCallback(async () => {
    if (!teamId || !editProject) return;
    const trimmedName = saveFromName.trim();
    if (!trimmedName) {
      setError("Template name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveTemplateFromProject(teamId, {
      projectId: editProject.id,
      name: trimmedName,
      keyword: saveFromKeyword.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save template from project.");
      return;
    }
    if (result.templates) onTemplatesChange?.(result.templates);
    setSaveFromKeyword("");
  }, [editProject, onTemplatesChange, saveFromKeyword, saveFromName, teamId]);

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      keyword: keyword.trim() || trimmedTitle.toLowerCase().replace(/\s+/g, "-"),
      title: trimmedTitle,
      description: description.trim() || undefined,
      wordpressSiteId: clientId.trim() || null,
    };
    let ok = false;
    if (isEdit && editProject && onUpdate) {
      ok = await onUpdate(editProject.id, payload);
      if (!ok) setError("Could not update project.");
    } else {
      const defaultTasks = projectTasks
        .filter((draft) => draft.title.trim() !== "")
        .map((draft, i) => draftToPayload(draft, i));
      ok = await onCreate({
        ...payload,
        wordpressSites: sites,
        defaultTasks,
      });
      if (!ok) setError("Could not create project.");
    }
    setSaving(false);
    if (!ok) return;
    reset();
    onOpenChange(false);
  }, [
    clientId,
    description,
    editProject,
    isEdit,
    keyword,
    onCreate,
    onOpenChange,
    onUpdate,
    projectTasks,
    reset,
    sites,
    title,
  ]);

  const topLevelTasks = editProjectTasks;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className={TASK_PROJECT_DIALOG_CLASS}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base font-semibold text-white">
            {isEdit ? "Edit project" : "New project"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          <TaskFormSideSection title="Project">
            <TaskFormFlatGrid
              className={
                !isEdit
                  ? sites.length > 0
                    ? "grid-cols-5"
                    : "grid-cols-4"
                  : sites.length > 0
                    ? "grid-cols-4"
                    : "grid-cols-3"
              }
            >
              {!isEdit ? (
                <TaskFormFlatSelectPlaceholder
                  placeholder="Template"
                  value={templateKeyword}
                  onChange={handleTemplatePick}
                  disabled={saving}
                  options={[
                    { value: "", label: "Blank project" },
                    ...projectTemplates.map((tpl) => ({ value: tpl.keyword, label: tpl.name })),
                  ]}
                />
              ) : null}
              {sites.length > 0 ? (
                <TaskFormFlatSelectPlaceholder
                  placeholder="Client"
                  value={clientId}
                  onChange={setClientId}
                  disabled={saving}
                  options={[
                    { value: "", label: "No client" },
                    ...sites.map((site) => ({ value: site.id, label: site.name })),
                  ]}
                />
              ) : null}
              <TaskFormPlaceholderCell>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Keyword"
                  aria-label="Project keyword"
                  disabled={saving}
                  className={TASK_FORM_FLAT_CONTROL_CLASS}
                />
              </TaskFormPlaceholderCell>
              <TaskFormPlaceholderCell>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  aria-label="Project title"
                  disabled={saving}
                  className={TASK_FORM_FLAT_CONTROL_CLASS}
                />
              </TaskFormPlaceholderCell>
              <TaskFormPlaceholderCell>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                  aria-label="Project description"
                  disabled={saving}
                  className={TASK_FORM_FLAT_CONTROL_CLASS}
                />
              </TaskFormPlaceholderCell>
            </TaskFormFlatGrid>
          </TaskFormSideSection>

          <TaskFormSideSection title="Tasks">
            <div className="max-h-[40vh] min-h-0 overflow-y-auto">
              {isEdit ? (
                topLevelTasks.length === 0 ? (
                  <p className="py-1 text-base text-muted-foreground">No tasks in this project yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {topLevelTasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center justify-between gap-3 border-b border-zinc-800 py-2 last:border-b-0"
                      >
                        <span className="min-w-0 flex-1 truncate text-base text-white">{task.title}</span>
                        <span className="shrink-0 text-base text-muted-foreground">
                          {TASK_STATUS_LABELS[task.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              ) : projectTasks.length === 0 ? (
                <p className="py-1 text-base text-muted-foreground">Add tasks to create with this project.</p>
              ) : (
                <div>
                  {projectTasks.map((draft, i) => (
                    <ProjectTaskFlatRow
                      key={`task-${i}`}
                      index={i}
                      draft={draft}
                      members={members}
                      tags={tags}
                      saving={saving}
                      isLast={i === projectTasks.length - 1}
                      onChange={(patch) => updateTaskDraft(i, patch)}
                      onRemove={() => setProjectTasks((prev) => prev.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              )}
            </div>
          </TaskFormSideSection>

          {isEdit ? (
            <TaskFormSideSection title="Template">
              <TaskFormFlatGrid className="grid-cols-3">
                <TaskFormPlaceholderCell>
                  <Input
                    value={saveFromName}
                    onChange={(e) => setSaveFromName(e.target.value)}
                    placeholder="Name"
                    aria-label="Template name"
                    disabled={saving}
                    className={TASK_FORM_FLAT_CONTROL_CLASS}
                  />
                </TaskFormPlaceholderCell>
                <TaskFormPlaceholderCell>
                  <Input
                    value={saveFromKeyword}
                    onChange={(e) => setSaveFromKeyword(e.target.value)}
                    placeholder="Keyword"
                    aria-label="Template keyword"
                    disabled={saving}
                    className={TASK_FORM_FLAT_CONTROL_CLASS}
                  />
                </TaskFormPlaceholderCell>
                <TaskFormPlaceholderCell className="flex items-center">
                  <Button
                    type="button"
                    className={cn("h-9 w-full text-base", TASK_FORM_DIALOG_BUTTON_CLASS)}
                    disabled={saving}
                    onClick={() => void handleSaveFromProject()}
                  >
                    Save as template
                  </Button>
                </TaskFormPlaceholderCell>
              </TaskFormFlatGrid>
            </TaskFormSideSection>
          ) : null}
        </div>

        {error ? (
          <div className="shrink-0 text-base text-red-400">{error}</div>
        ) : null}
        <DialogFooter className="flex shrink-0 flex-row items-center justify-between gap-2 sm:justify-between">
          {!isEdit ? (
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-10 border-0 bg-[#000] text-base text-white hover:bg-[#000] hover:text-white",
                TASK_FORM_DIALOG_BUTTON_CLASS,
              )}
              disabled={saving}
              onClick={() => setProjectTasks((prev) => [...prev, emptyProjectTaskDraft()])}
            >
              Add task
            </Button>
          ) : (
            <span className="shrink-0" aria-hidden="true" />
          )}
          <div className="flex flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-10 border-0 bg-[#000] text-base text-white hover:bg-[#000] hover:text-white",
                TASK_FORM_DIALOG_BUTTON_CLASS,
              )}
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={cn(
                "h-10 bg-[#77AA00] text-base text-black hover:bg-[#77AA00]/90",
                TASK_FORM_DIALOG_BUTTON_CLASS,
              )}
              disabled={saving}
              onClick={() => void handleSubmit()}
            >
              {saving ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
