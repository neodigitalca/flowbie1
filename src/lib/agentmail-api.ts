import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { loadAgentMailApiKey } from "@/lib/api";

/**
 * Base URL for AgentMail BFF. In dev, use same-origin paths so Vite proxies to the API
 * and session cookies work. In production, use BACKEND_API_BASE when set.
 */
export function agentmailApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.DEV) {
    return p;
  }
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  return `${base}${p}`;
}

export type AgentMailConfig = {
  inboxId: string;
  displayName: string;
  configured: boolean;
  /** Notify inbox id/email (server `AGENTMAIL_NOTIFY_INBOX`; UI: Properties → Email threads). */
  notifyInboxEmail?: string;
  /** Deployment Flo mailbox (always `...@agentmail.to`) - for tool routing when inbox id is a UUID. */
  toolMailboxEmail?: string;
  /** Shared default recipient email (server-backed). */
  generalEmail?: string;
  /** Server AGENTMAIL_OUTBOUND_REPLY_TO - Flo adds Reply-To on send/reply when set. */
  outboundReplyTo?: string;
};

export type AgentMailMessageRow = {
  messageId?: string;
  subject?: string;
  from?: string;
  preview?: string;
  timestamp?: string;
};

/** Subset of SDK message fields used client-side. */
export type AgentMailMessageDetail = {
  messageId?: string;
  inboxId?: string;
  subject?: string;
  from?: string;
  text?: string;
  html?: string;
  extractedText?: string;
  preview?: string;
  timestamp?: string;
};

export type AgentMailMessagesResponse = {
  count: number;
  nextPageToken?: string;
  messages: AgentMailMessageRow[];
};

export type AgentMailMessageGetResponse = {
  message: AgentMailMessageDetail;
};

/** Thread summary from threads.list (SDK shape). */
export type AgentMailThreadRow = {
  threadId?: string;
  subject?: string;
  preview?: string;
  timestamp?: string;
  messageCount?: number;
  senders?: unknown;
  recipients?: unknown;
};

export type AgentMailThreadsListResponse = {
  count: number;
  nextPageToken?: string;
  limit?: number;
  threads: AgentMailThreadRow[];
};

export type AgentMailThreadWithMessages = {
  threadId?: string;
  inboxId?: string;
  subject?: string;
  messages?: AgentMailMessageDetail[];
};

export type AgentMailThreadGetResponse = {
  thread: AgentMailThreadWithMessages;
};

function agentMailAuthHeaders(): Record<string, string> {
  const k = String(loadAgentMailApiKey() ?? "").trim();
  return k ? { "X-AgentMail-Api-Key": k } : {};
}

async function fetchAgentMail(path: string, init?: RequestInit) {
  const url = agentmailApiUrl(path);
  const hasBody = init?.body != null;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...agentMailAuthHeaders(),
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || res.statusText };
  }
  if (!res.ok) {
    const err = (data as { error?: string })?.error || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data;
}

export async function fetchAgentMailConfig(): Promise<AgentMailConfig> {
  return fetchAgentMail("/api/agentmail/config") as Promise<AgentMailConfig>;
}

export async function saveAgentMailConfig(input: { generalEmail?: string }): Promise<{ success: boolean; generalEmail?: string }> {
  return fetchAgentMail("/api/agentmail/config", {
    method: "POST",
    body: JSON.stringify({
      generalEmail: typeof input.generalEmail === "string" ? input.generalEmail : "",
    }),
  }) as Promise<{ success: boolean; generalEmail?: string }>;
}

export async function fetchAgentMailMessages(params?: {
  limit?: number;
  pageToken?: string;
  /** Must be an allowlisted inbox (primary or notify). */
  inboxId?: string;
}): Promise<AgentMailMessagesResponse> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.pageToken) sp.set("pageToken", params.pageToken);
  if (params?.inboxId?.trim()) sp.set("inboxId", params.inboxId.trim());
  const q = sp.toString();
  return fetchAgentMail(`/api/agentmail/messages${q ? `?${q}` : ""}`) as Promise<AgentMailMessagesResponse>;
}

export async function fetchAgentMailMessageDetail(params: {
  inboxId: string;
  messageId: string;
}): Promise<AgentMailMessageDetail> {
  const sp = new URLSearchParams();
  sp.set("inboxId", String(params.inboxId ?? "").trim());
  sp.set("messageId", String(params.messageId ?? "").trim());
  const data = (await fetchAgentMail(
    `/api/agentmail/messages?${sp.toString()}`
  )) as AgentMailMessageGetResponse;
  return data.message;
}

export async function fetchAgentMailThreadList(params?: {
  limit?: number;
  pageToken?: string;
  inboxId?: string;
}): Promise<AgentMailThreadsListResponse> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.pageToken) sp.set("pageToken", params.pageToken);
  if (params?.inboxId?.trim()) sp.set("inboxId", params.inboxId.trim());
  const q = sp.toString();
  return fetchAgentMail(`/api/agentmail/threads${q ? `?${q}` : ""}`) as Promise<AgentMailThreadsListResponse>;
}

export async function fetchAgentMailThreadDetail(params: {
  inboxId: string;
  threadId: string;
}): Promise<AgentMailThreadWithMessages> {
  const sp = new URLSearchParams();
  sp.set("inboxId", String(params.inboxId ?? "").trim());
  sp.set("threadId", String(params.threadId ?? "").trim());
  const data = (await fetchAgentMail(
    `/api/agentmail/threads?${sp.toString()}`
  )) as AgentMailThreadGetResponse;
  return data.thread;
}

/** Matches AgentMail SDK / server worker shape (base64 content). */
export type AgentMailReplyAttachment = {
  filename: string;
  contentType: string;
  content: string;
};

export type SendAgentMailMessageBody =
  | {
      to: string;
      subject: string;
      text: string;
      html?: string;
      /** Send as this inbox when allowlisted (e.g. notify inbox id). */
      inboxId?: string;
      /** Overrides server AGENTMAIL_OUTBOUND_REPLY_TO for this send. */
      replyTo?: string;
    }
  | {
      /** Reply in-thread; requires inboxId + text (omit to/subject). */
      replyToMessageId: string;
      inboxId: string;
      text: string;
      html?: string;
      attachments?: AgentMailReplyAttachment[];
      /** Overrides server AGENTMAIL_OUTBOUND_REPLY_TO for this reply. */
      replyTo?: string;
    };

export async function sendAgentMailMessage(body: SendAgentMailMessageBody): Promise<unknown> {
  return fetchAgentMail("/api/agentmail/send", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
