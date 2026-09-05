import { linearOrderedNodes } from "@/lib/workflow/workflow-graph-mutations";
import { calendarDayOfMonthFromConfig } from "@/lib/workflow/workflow-calendar-start";
import type { TaskExecutionPayload } from "@/lib/tasks-types";
import type {
  WorkflowActionConfig,
  WorkflowCalendarTriggerConfig,
  WorkflowClientConfig,
  WorkflowDefinition,
  WorkflowNode,
} from "@/lib/workflow/workflow-types";
import { isWorkflowScheduleKind } from "@/lib/workflow/workflow-types";

export type WorkflowCalendarFields = Pick<
  WorkflowCalendarTriggerConfig,
  "frequency" | "startDate" | "time" | "dayOfMonth" | "startMonthChoice" | "timezone"
>;

export function calendarFieldsFromConfig(
  config: WorkflowClientConfig | WorkflowCalendarTriggerConfig | Record<string, unknown>,
): WorkflowCalendarFields {
  const startDate = String(config.startDate ?? "").trim().slice(0, 10);
  const time = String(config.time ?? "").trim().slice(0, 5);
  const frequency = (config.frequency as WorkflowCalendarFields["frequency"] | undefined) ?? "monthly";
  const startMonthChoice = config.startMonthChoice as WorkflowCalendarFields["startMonthChoice"] | undefined;
  const timezone = String(config.timezone ?? "").trim() || "America/Edmonton";
  return {
    frequency,
    startDate,
    time,
    dayOfMonth: calendarDayOfMonthFromConfig({
      dayOfMonth: typeof config.dayOfMonth === "number" ? config.dayOfMonth : undefined,
      startDate,
    }),
    ...(startMonthChoice ? { startMonthChoice } : {}),
    timezone,
  };
}

export function hasWorkflowPublishSchedule(
  config: WorkflowClientConfig | WorkflowCalendarTriggerConfig | Record<string, unknown> | undefined,
): boolean {
  return String(config?.startDate ?? "").trim().length >= 10;
}

export function applyCalendarFieldsToAgentPayload(
  calendar: WorkflowCalendarFields,
  payload: TaskExecutionPayload,
): TaskExecutionPayload {
  const startDate = calendar.startDate.slice(0, 10);
  const time = calendar.time.slice(0, 5) || "09:00";
  return {
    ...payload,
    scheduleStartTime: time,
    scheduleStartDateOption: "custom",
    scheduleCustomStartDate: startDate,
    scheduleStartDay: calendar.dayOfMonth,
  };
}

function stampUpstreamNode(upstream: WorkflowNode, calendar: WorkflowCalendarFields): WorkflowNode {
  if (upstream.kind === "workflow_client") {
    return {
      ...upstream,
      config: {
        ...(upstream.config as WorkflowClientConfig),
        ...calendar,
      },
    };
  }
  if (upstream.kind === "action_agent") {
    const config = upstream.config as WorkflowActionConfig;
    return {
      ...upstream,
      config: {
        ...config,
        executionPayload: applyCalendarFieldsToAgentPayload(calendar, config.executionPayload ?? {}),
      },
    };
  }
  return {
    ...upstream,
    config: {
      ...(upstream.config as Record<string, unknown>),
      ...calendar,
    },
  };
}

/** Write each Schedule step's When onto the immediate upstream node. */
export function applyScheduleStampToUpstream(workflow: WorkflowDefinition): WorkflowDefinition {
  const ordered = linearOrderedNodes(workflow);
  const replacements = new Map<string, WorkflowNode>();

  for (let index = 0; index < ordered.length; index += 1) {
    const node = ordered[index]!;
    if (!isWorkflowScheduleKind(node.kind)) continue;
    const upstream = ordered[index - 1];
    if (!upstream) continue;
    const calendar = calendarFieldsFromConfig(node.config as WorkflowCalendarTriggerConfig);
    if (!hasWorkflowPublishSchedule(calendar)) continue;
    replacements.set(upstream.id, stampUpstreamNode(upstream, calendar));
  }

  if (replacements.size === 0) return workflow;
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => replacements.get(node.id) ?? node),
  };
}

/** Keep a Schedule step immediately after Client in sync with Client Publish fields. */
export function syncAdjacentScheduleFromClient(workflow: WorkflowDefinition): WorkflowDefinition {
  const ordered = linearOrderedNodes(workflow);
  const clientIndex = ordered.findIndex((node) => node.kind === "workflow_client");
  if (clientIndex < 0) return workflow;
  const client = ordered[clientIndex]!;
  const next = ordered[clientIndex + 1];
  if (!next || !isWorkflowScheduleKind(next.kind)) return workflow;
  const calendar = calendarFieldsFromConfig(client.config as WorkflowClientConfig);
  if (!hasWorkflowPublishSchedule(calendar)) return workflow;
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.id === next.id
        ? { ...node, config: { ...(node.config as Record<string, unknown>), ...calendar } }
        : node,
    ),
  };
}

export function scheduleHasUpstream(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
  scheduleNodeId: string,
): boolean {
  const ordered = linearOrderedNodes(workflow);
  const index = ordered.findIndex((node) => node.id === scheduleNodeId);
  return index > 0;
}
