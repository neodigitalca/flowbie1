import { backendApiUrl } from "@/lib/wordpress-api/connection";
import { loadApiKey, saveApiKey } from "@/lib/api";

type ResolvedOpenRouterKeyResponse = {
  ok?: boolean;
  key?: string;
};

/** Prefer Dashboard/local key; use server secrets only when the client key is unset. */
export async function resolveOpenRouterApiKeyForHarness(): Promise<string> {
  const clientKey = loadApiKey()?.trim() ?? "";
  if (clientKey) return clientKey;

  try {
    const res = await fetch(backendApiUrl("/integrations/resolved-openrouter-key"), {
      credentials: "include",
    });
    if (res.ok) {
      const data = (await res.json()) as ResolvedOpenRouterKeyResponse;
      const serverKey = typeof data.key === "string" ? data.key.trim() : "";
      if (serverKey) {
        saveApiKey(serverKey);
        return serverKey;
      }
    }
  } catch {
    /* ignore */
  }

  throw new Error("Add an OpenRouter API key in Settings.");
}
