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
  TASK_FORM_DIALOG_BUTTON_CLASS,
  TASK_FORM_FLAT_CONTROL_CLASS,
  TASK_FORM_SELECT_CONTENT_CLASS,
  TASK_FORM_SELECT_ITEM_CLASS,
  TASK_FORM_SELECT_TRIGGER_CLASS,
  TaskFormCompactCell,
  TaskFormFlatGrid,
  TaskFormSideSection,
} from "@/components/manager/tasks/TaskFormLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutomationWhenPanel } from "@/components/manager/tasks/planner/AutomationWhenPanel";
import { AutomationThenPanel } from "@/components/manager/tasks/planner/AutomationThenPanel";
import { PulseForgePostSchedulePanel } from "@/components/manager/tasks/planner/PulseForgePostSchedulePanel";
import { AutomationJsonPanel } from "@/components/manager/tasks/planner/AutomationJsonPanel";
import { AutomationTaskExecuteButton } from "@/components/manager/tasks/AutomationTaskExecuteButton";
import { buildRecipeGuideBlocks } from "@/lib/automation-recipe-copy";
import {
  fetchAutomationActionBlocks,
  fetchAutomationTriggerBlocks,
  type AutomationBlockCatalogItem,
} from "@/lib/automation-blocks-api";
import {
  planToTaskDef,
  planToTaskDefs,
  recipeToPlan,
  validateAutomationPlan,
} from "@/lib/automation-planner-compile";
import type { AutomationPlan } from "@/lib/automation-planner-types";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import { saveTemplateFromProject, testFireTaskTrigger } from "@/lib/tasks-api";
import type { DefaultTaskCreatePayload, TaskProject, TaskTemplate, TeamTask } from "@/lib/tasks-types";
import { defaultTaskTriggerConfig } from "@/lib/task-trigger-types";
import type { TeamMember } from "@/lib/teams-types";
import { isNeoPulseBotMember } from "@/lib/chat-neo-pulse";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";

export type AutomationPlannerMode = "recipe" | "create" | "edit";

function emptyPlan(): AutomationPlan {
  return {
    keyword: "",
    name: "",
    trigger: {
      keyword: "gsc-ctr-drop",
      kind: "gsc",
      source: "gsc",
      triggerConfig: defaultTaskTriggerConfig(),
    },
    action: {
      keyword: "content-optimizer-full",
      executionKind: "content_optimizer",
      executionPayload: { updateMode: "update", targetBucket: "posts" },
      title: "",
    },
  };
}

function pulseMemberUserId(members: TeamMember[]): number | null {
  const pulse = members.find((m) => isNeoPulseBotMember(m));
  return pulse?.userId ?? null;
}

export type AutomationPlannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AutomationPlannerMode;
  teamId: number | null;
  sites: WordPressSiteOption[];
  members: TeamMember[];
  defaultSiteId?: string | null;
  recipe?: AutomationRecipeCatalogItem | null;
  editAutomation?: TaskProject | null;
  editAutomationTasks?: TeamTask[];
  onCreate: (payload: {
    keyword: string;
    title: string;
    description?: string;
    wordpressSiteId?: string | null;
    wordpressSites?: WordPressSiteOption[];
    defaultTasks?: DefaultTaskCreatePayload[];
    isAutomation: boolean;
    sourceTemplateKeyword?: string;
    templateKeyword?: string;
  }) => Promise<boolean>;
  onUpdate?: (
    projectId: number,
    payload: { keyword: string; title: string; description?: string; wordpressSiteId?: string | null },
  ) => Promise<boolean>;
  onUpdateTask?: (taskId: number, payload: DefaultTaskCreatePayload) => Promise<boolean>;
  onTemplatesChange?: (templates: TaskTemplate[]) => void;
  onTaskExecuted?: () => void;
  onInstalled?: (projectId: number) => void;
};

