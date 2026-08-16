import { describe, expect, it } from "vitest";
import {
  buildMobilePushNotification,
  MOBILE_PUSH_ACTION_BY_ID,
  shouldSendMobilePush,
} from "@/lib/mobile-push/notification-actions";
import { payloadFromNotificationData, resolveMobilePushDeepLink } from "@/lib/mobile-push/deep-link";

describe("mobile push notification actions", () => {
  it("builds mention notification payload", () => {
    const built = buildMobilePushNotification("chat.mention", {
      teamId: 1,
      channelId: 10,
      messageId: 99,
      authorName: "Alex",
      bodyPreview: "Hey @you check this",
    });
    expect(built?.title).toBe("Alex mentioned you");
    expect(built?.payload.actionId).toBe("chat.mention");
    expect(built?.payload.messageId).toBe(99);
  });

  it("respects preference toggles", () => {
    expect(
      shouldSendMobilePush("chat.mention", {
        mentions: false,
        dms: true,
        threads: true,
        calls: true,
        channelMessages: false,
        taskAssigned: true,
        agentRuns: true,
      }),
    ).toBe(false);
  });

  it("maps push data to chat deep link", () => {
    const payload = payloadFromNotificationData({
      actionId: "chat.dm",
      teamId: "3",
      channelId: "12",
      messageId: "44",
    });
    expect(payload).not.toBeNull();
    const link = resolveMobilePushDeepLink(payload!);
    expect(link.tab).toBe("chat");
    expect(link.channelId).toBe(12);
  });

  it("includes all phase-1 actions", () => {
    expect(Object.keys(MOBILE_PUSH_ACTION_BY_ID).sort()).toEqual(
      [
        "agent.run_complete",
        "chat.call",
        "chat.channel",
        "chat.dm",
        "chat.mention",
        "chat.thread",
        "task.assigned",
      ].sort(),
    );
  });
});
