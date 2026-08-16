import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { getSessionToken } from "@/lib/auth-device";
import { loadApiKey } from "@/lib/api";
import type { ChatActivityLogEntry } from "@/lib/chat-activity-log";
import type {
  ChatAttachment,
  ChatChannel,
  ChatLinkPreview,
  ChatMentionInboxItem,
  ChatMessage,
  ChatMessagesResponse,
} from "@/lib/chat-types";
import type { ChatCall } from "@/lib/chat-call-types";

function baseUrl(): string {
  return (import.meta.env.VITE_MCP_API_BASE?.replace(/\/api\/mcp\/?$/, "") || BACKEND_API_BASE || "").replace(
    /\/$/,
    "",
  );
}

function api(path: string, options?: RequestInit): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options?.headers);
  const token = getSessionToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const openRouterKey = loadApiKey().trim();
  if (openRouterKey && !headers.has("X-OpenRouter-Api-Key")) {
    headers.set("X-OpenRouter-Api-Key", openRouterKey);
  }
  return fetch(`${baseUrl()}/api${p}`, { ...options, headers, credentials: "include", cache: "no-store" });
}

export async function fetchChatChannels(teamId: number): Promise<ChatChannel[]> {
  const res = await api(`/teams/${teamId}/chat/channels`);
  const data = (await res.json()) as { ok?: boolean; channels?: ChatChannel[] };
  return data.channels ?? [];
}

export async function createChatChannel(
  teamId: number,
  payload: { name: string; type?: "public" | "private"; memberUserIds?: number[] },
): Promise<{ ok: boolean; channel?: ChatChannel; error?: string }> {
  const res = await api(`/teams/${teamId}/chat/channels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; channel?: ChatChannel; error?: string };
  return { ok: Boolean(data.ok), channel: data.channel, error: data.error };
}

export async function openChatDm(
  teamId: number,
  userId: number,
): Promise<{ ok: boolean; channel?: ChatChannel; error?: string }> {
  const res = await api(`/teams/${teamId}/chat/dms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const data = (await res.json()) as { ok?: boolean; channel?: ChatChannel; error?: string };
  return { ok: Boolean(data.ok), channel: data.channel, error: data.error };
}

export async function fetchChatMessages(
  teamId: number,
  channelId: number,
  opts?: {
    after?: number;
    before?: number;
    limit?: number;
    scope?: "channel" | "thread";
    parentId?: number;
    includeThreadUnread?: boolean;
  },
): Promise<ChatMessagesResponse> {
  const params = new URLSearchParams();
  if (opts?.after) params.set("after", String(opts.after));
  if (opts?.before) params.set("before", String(opts.before));
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.scope) params.set("scope", opts.scope);
  if (opts?.parentId) params.set("parentId", String(opts.parentId));
  if (opts?.includeThreadUnread) params.set("includeThreadUnread", "1");
  const qs = params.toString();
  const res = await api(`/teams/${teamId}/chat/channels/${channelId}/messages${qs ? `?${qs}` : ""}`);
  const data = (await res.json()) as ChatMessagesResponse & { ok?: boolean };
  return {
    messages: data.messages ?? [],
    threadsUnread: data.threadsUnread,
    typingUsers: data.typingUsers,
  };
}

export async function fetchChatThread(
  teamId: number,
  channelId: number,
  messageId: number,
): Promise<ChatMessage[]> {
  const res = await api(`/teams/${teamId}/chat/channels/${channelId}/messages/${messageId}/thread`);
  const data = (await res.json()) as { ok?: boolean; messages?: ChatMessage[] };
  return data.messages ?? [];
}

