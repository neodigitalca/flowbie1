import type {
  MobilePushActionContext,
  MobilePushActionId,
  MobilePushPayload,
  MobilePushPrefKey,
  MobilePushPrefs,
} from "./types";

export type MobilePushActionDefinition = {
  id: MobilePushActionId;
  category: "chat" | "tasks" | "agents";
  label: string;
  description: string;
  prefKey: MobilePushPrefKey;
  defaultEnabled: boolean;
  buildTitle: (ctx: MobilePushActionContext) => string;
  buildBody: (ctx: MobilePushActionContext) => string;
  buildPayload: (ctx: MobilePushActionContext) => MobilePushPayload;
};

function truncate(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export const DEFAULT_MOBILE_PUSH_PREFS: MobilePushPrefs = {
  mentions: true,
  dms: true,
  threads: true,
  calls: true,
  channelMessages: false,
  taskAssigned: true,
  agentRuns: true,
};

export const MOBILE_PUSH_ACTIONS: MobilePushActionDefinition[] = [
  {
    id: "chat.mention",
    category: "chat",
    label: "Mentions",
    description: "When someone @mentions you in chat",
    prefKey: "mentions",
    defaultEnabled: true,
    buildTitle: (ctx) => `${ctx.authorName ?? "Someone"} mentioned you`,
    buildBody: (ctx) =>
      truncate(ctx.bodyPreview ?? "New mention", 120),
    buildPayload: (ctx) => ({
      actionId: "chat.mention",
      teamId: ctx.teamId,
      channelId: ctx.channelId,
      messageId: ctx.messageId,
      threadRootId: ctx.threadRootId,
    }),
  },
  {
    id: "chat.dm",
    category: "chat",
    label: "Direct messages",
    description: "New messages in a DM conversation",
    prefKey: "dms",
    defaultEnabled: true,
    buildTitle: (ctx) => ctx.authorName ?? "Direct message",
    buildBody: (ctx) => truncate(ctx.bodyPreview ?? "New message", 120),
    buildPayload: (ctx) => ({
      actionId: "chat.dm",
      teamId: ctx.teamId,
      channelId: ctx.channelId,
      messageId: ctx.messageId,
    }),
  },
  {
    id: "chat.thread",
    category: "chat",
    label: "Thread replies",
    description: "Replies in threads you follow",
    prefKey: "threads",
    defaultEnabled: true,
    buildTitle: (ctx) => `Reply in ${ctx.channelLabel ?? "thread"}`,
    buildBody: (ctx) =>
      truncate(
        ctx.authorName
          ? `${ctx.authorName}: ${ctx.bodyPreview ?? "New reply"}`
          : ctx.bodyPreview ?? "New thread reply",
        120,
      ),
    buildPayload: (ctx) => ({
      actionId: "chat.thread",
      teamId: ctx.teamId,
      channelId: ctx.channelId,
      messageId: ctx.messageId,
      threadRootId: ctx.threadRootId,
    }),
  },
  {
    id: "chat.call",
    category: "chat",
    label: "Incoming calls",
    description: "When someone starts a call with you",
    prefKey: "calls",
    defaultEnabled: true,
    buildTitle: () => "Incoming call",
    buildBody: (ctx) => `${ctx.callerName ?? "Someone"} is calling`,
    buildPayload: (ctx) => ({
      actionId: "chat.call",
      teamId: ctx.teamId,
      channelId: ctx.channelId,
    }),
  },
  {
    id: "chat.channel",
    category: "chat",
    label: "Channel messages",
    description: "New messages in channels you watch",
    prefKey: "channelMessages",
    defaultEnabled: false,
    buildTitle: (ctx) => ctx.channelLabel ?? "Channel message",
    buildBody: (ctx) =>
      truncate(
        ctx.authorName
          ? `${ctx.authorName}: ${ctx.bodyPreview ?? "New message"}`
          : ctx.bodyPreview ?? "New message",
        120,
      ),
    buildPayload: (ctx) => ({
      actionId: "chat.channel",
      teamId: ctx.teamId,
      channelId: ctx.channelId,
      messageId: ctx.messageId,
    }),
  },
  {
    id: "task.assigned",
    category: "tasks",
    label: "Task assigned",
    description: "When a task is assigned to you",
    prefKey: "taskAssigned",
    defaultEnabled: true,
    buildTitle: () => "Task assigned",
    buildBody: (ctx) => truncate(ctx.taskTitle ?? "You have a new task", 120),
    buildPayload: (ctx) => ({
      actionId: "task.assigned",
      teamId: ctx.teamId,
      taskId: ctx.taskId,
    }),
  },
  {
    id: "agent.run_complete",
    category: "agents",
    label: "Agent finished",
    description: "When an agent run completes or fails",
    prefKey: "agentRuns",
    defaultEnabled: true,
    buildTitle: (ctx) => {
      const status = ctx.runStatus ?? "done";
      if (status === "failed") return "Agent run failed";
      if (status === "cancelled") return "Agent run cancelled";
      return "Agent run complete";
    },
    buildBody: (ctx) => truncate(ctx.runTitle ?? "Agent run finished", 120),
    buildPayload: (ctx) => ({
      actionId: "agent.run_complete",
      teamId: ctx.teamId,
      runId: ctx.runId,
    }),
  },
];

export const MOBILE_PUSH_ACTION_BY_ID: Record<
  MobilePushActionId,
  MobilePushActionDefinition
> = MOBILE_PUSH_ACTIONS.reduce(
  (acc, action) => {
    acc[action.id] = action;
    return acc;
  },
  {} as Record<MobilePushActionId, MobilePushActionDefinition>,
);

export function isMobilePushActionId(value: string): value is MobilePushActionId {
  return value in MOBILE_PUSH_ACTION_BY_ID;
}

export function shouldSendMobilePush(
  actionId: MobilePushActionId,
  prefs: MobilePushPrefs,
): boolean {
  const action = MOBILE_PUSH_ACTION_BY_ID[actionId];
  if (!action) return false;
  return prefs[action.prefKey] !== false;
}

export function buildMobilePushNotification(
  actionId: MobilePushActionId,
  context: MobilePushActionContext,
): { title: string; body: string; payload: MobilePushPayload } | null {
  const action = MOBILE_PUSH_ACTION_BY_ID[actionId];
  if (!action) return null;
  return {
    title: action.buildTitle(context),
    body: action.buildBody(context),
    payload: action.buildPayload(context),
  };
}
