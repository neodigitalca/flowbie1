import { backendApiUrl } from "@/lib/wordpress-api/connection";
import { loadApiKey, saveApiKey } from "@/lib/api";

type ResolvedOpenRouterKeyResponse = {
  ok?: boolean;
  key?: string;
};

async function fetchSettingsPluginOpenRouterKey(): Promise<string> {
  const res = await fetch(backendApiUrl("/integrations/resolved-openrouter-key"), {
    credentials: "include",
  });
  if (!res.ok) return "";
  const data = (await res.json()) as ResolvedOpenRouterKeyResponse;
  return typeof data.key === "string" ? data.key.trim() : "";
}

/** Settings plugin key only. Does not use Dashboard/localStorage. */
export async function resolveOpenRouterApiKeyFromSettingsPlugin(): Promise<string> {
  const serverKey = await fetchSettingsPluginOpenRouterKey();
  if (serverKey) return serverKey;
  throw new Error("Add an OpenRouter API key in Settings.");
}

/** Prefer Dashboard/local key; use server secrets only when the client key is unset. */
export async function resolveOpenRouterApiKeyForHarness(): Promise<string> {
  const clientKey = loadApiKey()?.trim() ?? "";
  if (clientKey) return clientKey;

  try {
    const serverKey = await fetchSettingsPluginOpenRouterKey();
    if (serverKey) {
      saveApiKey(serverKey);
      return serverKey;
    }
  } catch {
    /* ignore */
  }

  throw new Error("Add an OpenRouter API key in Settings.");
}
