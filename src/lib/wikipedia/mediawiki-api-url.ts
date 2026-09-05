import { backendApiUrl } from "../wordpress-api/connection";

/**
 * Browser-safe MediaWiki endpoint. Direct calls to en.wikipedia.org often fail (CORS / empty body);
 * the NEO Pulse server proxies {@link https://en.wikipedia.org/w/api.php} at `/api/wikipedia/api`.
 */
export function getMediaWikiApiUrlWithQuery(params: URLSearchParams): string {
  return `${backendApiUrl("/wikipedia/api")}?${params.toString()}`;
}
