import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TaskBuilderPanelShell } from "@/components/manager/pulse-forge/TaskBuilderPanelShell";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import { getPropertyListRowBlackLabelButtonClass } from "@/components/integrations/wordpress/cyberpunk-theme";
import {
  TASK_FORM_DIALOG_BUTTON_CLASS,
  TASK_FORM_FLAT_CONTROL_CLASS,
  TASK_FORM_SELECT_CONTENT_CLASS,
  TASK_FORM_SELECT_ITEM_CLASS,
  TASK_FORM_SELECT_TRIGGER_CLASS,
  TaskFormInlineRow,
} from "@/components/manager/tasks/TaskFormLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutomationWhenPanel } from "@/components/manager/tasks/planner/AutomationWhenPanel";
import { AutomationWhatPanel } from "@/components/manager/tasks/planner/AutomationWhatPanel";
import { AutomationThenPanel } from "@/components/manager/tasks/planner/AutomationThenPanel";
import { AutomationJsonPanel, type AutomationJsonPanelHandle } from "@/components/manager/tasks/planner/AutomationJsonPanel";
import { TaskBuilderArchivePanel } from "@/components/manager/tasks/planner/TaskBuilderArchivePanel";
import { AutomationTaskExecuteButton } from "@/components/manager/tasks/AutomationTaskExecuteButton";
import { buildRecipeGuideBlocks } from "@/lib/automation-recipe-copy";
import {
  fetchAutomationActionBlocks,
  fetchAutomationTriggerBlocks,
  type AutomationBlockCatalogItem,
} from "@/lib/automation-blocks-api";
import {
  planToTaskDefs,
  recipeToPlan,
  validateAutomationPlan,
} from "@/lib/automation-planner-compile";
import type { AutomationPlan } from "@/lib/automation-planner-types";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import { saveTemplateFromProject, testFireTaskTrigger } from "@/lib/tasks-api";
import { resolveTaskForAutomationExecute } from "@/lib/task-automation-ui";
import type { DefaultTaskCreatePayload, ForgeAutomationVisibility, TaskExecutionPayload, TaskProject, TaskTemplate, TeamTask } from "@/lib/tasks-types";
import { defaultTaskTriggerConfig } from "@/lib/task-trigger-types";
import type { TeamMember } from "@/lib/teams-types";
import { isNeoPulseBotMember } from "@/lib/chat-neo-pulse";
import { mergeExecutionPayloadForSave } from "@/lib/post-creator/post-creator-schedule-payload";
import { effectiveSaveLocalArchive } from "@/lib/schedule-output-destination";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import { TaskBuilderClientSitePicker } from "@/components/manager/pulse-forge/TaskBuilderClientSitePicker";
import { FORGE_TASK_BUILDER_INFIELD_CLASS } from "@/components/manager/pulse-forge/forge-recipe-styles";
import { resolveAutomationVisibility } from "@/lib/pulse-forge/forge-automation-visibility";
import {
  readCachedExecutionPayload,
  writeCachedExecutionPayload,
} from "@/lib/forge-automation-plan-cache";

export type TaskBuilderMode = "recipe" | "create" | "edit";

export type TaskBuilderTab = "setup" | "what" | "when" | "then" | "preview" | "json" | "archive" | "template";

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

export type TaskBuilderViewProps = {
  mode: TaskBuilderMode;
  teamId: number | null;
  sites: WordPressSiteOption[];
  members: TeamMember[];
  defaultSiteId?: string | null;
  recipe?: AutomationRecipeCatalogItem | null;
  editAutomation?: TaskProject | null;
  editAutomationTasks?: TeamTask[];
  onCancel: () => void;
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
    automationVisibility?: ForgeAutomationVisibility;
  }) => Promise<boolean>;
  onUpdate?: (
    projectId: number,
    payload: {
      keyword: string;
      title: string;
      description?: string;
      wordpressSiteId?: string | null;
      automationVisibility?: ForgeAutomationVisibility;
    },
  ) => Promise<boolean>;
  onUpdateTask?: (
    taskId: number,
    payload: DefaultTaskCreatePayload,
  ) => Promise<{ ok: boolean; task?: TeamTask }>;
  onTemplatesChange?: (templates: TaskTemplate[]) => void;
  onTaskExecuted?: () => void;
  initialTab?: TaskBuilderTab;
  onTabChange?: (tab: TaskBuilderTab) => void;
};

