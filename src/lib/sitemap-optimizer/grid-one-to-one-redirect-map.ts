import { gridMemberSourceUrl } from "@/lib/sitemap-optimizer/grid-member-url";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

/** Max 1 + every upload row has old_url → new_url from a redirect map CSV. */
export function isGridOneToOneRedirectMap(
  rows: readonly SitemapOptimizerPostRow[],
  maxUrlsPerPost?: GridMaxUrlsPerPost,
): boolean {
  if (maxUrlsPerPost !== 1 || !rows.length) return false;
  return rows.every((r) => Boolean(r.gridRedirectFromUrl?.trim() && r.url?.trim()));
}

export function oneToOneRedirectMapLabel(row: SitemapOptimizerPostRow): string {
  const oldUrl = gridMemberSourceUrl(row);
  try {
    const tail = new URL(oldUrl).pathname.split("/").filter(Boolean).pop();
    if (tail) return tail.replace(/-/g, " ");
  } catch {
    /* fall through */
  }
  return row.gridTagLabel?.trim() || row.title?.trim() || oldUrl;
}
