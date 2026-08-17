import { backendApiUrl } from "@/lib/wordpress-api/connection";
import { loadApiKey } from "@/lib/api";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import type { WordPressSite } from "@/components/integrations/types";

function url(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return backendApiUrl(`/manager-wordpress-properties${p}`);
}

function openRouterPayload(overrides?: { openRouterApiKey?: string; openRouterModel?: string }) {
  return {
    openRouterApiKey: (overrides?.openRouterApiKey ?? loadApiKey() ?? "").trim(),
    openRouterModel: (overrides?.openRouterModel ?? getResearchModel() ?? "").trim(),
  };
}

export type WordPressPropertiesWorkspaceStatus = {
  ok?: boolean;
  workspaceConfigured?: boolean;
  urlHost?: string | null;
  canAutoCreateTable?: boolean;
};

export async function getWordPressPropertiesWorkspaceStatus(): Promise<WordPressPropertiesWorkspaceStatus | null> {
  try {
    const res = await fetch(url("/status"), { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as WordPressPropertiesWorkspaceStatus;
  } catch {
    return null;
  }
}

/** @deprecated Use getWordPressPropertiesWorkspaceStatus */
export async function getWordPressPropertiesCloudStatus(): Promise<WordPressPropertiesWorkspaceStatus | null> {
  return getWordPressPropertiesWorkspaceStatus();
}

export async function loadWordPressPropertyPluginTokens(): Promise<
  { ok: boolean; tokens?: { siteId: string; pluginAccessToken: string }[]; error?: string }
> {
  try {
    const res = await fetch(url("/load"), { credentials: "include" });
    const data = (await res.json()) as {
      ok?: boolean;
      tokens?: { siteId: string; pluginAccessToken: string }[];
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: Boolean(data.ok), tokens: data.tokens ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function syncOpenRouterToWorkspace(
  overrides?: { openRouterApiKey?: string; openRouterModel?: string },
): Promise<{ ok: boolean; updated?: number; error?: string }> {
  try {
    const res = await fetch(url("/sync-openrouter"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(openRouterPayload(overrides)),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      updated?: number;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: Boolean(data.ok), updated: data.updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveWordPressProperties(
  sites: WordPressSite[],
  overrides?: { openRouterApiKey?: string; openRouterModel?: string },
): Promise<{
  ok: boolean;
  error?: string;
  code?: string;
  updatedAt?: string;
  count?: number;
  tokens?: { siteId: string; pluginAccessToken: string }[];
}> {
  try {
    const res = await fetch(url("/save"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sites,
        ...openRouterPayload(overrides),
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      code?: string;
      updatedAt?: string;
      count?: number;
      tokens?: { siteId: string; pluginAccessToken: string }[];
    };
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}`, code: data.code };
    }
    return {
      ok: Boolean(data.ok),
      updatedAt: data.updatedAt,
      count: typeof data.count === "number" ? data.count : undefined,
      tokens: data.tokens,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
