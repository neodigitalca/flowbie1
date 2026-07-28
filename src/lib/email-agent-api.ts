export type EmailAgentProgressStep = {
  id: string;
  label: string;
  state: "pending" | "running" | "done" | "error";
};

export type EmailAgentMicroStep = {
  at: number;
  label: string;
};

import { loadAgentMailApiKey } from "@/lib/api";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";

function emailAgentBasePath(): string {
  const p = "/api/email-agent";
  if (import.meta.env.DEV) return p;
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  return `${base}${p}`;
}

function emailAgentProgressUrl(): string {
  return `${emailAgentBasePath()}/progress`;
}

function emailAgentSenderAccessUrl(): string {
  return `${emailAgentBasePath()}/sender-access`;
}

export type EmailAgentProgress = {
  active: boolean;
  updatedAt?: number;
  messageId?: string | null;
  subject?: string | null;
  classification?: "task" | "reply" | null;
  currentStepId?: string | null;
  steps?: EmailAgentProgressStep[];
  /** Current human-readable line (which tool is running). */
  activityDetail?: string | null;
  /** Rolling log of recent steps (newest last). */
  microSteps?: EmailAgentMicroStep[];
};

function emailAgentAuthHeaders(): Record<string, string> {
  const k = String(loadAgentMailApiKey() ?? "").trim();
  return k ? { "X-AgentMail-Api-Key": k } : {};
}

export async function fetchEmailAgentProgress(): Promise<EmailAgentProgress> {
  const res = await fetch(emailAgentProgressUrl(), {
    credentials: "include",
    headers: emailAgentAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : `HTTP ${res.status}`
    );
  }
  return res.json();
}

export type EmailAgentSenderAccess = {
  adminDomains: string[];
  extraWhitelist: string[];
  blacklist: string[];
};

export async function fetchEmailAgentSenderAccess(): Promise<EmailAgentSenderAccess> {
  const res = await fetch(emailAgentSenderAccessUrl(), {
    credentials: "include",
    headers: emailAgentAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : `HTTP ${res.status}`
    );
  }
  return res.json();
}

export async function saveEmailAgentSenderAccess(
  body: Pick<EmailAgentSenderAccess, "extraWhitelist" | "blacklist">
): Promise<EmailAgentSenderAccess> {
  const res = await fetch(emailAgentSenderAccessUrl(), {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...emailAgentAuthHeaders(),
    },
    body: JSON.stringify({
      extraWhitelist: body.extraWhitelist,
      blacklist: body.blacklist,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : `HTTP ${res.status}`
    );
  }
  return res.json();
}
