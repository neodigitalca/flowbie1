import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { BlogInternalLinkSpan } from "@/lib/overview/overview-blog-links-extract";

export type BlogLinksRowPatch = {
  blogLinkList: BlogInternalLinkSpan[];
  blogLinksPlanJson: string;
  postContentOptimized: string;
  blogLinksRanAtIso: string;
};

export function blogLinksPatchToOverviewRow(patch: BlogLinksRowPatch): Partial<OverviewRow> {
  return {
    blogLinkList: patch.blogLinkList.map((l) => ({ href: l.href, anchor: l.anchor })),
    blogLinksPlanJson: patch.blogLinksPlanJson,
    postContent: patch.postContentOptimized,
    postContentOptimized: patch.postContentOptimized,
    blogLinksRanAtIso: patch.blogLinksRanAtIso,
    status: "idle",
  };
}

export const BLOG_LINKS_PROGRESS_KEY = "aiLinks" as const;
