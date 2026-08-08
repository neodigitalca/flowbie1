export const OPENROUTER_WEB_APP_TITLE = "Flowbie Web App";
export const OPENROUTER_WEB_APP_REFERER = "https://flowbie.ca/flowbie/";

export function resolveOpenRouterWebReferer(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return window.location.origin;
  }
  return OPENROUTER_WEB_APP_REFERER;
}

export function openRouterWebAppHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": resolveOpenRouterWebReferer(),
    "X-Title": OPENROUTER_WEB_APP_TITLE,
  };
}
