import { neoPulseApiHeaders } from "@/lib/neo-pulse-api-headers";
import type { MobilePushDeviceRegistration, MobilePushPrefs } from "./types";
import { DEFAULT_MOBILE_PUSH_PREFS } from "./notification-actions";

const API_BASE = "/api/push";

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function registerPushDevice(
  body: MobilePushDeviceRegistration,
): Promise<boolean> {
  const res = await fetch(`${API_BASE}/devices`, {
    method: "POST",
    headers: neoPulseApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  return res.ok && data.ok === true;
}

export async function unregisterPushDevice(token: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/devices`, {
    method: "DELETE",
    headers: neoPulseApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ token }),
  });
  const data = await parseJson(res);
  return res.ok && data.ok === true;
}

export async function fetchMobilePushPreferences(): Promise<MobilePushPrefs> {
  const res = await fetch(`${API_BASE}/preferences`, {
    headers: neoPulseApiHeaders(),
  });
  const data = await parseJson(res);
  if (!res.ok || data.ok !== true || !data.preferences || typeof data.preferences !== "object") {
    return { ...DEFAULT_MOBILE_PUSH_PREFS };
  }
  return {
    ...DEFAULT_MOBILE_PUSH_PREFS,
    ...(data.preferences as Partial<MobilePushPrefs>),
  };
}

export async function patchMobilePushPreferences(
  patch: Partial<MobilePushPrefs>,
): Promise<MobilePushPrefs> {
  const res = await fetch(`${API_BASE}/preferences`, {
    method: "PATCH",
    headers: neoPulseApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ preferences: patch }),
  });
  const data = await parseJson(res);
  if (!res.ok || data.ok !== true || !data.preferences || typeof data.preferences !== "object") {
    throw new Error(typeof data.error === "string" ? data.error : "Could not save push preferences");
  }
  return {
    ...DEFAULT_MOBILE_PUSH_PREFS,
    ...(data.preferences as Partial<MobilePushPrefs>),
  };
}
