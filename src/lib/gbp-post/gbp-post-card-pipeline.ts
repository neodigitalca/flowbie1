import type { WordPressSite } from "@/components/integrations/types";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { getPublishedPosts } from "@/lib/wordpress-api";
import { resolveGbpTopicKeyword } from "@/lib/gbp-post/gbp-topic";
import {
  gbpSitemapSourceEmptyMessage,
  resolveGbpSitemapUrlsForSite,
} from "@/lib/gbp-post/gbp-sitemap-source";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import type { GbpInventoryRow } from "@/lib/gbp-post/gbp-posts-inventory";

const HARNESS_STEP_TITLES = ["Topic", "Site page", "Post card"] as const;
const HARNESS_TOTAL = HARNESS_STEP_TITLES.length;

export type GbpLinkedBlog = {
  blogPostUrl: string;
  blogPostTitle: string;
  blogPostExcerpt?: string;
  reason?: string;
};

function emitHarnessStep(
  onHarnessSection: ((payload: BulkHarnessSectionPayload) => void) | undefined,
  sectionIndex: number,
  title: string,
  phase: "start" | "done",
  markdownSlice = "",
) {
  onHarnessSection?.({
    rowIndex: 0,
    sectionIndex,
    totalSections: HARNESS_TOTAL,
    title,
    phase,
    ...(phase === "done" && markdownSlice ? { markdownSlice } : {}),
  });
}

/**
 * GBP harness: resolve topic, pick an existing blog (CTA target), then server writes the post card on publish.
 */
export async function runGbpPostCardPipeline(options: {
  site: WordPressSite;
  keyword?: string;
  openRouterApiKey: string;
  sitemapSource: OverviewSitemapSource;
  excludeBlogUrls?: string[];
  excludeGbpCtaUrls?: string[];
  existingGbpPosts?: GbpInventoryRow[];
  onHarnessSection?: (payload: BulkHarnessSectionPayload) => void;
}): Promise<{ topic: string; blogPost: GbpLinkedBlog }> {
  const { site, openRouterApiKey, sitemapSource } = options;

  const restrictToSitemapUrls = resolveGbpSitemapUrlsForSite(site, sitemapSource);
  if (!restrictToSitemapUrls.length) {
    throw new Error(gbpSitemapSourceEmptyMessage(site.name, sitemapSource));
  }

  let wordPressPosts: Array<{ title: string }> = [];
  if (site.username?.trim() && site.appPassword?.trim() && site.siteUrl?.trim()) {
    try {
      const pub = await getPublishedPosts(site.siteUrl, site.username, site.appPassword, 100);
      wordPressPosts = pub.posts ?? [];
    } catch {
      wordPressPosts = [];
    }
  }

  emitHarnessStep(options.onHarnessSection, 0, HARNESS_STEP_TITLES[0], "start");
  const topic = await resolveGbpTopicKeyword(
    options.keyword ?? "",
    site,
    openRouterApiKey,
    wordPressPosts.map((p) => p.title).filter(Boolean),
  );
  emitHarnessStep(
    options.onHarnessSection,
    0,
    HARNESS_STEP_TITLES[0],
    "done",
    `Topic: ${topic}`,
  );

  emitHarnessStep(options.onHarnessSection, 1, HARNESS_STEP_TITLES[1], "start");
  const pickRes = await fetch(`${BACKEND_API_BASE}/api/gmb/pick-blog-post`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      siteUrl: site.siteUrl,
      username: site.username,
      appPassword: site.appPassword,
      keyword: topic,
      openRouterApiKey,
      excludeUrls: options.excludeBlogUrls ?? [],
      excludeGbpCtaUrls: options.excludeGbpCtaUrls ?? [],
      existingGbpPosts: options.existingGbpPosts ?? [],
      restrictToSitemapUrls,
    }),
  });
  const pickData = await pickRes.json().catch(() => ({}));
  if (!pickRes.ok || !pickData.success || !pickData.blogPost) {
    throw new Error(pickData?.error ?? pickRes.statusText ?? "Failed to pick blog post");
  }
  const blogPost: GbpLinkedBlog = {
    blogPostUrl: String(pickData.blogPost.blogPostUrl ?? ""),
    blogPostTitle: String(pickData.blogPost.blogPostTitle ?? ""),
    blogPostExcerpt:
      typeof pickData.blogPost.blogPostExcerpt === "string"
        ? pickData.blogPost.blogPostExcerpt
        : "",
    reason: typeof pickData.blogPost.reason === "string" ? pickData.blogPost.reason : "",
  };
  emitHarnessStep(
    options.onHarnessSection,
    1,
    HARNESS_STEP_TITLES[1],
    "done",
    `Linked page:\n${blogPost.blogPostTitle}\n${blogPost.blogPostUrl}`,
  );

  emitHarnessStep(options.onHarnessSection, 2, HARNESS_STEP_TITLES[2], "start");

  return { topic, blogPost };
}

export function completeGbpPostCardHarnessStep(
  onHarnessSection: ((payload: BulkHarnessSectionPayload) => void) | undefined,
  summary: string,
) {
  emitHarnessStep(
    onHarnessSection,
    2,
    HARNESS_STEP_TITLES[2],
    "done",
    summary.trim() ? `Post card:\n${summary.trim()}` : "Post card published.",
  );
}
