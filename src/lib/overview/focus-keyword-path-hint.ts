/**
 * WordPress / blog URL segments that usually wrap the real slug (not the page topic).
 */
const PATH_NOISE_SEGMENTS = new Set([
  "blog",
  "blogs",
  "posts",
  "post",
  "news",
  "articles",
  "article",
  "page",
  "pages",
  "category",
  "categories",
  "tag",
  "tags",
  "author",
  "shop",
  "store",
  "product",
  "products",
  "services",
  "service",
]);

/**
 * Best-effort topic phrase from the URL path (usually the last meaningful slug segment):
 * `/blog/winter-declutter-holiday-space/` → `winter declutter holiday space`
 */
export function pathSlugToFocusHint(urlStr: string): string {
  const raw = (urlStr || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const parts = u.pathname.split("/").filter(Boolean);
    if (!parts.length) return "";

    const cleaned = parts.map((p) => p.replace(/\.(html?|php|aspx|md)$/i, ""));

    /** Prefer the last segment that is not a generic wrapper like `blog`. */
    let slug = "";
    for (let i = cleaned.length - 1; i >= 0; i--) {
      const seg = cleaned[i];
      if (!seg) continue;
      if (!PATH_NOISE_SEGMENTS.has(seg.toLowerCase())) {
        slug = seg;
        break;
      }
    }
    if (!slug && cleaned.length) {
      slug = cleaned[cleaned.length - 1] ?? "";
    }
    if (!slug) return "";

    const words = slug
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return words;
  } catch {
    return "";
  }
}
