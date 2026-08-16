import { getSessionToken } from "@/lib/auth-device";
import { loadApiKey } from "@/lib/api";

/** Session + OpenRouter headers for neodigital.ca /api/* (Capacitor WebView needs Bearer). */
export function neoPulseApiHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = getSessionToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const openRouterKey = loadApiKey().trim();
  if (openRouterKey && !headers.has("X-OpenRouter-Api-Key")) {
    headers.set("X-OpenRouter-Api-Key", openRouterKey);
  }
  return headers;
}
