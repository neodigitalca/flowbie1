import { backendApiUrl } from "@/lib/wordpress-api/connection";
import { loadApiKey } from "@/lib/api";
import { neoPulseApiHeaders } from "@/lib/neo-pulse-api-headers";
import type {
  CreateSupportTicketPayload,
  PreviewSupportTicketAiPayload,
  SupportComment,
  SupportTicket,
  SupportTicketExportBundle,
} from "@/lib/support-types";

function api(path: string, options?: RequestInit): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const headers = neoPulseApiHeaders(options?.headers);
  return fetch(backendApiUrl(p), { ...options, headers, credentials: "include", cache: "no-store" });
}

function withOpenRouterKey(body: Record<string, unknown>): Record<string, unknown> {
  const key = loadApiKey();
  return key ? { ...body, openRouterApiKey: key } : body;
}

async function parseSupportResult<T extends { ok?: boolean; error?: string }>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok && !data.error) {
    return { ...data, ok: false, error: `Request failed (${res.status})` } as T;
  }
  return data;
}

export async function listSupportTickets(teamId: number): Promise<SupportTicket[]> {
  const res = await api(`/teams/${teamId}/support/tickets`);
  const data = (await res.json()) as { ok?: boolean; tickets?: SupportTicket[] };
  return data.tickets ?? [];
}

export async function getSupportTicket(teamId: number, ticketId: number): Promise<SupportTicket | null> {
  const res = await api(`/teams/${teamId}/support/tickets/${ticketId}`);
  const data = (await res.json()) as { ok?: boolean; ticket?: SupportTicket };
  return data.ticket ?? null;
}

export async function previewSupportTicketAi(
  teamId: number,
  payload: PreviewSupportTicketAiPayload,
): Promise<{ ok: boolean; title?: string; summary?: string; error?: string }> {
  const res = await api(`/teams/${teamId}/support/tickets/preview-ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withOpenRouterKey(payload as Record<string, unknown>)),
  });
  const data = await parseSupportResult<{ ok?: boolean; title?: string; summary?: string; error?: string }>(res);
  return {
    ok: Boolean(data.ok),
    title: data.title,
    summary: data.summary,
    error: data.error,
  };
}

export async function createSupportTicket(
  teamId: number,
  payload: CreateSupportTicketPayload,
): Promise<{ ok: boolean; ticket?: SupportTicket; error?: string }> {
  const res = await api(`/teams/${teamId}/support/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withOpenRouterKey(payload as Record<string, unknown>)),
  });
  const data = await parseSupportResult<{ ok?: boolean; ticket?: SupportTicket; error?: string }>(res);
  return { ok: Boolean(data.ok), ticket: data.ticket, error: data.error };
}

export async function updateSupportTicket(
  teamId: number,
  ticketId: number,
  payload: { title?: string; summary?: string; status?: "open" | "closed" },
): Promise<{ ok: boolean; ticket?: SupportTicket; error?: string }> {
  const res = await api(`/teams/${teamId}/support/tickets/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; ticket?: SupportTicket; error?: string };
  return { ok: Boolean(data.ok), ticket: data.ticket, error: data.error };
}

export async function addSupportComment(
  teamId: number,
  ticketId: number,
  body: string,
): Promise<{ ok: boolean; comment?: SupportComment; ticket?: SupportTicket; error?: string }> {
  const res = await api(`/teams/${teamId}/support/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    comment?: SupportComment;
    ticket?: SupportTicket;
    error?: string;
  };
  return { ok: Boolean(data.ok), comment: data.comment, ticket: data.ticket, error: data.error };
}

export async function fetchSupportTicketChatLog(
  teamId: number,
  ticketId: number,
): Promise<Record<string, unknown> | null> {
  const res = await api(`/teams/${teamId}/support/tickets/${ticketId}/chat-log`);
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function downloadSupportTicketChatLog(teamId: number, ticketId: number): Promise<void> {
  const res = await api(`/teams/${teamId}/support/tickets/${ticketId}/chat-log`);
  if (!res.ok) {
    throw new Error(`Could not download chat log (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `ticket-${ticketId}-chat-log.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export async function exportAllSupportTickets(teamId: number, teamSlug?: string): Promise<void> {
  const res = await api(`/teams/${teamId}/support/export`);
  if (!res.ok) {
    throw new Error(`Could not export tickets (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = (teamSlug || "team").replace(/[^\w-]+/g, "-");
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `support-tickets-${slug}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export async function fetchSupportExportBundle(teamId: number): Promise<SupportTicketExportBundle> {
  const res = await api(`/teams/${teamId}/support/export`);
  if (!res.ok) {
    throw new Error(`Could not export tickets (HTTP ${res.status})`);
  }
  return (await res.json()) as SupportTicketExportBundle;
}

export async function deleteSupportTicket(
  teamId: number,
  ticketId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await api(`/teams/${teamId}/support/tickets/${ticketId}`, { method: "DELETE" });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: Boolean(data.ok), error: data.error };
}

export async function deleteAllSupportTickets(
  teamId: number,
): Promise<{ ok: boolean; deletedCount?: number; error?: string }> {
  const res = await api(`/teams/${teamId}/support/tickets`, { method: "DELETE" });
  const data = (await res.json()) as { ok?: boolean; deletedCount?: number; error?: string };
  return { ok: Boolean(data.ok), deletedCount: data.deletedCount, error: data.error };
}
