import {
  fetchChatChannels,
  fetchChatMessages,
  fetchChatMentions,
  fetchMentionUnreadCount,
} from "@/lib/chat-api";
import type { ChatChannel, ChatMessage, ChatMentionInboxItem } from "@/lib/chat-types";

export type ChatSessionSnapshot = {
  activeChannelId: number | null;
  channels: ChatChannel[];
  messagesByChannel: Record<number, ChatMessage[]>;
  mentions: ChatMentionInboxItem[];
  mentionUnreadCount: number;
  fetchedAt: number;
};

const memory = new Map<number, ChatSessionSnapshot>();
const listeners = new Set<(teamId: number) => void>();

function cacheKey(teamId: number): string {
  return `neo-pulse-chat-session-${teamId}`;
}

function normalizeSnapshot(raw: Partial<ChatSessionSnapshot> | null): ChatSessionSnapshot | null {
  if (!raw || !Array.isArray(raw.channels)) return null;
  const messagesByChannel: Record<number, ChatMessage[]> = {};
  if (raw.messagesByChannel && typeof raw.messagesByChannel === "object") {
    for (const [key, value] of Object.entries(raw.messagesByChannel)) {
      if (Array.isArray(value)) messagesByChannel[Number(key)] = value;
    }
  }
  const mentions = Array.isArray(raw.mentions) ? raw.mentions : [];
  return {
    activeChannelId: typeof raw.activeChannelId === "number" ? raw.activeChannelId : null,
    channels: raw.channels,
    messagesByChannel,
    mentions,
    mentionUnreadCount: typeof raw.mentionUnreadCount === "number" ? raw.mentionUnreadCount : 0,
    fetchedAt: typeof raw.fetchedAt === "number" ? raw.fetchedAt : 0,
  };
}

export function readChatSessionCache(teamId: number): ChatSessionSnapshot | null {
  const mem = memory.get(teamId);
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(cacheKey(teamId));
    if (!raw) return null;
    return normalizeSnapshot(JSON.parse(raw) as Partial<ChatSessionSnapshot>);
  } catch {
    return null;
  }
}

export function readCachedActiveChannelId(teamId: number): number | null {
  return readChatSessionCache(teamId)?.activeChannelId ?? null;
}

export function readCachedMentionState(teamId: number): {
  mentions: ChatMentionInboxItem[];
  mentionUnreadCount: number;
} {
  const cached = readChatSessionCache(teamId);
  return {
    mentions: cached?.mentions ?? [],
    mentionUnreadCount: cached?.mentionUnreadCount ?? 0,
  };
}

export function writeChatSessionCache(teamId: number, patch: Partial<ChatSessionSnapshot>): void {
  const prev = readChatSessionCache(teamId);
  const next: ChatSessionSnapshot = {
    activeChannelId: patch.activeChannelId ?? prev?.activeChannelId ?? null,
    channels: patch.channels ?? prev?.channels ?? [],
    messagesByChannel: {
      ...(prev?.messagesByChannel ?? {}),
      ...(patch.messagesByChannel ?? {}),
    },
    mentions: patch.mentions ?? prev?.mentions ?? [],
    mentionUnreadCount: patch.mentionUnreadCount ?? prev?.mentionUnreadCount ?? 0,
    fetchedAt: patch.fetchedAt ?? Date.now(),
  };
  memory.set(teamId, next);
  try {
    localStorage.setItem(cacheKey(teamId), JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  for (const listener of listeners) listener(teamId);
}

export function subscribeChatSessionCache(onUpdate: (teamId: number) => void): () => void {
  listeners.add(onUpdate);
  return () => listeners.delete(onUpdate);
}

export function setMemoryChatSession(teamId: number, snapshot: ChatSessionSnapshot): void {
  memory.set(teamId, snapshot);
}

function defaultActiveChannelId(channels: ChatChannel[], preferred: number | null): number | null {
  if (preferred != null && channels.some((c) => c.id === preferred)) return preferred;
  const general = channels.find((c) => c.slug === "general" && c.type === "public");
  return general?.id ?? channels[0]?.id ?? null;
}

export async function prefetchChatSession(teamId: number): Promise<void> {
  const existing = memory.get(teamId);
  if (existing && Date.now() - existing.fetchedAt < 4000) return;

  try {
    const [channels, mentions, mentionUnreadCount] = await Promise.all([
      fetchChatChannels(teamId),
      fetchChatMentions(teamId, { limit: 30 }),
      fetchMentionUnreadCount(teamId),
    ]);
    const preferred = readCachedActiveChannelId(teamId);
    const activeChannelId = defaultActiveChannelId(channels, preferred);
    const cached = readChatSessionCache(teamId);
    const messagesByChannel = { ...(cached?.messagesByChannel ?? {}) };

    if (activeChannelId != null && !(messagesByChannel[activeChannelId]?.length ?? 0)) {
      const result = await fetchChatMessages(teamId, activeChannelId, {
        limit: 50,
        scope: "channel",
        includeThreadUnread: true,
      });
      messagesByChannel[activeChannelId] = result.messages;
    }

    const snapshot: ChatSessionSnapshot = {
      activeChannelId,
      channels,
      messagesByChannel,
      mentions,
      mentionUnreadCount,
      fetchedAt: Date.now(),
    };
    setMemoryChatSession(teamId, snapshot);
    writeChatSessionCache(teamId, snapshot);
  } catch {
    // silent background prefetch
  }
}
