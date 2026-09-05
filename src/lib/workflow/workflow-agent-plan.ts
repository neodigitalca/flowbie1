import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import type {
  AutomationGscTriggerBlock,
  AutomationPollTriggerBlock,
  AutomationScheduleBlock,
  AutomationTriggerBlock,
  AutomationPlan,
  ScheduleFrequency,
} from "@/lib/automation-planner-types";
import { SCHEDULE_BLOCK_KEYWORDS } from "@/lib/automation-planner-types";
import { recipeToPlan, inferActionKeyword } from "@/lib/automation-planner-compile";
import { mergeExecutionPayloadForSave } from "@/lib/post-creator/post-creator-schedule-payload";
import { defaultTaskTriggerConfig } from "@/lib/task-trigger-types";
import {
  ensureOptimizationOptions,
} from "@/lib/task-optimization-options-defaults";
import type { TaskExecutionPayload } from "@/lib/tasks-types";
import type {
  WorkflowActionConfig,
  WorkflowCalendarTriggerConfig,
  WorkflowDefinition,
  WorkflowGscTriggerConfig,
  WorkflowNode,
} from "@/lib/workflow/workflow-types";
import { isWorkflowTriggerKind } from "@/lib/workflow/workflow-types";

function normalizeTime(value: string | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "09:00";
  return trimmed.slice(0, 5);
}

function dayFromDate(date: string): number {
  return Math.max(1, Math.min(28, Number(date.slice(8, 10)) || 1));
}

function findWorkflowTriggerNode(workflow: Pick<WorkflowDefinition, "nodes">): WorkflowNode | null {
  return workflow.nodes.find((node) => isWorkflowTriggerKind(node.kind)) ?? null;
}

