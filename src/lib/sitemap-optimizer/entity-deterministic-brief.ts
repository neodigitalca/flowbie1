import type { BlogDestinationPolicy } from "@/lib/sitemap-optimizer/blog-destination-policy";
import { resolveEntityLockedDestination } from "@/lib/sitemap-optimizer/entity-locked-destination";
import {
  entityConsolidatedTitleHint,
  entityKeywordFromMembers,
} from "@/lib/sitemap-optimizer/entity-merge-prompts";
import { gridMemberSourceUrl } from "@/lib/sitemap-optimizer/grid-member-url";
import { getGridContentYear, refreshYearsInText } from "@/lib/sitemap-optimizer/grid-title-year";
import { displayPostTitle } from "@/lib/sitemap-optimizer/merge-results-display";
import { resolvedMemberRows } from "@/lib/sitemap-optimizer/resolved-cluster-members";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

function entityOutlineForMembers(
  members: readonly SitemapOptimizerPostRow[],
  keyword: string,
): string[] {
  if (members.length <= 1) {
    return ["Local service overview", "Products and options", "Service area coverage", "Next steps"];
  }
  const sections = members
    .map((m) => displayPostTitle(m.title || m.url))
    .filter(Boolean)
    .slice(0, 5);
  return [`${keyword} overview`, ...sections, "Contact and service area"].slice(0, 6);
}

/** Deterministic entity brief for service-area consolidation clusters. */
export function buildDeterministicEntityBrief(
  cluster: SitemapOptimizerCluster,
  rowById: Map<string, SitemapOptimizerPostRow>,
  blogDestination?: BlogDestinationPolicy | null,
): SitemapOptimizerMergeRecommendation | null {
  const members = resolvedMemberRows(cluster, rowById);
  if (!members.length) return null;

  const keyword = entityKeywordFromMembers(members);
  const title = entityConsolidatedTitleHint(members, keyword);
  const metaBase = `Local ${keyword} — consolidated service-area page covering ${members.length} location URL(s).`;
  const meta = metaBase.length <= 160 ? metaBase : `${metaBase.slice(0, 157).trim()}...`;
  const contentYear = getGridContentYear();
  const locked = resolveEntityLockedDestination(cluster, rowById, blogDestination, title);
  if (!locked) return null;

  return {
    clusterId: cluster.clusterId,
    recommendedTitle: refreshYearsInText(title, contentYear),
    recommendedPrimaryKeyword: refreshYearsInText(keyword, contentYear),
    recommendedMeta: refreshYearsInText(meta, contentYear),
    lockedDestinationUrl: locked,
    combinedOutline: entityOutlineForMembers(members, keyword),
    whatToKeepFromEach: members.map((row) => ({
      url: gridMemberSourceUrl(row),
      title: displayPostTitle(row.title || ""),
      bullets: [displayPostTitle(row.title || row.url)].filter(Boolean),
    })),
    redirectOrCanonicalNote: "Redirect legacy service-area URLs to this consolidated local landing page.",
    priority: members.length >= 3 ? "high" : "medium",
    confidence: "high",
    rationale: "Deterministic entity brief (service-area consolidation).",
  };
}