export async function sendChatMessage(
  teamId: number,
  channelId: number,
  bodyHtml: string,
  opts?: { parentMessageId?: number; attachmentAssetIds?: number[]; mentionedUserIds?: number[] },
): Promise<{ ok: boolean; message?: ChatMessage; floReply?: ChatMessage; floHuddle?: ChatCall; error?: string }> {
  const res = await api(`/teams/${teamId}/chat/channels/${channelId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bodyHtml,
      parentMessageId: opts?.parentMessageId,
      attachmentAssetIds: opts?.attachmentAssetIds,
      mentionedUserIds: opts?.mentionedUserIds,
    }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    message?: ChatMessage;
    floReply?: ChatMessage;
    floHuddle?: ChatCall;
    error?: string;
  };
  return {
    ok: Boolean(data.ok),
    message: data.message,
    floReply: data.floReply,
    floHuddle: data.floHuddle,
    error: data.error,
  };
}

export async function markChatChannelRead(
  teamId: number,
  channelId: number,
  messageId: number,
): Promise<{ ok: boolean }> {
  const res = await api(`/teams/${teamId}/chat/channels/${channelId}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId }),
  });
  const data = (await res.json()) as { ok?: boolean };
  return { ok: Boolean(data.ok) };
}

export async function markChatThreadRead(
  teamId: number,
  channelId: number,
  threadRootId: number,
  messageId: number,
): Promise<{ ok: boolean }> {
  const res = await api(`/teams/${teamId}/chat/channels/${channelId}/threads/${threadRootId}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId }),
  });
  const data = (await res.json()) as { ok?: boolean };
  return { ok: Boolean(data.ok) };
}

export async function postChatTyping(teamId: number, channelId: number): Promise<void> {
  await api(`/teams/${teamId}/chat/channels/${channelId}/typing`, { method: "POST" });
}

export async function editChatMessage(
  teamId: number,
  messageId: number,
  bodyHtml: string,
  attachmentAssetIds?: number[],
  mentionedUserIds?: number[],
): Promise<{ ok: boolean; message?: ChatMessage; error?: string }> {
  const res = await api(`/teams/${teamId}/chat/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bodyHtml, attachmentAssetIds, mentionedUserIds }),
  });
  const data = (await res.json()) as { ok?: boolean; message?: ChatMessage; error?: string };
  return { ok: Boolean(data.ok), message: data.message, error: data.error };
}

export async function deleteChatMessage(teamId: number, messageId: number): Promise<{ ok: boolean }> {
  const res = await api(`/teams/${teamId}/chat/messages/${messageId}`, { method: "DELETE" });
  const data = (await res.json()) as { ok?: boolean };
  return { ok: Boolean(data.ok) };
}

export async function patchChatChannel(
  teamId: number,
  channelId: number,
  payload: { name?: string; topic?: string; archived?: boolean },
): Promise<{ ok: boolean; channel?: ChatChannel; error?: string }> {
  const res = await api(`/teams/${teamId}/chat/channels/${channelId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; channel?: ChatChannel; error?: string };
  return { ok: Boolean(data.ok), channel: data.channel, error: data.error };
}

export async function addChatChannelMembers(
  teamId: number,
  channelId: number,
  memberUserIds: number[],
): Promise<{ ok: boolean }> {
  const res = await api(`/teams/${teamId}/chat/channels/${channelId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberUserIds }),
  });
  const data = (await res.json()) as { ok?: boolean };
  return { ok: Boolean(data.ok) };
}

export async function uploadChatFile(
  teamId: number,
  channelId: number,
  file: File,
): Promise<{ ok: boolean; asset?: ChatAttachment; error?: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const dataBase64 = btoa(binary);
  const res = await api(`/teams/${teamId}/chat/channels/${channelId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      dataBase64,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; asset?: ChatAttachment; error?: string };
  return { ok: Boolean(data.ok), asset: data.asset, error: data.error };
}

export function chatFileDownloadUrl(
  teamId: number,
  channelId: number,
  assetId: number,
  inline = false,
): string {
  const base = `${baseUrl()}/api/teams/${teamId}/chat/channels/${channelId}/files/${assetId}`;
  return inline ? `${base}?inline=1` : base;
}

export async function previewChatLink(
  teamId: number,
  url: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; preview?: ChatLinkPreview; error?: string }> {
  const res = await api(`/teams/${teamId}/chat/preview-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });
  const data = (await res.json()) as { ok?: boolean; preview?: ChatLinkPreview; error?: string };
  return { ok: Boolean(data.ok), preview: data.preview, error: data.error };
}

