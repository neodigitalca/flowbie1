import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import type { ManagerCloudSnapshotV1 } from "@/lib/manager-cloud-settings-snapshot";

function baseUrl(): string {
  return (import.meta.env.VITE_MCP_API_BASE?.replace(/\/api\/mcp\/?$/, "") || BACKEND_API_BASE || "").replace(
    /\/$/,
    "",
  );
}

function url(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl()}/api/manager-cloud-settings${p}`;
}

export type ManagerCloudSettingsStatus = {
  ok: boolean;
  supabaseConfigured?: boolean;
  urlHost?: string | null;
  canAutoCreateTable?: boolean;
};

export async function getManagerCloudSettingsStatus(): Promise<ManagerCloudSettingsStatus> {
  try {
    const res = await fetch(url("/status"), { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as ManagerCloudSettingsStatus;
    return { ok: res.ok && Boolean(data.ok), ...data };
  } catch {
    return { ok: false };
  }
}

export async function saveManagerSettingsToCloud(
  snapshot: ManagerCloudSnapshotV1,
): Promise<{ ok: boolean; error?: string; code?: string; updatedAt?: string }> {
  try {
    const res = await fetch(url("/save"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      code?: string;
      updatedAt?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}`, code: data.code };
    }
    return { ok: Boolean(data.ok), updatedAt: data.updatedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function loadManagerSettingsFromCloud(): Promise<{
  ok: boolean;
  snapshot: ManagerCloudSnapshotV1 | null;
  updatedAt?: string | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(url("/load"), { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      snapshot?: ManagerCloudSnapshotV1 | null;
      updatedAt?: string | null;
      error?: string;
      code?: string;
    };
    if (!res.ok) {
      return { ok: false, snapshot: null, error: data.error || `HTTP ${res.status}`, code: data.code };
    }
    return {
      ok: Boolean(data.ok),
      snapshot: data.snapshot ?? null,
      updatedAt: data.updatedAt ?? null,
    };
  } catch (e) {
    return { ok: false, snapshot: null, error: e instanceof Error ? e.message : String(e) };
  }
}
