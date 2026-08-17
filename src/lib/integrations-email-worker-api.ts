import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";

const OPENROUTER_API_KEY_STORAGE_KEY = "openrouter-api-key";

function readOpenRouterApiKeyFromStorage(): string {
  try {
    const stored = localStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY) || "";
    if (stored.trim()) return stored.trim();
  } catch {
    /* ignore */
  }
  return (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined)?.trim() ?? "";
}

function integrationsUrl(path: string): string {
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export async function syncEmailWorkerKeys(overrides?: {
  agentmailApiKey?: string;
  agentmailGeneralEmail?: string;
  openRouterApiKey?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(integrationsUrl("/api/integrations/sync-email-worker-keys"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentmailApiKey: overrides?.agentmailApiKey ?? "",
        agentmailGeneralEmail: overrides?.agentmailGeneralEmail ?? "",
        openRouterApiKey: overrides?.openRouterApiKey ?? readOpenRouterApiKeyFromStorage(),
      }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: Boolean(data.ok) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
