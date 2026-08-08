import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ChatCall } from "@/lib/chat-call-types";
import type { ChatAlertItem } from "@/lib/chat-preferences-types";
import {
  messageMatchesKeywords,
  messageMatchesTopics,
  stripHtmlToPlain,
} from "@/lib/chat-preferences-types";
import { showChatDesktopNotification } from "@/lib/chat-test-notification";
import type { ChatChannel, ChatMentionInboxItem, ChatMessage } from "@/lib/chat-types";
import type { ChatUserPreferences } from "@/lib/chat-preferences-types";

type Options = {
  teamId: number | null;
  prefs: ChatUserPreferences;
  channels: ChatChannel[];
  messages: ChatMessage[];
  activeChannelId: number | null;
  currentUserId: number | null;
  enabled: boolean;
  mentions?: ChatMentionInboxItem[];
  incomingCall?: ChatCall | null;
  incomingCallerName?: string;
};

function channelLabel(channel: ChatChannel | undefined): string {
  if (!channel) return "Channel";
  if (channel.type === "dm") return channel.name;
  return channel.slug ?? channel.name;
}

function playSound(preset: ChatUserPreferences["notifications"]["soundPreset"]): void {
  if (preset === "none") return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = preset === "classic" ? 880 : 660;
    gain.gain.value = 0.05;
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    void ctx.close();
  } catch {
    // audio unavailable
  }
}

function notifyDesktop(title: string, body: string): void {
  void showChatDesktopNotification(title, body);
}

function pushAlerts(
  setAlerts: Dispatch<SetStateAction<ChatAlertItem[]>>,
  nextAlerts: ChatAlertItem[],
): void {
  if (nextAlerts.length === 0) return;
  setAlerts((prev) => {
    const byId = new Map(prev.map((a) => [a.id, a]));
    for (const a of nextAlerts) byId.set(a.id, a);
    return [...byId.values()].slice(-30);
  });
}

