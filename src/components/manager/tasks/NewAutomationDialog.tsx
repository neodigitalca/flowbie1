import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  TaskFormPlaceholderCell,
  TaskFormSideSection,
} from "@/components/manager/tasks/TaskFormLayout";
import {
  AutomationActionFlatRow,
  type AutomationActionDraft,
} from "@/components/manager/tasks/AutomationTaskFlatRow";
import { AutomationTaskExecuteButton } from "@/components/manager/tasks/AutomationTaskExecuteButton";
import { saveTemplateFromProject } from "@/lib/tasks-api";
import { filterAutomationTemplates } from "@/lib/task-automation-templates";
import type { DefaultTaskCreatePayload, TaskProject, TaskTemplate, TeamTask } from "@/lib/tasks-types";
import { TASK_STATUS_LABELS } from "@/lib/tasks-types";
import { defaultTaskTriggerConfig } from "@/lib/task-trigger-types";
import type { TeamMember } from "@/lib/teams-types";
import { isNeoPulseBotMember } from "@/lib/chat-neo-pulse";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";

function emptyAutomationActionDraft(): AutomationActionDraft {
  return {
    title: "",
    status: "todo",
    triggerConfig: defaultTaskTriggerConfig(),
    executionKind: "content_optimizer",
    executionPayload: { updateMode: "update" },
  };
}

function pulseMemberUserId(members: TeamMember[]): number | null {
  const pulse = members.find((m) => isNeoPulseBotMember(m));
  return pulse?.userId ?? null;
}

function actionDraftToPayload(
  draft: AutomationActionDraft,
  pulseUserId: number | null,
): DefaultTaskCreatePayload {
  const trimmedTitle = draft.title.trim();
  return {
    keyword: trimmedTitle.toLowerCase().replace(/\s+/g, "-") || "action",
    title: trimmedTitle,
    status: draft.status,
    scheduleMode: "trigger",
    recurrenceRule: "none",
    assigneeIds: pulseUserId != null ? [pulseUserId] : undefined,
    executionKind: draft.executionKind,
    executionPayload: draft.executionPayload,
    triggerConfig: draft.triggerConfig,
  };
}

function templateTaskToActionDraft(
  task: TaskTemplate["defaultTasks"][number],
): AutomationActionDraft {
  return {
    ...emptyAutomationActionDraft(),
    title: task.title,
    status: task.status ?? "todo",
    triggerConfig: task.triggerConfig ?? defaultTaskTriggerConfig(),
    executionKind: (task.executionKind?.trim() || "content_optimizer") as AutomationActionDraft["executionKind"],
    executionPayload: task.executionPayload ?? { updateMode: "update" },
  };
}

export type NewAutomationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: number | null;
  templates: TaskTemplate[];
  sites: WordPressSiteOption[];
  members: TeamMember[];
  defaultSiteId?: string | null;
  editAutomation?: TaskProject | null;
  editAutomationTasks?: TeamTask[];
  onTemplatesChange?: (templates: TaskTemplate[]) => void;
  onCreate: (payload: {
    keyword: string;
    title: string;
    description?: string;
    wordpressSiteId?: string | null;
    wordpressSites?: WordPressSiteOption[];
    defaultTasks?: DefaultTaskCreatePayload[];
    isAutomation: boolean;
    sourceTemplateKeyword?: string;
  }) => Promise<boolean>;
  onUpdate?: (
    projectId: number,
    payload: { keyword: string; title: string; description?: string; wordpressSiteId?: string | null },
  ) => Promise<boolean>;
  onTaskExecuted?: () => void;
};

