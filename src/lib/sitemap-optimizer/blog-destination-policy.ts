import {
  DEFAULT_BLOG_PERMALINK_PREFIX,
  ensureBlogDestinationUrl,
} from "@/lib/sitemap-optimizer/blog-destination-url";
import { editorialDestinationWithContentYear } from "@/lib/sitemap-optimizer/apply-content-year-policy";
import { getGridContentYear } from "@/lib/sitemap-optimizer/grid-title-year";
import { optimizeBlogMergeDestination } from "@/lib/sitemap-optimizer/optimize-blog-destination";
import type {
  SitemapOptimizerCollectionKey,
  SitemapOptimizerMergeRecommendation,
} from "@/lib/sitemap-optimizer/types";

export type BlogDestinationPolicy = {
  forceBlogPermalink: boolean;
  parentPrefix?: string;
  /** Keep CSV new_url slugs exactly (redirect-map upload). */
  preserveCsvDestinations?: boolean;
};

export function blogDestinationPolicyForCollections(
  selected: ReadonlySet<SitemapOptimizerCollectionKey>,
  options?: { redirectMap?: boolean; gridCsv?: boolean },
): BlogDestinationPolicy {
  if (options?.redirectMap || options?.gridCsv) {
    return {
      forceBlogPermalink: true,
      parentPrefix: DEFAULT_BLOG_PERMALINK_PREFIX,
      preserveCsvDestinations: Boolean(options?.redirectMap),
    };
  }
  const hasPosts = selected.has("posts");
  const hasPages = selected.has("pages");
  const hasEntity = selected.has("entity");
  const postsOnly = hasPosts && !hasPages && !hasEntity;
  const postsPrimary = hasPosts && !hasEntity;
  return {
    forceBlogPermalink: postsOnly || postsPrimary,
    parentPrefix: DEFAULT_BLOG_PERMALINK_PREFIX,
  };
}

export function applyBlogDestinationPolicy(
  url: string,
  policy?: BlogDestinationPolicy | null,
): string {
  const trimmed = url.trim();
  if (!policy?.forceBlogPermalink) return trimmed;
  return ensureBlogDestinationUrl(trimmed, { parentPrefix: policy.parentPrefix }) ?? trimmed;
}

export function blogPermalinkPrefixForPolicy(policy?: BlogDestinationPolicy | null): string {
  if (!policy?.forceBlogPermalink) return "";
  const raw = policy.parentPrefix ?? DEFAULT_BLOG_PERMALINK_PREFIX;
  const trimmed = raw.replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/` : "";
}

export function normalizeMergeDestinations(
  merges: readonly SitemapOptimizerMergeRecommendation[],
  policy?: BlogDestinationPolicy | null,
  memberUrlsByCluster?: ReadonlyMap<string, readonly string[]>,
  analyzedAt?: string,
): SitemapOptimizerMergeRecommendation[] {
  if (!policy?.forceBlogPermalink) return [...merges];
  const year = getGridContentYear(analyzedAt);
  return merges.map((m) => {
    const locked = m.lockedDestinationUrl?.trim();
    if (!locked) return m;
    const members = memberUrlsByCluster?.get(m.clusterId) ?? [locked];
    const normalized = policy.preserveCsvDestinations
      ? editorialDestinationWithContentYear(applyBlogDestinationPolicy(locked, policy), year)
      : editorialDestinationWithContentYear(
          optimizeBlogMergeDestination(
            locked,
            m.recommendedPrimaryKeyword,
            m.recommendedTitle,
            members,
            policy,
          ),
          year,
        );
    return { ...m, lockedDestinationUrl: normalized };
  });
}