export function useChatNotificationAlerts({
  teamId,
  prefs,
  channels,
  messages,
  activeChannelId,
  currentUserId,
  enabled,
  mentions = [],
  incomingCall = null,
  incomingCallerName = "",
}: Options) {
  const [alerts, setAlerts] = useState<ChatAlertItem[]>([]);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const seenRef = useRef<Set<number>>(new Set());
  const seededRef = useRef(false);
  const seenMentionIdsRef = useRef<Set<number>>(new Set());
  const seenCallIdsRef = useRef<Set<number>>(new Set());
  const threadUnreadByChannelRef = useRef<Map<number, number>>(new Map());
  const mentionsSeededRef = useRef(false);
  const threadUnreadSeededRef = useRef(false);

  useEffect(() => {
    seededRef.current = false;
    seenRef.current.clear();
    mentionsSeededRef.current = false;
    threadUnreadSeededRef.current = false;
    threadUnreadByChannelRef.current.clear();
  }, [teamId]);

  useEffect(() => {
    if (!seededRef.current && messages.length > 0) {
      for (const m of messages) seenRef.current.add(m.id);
      seededRef.current = true;
    }
  }, [messages]);

  const evaluateMessage = useCallback(
    (msg: ChatMessage): ChatAlertItem | null => {
      if (currentUserId != null && msg.userId === currentUserId) return null;
      const channel = channels.find((c) => c.id === msg.channelId);
      const bodyPlain = stripHtmlToPlain(msg.bodyHtml);
      const { notifications } = prefs;

      let reason: ChatAlertItem["reason"] | null = null;
      let matchLabel = "";

      if (notifications.threads && msg.parentMessageId) {
        reason = "thread";
      } else if (channel?.type === "dm" && notifications.dms) {
        reason = "dm";
      } else if (notifications.channelMessages && channel && channel.type !== "dm") {
        reason = "channel";
      }

      const kw = messageMatchesKeywords(bodyPlain, notifications.keywordWatch);
      if (kw) {
        reason = "keyword";
        matchLabel = kw;
      }

      const topic = messageMatchesTopics(bodyPlain, channel?.topic, notifications.topicWatch);
      if (topic) {
        reason = "topic";
        matchLabel = topic;
      }

      if (!reason) return null;

      const preview =
        matchLabel && reason !== "dm" && reason !== "channel" && reason !== "thread"
          ? `${matchLabel}: ${bodyPlain.slice(0, 80)}`
          : reason === "thread"
            ? `Thread reply: ${bodyPlain.slice(0, 80)}`
            : bodyPlain.slice(0, 100);

      return {
        id: `alert-${msg.id}`,
        messageId: msg.id,
        channelId: msg.channelId,
        channelLabel: channelLabel(channel),
        bodyPreview: preview,
        reason,
        createdAt: msg.createdAt,
      };
    },
    [channels, currentUserId, prefs],
  );

  const fireAlerts = useCallback(
    (nextAlerts: ChatAlertItem[]) => {
      if (nextAlerts.length === 0) return;
      pushAlerts(setAlerts, nextAlerts);
      if (prefs.notifications.soundEnabled) {
        playSound(prefs.notifications.soundPreset);
      }
      if (prefs.notifications.desktopAlerts) {
        for (const alert of nextAlerts.slice(0, 3)) {
          notifyDesktop(alert.channelLabel, alert.bodyPreview);
        }
      }
    },
    [
      prefs.notifications.desktopAlerts,
      prefs.notifications.soundEnabled,
      prefs.notifications.soundPreset,
    ],
  );

  useEffect(() => {
    if (!enabled || messages.length === 0) return;
    const fresh = messages.filter((m) => !seenRef.current.has(m.id));
    if (fresh.length === 0) return;

    const nextAlerts: ChatAlertItem[] = [];
    for (const msg of fresh) {
      seenRef.current.add(msg.id);
      const alert = evaluateMessage(msg);
      if (alert) nextAlerts.push(alert);
    }

    fireAlerts(nextAlerts);
  }, [messages, enabled, evaluateMessage, fireAlerts]);

  useEffect(() => {
    if (!enabled || !prefs.notifications.mentions) return;
    if (!mentionsSeededRef.current) {
      for (const item of mentions) seenMentionIdsRef.current.add(item.id);
      mentionsSeededRef.current = true;
      return;
    }
    const nextAlerts: ChatAlertItem[] = [];
    for (const item of mentions) {
      if (item.readAt != null || seenMentionIdsRef.current.has(item.id)) continue;
      seenMentionIdsRef.current.add(item.id);
      nextAlerts.push({
        id: `mention-${item.id}`,
        messageId: item.messageId,
        channelId: item.channelId,
        channelLabel: item.channelLabel,
        bodyPreview: `${item.authorDisplayName}: ${item.preview}`,
        reason: "mention",
        createdAt: item.createdAt,
      });
    }
    fireAlerts(nextAlerts);
  }, [mentions, enabled, prefs.notifications.mentions, fireAlerts]);

  useEffect(() => {
    if (!enabled || !prefs.notifications.threads) return;
    if (!threadUnreadSeededRef.current) {
      for (const channel of channels) {
        threadUnreadByChannelRef.current.set(channel.id, channel.threadUnreadCount ?? 0);
      }
      threadUnreadSeededRef.current = true;
      return;
    }
    const nextAlerts: ChatAlertItem[] = [];
    for (const channel of channels) {
      const prev = threadUnreadByChannelRef.current.get(channel.id) ?? 0;
      const next = channel.threadUnreadCount ?? 0;
      threadUnreadByChannelRef.current.set(channel.id, next);
      if (next <= prev || next === 0) continue;
      if (channel.id === activeChannelId) continue;
      nextAlerts.push({
        id: `thread-${channel.id}-${next}`,
        messageId: 0,
        channelId: channel.id,
        channelLabel: channelLabel(channel),
        bodyPreview: `${next} unread thread ${next === 1 ? "reply" : "replies"}`,
        reason: "thread",
        createdAt: new Date().toISOString(),
      });
    }
    fireAlerts(nextAlerts);
  }, [channels, activeChannelId, enabled, prefs.notifications.threads, fireAlerts]);

  useEffect(() => {
    if (!enabled || !prefs.notifications.calls || !incomingCall) return;
    if (seenCallIdsRef.current.has(incomingCall.id)) return;
    seenCallIdsRef.current.add(incomingCall.id);
    const channel = channels.find((c) => c.id === incomingCall.channelId);
    fireAlerts([
      {
        id: `call-${incomingCall.id}`,
        messageId: 0,
        channelId: incomingCall.channelId,
        channelLabel: channelLabel(channel),
        bodyPreview: incomingCallerName
          ? `Incoming call from ${incomingCallerName}`
          : "Incoming call",
        reason: "call",
        createdAt: incomingCall.startedAt,
      },
    ]);
  }, [
    incomingCall,
    incomingCallerName,
    channels,
    enabled,
    prefs.notifications.calls,
    fireAlerts,
  ]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    if (activeAlertId === alertId) setActiveAlertId(null);
  }, [activeAlertId]);

  const openAlert = useCallback((alert: ChatAlertItem) => {
    setActiveAlertId(alert.id);
    return alert;
  }, []);

  return {
    alerts,
    activeAlertId,
    openAlert,
    dismissAlert,
    setActiveAlertId,
  };
}