export function TaskBuilderView({
  mode,
  teamId,
  sites,
  members,
  defaultSiteId = null,
  recipe = null,
  editAutomation = null,
  editAutomationTasks = [],
  onCancel,
  onCreate,
  onUpdate,
  onUpdateTask,
  onTemplatesChange,
  onTaskExecuted,
  initialTab,
  onTabChange,
}: TaskBuilderViewProps): React.ReactElement {
  const [plan, setPlan] = useState<AutomationPlan>(emptyPlan);
  const [clientId, setClientId] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(() => new Set());
  const [automationVisibility, setAutomationVisibility] = useState<ForgeAutomationVisibility>("private");
  const [triggerBlocks, setTriggerBlocks] = useState<AutomationBlockCatalogItem[]>([]);
  const [actionBlocks, setActionBlocks] = useState<AutomationBlockCatalogItem[]>([]);
  const [tab, setTab] = useState<TaskBuilderTab>("setup");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveFromName, setSaveFromName] = useState("");
  const [saveFromKeyword, setSaveFromKeyword] = useState("");
  const [planReady, setPlanReady] = useState(false);
  const thenExecutionPayloadRef = useRef<TaskExecutionPayload | null>(null);
  const jsonPanelRef = useRef<AutomationJsonPanelHandle>(null);
  const planInitializedScopeRef = useRef<string | null>(null);

  const pulseUserId = useMemo(() => pulseMemberUserId(members), [members]);
  const editTask = editAutomationTasks[0] ?? null;
  const archiveSiteName = useMemo(() => {
    const siteId = clientId.trim() || editAutomation?.wordpressSiteId?.trim() || "";
    if (!siteId) return "";
    return sites.find((site) => site.id === siteId)?.name ?? "";
  }, [clientId, editAutomation?.wordpressSiteId, sites]);
  const validationErrors = useMemo(
    () => (planReady ? validateAutomationPlan(plan) : []),
    [plan, planReady],
  );
  const canSubmit = planReady && validationErrors.length === 0;

  const submitLabel =
    mode === "recipe" ? "Install" : mode === "edit" ? "Save" : "Create";

  const previewBlocks = useMemo(() => {
    if (!recipe) return [];
    return buildRecipeGuideBlocks({
      ...recipe,
      defaultTasks: planToTaskDefs(plan),
    });
  }, [plan, recipe]);

  const tabs = useMemo((): { id: TaskBuilderTab; label: string }[] => {
    const base: { id: TaskBuilderTab; label: string }[] = [
      { id: "setup", label: "Setup" },
      { id: "what", label: "What" },
      { id: "when", label: "When" },
      { id: "then", label: "Then" },
    ];
    if (mode === "recipe" && recipe) {
      base.push({ id: "preview", label: "Preview" });
    }
    base.push({ id: "json", label: "JSON" });
    base.push({ id: "archive", label: "Archive" });
    if (mode === "edit") {
      base.push({ id: "template", label: "Template" });
    }
    return base;
  }, [mode, recipe]);

  const builderScopeKey =
    mode === "edit" && editAutomation
      ? `edit:${editAutomation.id}`
      : mode === "recipe" && recipe
        ? `recipe:${recipe.keyword}`
        : mode === "create"
          ? "create"
          : "none";

  useEffect(() => {
    if (!teamId) return;
    void fetchAutomationTriggerBlocks(teamId).then(setTriggerBlocks);
    void fetchAutomationActionBlocks(teamId).then(setActionBlocks);
  }, [teamId]);

  useEffect(() => {
    if (planInitializedScopeRef.current === builderScopeKey) {
      setPlanReady(true);
      return;
    }
    setPlanReady(false);

    if (mode === "recipe" && recipe) {
      const next = recipeToPlan(recipe);
      planInitializedScopeRef.current = builderScopeKey;
      setPlan(next);
      thenExecutionPayloadRef.current = next.action.executionPayload ?? null;
      setSelectedClientIds(defaultSiteId ? new Set([defaultSiteId]) : new Set());
      setAutomationVisibility("private");
      setError(null);
      setPlanReady(true);
      return;
    }
    if (mode === "edit" && editAutomation) {
      if (!editTask) return;
      const resolvedTask = resolveTaskForAutomationExecute(editTask, editAutomation);
      const cachedPayload = readCachedExecutionPayload(editAutomation.id);
      const executionPayload = mergeExecutionPayloadForSave(
        resolvedTask.executionPayload,
        cachedPayload,
      );
      const base = recipeToPlan({
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
            keyword: resolvedTask.keyword,
            title: resolvedTask.title,
            scheduleMode: resolvedTask.scheduleMode,
            triggerConfig: resolvedTask.triggerConfig,
            recurrenceRule: resolvedTask.recurrenceRule,
            dueDate: resolvedTask.dueDate,
            dueTime: resolvedTask.dueTime,
            executionKind: resolvedTask.executionKind,
            executionPayload,
          },
        ],
        triggerBlock: undefined,
        actionBlock: undefined,
      });
      planInitializedScopeRef.current = builderScopeKey;
      const nextPlan = { ...base, keyword: editAutomation.keyword, name: editAutomation.title };
      setPlan(nextPlan);
      thenExecutionPayloadRef.current = nextPlan.action.executionPayload ?? null;
      setClientId(editAutomation.wordpressSiteId ?? "");
      setAutomationVisibility(resolveAutomationVisibility(editAutomation));
      setSaveFromName(editAutomation.title);
      setError(null);
      setPlanReady(true);
      return;
    }
    if (mode === "create") {
      planInitializedScopeRef.current = builderScopeKey;
      const next = emptyPlan();
      setPlan(next);
      thenExecutionPayloadRef.current = next.action.executionPayload ?? null;
      setSelectedClientIds(defaultSiteId ? new Set([defaultSiteId]) : new Set());
      setAutomationVisibility("private");
      setError(null);
      setPlanReady(true);
    }
  }, [builderScopeKey, defaultSiteId, editAutomation, editTask, mode, recipe]);

  const appliedBuilderScopeRef = useRef<string | null>(null);

  useEffect(() => {
    if (appliedBuilderScopeRef.current !== builderScopeKey) {
      appliedBuilderScopeRef.current = builderScopeKey;
      setTab(initialTab ?? "setup");
      return;
    }
    if (initialTab) {
      setTab(initialTab);
    }
  }, [builderScopeKey, initialTab]);

  const selectTab = useCallback(
    (next: TaskBuilderTab) => {
      setTab(next);
      onTabChange?.(next);
    },
    [onTabChange],
  );

  const buildTaskPayloads = useCallback(
    (sourcePlan: AutomationPlan): DefaultTaskCreatePayload[] => {
      const executionPayload = mergeExecutionPayloadForSave(
        sourcePlan.action.executionPayload,
        thenExecutionPayloadRef.current,
      );
      const planForSave = {
        ...sourcePlan,
        action: { ...sourcePlan.action, executionPayload },
      };
      return planToTaskDefs(planForSave).map((task) => ({
        ...task,
        assigneeIds: pulseUserId != null ? [pulseUserId] : undefined,
      }));
    },
    [pulseUserId],
  );

  const taskPayloads = useCallback(
    (): DefaultTaskCreatePayload[] => buildTaskPayloads(plan),
    [buildTaskPayloads, plan],
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const trimmedName = plan.name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if ((mode === "recipe" || mode === "create") && selectedClientIds.size === 0) {
      setError("Select at least one client site.");
      return;
    }
    setSaving(true);
    setError(null);
    let planForSave = plan;
    const flushedPlan = jsonPanelRef.current?.flushPendingPlan();
    if (flushedPlan) {
      planForSave = flushedPlan;
      setPlan(flushedPlan);
      thenExecutionPayloadRef.current = flushedPlan.action.executionPayload ?? null;
    }
    const mergedPayload = mergeExecutionPayloadForSave(
      planForSave.action.executionPayload,
      thenExecutionPayloadRef.current,
    );
    planForSave = {
      ...planForSave,
      action: { ...planForSave.action, executionPayload: mergedPayload },
    };
    thenExecutionPayloadRef.current = mergedPayload;
    const baseKeyword = planForSave.keyword.trim() || trimmedName.toLowerCase().replace(/\s+/g, "-");
    let ok = false;
    if (mode === "edit" && editAutomation && onUpdate) {
      const projectPayload = {
        keyword: baseKeyword,
        title: trimmedName,
        description: planForSave.description?.trim() || undefined,
        wordpressSiteId: clientId.trim() || null,
        automationVisibility,
      };
      const taskPayload = buildTaskPayloads(planForSave)[0]!;
      if (editTask && onUpdateTask) {
        const taskResult = await onUpdateTask(editTask.id, taskPayload);
        ok = taskResult.ok;
      } else {
        ok = true;
      }
      if (ok) {
        ok = await onUpdate(editAutomation.id, projectPayload);
      }
      if (ok) {
        const savedPayload = taskPayload.executionPayload ?? planForSave.action.executionPayload;
        if (savedPayload) {
          const keptPlan = {
            ...planForSave,
            action: { ...planForSave.action, executionPayload: savedPayload },
          };
          planForSave = keptPlan;
          setPlan(keptPlan);
          thenExecutionPayloadRef.current = savedPayload;
          if (editAutomation?.id) {
            writeCachedExecutionPayload(editAutomation.id, savedPayload);
          }
        }
      }
      if (!ok) setError("Could not save automation.");
    } else {
      const siteIds = [...selectedClientIds];
      const multiSite = siteIds.length > 1;
      ok = true;
      for (const siteId of siteIds) {
        const site = sites.find((entry) => entry.id === siteId);
        const siteName = site?.name ?? "";
        const keyword = multiSite ? `${baseKeyword}-${siteId}` : baseKeyword;
        const title = multiSite && siteName ? `${trimmedName} - ${siteName}` : trimmedName;
        const created = await onCreate({
          keyword,
          title,
          description: planForSave.description?.trim() || undefined,
          wordpressSiteId: siteId,
          wordpressSites: sites,
          isAutomation: true,
          sourceTemplateKeyword: mode === "recipe" && recipe ? recipe.keyword : undefined,
          defaultTasks: buildTaskPayloads(planForSave),
          automationVisibility,
        });
        if (!created) {
          ok = false;
          break;
        }
      }
      if (!ok) {
        setError(
          mode === "recipe"
            ? "Could not install automation for all selected sites."
            : "Could not create automation for all selected sites.",
        );
      }
    }
    setSaving(false);
    if (!ok) return;
    if (mode === "edit") {
      return;
    }
    onCancel();
  }, [
    automationVisibility,
    canSubmit,
    clientId,
    editAutomation,
    editTask,
    mode,
    onCancel,
    onCreate,
    onTaskExecuted,
    onUpdate,
    onUpdateTask,
    plan,
    recipe,
    selectedClientIds,
    sites,
    buildTaskPayloads,
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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-black font-sans">
      <nav className="flex shrink-0 flex-wrap items-center gap-1 px-4 py-3">
        {tabs.map(({ id, label }) => (
          <WorkspacePill
            key={id}
            label={label}
            square
            tone="forge"
            active={tab === id}
            onClick={() => selectTab(id)}
          />
        ))}
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
          {mode === "edit" && plan.trigger.kind === "gsc" && editTask ? (
            <Button
              type="button"
              variant="outline"
              className={getPropertyListRowBlackLabelButtonClass()}
              disabled={saving}
              onClick={() => void handleTestFire()}
            >
              Test fire
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className={getPropertyListRowBlackLabelButtonClass()}
            disabled={saving}
            onClick={onCancel}
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
        </div>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4">
        {tab === "setup" ? (
          <TaskBuilderPanelShell>
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-3">
                <div className={FORGE_TASK_BUILDER_INFIELD_CLASS}>
                  <span className="shrink-0 text-base text-white">Visibility</span>
                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                    <WorkspacePill
                      label="Private"
                      square
                      tone="forge"
                      active={automationVisibility === "private"}
                      disabled={saving}
                      onClick={() => setAutomationVisibility("private")}
                    />
                    <WorkspacePill
                      label="Public"
                      square
                      tone="forge"
                      active={automationVisibility === "public"}
                      disabled={saving}
                      onClick={() => setAutomationVisibility("public")}
                    />
                  </div>
                </div>
                <div className={FORGE_TASK_BUILDER_INFIELD_CLASS}>
                  <span className="shrink-0 text-base text-white">Keyword</span>
                  <Input
                    value={plan.keyword}
                    onChange={(e) => setPlan((p) => ({ ...p, keyword: e.target.value }))}
                    placeholder="automation-keyword"
                    disabled={saving}
                    className={TASK_FORM_FLAT_CONTROL_CLASS}
                  />
                </div>
                <div className={FORGE_TASK_BUILDER_INFIELD_CLASS}>
                  <span className="shrink-0 text-base text-white">Name</span>
                  <Input
                    value={plan.name}
                    onChange={(e) => setPlan((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Automation name"
                    disabled={saving}
                    className={TASK_FORM_FLAT_CONTROL_CLASS}
                  />
                </div>
              </div>
              {sites.length > 0 ? (
                mode === "edit" ? (
                  <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-base text-white">Client site</span>
                      <Select
                        value={clientId || "__empty__"}
                        onValueChange={(v) => setClientId(v === "__empty__" ? "" : v)}
                        disabled={saving}
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
                    </div>
                  </div>
                ) : (
                  <section className="flex min-h-0 flex-1 flex-col">
                    <TaskBuilderClientSitePicker
                      sites={sites}
                      selectedIds={selectedClientIds}
                      onChange={setSelectedClientIds}
                      disabled={saving}
                    />
                  </section>
                )
              ) : null}
            </div>
          </TaskBuilderPanelShell>
        ) : null}

        {tab === "what" ? (
          <TaskBuilderPanelShell>
            <AutomationWhatPanel
              action={plan.action}
              actionBlocks={actionBlocks}
              disabled={saving}
              pillTone="forge"
              onChange={(action) => setPlan((p) => ({ ...p, action }))}
            />
          </TaskBuilderPanelShell>
        ) : null}

        {tab === "when" ? (
          <TaskBuilderPanelShell>
            <AutomationWhenPanel
              trigger={plan.trigger}
              triggerBlocks={triggerBlocks}
              disabled={saving}
              onChange={(trigger) => setPlan((p) => ({ ...p, trigger }))}
            />
          </TaskBuilderPanelShell>
        ) : null}

        {tab === "then" ? (
          <TaskBuilderPanelShell>
            <AutomationThenPanel
              action={plan.action}
              disabled={saving}
              onChange={(patch) => {
                if (patch.executionPayload) {
                  thenExecutionPayloadRef.current = patch.executionPayload;
                  if (editAutomation?.id) {
                    writeCachedExecutionPayload(editAutomation.id, patch.executionPayload);
                  }
                }
                setPlan((p) => ({ ...p, action: { ...p.action, ...patch } }));
              }}
            />
          </TaskBuilderPanelShell>
        ) : null}

        {tab === "preview" ? (
          <TaskBuilderPanelShell label="Preview">
            {previewBlocks.length > 0 ? (
              <ul className="flex flex-col gap-2">
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
          </TaskBuilderPanelShell>
        ) : null}

        {tab === "json" ? (
          <TaskBuilderPanelShell>
            <AutomationJsonPanel
              ref={jsonPanelRef}
              plan={plan}
              disabled={saving}
              onPlanChange={(nextPlan) => {
                thenExecutionPayloadRef.current = nextPlan.action.executionPayload ?? null;
                setPlan(nextPlan);
              }}
            />
          </TaskBuilderPanelShell>
        ) : null}

        {tab === "archive" ? (
          <TaskBuilderPanelShell>
            <TaskBuilderArchivePanel
              teamId={teamId}
              taskId={editTask?.id ?? null}
              saveLocalArchive={effectiveSaveLocalArchive(
                plan.action.executionKind,
                plan.action.executionPayload,
              )}
              executionPayload={plan.action.executionPayload}
              executionKind={plan.action.executionKind}
              automationTitle={plan.name || plan.action.title || editAutomation?.title}
              siteName={archiveSiteName}
              disabled={saving}
            />
          </TaskBuilderPanelShell>
        ) : null}

        {tab === "template" && mode === "edit" ? (
          <TaskBuilderPanelShell label="Template">
            <div className="flex flex-col gap-3">
              {editTask ? (
                <div className="flex justify-end">
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
              <div className="flex flex-col gap-2">
                <TaskFormInlineRow label="Template name">
                  <Input
                    value={saveFromName}
                    onChange={(e) => setSaveFromName(e.target.value)}
                    placeholder="Team template name"
                    disabled={saving}
                    className={TASK_FORM_FLAT_CONTROL_CLASS}
                  />
                </TaskFormInlineRow>
                <TaskFormInlineRow label="Template keyword">
                  <Input
                    value={saveFromKeyword}
                    onChange={(e) => setSaveFromKeyword(e.target.value)}
                    placeholder="template-keyword"
                    disabled={saving}
                    className={TASK_FORM_FLAT_CONTROL_CLASS}
                  />
                </TaskFormInlineRow>
                <TaskFormInlineRow label="Save">
                  <Button
                    type="button"
                    className={cn("h-9 w-full max-w-xs text-base", TASK_FORM_DIALOG_BUTTON_CLASS)}
                    disabled={saving}
                    onClick={() => void handleSaveTemplate()}
                  >
                    Save template
                  </Button>
                </TaskFormInlineRow>
              </div>
            </div>
          </TaskBuilderPanelShell>
        ) : null}
      </div>

      {error ? <p className="shrink-0 px-4 pb-4 text-base text-red-400">{error}</p> : null}
    </div>
  );
}
