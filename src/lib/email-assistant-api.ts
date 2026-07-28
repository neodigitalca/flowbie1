import type { AgentMailReplyAttachment } from "@/lib/agentmail-api";
import { loadAgentMailApiKey, loadApiKey } from "@/lib/api";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";

/** Split UI/API: session cookies do not cross origins; server accepts this header (same as `/api/agentmail/*`). */
function emailAssistantAuthHeaders(): Record<string, string> {
  const k = String(loadAgentMailApiKey() ?? "").trim();
  return k ? { "X-AgentMail-Api-Key": k } : {};
}

/**
 * Same-origin in dev (Vite proxy); in production uses `VITE_MCP_API_BASE` so split UI/API hosts
 * still hit the real Express app (not the SPA index.html).
 */
function emailAssistantApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.DEV) {
    return p;
  }
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  return `${base}${p}`;
}

/**
 * When AgentMail config uses a UUID as inbox id, pass `toolMailboxEmail` from GET /api/agentmail/config
 * so routing matches server whitelist (flowbie@ / seowithflo@).
 */
export function resolveToolMailboxForRouting(
  inboxIdOrNotify: string | undefined,
  toolMailboxEmailFromServer?: string | undefined
): string {
  const raw = (inboxIdOrNotify || "").trim();
  if (raw.includes("@")) return raw.toLowerCase();
  const fromServer = (toolMailboxEmailFromServer || "").trim();
  if (fromServer.includes("@")) return fromServer.toLowerCase();
  return import.meta.env.DEV ? "seowithflo@agentmail.to" : "flowbie@agentmail.to";
}

/** Same defaults as server/email-agent-inbox-whitelist.js - if classify still returns reply, force compose. */
export function inboxShouldUseToolAgent(
  inboxId: string | undefined,
  toolMailboxEmailFromServer?: string | undefined
): boolean {
  const r = resolveToolMailboxForRouting(inboxId, toolMailboxEmailFromServer);
  return r === "flowbie@agentmail.to" || r === "seowithflo@agentmail.to";
}

/** Extract bare email from a From header like \`Name <user@domain.com>\`. */
export function extractInboundSenderEmail(fromRaw: string | undefined): string | null {
  const from = (fromRaw || "").trim();
  if (!from) return null;
  const bracket = from.match(/<([^>]+)>/);
  const raw = bracket ? bracket[1].trim() : from;
  const match = raw.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  return match ? match[0].trim().toLowerCase() : null;
}

export type EmailAssistantClassifyResponse = {
  kind: "task" | "reply";
  /** \`keyword_research\` / \`meta_optimizer\` / \`blog_prompt\` use fast server pipelines; \`null\` means run the full tool agent. */
  taskSubtype: "keyword_research" | "meta_optimizer" | "blog_prompt" | null;
  primaryKeyword?: string | null;
  targetUrl?: string | null;
  location_name?: string | null;
  language_code?: string | null;
};

export type EmailAssistantComposeResponse = {
  text: string;
  /** Multipart HTML body when the server used the tool agent (GSC/WP HTML + technical readout). */
  html?: string;
  attachments: AgentMailReplyAttachment[];
};

export async function emailAssistantClassify(params: {
  subject: string;
  body: string;
  openRouterApiKey?: string;
  /** AgentMail notify/primary inbox - server applies tool whitelist (flowbie@ / seowithflo@). */
  inboxId?: string;
}): Promise<EmailAssistantClassifyResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...emailAssistantAuthHeaders(),
  };
  const fromParam =
    typeof params.openRouterApiKey === "string" ? params.openRouterApiKey.trim() : "";
  const fromStore = String(loadApiKey() ?? "").trim();
  const key = fromParam || fromStore;
  if (key) {
    headers["X-OpenRouter-Api-Key"] = key;
  }
  const inbox = (params.inboxId || "").trim();
  const res = await fetch(emailAssistantApiUrl("/api/email-assistant/classify"), {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      subject: params.subject,
      body: params.body,
      ...(inbox ? { inboxId: inbox, notifyInboxEmail: inbox } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
  }
  return data as EmailAssistantClassifyResponse;
}

export async function emailAssistantComposeTask(params: {
  subject: string;
  body: string;
  taskSubtype: string | null;
  /** Same key as Dashboard → API keys / streamGeneration (required unless server has OPENROUTER_API_KEY). */
  openRouterApiKey?: string;
  /** Inbound From address - required for non–keyword-research tasks (WordPress/GSC credential lookup). */
  senderEmail?: string | null;
  /** Raw From header - server also checks this if `senderEmail` is missing (see email-assistant-routes). */
  fromEmail?: string | null;
  /** AgentMail notify/primary inbox - server applies tool whitelist. */
  inboxId?: string;
  /** Stable id for blog pending / multi-step flows (same as AgentMail thread_id). */
  threadId?: string | null;
}): Promise<EmailAssistantComposeResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...emailAssistantAuthHeaders(),
  };
  const fromParam =
    typeof params.openRouterApiKey === "string" ? params.openRouterApiKey.trim() : "";
  const fromStore = String(loadApiKey() ?? "").trim();
  const key = fromParam || fromStore;
  if (key) {
    headers["X-OpenRouter-Api-Key"] = key;
  }
  const inbox = (params.inboxId || "").trim();
  const threadId = typeof params.threadId === "string" ? params.threadId.trim() : "";
  const res = await fetch(emailAssistantApiUrl("/api/email-assistant/compose-task"), {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      subject: params.subject,
      body: params.body,
      taskSubtype: params.taskSubtype,
      ...(params.senderEmail?.trim() ? { senderEmail: params.senderEmail.trim() } : {}),
      ...(params.fromEmail?.trim() ? { fromEmail: params.fromEmail.trim() } : {}),
      ...(inbox ? { inboxId: inbox, notifyInboxEmail: inbox } : {}),
      ...(threadId ? { threadId } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
  }
  const hasPayload =
    (typeof data?.text === "string" && data.text.trim() !== "") ||
    (typeof data?.html === "string" && data.html.trim() !== "") ||
    (Array.isArray(data?.attachments) && data.attachments.length > 0);
  if (!hasPayload) {
    throw new Error(
      "Compose-task returned no reply body. The UI may be calling the wrong host: set VITE_MCP_API_BASE to your API origin (same as WordPress/GSC calls), or deploy UI and API on the same origin."
    );
  }
  return data as EmailAssistantComposeResponse;
}
