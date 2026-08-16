import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { loadApiKey } from "@/lib/api";
import { neoPulseApiHeaders } from "@/lib/neo-pulse-api-headers";
import type { WordPressSite } from "@/components/integrations/types";
import type { AssistCard, AssistRequestPayload } from "./types";
import { consumeAssistNdjsonStream, processNdjsonEvents, type StreamHandlers } from "./stream";

type AssistSiteContext = {
  siteUrl?: string;
  siteId?: string;
  username?: string;
  appPassword?: string;
};

function siteAuthBody(site: WordPressSite | null | undefined): AssistSiteContext {
  if (!site) return {};
  return {
    siteUrl: site.siteUrl,
    siteId: site.id,
    username: site.username,
    appPassword: site.appPassword,
  };
}

function assistBaseBody(site: WordPressSite | null | undefined, body: Record<string, unknown>) {
  const apiKey = loadApiKey();
  return {
    ...siteAuthBody(site),
    ...(apiKey ? { openRouterApiKey: apiKey } : {}),
    ...body,
  };
}

async function postJson<T>(
  path: string,
  site: WordPressSite | null | undefined,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${BACKEND_API_BASE}/api/pulse-assist${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: neoPulseApiHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(assistBaseBody(site, body)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        (typeof data.message === "string" && data.message) ||
        `Pulse assist failed (HTTP ${response.status})`,
    );
  }
  return data as T;
}

export async function pulseAssistAck(
  site: WordPressSite | null | undefined,
  payload: AssistRequestPayload,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const data = await postJson<{ ok?: boolean; text?: string; error?: string }>(
      "/ack",
      site,
      payload as unknown as Record<string, unknown>,
    );
    return { ok: data.ok !== false, text: data.text, error: data.error };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ack request failed",
    };
  }
}

export async function pulseAssistStreamLive(
  site: WordPressSite | null | undefined,
  payload: AssistRequestPayload,
  handlers: StreamHandlers,
  ackShownAtRef: { value: number },
): Promise<void> {
  const url = `${BACKEND_API_BASE}/api/pulse-assist/stream`;
  const response = await fetch(url, {
    method: "POST",
    headers: neoPulseApiHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(assistBaseBody(site, payload as unknown as Record<string, unknown>)),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        (typeof data.message === "string" && data.message) ||
        `Pulse assist failed (HTTP ${response.status})`,
    );
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("ndjson") && response.body) {
    await consumeAssistNdjsonStream(response.body, handlers, ackShownAtRef);
    return;
  }

  const data = await response.json().catch(() => ({}));
  const lines = Array.isArray(data.ndjson) ? data.ndjson : [];
  await processNdjsonEvents(lines, handlers, ackShownAtRef);
}

/** @deprecated Use pulseAssistStreamLive */
export async function pulseAssistStream(
  site: WordPressSite | null | undefined,
  payload: AssistRequestPayload,
): Promise<{ ok: boolean; ndjson?: unknown[]; error?: string }> {
  return postJson("/stream", site, payload as unknown as Record<string, unknown>);
}

export async function pulseAssistBuild(
  site: WordPressSite | null | undefined,
  payload: AssistRequestPayload,
): Promise<AssistCard> {
  const data = await postJson<AssistCard & { ok?: boolean; error?: string }>(
    "",
    site,
    payload as unknown as Record<string, unknown>,
  );
  if (data.error) throw new Error(data.error);
  return data;
}

export async function pulseAssistUndo(site: WordPressSite, postId: number): Promise<AssistCard> {
  const url = `${BACKEND_API_BASE}/api/wordpress/pulse-assist-undo`;
  const response = await fetch(url, {
    method: "POST",
    headers: neoPulseApiHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ ...siteAuthBody(site), post_id: postId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        `Pulse assist undo failed (HTTP ${response.status})`,
    );
  }
  return data as AssistCard;
}

export async function warmSiteInventory(site: WordPressSite): Promise<{ count?: number }> {
  const url = `${BACKEND_API_BASE}/api/wordpress/pulse-assist-site-inventory`;
  const response = await fetch(url, {
    method: "POST",
    headers: neoPulseApiHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(siteAuthBody(site)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        `Site inventory failed (HTTP ${response.status})`,
    );
  }
  return data as { count?: number };
}

export async function downloadSiteInventoryCsv(site: WordPressSite): Promise<void> {
  const url = `${BACKEND_API_BASE}/api/wordpress/pulse-assist-site-inventory`;
  const response = await fetch(url, {
    method: "POST",
    headers: neoPulseApiHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({
      ...siteAuthBody(site),
      format: "csv",
      include_drafts: true,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        `Site inventory export failed (HTTP ${response.status})`,
    );
  }
  const csv =
    typeof data.csv === "string"
      ? data.csv
      : typeof data.content === "string"
        ? data.content
        : typeof data.data === "string"
          ? data.data
          : "";
  if (!csv) {
    throw new Error("Site inventory CSV was empty");
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = "site-inventory.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}
