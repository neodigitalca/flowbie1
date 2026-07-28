import { urlPathTail } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";

/** WordPress clone slugs: ...-2, ...-3, ...-2-2, etc. (not ...-1). */
export function isWordPressNumberedSlugDuplicate(url: string): boolean {
  const slug = urlPathTail(url).toLowerCase();
  const suffix = slug.match(/(?:-\d+)+$/);
  if (!suffix) return false;
  return suffix[0]
    .split("-")
    .filter(Boolean)
    .some((seg) => {
      const n = Number(seg);
      return Number.isInteger(n) && n >= 2 && n <= 99;
    });
}

export function filterWordPressNumberedSlugDuplicates(urls: readonly string[]): string[] {
  return urls.filter((url) => !isWordPressNumberedSlugDuplicate(url));
}

/** Strip trailing WP numbered clone suffix (...-2, ...-3) from a URL path for a clean destination. */
export function stripWordPressNumberedSlugSuffix(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || !isWordPressNumberedSlugDuplicate(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const path = u.pathname.replace(/\/$/, "");
    const cleaned = path.replace(/(?:-\d+)+$/i, "");
    if (!cleaned || cleaned === path) return trimmed;
    u.pathname = `${cleaned}/`;
    return u.toString();
  } catch {
    return trimmed.replace(/(?:-\d+)+\/?$/i, "/");
  }
}