function calendarTriggerFromNode(node: WorkflowNode): AutomationScheduleBlock {
  const config = node.config as WorkflowCalendarTriggerConfig;
  const frequency = (config.frequency ?? "monthly") as ScheduleFrequency;
  return {
    keyword: SCHEDULE_BLOCK_KEYWORDS[frequency] ?? "schedule-monthly",
    kind: "calendar",
    frequency,
    startDate: String(config.startDate ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    time: normalizeTime(config.time),
  };
}

function gscTriggerFromNode(node: WorkflowNode): AutomationGscTriggerBlock {
  const config = node.config as WorkflowGscTriggerConfig;
  return {
    keyword: "gsc-custom",
    kind: "gsc",
    source: config.source ?? "gsc",
    targetBucket: config.targetBucket,
    triggerConfig: config.triggerConfig ?? defaultTaskTriggerConfig(),
  };
}

export function payloadHasCustomScheduleDate(payload: Record<string, unknown> | undefined): boolean {
  if (!payload) return false;
  return (
    payload.scheduleStartDateOption === "custom" &&
    String(payload.scheduleCustomStartDate ?? "").trim().length >= 10
  );
}

/** Hydrate Forge When tab from the Client publish schedule, then any remaining trigger node. */
export function readWorkflowTriggerBlock(
  workflow: Pick<WorkflowDefinition, "nodes">,
): AutomationTriggerBlock | null {
  const client = workflow.nodes.find((node) => node.kind === "workflow_client") ?? null;
  if (client && String((client.config as WorkflowCalendarTriggerConfig).startDate ?? "").trim().length >= 10) {
    return calendarTriggerFromNode(client);
  }
  const node = findWorkflowTriggerNode(workflow);
  if (!node) return null;
  if (node.kind === "trigger_gsc") return gscTriggerFromNode(node);
  if (node.kind === "trigger_manual") {
    return {
      keyword: "schedule-once",
      kind: "calendar",
      frequency: "once",
      startDate: new Date().toISOString().slice(0, 10),
      time: "09:00",
    };
  }
  return null;
}

function patchCalendarTriggerNode(node: WorkflowNode, trigger: AutomationScheduleBlock): WorkflowNode {
  const config = node.config as WorkflowCalendarTriggerConfig;
  return {
    ...node,
    config: {
      ...config,
      frequency: trigger.frequency,
      startDate: trigger.startDate.slice(0, 10),
      time: normalizeTime(trigger.time),
      recurrenceRule: trigger.frequency === "once" ? "none" : trigger.frequency,
    },
  };
}

function patchGscTriggerNode(node: WorkflowNode, trigger: AutomationGscTriggerBlock): WorkflowNode {
  const config = node.config as WorkflowGscTriggerConfig;
  return {
    ...node,
    config: {
      ...config,
      source: trigger.source,
      targetBucket: trigger.targetBucket,
      triggerConfig: trigger.triggerConfig,
    },
  };
}

/** Persist Forge When tab edits onto the workflow trigger node. */
export function applyWorkflowTriggerBlock(
  workflow: WorkflowDefinition,
  trigger: AutomationTriggerBlock,
): WorkflowDefinition {
  const nodes = workflow.nodes.map((node) => {
    if (trigger.kind === "calendar" && (node.kind === "workflow_client" || node.kind === "trigger_calendar")) {
      return patchCalendarTriggerNode(node, trigger);
    }
    if (trigger.kind === "gsc" && node.kind === "trigger_gsc") {
      return patchGscTriggerNode(node, trigger);
    }
    if (trigger.kind === "poll" && node.kind === "trigger_gsc") {
      const poll = trigger as AutomationPollTriggerBlock;
      return {
        ...node,
        config: {
          ...(node.config as WorkflowGscTriggerConfig),
          targetBucket: poll.targetBucket,
          triggerConfig: poll.triggerConfig ?? defaultTaskTriggerConfig(),
        },
      };
    }
    return node;
  });
  return { ...workflow, nodes };
}

const SCHEDULE_PAYLOAD_KINDS = new Set([
  "entity_page_creator",
  "entity_generator",
  "sap_generator",
  "post_creator",
]);

const AGENT_SCHEDULE_PAYLOAD_KEYS: (keyof TaskExecutionPayload)[] = [
  "scheduleFrequency",
  "scheduleCustomInterval",
  "scheduleDayOfWeek",
  "scheduleStartDateOption",
  "scheduleCustomStartDate",
  "scheduleTimesPerMonth",
  "scheduleStartDay",
  "scheduleStartTime",
  "scheduleStaggerOptimized",
  "schedulePublishDays",
  "scheduleDraftOnly",
  "postDestination",
];

/** Remove workflow-level schedule fields from agent payload before workflow-agent save. */
export function stripScheduleFieldsFromAgentPayload(
  payload: TaskExecutionPayload | undefined,
): TaskExecutionPayload {
  const next = { ...(payload ?? {}) } as Record<string, unknown>;
  for (const key of AGENT_SCHEDULE_PAYLOAD_KEYS) {
    delete next[key];
  }
  return next as TaskExecutionPayload;
}

/** Copy Then-tab custom schedule date onto the calendar trigger block. */
export function syncTriggerFromActionSchedule(
  trigger: AutomationTriggerBlock,
  payload: Record<string, unknown>,
  executionKind: string,
): AutomationTriggerBlock {
  if (!SCHEDULE_PAYLOAD_KINDS.has(executionKind) || trigger.kind !== "calendar") {
    return trigger;
  }
  if (!payloadHasCustomScheduleDate(payload)) return trigger;
  const schedule = trigger as AutomationScheduleBlock;
  const startDate = String(payload.scheduleCustomStartDate).slice(0, 10);
  return {
    ...schedule,
    startDate,
    time: normalizeTime(String(payload.scheduleStartTime ?? schedule.time)),
  };
}

/** Keep action posting schedule aligned with calendar trigger When tab. */
export function syncActionScheduleFromTrigger(
  trigger: AutomationTriggerBlock,
  executionPayload: Record<string, unknown> | undefined,
  executionKind: string,
): Record<string, unknown> {
  const payload = { ...(executionPayload ?? {}) };
  if (trigger.kind !== "calendar" || !SCHEDULE_PAYLOAD_KINDS.has(executionKind)) {
    return payload;
  }
  const usesScheduleFields =
    "scheduleStartTime" in payload ||
    "scheduleFrequency" in payload ||
    "scheduleTimesPerMonth" in payload ||
    "scheduleStartDateOption" in payload ||
    "scheduleCustomStartDate" in payload;
  if (!usesScheduleFields) return payload;

  const startDate = trigger.startDate.slice(0, 10);
  payload.scheduleStartTime = normalizeTime(trigger.time);
  payload.scheduleStartDateOption = "custom";
  payload.scheduleCustomStartDate = startDate;
  payload.scheduleStartDay = dayFromDate(startDate);
  return payload;
}

export function reconcileTriggerWithSavedSchedule(
  trigger: AutomationTriggerBlock,
  payload: Record<string, unknown>,
  executionKind: string,
): AutomationTriggerBlock {
  if (payloadHasCustomScheduleDate(payload)) {
    return syncTriggerFromActionSchedule(trigger, payload, executionKind);
  }
  return trigger;
}

/** Keep Then-tab posting schedule aligned with calendar trigger edits on the When tab. */
export function applyTriggerScheduleToPlan(plan: AutomationPlan): AutomationPlan {
  const executionKind = plan.action.executionKind;
  if (!SCHEDULE_PAYLOAD_KINDS.has(executionKind) || plan.trigger.kind !== "calendar") {
    return plan;
  }
  const executionPayload = syncActionScheduleFromTrigger(
    plan.trigger,
    plan.action.executionPayload as Record<string, unknown>,
    executionKind,
  ) as TaskExecutionPayload;
  return { ...plan, action: { ...plan.action, executionPayload } };
}

/** Keep calendar trigger aligned with Then-tab posting schedule edits. */
export function applyActionScheduleToPlanTrigger(plan: AutomationPlan): AutomationPlan {
  const executionKind = plan.action.executionKind;
  const payload = plan.action.executionPayload as Record<string, unknown>;
  if (!SCHEDULE_PAYLOAD_KINDS.has(executionKind)) return plan;
  return {
    ...plan,
    trigger: reconcileTriggerWithSavedSchedule(plan.trigger, payload, executionKind),
  };
}

/** Saved action payload wins on load; trigger is aligned when payload carries a custom date. */
export function hydrateWorkflowAgentPlanFromNodes(input: {
  recipe: AutomationRecipeCatalogItem;
  workflow: WorkflowDefinition;
  nodeId: string;
}): AutomationPlan {
  const node = input.workflow.nodes.find((item) => item.id === input.nodeId);
  const config = node?.config as WorkflowActionConfig | undefined;
  const next = recipeToPlan(input.recipe);

  if (!config) return next;

  const savedPayload = mergeExecutionPayloadForSave(undefined, config.executionPayload) as Record<
    string,
    unknown
  >;
  const executionKind = config.executionKind ?? next.action.executionKind;
  const actionBlockKeyword =
    config.actionBlockKeyword?.trim() ||
    inferActionKeyword(executionKind, savedPayload as TaskExecutionPayload);

  let executionPayload = savedPayload as TaskExecutionPayload;
  if (executionKind === "content_optimizer" || executionKind === "content_optimizer_meta") {
    executionPayload = ensureOptimizationOptions(executionPayload, actionBlockKeyword);
  }

  next.action = {
    ...next.action,
    keyword: actionBlockKeyword,
    executionKind,
    executionPayload,
    title: config.title ?? next.action.title,
  };
  next.name = config.title ?? next.name;

  const triggerFromWorkflow = readWorkflowTriggerBlock(input.workflow);
  if (triggerFromWorkflow) {
    next.trigger = triggerFromWorkflow;
  }

  return next;
}

/** Coalesce When + Then schedule edits before persisting workflow nodes. */
export function syncWorkflowAgentScheduleForSave(plan: AutomationPlan): {
  trigger: AutomationTriggerBlock;
  executionPayload: TaskExecutionPayload;
} {
  const executionKind = plan.action.executionKind;
  const payload = { ...(plan.action.executionPayload ?? {}) } as Record<string, unknown>;
  let trigger = plan.trigger;

  if (!SCHEDULE_PAYLOAD_KINDS.has(executionKind)) {
    return { trigger, executionPayload: payload as TaskExecutionPayload };
  }

  if (payloadHasCustomScheduleDate(payload)) {
    trigger = syncTriggerFromActionSchedule(trigger, payload, executionKind);
  }

  if (trigger.kind === "calendar") {
    return {
      trigger,
      executionPayload: syncActionScheduleFromTrigger(trigger, payload, executionKind) as TaskExecutionPayload,
    };
  }

  return { trigger, executionPayload: payload as TaskExecutionPayload };
}

export function applyWorkflowTriggerScheduleToPayload(
  workflow: Pick<WorkflowDefinition, "nodes">,
  executionKind: string,
  executionPayload: TaskExecutionPayload,
): TaskExecutionPayload {
  const payload = executionPayload as Record<string, unknown>;
  if (payloadHasCustomScheduleDate(payload)) {
    return executionPayload;
  }
  const trigger = readWorkflowTriggerBlock(workflow);
  if (!trigger) return executionPayload;
  return syncActionScheduleFromTrigger(
    trigger,
    payload,
    executionKind,
  ) as TaskExecutionPayload;
}