export function AutomationPlannerDialog({
  open,
  onOpenChange,
  mode,
  teamId,
  sites,
  members,
  defaultSiteId = null,
  recipe = null,
  editAutomation = null,
  editAutomationTasks = [],
  onCreate,
  onUpdate,
  onUpdateTask,
  onTemplatesChange,
  onTaskExecuted,
  onInstalled,
}: AutomationPlannerDialogProps): React.ReactElement {
  const [plan, setPlan] = useState<AutomationPlan>(emptyPlan);
  const [clientId, setClientId] = useState("");
  const [triggerBlocks, setTriggerBlocks] = useState<AutomationBlockCatalogItem[]>([]);
  const [actionBlocks, setActionBlocks] = useState<AutomationBlockCatalogItem[]>([]);
  const [tab, setTab] = useState<"visual" | "json">("visual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveFromName, setSaveFromName] = useState("");
  const [saveFromKeyword, setSaveFromKeyword] = useState("");

  const pulseUserId = useMemo(() => pulseMemberUserId(members), [members]);
  const editTask = editAutomationTasks[0] ?? null;
  const validationErrors = useMemo(() => validateAutomationPlan(plan), [plan]);
  const canSubmit = validationErrors.length === 0;

  const titleLabel =
    mode === "recipe" ? "Install automation" : mode === "edit" ? "Edit automation" : "New automation";

  const submitLabel =
    mode === "recipe" ? "Install" : mode === "edit" ? "Save" : "Create";

  const previewBlocks = useMemo(() => {
    if (!recipe) return [];
    return buildRecipeGuideBlocks({
      ...recipe,
      defaultTasks: planToTaskDefs(plan),
    });
  }, [plan, recipe]);

  useEffect(() => {
    if (!open || !teamId) return;
    void fetchAutomationTriggerBlocks(teamId).then(setTriggerBlocks);
    void fetchAutomationActionBlocks(teamId).then(setActionBlocks);
  }, [open, teamId]);

  useEffect(() => {
    if (!open) return;
    if (mode === "recipe" && recipe) {
      const next = recipeToPlan(recipe);
      setPlan(next);
      setClientId(defaultSiteId ?? "");
      setError(null);
      return;
    }
    if (mode === "edit" && editAutomation) {
      const base = editTask
        ? recipeToPlan({
            keyword: editAutomation.keyword,
            name: editAutomation.title,
            description: editAutomation.description ?? "",
            isAutomation: true,
            category: "reactive",
            verticals: [],
            tags: [],
            prerequisites: [],
            filters: {},
            defaultTasks: [
              {
                keyword: editTask.keyword,
                title: editTask.title,
                scheduleMode: editTask.scheduleMode,
                triggerConfig: editTask.triggerConfig,
                recurrenceRule: editTask.recurrenceRule,
                dueDate: editTask.dueDate,
                dueTime: editTask.dueTime,
                executionKind: editTask.executionKind,
                executionPayload: editTask.executionPayload,
              },
            ],
            triggerBlock: undefined,
            actionBlock: undefined,
          })
        : emptyPlan();
      setPlan({ ...base, keyword: editAutomation.keyword, name: editAutomation.title });
      setClientId(editAutomation.wordpressSiteId ?? "");
      setSaveFromName(editAutomation.title);
      setError(null);
      return;
    }
    setPlan(emptyPlan());
    setClientId(defaultSiteId ?? "");
    setError(null);
  }, [defaultSiteId, editAutomation, editTask, mode, open, recipe]);

  const taskPayloads = useCallback((): DefaultTaskCreatePayload[] => {
    return planToTaskDefs(plan).map((task) => ({
      ...task,
      assigneeIds: pulseUserId != null ? [pulseUserId] : undefined,
    }));
  }, [plan, pulseUserId]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const trimmedName = plan.name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if ((mode === "recipe" || mode === "create") && !clientId.trim()) {
      setError("Client site is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      keyword: plan.keyword.trim() || trimmedName.toLowerCase().replace(/\s+/g, "-"),
      title: trimmedName,
      description: plan.description?.trim() || undefined,
      wordpressSiteId: clientId.trim() || null,
    };
    let ok = false;
    if (mode === "edit" && editAutomation && onUpdate) {
      ok = await onUpdate(editAutomation.id, payload);
      if (ok && editTask && onUpdateTask) {
        ok = await onUpdateTask(editTask.id, taskPayloads()[0]!);
      }
      if (!ok) setError("Could not save automation.");
    } else if (mode === "recipe" && recipe) {
      ok = await onCreate({
        ...payload,
        wordpressSites: sites,
        isAutomation: true,
        sourceTemplateKeyword: recipe.keyword,
        defaultTasks: taskPayloads(),
      });
      if (!ok) setError("Could not install automation.");
    } else {
      ok = await onCreate({
        ...payload,
        wordpressSites: sites,
        defaultTasks: taskPayloads(),
        isAutomation: true,
      });
      if (!ok) setError("Could not create automation.");
    }
    setSaving(false);
    if (!ok) return;
    onOpenChange(false);
  }, [
    canSubmit,
    clientId,
    editAutomation,
    editTask,
    mode,
    onCreate,
    onOpenChange,
    onUpdate,
    onUpdateTask,
    plan,
    recipe,
    sites,
    taskPayloads,
  ]);

  const handleTestFire = useCallback(async () => {
    if (!teamId || !editTask || plan.trigger.kind !== "gsc") return;
    setSaving(true);
    await testFireTaskTrigger(teamId, editTask.id);
    setSaving(false);
  }, [editTask, plan.trigger.kind, teamId]);

  const handleSaveTemplate = useCallback(async () => {
    if (!teamId || !editAutomation) return;
    const trimmedName = saveFromName.trim();
    if (!trimmedName) {
      setError("Template name is required.");
      return;
    }
    setSaving(true);
    const result = await saveTemplateFromProject(teamId, {
      projectId: editAutomation.id,
      name: trimmedName,
      keyword: saveFromKeyword.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save template.");
      return;
    }
    if (result.templates) onTemplatesChange?.(result.templates);
  }, [editAutomation, onTemplatesChange, saveFromKeyword, saveFromName, teamId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[90vw] max-w-5xl flex-col gap-0 overflow-hidden rounded-none border-0 bg-black p-0">
        <DialogHeader className="shrink-0 px-4 pt-4">
          <DialogTitle className="text-base font-semibold text-white">{titleLabel}</DialogTitle>
        </DialogHeader>

        <div className="mx-4 flex shrink-0 gap-0 bg-zinc-900">
          {(["visual", "json"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "h-9 px-4 text-base capitalize",
                tab === value ? "bg-black text-white" : "text-muted-foreground hover:text-white",
              )}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="relative min-h-[min(58vh,640px)] flex-1 overflow-hidden px-4 pb-2">
          <div
            className={cn(
              "absolute inset-0 overflow-y-auto pb-2",
              tab !== "visual" && "pointer-events-none invisible",
            )}
          >
            <TaskFormSideSection title="Automation">
              <TaskFormFlatGrid
                className={
                  sites.length > 0
                    ? "grid-cols-2 lg:grid-cols-4"
                    : "grid-cols-1 lg:grid-cols-3"
                }
              >
                {sites.length > 0 ? (
                  <TaskFormCompactCell label="Client site">
                    <Select
                      value={clientId || "__empty__"}
                      onValueChange={(v) => setClientId(v === "__empty__" ? "" : v)}
                      disabled={saving || mode === "edit"}
                    >
                      <SelectTrigger className={TASK_FORM_SELECT_TRIGGER_CLASS}>
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                      <SelectContent className={TASK_FORM_SELECT_CONTENT_CLASS}>
                        {sites.map((s) => (
                          <SelectItem key={s.id} value={s.id} className={TASK_FORM_SELECT_ITEM_CLASS}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TaskFormCompactCell>
                ) : null}
                <TaskFormCompactCell label="Keyword">
                  <Input
                    value={plan.keyword}
                    onChange={(e) => setPlan((p) => ({ ...p, keyword: e.target.value }))}
                    placeholder="automation-keyword"
                    disabled={saving}
                    className={TASK_FORM_FLAT_CONTROL_CLASS}
                  />
                </TaskFormCompactCell>
                <TaskFormCompactCell label="Name">
                  <Input
                    value={plan.name}
                    onChange={(e) => setPlan((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Automation name"
                    disabled={saving}
                    className={TASK_FORM_FLAT_CONTROL_CLASS}
                  />
                </TaskFormCompactCell>
              </TaskFormFlatGrid>
            </TaskFormSideSection>

            <TaskFormSideSection title="WHEN">
              <AutomationWhenPanel
                trigger={plan.trigger}
                triggerBlocks={triggerBlocks}
                disabled={saving}
                onChange={(trigger) => setPlan((p) => ({ ...p, trigger }))}
              />
            </TaskFormSideSection>

            <TaskFormSideSection title="THEN">
              <AutomationThenPanel
                action={plan.action}
                disabled={saving}
                onChange={(patch) => setPlan((p) => ({ ...p, action: { ...p.action, ...patch } }))}
              />
            </TaskFormSideSection>

            <TaskFormSideSection title="Post schedule">
              <div
                className={cn(
                  "min-h-[22rem]",
                  plan.action.executionKind !== "post_creator" && "pointer-events-none invisible",
                )}
              >
                <PulseForgePostSchedulePanel
                  executionPayload={plan.action.executionPayload}
                  disabled={saving || plan.action.executionKind !== "post_creator"}
                  onChange={(executionPayload) =>
                    setPlan((p) => ({ ...p, action: { ...p.action, executionPayload } }))
                  }
                />
              </div>
            </TaskFormSideSection>

            <TaskFormSideSection title="Preview">
              <div className="min-h-[4.5rem] px-1">
                {previewBlocks.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {previewBlocks.flatMap((block) =>
                      block.steps.map((line) => (
                        <li key={`${block.title ?? "step"}-${line}`} className="text-base text-muted-foreground">
                          {line}
                        </li>
                      )),
                    )}
                  </ul>
                ) : (
                  <p className="text-base text-muted-foreground">Preview appears for recipe installs.</p>
                )}
              </div>
            </TaskFormSideSection>

            {mode === "edit" && editTask ? (
              <div className="flex justify-end py-2">
                <AutomationTaskExecuteButton
                  teamId={teamId}
                  taskId={editTask.id}
                  task={editTask}
                  project={editAutomation}
                  disabled={saving}
                  onExecuted={() => onTaskExecuted?.()}
                />
              </div>
            ) : null}

            {mode === "edit" ? (
              <TaskFormSideSection title="Template">
                <TaskFormFlatGrid className="grid-cols-1 lg:grid-cols-3">
                  <TaskFormCompactCell label="Template name">
                    <Input
                      value={saveFromName}
                      onChange={(e) => setSaveFromName(e.target.value)}
                      placeholder="Team template name"
                      disabled={saving}
                      className={TASK_FORM_FLAT_CONTROL_CLASS}
                    />
                  </TaskFormCompactCell>
                  <TaskFormCompactCell label="Template keyword">
                    <Input
                      value={saveFromKeyword}
                      onChange={(e) => setSaveFromKeyword(e.target.value)}
                      placeholder="template-keyword"
                      disabled={saving}
                      className={TASK_FORM_FLAT_CONTROL_CLASS}
                    />
                  </TaskFormCompactCell>
                  <TaskFormCompactCell label="Save">
                    <Button
                      type="button"
                      className={cn("h-9 w-full text-base", TASK_FORM_DIALOG_BUTTON_CLASS)}
                      disabled={saving}
                      onClick={() => void handleSaveTemplate()}
                    >
                      Save template
                    </Button>
                  </TaskFormCompactCell>
                </TaskFormFlatGrid>
              </TaskFormSideSection>
            ) : null}
          </div>

          <div
            className={cn(
              "absolute inset-0 overflow-hidden pb-2",
              tab !== "json" && "pointer-events-none invisible",
            )}
          >
            <AutomationJsonPanel plan={plan} disabled={saving} onPlanChange={setPlan} />
          </div>
        </div>

        {error ? <p className="shrink-0 px-4 text-base text-red-400">{error}</p> : null}

        <DialogFooter className="shrink-0 gap-2 px-4 pb-4 sm:justify-end">
          {mode === "edit" && plan.trigger.kind === "gsc" && editTask ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-none border-0 bg-zinc-900 text-base text-white"
              disabled={saving}
              onClick={() => void handleTestFire()}
            >
              Test fire
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-none border-0 bg-zinc-900 text-base text-white"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10 rounded-none bg-[#77AA00] text-base text-black hover:bg-[#77AA00]/90"
            disabled={saving || !canSubmit}
            onClick={() => void handleSubmit()}
          >
            {saving ? `${submitLabel}…` : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
