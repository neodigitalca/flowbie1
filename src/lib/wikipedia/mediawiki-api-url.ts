import { BACKEND_API_BASE } from "../wordpress-api/connection";

/**
 * Browser-safe MediaWiki endpoint. Direct calls to en.wikipedia.org often fail (CORS / empty body);
 * the NEO Pulse server proxies {@link https://en.wikipedia.org/w/api.php} at `/api/wikipedia/api`.
 */
export function getMediaWikiApiUrlWithQuery(params: URLSearchParams): string {
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  const endpoint = base ? `${base}/api/wikipedia/api` : "/api/wikipedia/api";
  return `${endpoint}?${params.toString()}`;
}
