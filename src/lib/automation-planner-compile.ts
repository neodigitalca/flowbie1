import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import type { TaskRecurrenceRule, TaskTemplateTaskDef } from "@/lib/tasks-types";
import {
  defaultTaskTriggerConfig,
  isScheduleOnlyTriggerSource,
  type TaskTriggerConfig,
} from "@/lib/task-trigger-types";
import type {
  AutomationActionBlock,
  AutomationGscTriggerBlock,
  AutomationPlan,
  AutomationPlanRecipeMeta,
  AutomationPlanTaskInput,
  AutomationPollTriggerBlock,
  AutomationScheduleBlock,
  AutomationTriggerBlock,
  ScheduleFrequency,
} from "@/lib/automation-planner-types";
import { SCHEDULE_BLOCK_KEYWORDS } from "@/lib/automation-planner-types";

function recurrenceToFrequency(rule?: TaskRecurrenceRule): ScheduleFrequency {
  if (rule === "none" || !rule) return "once";
  if (rule === "daily" || rule === "weekly" || rule === "monthly" || rule === "yearly") return rule;
  return "once";
}

function frequencyToRecurrence(frequency: ScheduleFrequency): TaskRecurrenceRule {
  return frequency === "once" ? "none" : frequency;
}

function inferGscTriggerKeyword(config: TaskTriggerConfig): string {
  if (config.match === "all" && config.conditions.length > 1) return "gsc-dual-decay";
  const signal = config.conditions[0]?.signal;
  if (signal === "ctr_drop") return "gsc-ctr-drop";
  if (signal === "position_drop") return "gsc-position-drop";
  if (signal === "clicks_drop") return "gsc-clicks-drop";
  if (signal === "quick_win_slipped") return "gsc-quick-win-slipped";
  if (signal === "impressions_up_ctr_down") return "gsc-impressions-ctr-decay";
  return "gsc-custom";
}

function inferActionKeyword(kind: string, payload?: { targetBucket?: string }): string {
  if (kind === "content_optimizer_meta") return "content-optimizer-meta";
  if (kind === "content_optimizer") return "content-optimizer-full";
  if (kind === "post_creator") return "post-creator-monthly";
  if (kind === "gsc_reporting") {
    return payload && "comparePreset" in payload && payload.comparePreset === "yoy"
      ? "gsc-report-yoy"
      : "gsc-report-mom";
  }
  return `action-${kind || "custom"}`;
}

