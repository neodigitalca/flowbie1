import type { BlogDestinationPolicy } from "@/lib/sitemap-optimizer/blog-destination-policy";
import { applyBlogDestinationPolicy } from "@/lib/sitemap-optimizer/blog-destination-policy";
import { editorialDestinationWithContentYear } from "@/lib/sitemap-optimizer/apply-content-year-policy";
import { entityKeywordFromMembers } from "@/lib/sitemap-optimizer/entity-merge-prompts";
import { entityConsolidatedTitleHint } from "@/lib/sitemap-optimizer/entity-merge-prompts";
import { buildGridDestinationPreservingPermalink } from "@/lib/sitemap-optimizer/grid-destination-aiseo-policy";
import { gridMemberCanonicalUrl } from "@/lib/sitemap-optimizer/grid-member-url";
import { getGridContentYear, refreshYearsInText } from "@/lib/sitemap-optimizer/grid-title-year";
import { resolvedMemberRows } from "@/lib/sitemap-optimizer/resolved-cluster-members";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

/** Canonical service-area destination URL for an entity cluster (structural, not copy). */
export function resolveEntityLockedDestination(
  cluster: SitemapOptimizerCluster,
  rowById: Map<string, SitemapOptimizerPostRow>,
  blogDestination?: BlogDestinationPolicy | null,
  titleHint?: string,
): string | null {
  const members = resolvedMemberRows(cluster, rowById);
  if (!members.length) return null;

  const keyword = entityKeywordFromMembers(members);
  const title = titleHint?.trim() || entityConsolidatedTitleHint(members, keyword);
  const memberUrls = members.map((m) => gridMemberCanonicalUrl(m));
  const contentYear = getGridContentYear();

  let locked =
    buildGridDestinationPreservingPermalink(memberUrls, keyword, title) ??
    buildGridDestinationPreservingPermalink(memberUrls, `${keyword} services`, title);
  if (!locked) return null;

  locked = editorialDestinationWithContentYear(
    applyBlogDestinationPolicy(locked, blogDestination),
    contentYear,
  );
  return refreshYearsInText(locked, contentYear);
}
