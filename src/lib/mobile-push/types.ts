import type { MobileAppTab } from "@/components/mobile-app/mobile-app-types";

export type MobilePushPlatform = "android" | "ios" | "web";

export type MobilePushActionId =
  | "chat.mention"
  | "chat.dm"
  | "chat.thread"
  | "chat.call"
  | "chat.channel"
  | "task.assigned"
  | "agent.run_complete";

export type MobilePushPrefKey =
  | "mentions"
  | "dms"
  | "threads"
  | "calls"
  | "channelMessages"
  | "taskAssigned"
  | "agentRuns";

export type MobilePushPrefs = Record<MobilePushPrefKey, boolean>;

export type MobilePushActionContext = {
  teamId: number;
  channelId?: number;
  messageId?: number;
  threadRootId?: number;
  taskId?: number;
  runId?: number;
  authorName?: string;
  authorUserId?: number;
  channelLabel?: string;
  bodyPreview?: string;
  taskTitle?: string;
  runTitle?: string;
  runStatus?: string;
  callerName?: string;
};

export type MobilePushPayload = {
  actionId: MobilePushActionId;
  teamId: number;
  channelId?: number;
  messageId?: number;
  threadRootId?: number;
  taskId?: number;
  runId?: number;
};

export type MobilePushDeepLink = {
  tab: MobileAppTab;
  teamId: number;
  channelId?: number;
  messageId?: number;
  threadRootId?: number;
  taskId?: number;
  runId?: number;
};

export type MobilePushDeviceRegistration = {
  token: string;
  platform: MobilePushPlatform;
  deviceLabel?: string;
  appVersion?: string;
};
