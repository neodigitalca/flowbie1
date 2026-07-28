/**
 * Cached link validation: validate post URLs once per site per run, reuse for all optimizations.
 * Wraps filterPostsToValidatedLinksOnly so bulk runs do not repeat ~100 HTTP HEAD calls per post.
 */

import { filterPostsToValidatedLinksOnly } from "@/lib/wordpress-api/validate-internal-links";
import type { PostWithLink } from "@/lib/wordpress-api/validate-internal-links";

function normalizeUrl(siteBaseUrl: string, link: string): string {
  if (!link?.trim()) return "";
  const base = (siteBaseUrl || "").trim().replace(/\/+$/, "");
  const baseUrl = base.startsWith("http") ? base : `https://${base}`;
  const full = link.startsWith("http") ? link : `${baseUrl}${link.startsWith("/") ? link : `/${link}`}`;
  return full.toLowerCase().replace(/\/+$/, "");
}

// siteId -> normalizedUrl -> ok (true = 200, false = checked but not ok)
const validationCache = new Map<string, Map<string, boolean>>();

/**
 * Returns only posts whose link returns HTTP 200. Results are cached per siteId;
 * subsequent calls for the same site only validate URLs not yet in the cache.
 */
export async function getValidatedPosts(
  siteId: string,
  siteBaseUrl: string,
  posts: PostWithLink[],
  onProgress?: (message: string) => void
): Promise<PostWithLink[]> {
  if (!posts.length) return posts;

  let siteMap = validationCache.get(siteId);
  if (!siteMap) {
    siteMap = new Map<string, boolean>();
    validationCache.set(siteId, siteMap);
  }

  const unchecked = posts.filter((p) => !siteMap!.has(normalizeUrl(siteBaseUrl, p.link)));
  if (unchecked.length > 0) {
    const results = await filterPostsToValidatedLinksOnly(siteBaseUrl, unchecked, onProgress);
    const okSet = new Set(results.map((p) => normalizeUrl(siteBaseUrl, p.link)));
    for (const p of unchecked) {
      const norm = normalizeUrl(siteBaseUrl, p.link);
      siteMap.set(norm, okSet.has(norm));
    }
  }

  const norm = (p: PostWithLink) => normalizeUrl(siteBaseUrl, p.link);
  return posts.filter((p) => siteMap!.get(norm(p)) === true);
}

/**
 * Clears the validation cache for a site (call when optimization run ends).
 */
export function clearValidationCache(siteId: string): void {
  if (validationCache.has(siteId)) {
    validationCache.delete(siteId);
  }
}

/**
 * Clears all validation caches (e.g. when clearing all site caches).
 */
export function clearAllValidationCaches(): void {
  validationCache.clear();
}