export function taskDefToTriggerBlock(task: AutomationPlanTaskInput): AutomationTriggerBlock {
  if (task.scheduleMode === "calendar") {
    const frequency = recurrenceToFrequency(task.recurrenceRule);
    return {
      keyword: SCHEDULE_BLOCK_KEYWORDS[frequency],
      kind: "calendar",
      frequency,
      startDate: (task.dueDate ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      time: (task.dueTime ?? "09:00").slice(0, 5),
      targetBucket: task.executionPayload?.targetBucket,
    };
  }

  const triggerConfig = task.triggerConfig ?? defaultTaskTriggerConfig();
  if (isScheduleOnlyTriggerSource(triggerConfig.sources)) {
    return {
      keyword: "schedule-poll",
      kind: "poll",
      pollHours: triggerConfig.pollHours,
      targetBucket: task.executionPayload?.targetBucket,
      triggerConfig,
    };
  }

  return {
    keyword: inferGscTriggerKeyword(triggerConfig),
    kind: "gsc",
    source: triggerConfig.sources[0] ?? "gsc",
    targetBucket: task.executionPayload?.targetBucket,
    triggerConfig,
  };
}

export function taskDefToActionBlock(task: AutomationPlanTaskInput): AutomationActionBlock {
  return {
    keyword: inferActionKeyword(task.executionKind ?? "", task.executionPayload),
    executionKind: task.executionKind ?? "content_optimizer",
    executionPayload: task.executionPayload ?? {},
    title: task.title,
  };
}

export function taskDefToPlan(
  task: AutomationPlanTaskInput,
  recipeMeta?: AutomationPlanRecipeMeta,
): AutomationPlan {
  return {
    keyword: recipeMeta?.keyword ?? task.keyword ?? "automation",
    name: recipeMeta?.name ?? task.title ?? "Automation",
    description: recipeMeta?.description,
    category: recipeMeta?.category,
    prerequisites: recipeMeta?.prerequisites,
    trigger: taskDefToTriggerBlock(task),
    action: taskDefToActionBlock(task),
  };
}

export function recipeToPlan(recipe: AutomationRecipeCatalogItem): AutomationPlan {
  const meta: AutomationPlanRecipeMeta = {
    keyword: recipe.keyword,
    name: recipe.name,
    description: recipe.description,
    category: recipe.category,
    prerequisites: recipe.prerequisites,
  };

  const tasks = recipe.defaultTasks ?? [];
  const trigger =
    recipe.triggerBlock ??
    (tasks[0] ? taskDefToTriggerBlock(tasks[0]) : taskDefToTriggerBlock({ scheduleMode: "trigger" }));
  const actionBlocks =
    recipe.actionBlocks ??
    (recipe.actionBlock
      ? [recipe.actionBlock]
      : tasks.map((t) => taskDefToActionBlock(t)));

  const plan: AutomationPlan = {
    ...meta,
    trigger: trigger as AutomationTriggerBlock,
    action: actionBlocks[0] ?? taskDefToActionBlock({ title: recipe.name }),
  };
  if (actionBlocks.length > 1) {
    plan.actions = actionBlocks;
  }
  return plan;
}

export function triggerBlockToTaskFields(trigger: AutomationTriggerBlock): Partial<TaskTemplateTaskDef> {
  if (trigger.kind === "calendar") {
    return {
      scheduleMode: "calendar",
      dueDate: trigger.startDate,
      dueTime: trigger.time,
      recurrenceRule: frequencyToRecurrence(trigger.frequency),
    };
  }
  if (trigger.kind === "poll") {
    return {
      scheduleMode: "trigger",
      recurrenceRule: "none",
      triggerConfig: trigger.triggerConfig,
    };
  }
  return {
    scheduleMode: "trigger",
    recurrenceRule: "none",
    triggerConfig: trigger.triggerConfig,
  };
}

export function planToTaskDef(plan: AutomationPlan, taskKeyword?: string): TaskTemplateTaskDef {
  const triggerFields = triggerBlockToTaskFields(plan.trigger);
  const payload = { ...plan.action.executionPayload };
  if (plan.trigger.kind !== "calendar" && plan.trigger.targetBucket && !payload.targetBucket) {
    payload.targetBucket = plan.trigger.targetBucket;
  }

  return {
    keyword: taskKeyword ?? `${plan.keyword}-run`,
    title: plan.action.title ?? plan.name,
    status: "todo",
    assignPulse: true,
    executionKind: plan.action.executionKind,
    executionPayload: payload,
    ...triggerFields,
  };
}

export function planToTaskDefs(plan: AutomationPlan): TaskTemplateTaskDef[] {
  const actions = plan.actions?.length ? plan.actions : [plan.action];
  return actions.map((action, index) => {
    const subPlan: AutomationPlan = { ...plan, action };
    const kw =
      actions.length > 1
        ? `${plan.keyword}-task-${index + 1}`
        : `${plan.keyword}-run`;
    return planToTaskDef(subPlan, kw);
  });
}

export function planToRecipeJson(plan: AutomationPlan): AutomationRecipeCatalogItem {
  const defaultTasks = planToTaskDefs(plan);
  const triggerBlock = plan.trigger;
  const actionBlocks = plan.actions?.length ? plan.actions : [plan.action];

  return {
    keyword: plan.keyword,
    name: plan.name,
    description: plan.description ?? "",
    isAutomation: true,
    category: plan.category ?? "reactive",
    verticals: ["general"],
    tags: [],
    prerequisites: (plan.prerequisites ?? []) as AutomationRecipeCatalogItem["prerequisites"],
    filters: {
      executionKinds: [...new Set(actionBlocks.map((a) => a.executionKind).filter(Boolean))],
      targetBuckets: triggerBlock.targetBucket ? [triggerBlock.targetBucket] : undefined,
      triggerSignals:
        triggerBlock.kind === "gsc"
          ? triggerBlock.triggerConfig.conditions.map((c) => c.signal)
          : undefined,
      actionCount: actionBlocks.length,
    },
    triggerBlock,
    actionBlock: actionBlocks[0],
    actionBlocks: actionBlocks.length > 1 ? actionBlocks : undefined,
    defaultTasks,
  };
}

export function validateAutomationPlan(plan: AutomationPlan): string[] {
  const errors: string[] = [];
  if (!plan.keyword.trim()) errors.push("Keyword is required.");
  if (!plan.name.trim()) errors.push("Name is required.");
  if (!plan.action.executionKind) errors.push("Action execution kind is required.");

  if (plan.trigger.kind === "calendar") {
    const t = plan.trigger as AutomationScheduleBlock;
    if (!t.startDate.trim()) errors.push("Schedule start date is required.");
    if (!t.time.trim()) errors.push("Schedule time is required.");
  } else if (plan.trigger.kind === "gsc") {
    const t = plan.trigger as AutomationGscTriggerBlock;
    if (!t.triggerConfig.conditions.length) errors.push("At least one GSC condition is required.");
  } else if (plan.trigger.kind === "poll") {
    const t = plan.trigger as AutomationPollTriggerBlock;
    if (t.pollHours < 1) errors.push("Poll interval must be at least 1 hour.");
  }

  return errors;
}
