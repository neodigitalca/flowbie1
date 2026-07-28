/** Default WordPress post permalink folder for sitemap optimizer destinations. */
export const DEFAULT_BLOG_PERMALINK_PREFIX = "blog/";

export type EnsureBlogDestinationOptions = {
  parentPrefix?: string;
};

function normalizeParentPrefix(raw: string): string {
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/` : "";
}

function pathSegments(pathname: string): string[] {
  return pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

function isUnderBlogPrefix(segments: readonly string[], blogFolder: string): boolean {
  const blog = blogFolder.toLowerCase();
  return segments.length >= 2 && segments[0]!.toLowerCase() === blog;
}

/**
 * Normalize a full URL to `{origin}/blog/{slug}/` for post destinations.
 * Strips date-archive paths; keeps last segment as slug. Idempotent when already under /blog/.
 */
export function ensureBlogDestinationUrl(
  fullUrl: string,
  options?: EnsureBlogDestinationOptions,
): string | null {
  const trimmed = fullUrl?.trim();
  if (!trimmed) return null;

  const parentPrefix = normalizeParentPrefix(options?.parentPrefix ?? DEFAULT_BLOG_PERMALINK_PREFIX);
  const blogFolder = parentPrefix.replace(/\/$/, "");
  if (!blogFolder) return null;

  try {
    const u = new URL(trimmed);
    let pathname = u.pathname.replace(/\/+/g, "/");
    if (!pathname.endsWith("/")) pathname += "/";

    const segments = pathSegments(pathname);
    if (!segments.length) return null;

    if (isUnderBlogPrefix(segments, blogFolder)) {
      const normalized = `/${segments.join("/")}/`;
      return `${u.origin}${normalized}`;
    }

    const slug = segments[segments.length - 1]!;
    if (!slug) return null;

    return `${u.origin}/${blogFolder}/${slug}/`;
  } catch {
    return null;
  }
}

/** True when ensureBlogDestinationUrl would change the URL (ignoring trailing slash). */
export function blogDestinationWasNormalized(
  before: string,
  after: string | null,
): boolean {
  if (!after) return false;
  const norm = (s: string) => s.trim().replace(/\/+$/, "").toLowerCase();
  return norm(before) !== norm(after);
}