export function NewAutomationDialog({
  open,
  onOpenChange,
  teamId,
  templates,
  sites,
  members,
  defaultSiteId = null,
  editAutomation = null,
  editAutomationTasks = [],
  onTemplatesChange,
  onCreate,
  onUpdate,
  onTaskExecuted,
}: NewAutomationDialogProps): React.ReactElement {
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [templateKeyword, setTemplateKeyword] = useState("");
  const [clientId, setClientId] = useState("");
  const [automationAction, setAutomationAction] = useState<AutomationActionDraft>(
    emptyAutomationActionDraft,
  );
  const [saveFromName, setSaveFromName] = useState("");
  const [saveFromKeyword, setSaveFromKeyword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const automationTemplates = useMemo(() => filterAutomationTemplates(templates), [templates]);
  const selectedTemplate = useMemo(
    () => automationTemplates.find((tpl) => tpl.keyword === templateKeyword) ?? null,
    [automationTemplates, templateKeyword],
  );
  const pulseUserId = useMemo(() => pulseMemberUserId(members), [members]);
  const isEdit = editAutomation != null;
  const editAction = editAutomationTasks[0] ?? null;
  const actionTitleWarning = "Action title is required.";
  const showActionTitleWarning = error === actionTitleWarning;
  const footerError = error && error !== actionTitleWarning ? error : null;

  const reset = useCallback(() => {
    setKeyword("");
    setTitle("");
    setDescription("");
    setTemplateKeyword("");
    setClientId(defaultSiteId ?? "");
    setAutomationAction(emptyAutomationActionDraft());
    setSaveFromName("");
    setSaveFromKeyword("");
    setError(null);
  }, [defaultSiteId]);

  useEffect(() => {
    if (!open) return;
    if (editAutomation) {
      setKeyword(editAutomation.keyword);
      setTitle(editAutomation.title);
      setDescription(editAutomation.description ?? "");
      setTemplateKeyword(editAutomation.sourceTemplateKeyword ?? "");
      setClientId(editAutomation.wordpressSiteId ?? "");
      setSaveFromName(editAutomation.title);
      setSaveFromKeyword("");
      setError(null);
    } else {
      reset();
    }
  }, [defaultSiteId, editAutomation, open, reset]);

  const handleTemplatePick = useCallback(
    (kw: string) => {
      setTemplateKeyword(kw);
      if (!kw) {
        setAutomationAction(emptyAutomationActionDraft());
        return;
      }
      const tpl = automationTemplates.find((t) => t.keyword === kw);
      if (!tpl) {
        setAutomationAction(emptyAutomationActionDraft());
        return;
      }
      setKeyword(tpl.keyword);
      setTitle(tpl.name);
      const firstTask = tpl.defaultTasks[0];
      setAutomationAction(firstTask ? templateTaskToActionDraft(firstTask) : emptyAutomationActionDraft());
    },
    [automationTemplates],
  );

  const handleSaveFromAutomation = useCallback(async () => {
    if (!teamId || !editAutomation) return;
    const trimmedName = saveFromName.trim();
    if (!trimmedName) {
      setError("Template name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveTemplateFromProject(teamId, {
      projectId: editAutomation.id,
      name: trimmedName,
      keyword: saveFromKeyword.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save template from automation.");
      return;
    }
    if (result.templates) onTemplatesChange?.(result.templates);
    setSaveFromKeyword("");
  }, [editAutomation, onTemplatesChange, saveFromKeyword, saveFromName, teamId]);

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (!isEdit && !clientId.trim()) {
      setError("Client site is required for automations.");
      return;
    }
    if (!isEdit && !templateKeyword.trim() && automationAction.title.trim() === "") {
      setError(actionTitleWarning);
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
    if (isEdit && editAutomation && onUpdate) {
      ok = await onUpdate(editAutomation.id, payload);
      if (!ok) setError("Could not update automation.");
    } else {
      const trimmedTemplate = templateKeyword.trim();
      ok = await onCreate(
        trimmedTemplate
          ? {
              ...payload,
              wordpressSites: sites,
              templateKeyword: trimmedTemplate,
              isAutomation: true,
              sourceTemplateKeyword: trimmedTemplate,
            }
          : {
              ...payload,
              wordpressSites: sites,
              defaultTasks: [actionDraftToPayload(automationAction, pulseUserId)],
              isAutomation: true,
              sourceTemplateKeyword: undefined,
            },
      );
      if (!ok) setError("Could not create automation.");
    }
    setSaving(false);
    if (!ok) return;
    reset();
    onOpenChange(false);
  }, [
    actionTitleWarning,
    automationAction,
    clientId,
    description,
    editAutomation,
    isEdit,
    keyword,
    onCreate,
    onOpenChange,
    onUpdate,
    pulseUserId,
    reset,
    sites,
    templateKeyword,
    title,
  ]);

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
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-base font-semibold text-white">
              {isEdit ? "Edit automation" : "New automation"}
            </DialogTitle>
            {showActionTitleWarning ? (
              <span className="inline-flex h-8 shrink-0 items-center rounded-none bg-zinc-900 px-2 text-base text-red-400">
                {actionTitleWarning}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          <TaskFormSideSection title="Automation">
            <TaskFormFlatGrid
              className={
                sites.length > 0
                  ? "grid-cols-2 md:grid-cols-4"
                  : "grid-cols-1 md:grid-cols-3"
              }
            >
              {!isEdit ? (
                <TaskFormFlatSelectPlaceholder
                  placeholder="Template"
                  value={templateKeyword}
                  onChange={handleTemplatePick}
                  disabled={saving}
                  options={[
                    { value: "", label: "Blank automation" },
                    ...automationTemplates.map((tpl) => ({ value: tpl.keyword, label: tpl.name })),
                  ]}
                />
              ) : null}
              {sites.length > 0 ? (
                <TaskFormFlatSelectPlaceholder
                  placeholder="Client"
                  value={clientId}
                  onChange={setClientId}
                  disabled={saving}
                  options={sites.map((site) => ({ value: site.id, label: site.name }))}
                />
              ) : null}
              <TaskFormPlaceholderCell>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Keyword"
                  aria-label="Automation keyword"
                  disabled={saving}
                  className={TASK_FORM_FLAT_CONTROL_CLASS}
                />
              </TaskFormPlaceholderCell>
              <TaskFormPlaceholderCell>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  aria-label="Automation title"
                  disabled={saving}
                  className={TASK_FORM_FLAT_CONTROL_CLASS}
                />
              </TaskFormPlaceholderCell>
            </TaskFormFlatGrid>
          </TaskFormSideSection>

          <TaskFormSideSection title="Action">
            <div className="max-h-[50vh] min-h-0 overflow-y-auto">
              {isEdit ? (
                editAction == null ? (
                  <p className="py-1 text-base text-muted-foreground">No action yet.</p>
                ) : (
                  <div className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="block text-base text-white">{editAction.title}</span>
                      <span className="text-base text-muted-foreground">
                        {TASK_STATUS_LABELS[editAction.status]}
                        {editAction.triggerMeta?.lastMatchedCount != null
                          ? ` · ${editAction.triggerMeta.lastMatchedCount} matches`
                          : ""}
                      </span>
                    </div>
                    <AutomationTaskExecuteButton
                      teamId={teamId}
                      taskId={editAction.id}
                      disabled={saving}
                      className="shrink-0"
                      onExecuted={() => onTaskExecuted?.()}
                    />
                  </div>
                )
              ) : templateKeyword.trim() && selectedTemplate ? (
                <ul className="flex flex-col gap-2 py-2">
                  {selectedTemplate.defaultTasks.map((task) => (
                    <li key={task.keyword} className="bg-zinc-900 px-3 py-2 text-base text-white">
                      {task.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <AutomationActionFlatRow
                  draft={automationAction}
                  saving={saving}
                  onChange={(patch) => setAutomationAction((prev) => ({ ...prev, ...patch }))}
                />
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
                    onClick={() => void handleSaveFromAutomation()}
                  >
                    Save as template
                  </Button>
                </TaskFormPlaceholderCell>
              </TaskFormFlatGrid>
            </TaskFormSideSection>
          ) : null}
        </div>

        {footerError ? <div className="shrink-0 text-base text-red-400">{footerError}</div> : null}
        <DialogFooter className="flex shrink-0 flex-row items-center justify-end gap-2 sm:justify-end">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
