import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { BlogInternalLinkSpan } from "@/lib/overview/overview-blog-links-extract";
import {
  applyElementorPageHtmlToJson,
} from "@/lib/elementor-page-content/elementor-page-html";
import {
  parseElementorDataJson,
  parseElementorSectionOutline,
} from "@/lib/elementor-page-content/parse-elementor-section-outline";

export type BlogLinksRowPatch = {
  blogLinkList: BlogInternalLinkSpan[];
  blogLinksPlanJson: string;
  postContentOptimized: string;
  blogLinksRanAtIso: string;
  elementorSourceJson?: string;
};

export function blogLinksPatchToOverviewRow(patch: BlogLinksRowPatch): Partial<OverviewRow> {
  const elementorSourceJson = patch.elementorSourceJson?.trim();
  if (elementorSourceJson) {
    const nextJson = applyElementorPageHtmlToJson(elementorSourceJson, patch.postContentOptimized);
    const sectionHeaders = parseElementorSectionOutline(parseElementorDataJson(nextJson));
    return {
      blogLinkList: patch.blogLinkList.map((l) => ({ href: l.href, anchor: l.anchor })),
      blogLinksPlanJson: patch.blogLinksPlanJson,
      blogLinksRanAtIso: patch.blogLinksRanAtIso,
      contentFormat: "elementor",
      elementorDataJson: nextJson,
      elementorSectionHeaders: sectionHeaders,
      blogH2List: sectionHeaders.map((section) => section.title),
      status: "idle",
    };
  }

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
