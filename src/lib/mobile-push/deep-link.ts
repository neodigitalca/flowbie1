import type { MobileAppTab } from "@/components/mobile-app/mobile-app-types";
import { isMobilePushActionId } from "./notification-actions";
import type { MobilePushDeepLink, MobilePushPayload } from "./types";

function parseIntField(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function payloadFromNotificationData(
  data: Record<string, unknown>,
): MobilePushPayload | null {
  const actionIdRaw = typeof data.actionId === "string" ? data.actionId : "";
  if (!isMobilePushActionId(actionIdRaw)) return null;

  const teamId = parseIntField(data.teamId);
  if (!teamId) return null;

  return {
    actionId: actionIdRaw,
    teamId,
    channelId: parseIntField(data.channelId),
    messageId: parseIntField(data.messageId),
    threadRootId: parseIntField(data.threadRootId),
    taskId: parseIntField(data.taskId),
    runId: parseIntField(data.runId),
  };
}

export function resolveMobilePushDeepLink(
  payload: MobilePushPayload,
): MobilePushDeepLink {
  const base = {
    teamId: payload.teamId,
    channelId: payload.channelId,
    messageId: payload.messageId,
    threadRootId: payload.threadRootId,
    taskId: payload.taskId,
    runId: payload.runId,
  };

  switch (payload.actionId) {
    case "chat.mention":
    case "chat.dm":
    case "chat.thread":
    case "chat.call":
    case "chat.channel":
      return { tab: "chat", ...base };
    case "task.assigned":
      return { tab: "tasks", teamId: payload.teamId, taskId: payload.taskId };
    case "agent.run_complete":
      return { tab: "agents", teamId: payload.teamId, runId: payload.runId };
    default:
      return { tab: "chat" as MobileAppTab, teamId: payload.teamId };
  }
}
