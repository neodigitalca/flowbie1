import type { BlogDestinationPolicy } from "@/lib/sitemap-optimizer/blog-destination-policy";
import { applyBlogDestinationPolicy } from "@/lib/sitemap-optimizer/blog-destination-policy";
import { optimizeGridDestinationForAiseo } from "@/lib/sitemap-optimizer/grid-destination-aiseo-policy";

/**
 * Shorten destination to /blog/{aiseo-slug}/ using merge keyword/title.
 * Used for redirect-map rows where CSV new_url kept the legacy long slug.
 */
export function optimizeBlogMergeDestination(
  destinationUrl: string,
  keyword: string,
  title: string,
  memberUrls: readonly string[],
  blogDestination?: BlogDestinationPolicy | null,
): string {
  const trimmed = destinationUrl.trim();
  if (!trimmed) return trimmed;

  const withBlog = applyBlogDestinationPolicy(trimmed, blogDestination);
  if (!blogDestination?.forceBlogPermalink) return withBlog;

  const canonicalMembers = memberUrls.length
    ? memberUrls
    : [withBlog];

  const optimized =
    optimizeGridDestinationForAiseo(
      withBlog,
      keyword,
      title,
      canonicalMembers,
      blogDestination,
    ) ?? withBlog;

  return applyBlogDestinationPolicy(optimized, blogDestination);
}