export async function fetchChatActivityLog(
  teamId: number,
  channelId: number,
  opts?: { kind?: string; userId?: number; limit?: number; after?: number },
): Promise<ChatActivityLogEntry[]> {
  const params = new URLSearchParams();
  if (opts?.kind) params.set("kind", opts.kind);
  if (opts?.userId) params.set("userId", String(opts.userId));
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.after) params.set("after", String(opts.after));
  const qs = params.toString();
  const res = await api(`/teams/${teamId}/chat/channels/${channelId}/activity-log${qs ? `?${qs}` : ""}`);
  const data = (await res.json()) as { ok?: boolean; items?: ChatActivityLogEntry[] };
  return data.items ?? [];
}

export async function searchChatMessages(
  teamId: number,
  channelId: number,
  q: string,
  limit = 50,
): Promise<ChatMessage[]> {
  const params = new URLSearchParams();
  params.set("q", q);
  params.set("limit", String(limit));
  const res = await api(`/teams/${teamId}/chat/channels/${channelId}/messages/search?${params.toString()}`);
  const data = (await res.json()) as { ok?: boolean; messages?: ChatMessage[] };
  return data.messages ?? [];
}

export async function deleteChatFile(
  teamId: number,
  channelId: number,
  assetId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await api(`/teams/${teamId}/chat/channels/${channelId}/files/${assetId}`, { method: "DELETE" });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function searchChatShared(
  teamId: number,
  opts?: {
    q?: string;
    channelId?: number;
    userId?: number;
    kind?: "link_shared" | "file_shared";
    scope?: "all" | "channel" | "thread";
    threadRootMessageId?: number;
    limit?: number;
    after?: number;
  },
): Promise<ChatActivityLogEntry[]> {
  const params = new URLSearchParams();
  if (opts?.q) params.set("q", opts.q);
  if (opts?.channelId) params.set("channelId", String(opts.channelId));
  if (opts?.userId) params.set("userId", String(opts.userId));
  if (opts?.kind) params.set("kind", opts.kind);
  if (opts?.scope) params.set("scope", opts.scope);
  if (opts?.threadRootMessageId) params.set("threadRootMessageId", String(opts.threadRootMessageId));
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.after) params.set("after", String(opts.after));
  const qs = params.toString();
  const res = await api(`/teams/${teamId}/chat/shared-search${qs ? `?${qs}` : ""}`);
  const data = (await res.json()) as { ok?: boolean; items?: ChatActivityLogEntry[] };
  return data.items ?? [];
}

export async function fetchChatMentions(
  teamId: number,
  opts?: { limit?: number; unreadOnly?: boolean },
): Promise<ChatMentionInboxItem[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.unreadOnly) params.set("unread", "1");
  const qs = params.toString();
  const res = await api(`/teams/${teamId}/chat/mentions${qs ? `?${qs}` : ""}`);
  const data = (await res.json()) as { ok?: boolean; mentions?: ChatMentionInboxItem[] };
  return data.mentions ?? [];
}

export async function fetchMentionUnreadCount(teamId: number): Promise<number> {
  const res = await api(`/teams/${teamId}/chat/mentions/unread-count`);
  const data = (await res.json()) as { ok?: boolean; count?: number };
  return data.count ?? 0;
}

export async function markChatMentionRead(teamId: number, messageId: number): Promise<{ ok: boolean }> {
  const res = await api(`/teams/${teamId}/chat/mentions/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId }),
  });
  const data = (await res.json()) as { ok?: boolean };
  return { ok: Boolean(data.ok) };
}
