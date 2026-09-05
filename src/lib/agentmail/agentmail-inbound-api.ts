import { backendApiUrl } from "@/lib/wordpress-api/connection";
import { getSessionToken } from "@/lib/auth-device";

export type AgentMailInboundAttachment = {
  attachmentId: string;
  filename: string;
  contentType: string;
  size: number;
  dataBase64: string;
};

export type AgentMailInboundRecord = {
  messageId: string;
  storageKey: string;
  inboxId: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  preview: string;
  attachments: AgentMailInboundAttachment[];
  receivedAt: string;
};

export async function fetchAgentMailInbound(
  teamId: number,
  messageId: string,
): Promise<AgentMailInboundRecord> {
  const token = getSessionToken();
  const headers = new Headers({ Accept: "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const encoded = encodeURIComponent(messageId);
  const res = await fetch(backendApiUrl(`/api/teams/${teamId}/agentmail-inbound/${encoded}`), {
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const raw = await res.text();
  let data: { ok?: boolean; error?: string; inbound?: AgentMailInboundRecord };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error(`AgentMail inbound fetch failed (${res.status})`);
  }
  if (!res.ok || !data.ok || !data.inbound) {
    throw new Error(data.error?.trim() || `AgentMail inbound not found (${res.status})`);
  }
  return data.inbound;
}
